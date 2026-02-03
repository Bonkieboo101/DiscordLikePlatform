import { Server, Socket } from 'socket.io';
import { verifyToken } from './services/auth.service';
import { PrismaClient } from '@prisma/client';
import * as messageService from './services/message.service';
import * as workspaceService from './services/workspace.service';
import { z } from 'zod';
import logger from './logger';
import { SEND_MESSAGE_LIMIT, SEND_WINDOW_MS, EDIT_MESSAGE_LIMIT, EDIT_WINDOW_MS } from './config/rateLimitConfig';
import { createRateLimiter } from './utils/rateLimiter';

const prisma = new PrismaClient();

// Map userId -> set of socket ids
const userSockets = new Map<string, Set<string>>();

let ioServer: Server | null = null;

export async function broadcastStatusUpdate(userId: string, status?: string | null, customStatus?: string | null) {
  if (!ioServer) return;
  const memberships = await prisma.workspaceMember.findMany({ where: { userId } });
  memberships.forEach((m) => ioServer!.to(`workspace:${m.workspaceId}`).emit('statusUpdate', { userId, status, customStatus }));
}

export async function broadcastUnreadUpdate(payload: { channelId?: string; conversationId?: string; newCount?: number }) {
  if (!ioServer) return;
  if (payload.channelId) {
    const ch = await prisma.channel.findUnique({ where: { id: payload.channelId } });
    ioServer.to(`channel:${payload.channelId}`).emit('unreadCountsUpdated', { channelId: payload.channelId, unreadCount: payload.newCount ?? ch?.unreadCount ?? 0 });
  } else if (payload.conversationId) {
    const conv = await prisma.dMConversation.findUnique({ where: { id: payload.conversationId } });
    ioServer.to(`dm:${payload.conversationId}`).emit('unreadCountsUpdated', { conversationId: payload.conversationId, unreadCount: payload.newCount ?? conv?.unreadCount ?? 0 });
  }
}

export function initSocket(io: Server) {
  ioServer = io;
  // middleware to authenticate and attach user
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next();
      const payload = verifyToken(token);
      if (!payload) return next();
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user) {
        socket.data.user = { id: user.id, email: user.email, name: user.name };
        // mark online
        await prisma.user.update({ where: { id: user.id }, data: { isOnline: true } });
        // join workspace rooms for presence broadcasts
        const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id } });
        memberships.forEach((m) => socket.join(`workspace:${m.workspaceId}`));
        // track sockets
        const set = userSockets.get(user.id) ?? new Set<string>();
        set.add(socket.id);
        userSockets.set(user.id, set);
      }
      next();
    } catch (err) {
      next(err as any);
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`socket connected ${socket.id} user:${socket.data.user?.id || 'anon'}`);
    socket.emit('connected', { socketId: socket.id, user: socket.data.user || null });

    // rate limiter instance per socket
    const rateLimiter = createRateLimiter();

    socket.on('joinChannel', async (payload: { channelId: string }) => {
      try {
        const schema = z.object({ channelId: z.string().min(1) });
        const p = schema.parse(payload);
        // check membership
        const channel = await prisma.channel.findUnique({ where: { id: p.channelId }, include: { workspace: true } });
        if (!channel) return socket.emit('error', { message: 'Channel not found' });
        const ws = await workspaceService.getWorkspaceById(channel.workspaceId);
        const isMember = ws?.members.some((m: any) => m.userId === socket.data.user?.id);
        if (!isMember) return socket.emit('error', { message: 'Not a member' });
        socket.join(`channel:${p.channelId}`);
        socket.emit('joinedChannel', { channelId: p.channelId });
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('leaveChannel', (payload: { channelId: string }) => {
      if (!payload?.channelId) return;
      socket.leave(`channel:${payload.channelId}`);
      socket.emit('leftChannel', { channelId: payload.channelId });
    });

    socket.on('joinDM', async (payload: { conversationId: string }) => {
      try {
        const schema = z.object({ conversationId: z.string().min(1) });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        const participant = await prisma.dMParticipant.findFirst({ where: { conversationId: p.conversationId, userId: socket.data.user.id } });
        if (!participant) return socket.emit('error', { message: 'Not a participant' });
        socket.join(`dm:${p.conversationId}`);
        socket.emit('joinedDM', { conversationId: p.conversationId });
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('leaveDM', (payload: { conversationId: string }) => {
      if (!payload?.conversationId) return;
      socket.leave(`dm:${payload.conversationId}`);
      socket.emit('leftDM', { conversationId: payload.conversationId });
    });

    socket.on('sendMessage', async (payload: any) => {
      try {
        if (!rateLimiter.allow('sendMessage', SEND_MESSAGE_LIMIT, SEND_WINDOW_MS)) {
          logger.warn(`rate limit exceeded: sendMessage socket=${socket.id} user=${socket.data.user?.id || 'anon'}`);
          return socket.emit('error', { message: 'Rate limit exceeded' });
        }
        const schema = z.object({ channelId: z.string().optional(), conversationId: z.string().optional(), content: z.string().min(1), mentions: z.array(z.string()).optional(), attachments: z.array(z.object({ url: z.string().url(), filename: z.string(), mimeType: z.string(), size: z.number() })).optional() });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        let msg;
        if (p.channelId) {
          const res = await messageService.createMessage(socket.data.user.id, p.content, { channelId: p.channelId, mentions: p.mentions || [], attachments: p.attachments || [] });
          const msgObj = res.message || res;
          io.to(`channel:${p.channelId}`).emit('messageCreated', msgObj);

          // emit mention notifications
          if (msgObj.mentions && msgObj.mentions.length) {
            for (const m of msgObj.mentions) {
              const sockets = userSockets.get(m.userId);
              if (sockets) sockets.forEach((sid) => io.to(sid).emit('notification', { type: 'mention', message: msgObj }));
            }
          }

          // calculate which recipients are NOT currently in the channel room (so they should get unread increment)
          const socketsInRoom = await io.in(`channel:${p.channelId}`).fetchSockets();
          const presentUserIds = new Set<string>(socketsInRoom.map((s) => s.data.user?.id).filter(Boolean));
          let missing = 0;
          for (const uid of res.affectedUserIds || []) {
            if (!presentUserIds.has(uid)) {
              missing += 1;
              const sockets = userSockets.get(uid);
              if (sockets) sockets.forEach((sid) => io.to(sid).emit('unreadIncrement', { channelId: p.channelId }));
            }
          }
          if (missing > 0) {
            // increment aggregate unreadCount for the channel
            const updated = await prisma.channel.update({ where: { id: p.channelId }, data: { unreadCount: { increment: missing } } });
            // broadcast updated aggregate count to channel
            await broadcastUnreadUpdate({ channelId: p.channelId, newCount: updated.unreadCount });
          }
        } else if (p.conversationId) {
          const res = await messageService.createMessage(socket.data.user.id, p.content, { conversationId: p.conversationId, mentions: p.mentions || [], attachments: p.attachments || [] });
          const msgObj = res.message || res;
          io.to(`dm:${p.conversationId}`).emit('messageCreated', msgObj);

          // mention notifications
          if (msgObj.mentions && msgObj.mentions.length) {
            for (const m of msgObj.mentions) {
              const sockets = userSockets.get(m.userId);
              if (sockets) sockets.forEach((sid) => io.to(sid).emit('notification', { type: 'mention', message: msgObj }));
            }
          }

          const socketsInRoom = await io.in(`dm:${p.conversationId}`).fetchSockets();
          const presentUserIds = new Set<string>(socketsInRoom.map((s) => s.data.user?.id).filter(Boolean));
          let missing = 0;
          for (const uid of res.affectedUserIds || []) {
            if (!presentUserIds.has(uid)) {
              missing += 1;
              const sockets = userSockets.get(uid);
              if (sockets) sockets.forEach((sid) => io.to(sid).emit('unreadIncrement', { conversationId: p.conversationId }));
            }
          }
          if (missing > 0) {
            const updated = await prisma.dMConversation.update({ where: { id: p.conversationId }, data: { unreadCount: { increment: missing } } });
            await broadcastUnreadUpdate({ conversationId: p.conversationId, newCount: updated.unreadCount });
          }
        } else {
          return socket.emit('error', { message: 'channelId or conversationId required' });
        }


      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('editMessage', async (payload: any) => {
      try {
        if (!rateLimiter.allow('editMessage', EDIT_MESSAGE_LIMIT, EDIT_WINDOW_MS)) {
          logger.warn(`rate limit exceeded: editMessage socket=${socket.id} user=${socket.data.user?.id || 'anon'}`);
          return socket.emit('error', { message: 'Rate limit exceeded' });
        }
        const schema = z.object({ messageId: z.string().min(1), content: z.string().min(1), mentions: z.array(z.string()).optional(), attachments: z.array(z.object({ url: z.string().url(), filename: z.string(), mimeType: z.string(), size: z.number() })).optional() });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        const updated = await messageService.editMessage(p.messageId, socket.data.user.id, p.content, p.mentions || [], p.attachments || []);
        if (updated.channelId) io.to(`channel:${updated.channelId}`).emit('messageUpdated', updated);
        else if (updated.conversationId) io.to(`dm:${updated.conversationId}`).emit('messageUpdated', updated);
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('deleteMessage', async (payload: any) => {
      try {
        if (!rateLimiter.allow('deleteMessage', 20, 10000)) {
          logger.warn(`rate limit exceeded: deleteMessage socket=${socket.id} user=${socket.data.user?.id || 'anon'}`);
          return socket.emit('error', { message: 'Rate limit exceeded' });
        }
        const schema = z.object({ messageId: z.string().min(1) });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        const deleted = await messageService.deleteMessage(p.messageId, socket.data.user.id);
        if (deleted.channelId) io.to(`channel:${deleted.channelId}`).emit('messageDeleted', { id: deleted.id });
        else if (deleted.conversationId) io.to(`dm:${deleted.conversationId}`).emit('messageDeleted', { id: deleted.id });
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('typing', (payload: any) => {
      try {
        if (!rateLimiter.allow('typing', 30, 5000)) return;
        const schema = z.object({ channelId: z.string().optional(), conversationId: z.string().optional(), isTyping: z.boolean() });
        const p = schema.parse(payload);
        if (!socket.data.user) return;
        if (p.channelId) socket.to(`channel:${p.channelId}`).emit('typing', { user: socket.data.user, isTyping: p.isTyping, channelId: p.channelId });
        else if (p.conversationId) socket.to(`dm:${p.conversationId}`).emit('typing', { user: socket.data.user, isTyping: p.isTyping, conversationId: p.conversationId });
      } catch (err) {
        // ignore invalid typing events
      }
    });

    socket.on('markAsRead', async (payload:any) => {
      try {
        const schema = z.object({ channelId: z.string().optional(), conversationId: z.string().optional() });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        if (p.channelId) {
          const result = await (await import('./services/unread.service')).markChannelRead(socket.data.user.id, p.channelId);
          await broadcastUnreadUpdate({ channelId: p.channelId, newCount: result.newCount });
        } else if (p.conversationId) {
          const result = await (await import('./services/unread.service')).markConversationRead(socket.data.user.id, p.conversationId);
          await broadcastUnreadUpdate({ conversationId: p.conversationId, newCount: result.newCount });
        }
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('addReaction', async (payload: any) => {
      try {
        const schema = z.object({ messageId: z.string().min(1), emoji: z.string().min(1) });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        const updated = await messageService.addReaction(p.messageId, socket.data.user.id, p.emoji);
        if (updated.channelId) io.to(`channel:${updated.channelId}`).emit('messageUpdated', updated);
        else if (updated.conversationId) io.to(`dm:${updated.conversationId}`).emit('messageUpdated', updated);
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('setStatus', async (payload: any) => {
      try {
        const schema = z.object({ status: z.enum(['ONLINE','AWAY','OFFLINE','CUSTOM']).optional(), customStatus: z.string().optional() });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        const updated = await prisma.user.update({ where: { id: socket.data.user.id }, data: { status: p.status, customStatus: p.customStatus } });
        await broadcastStatusUpdate(updated.id, updated.status, updated.customStatus);
        socket.emit('statusSet', { status: updated.status, customStatus: updated.customStatus });
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('removeReaction', async (payload: any) => {
      try {
        const schema = z.object({ messageId: z.string().min(1), emoji: z.string().min(1) });
        const p = schema.parse(payload);
        if (!socket.data.user) return socket.emit('error', { message: 'Not authenticated' });
        const updated = await messageService.removeReaction(p.messageId, socket.data.user.id, p.emoji);
        if (updated.channelId) io.to(`channel:${updated.channelId}`).emit('messageUpdated', updated);
        else if (updated.conversationId) io.to(`dm:${updated.conversationId}`).emit('messageUpdated', updated);
      } catch (err) {
        socket.emit('error', { message: (err as any).message });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const uid = socket.data.user?.id as string | undefined;
        if (uid) {
          // remove socket id and clean up if no more sockets for user
          const set = userSockets.get(uid);
          if (set) {
            set.delete(socket.id);
            if (set.size === 0) {
              userSockets.delete(uid);
              // set offline
              await prisma.user.update({ where: { id: uid }, data: { isOnline: false, lastSeen: new Date() } });
              // broadcast presence update to workspaces
              const memberships = await prisma.workspaceMember.findMany({ where: { userId: uid } });
              memberships.forEach((m) => io.to(`workspace:${m.workspaceId}`).emit('presenceUpdate', { userId: uid, isOnline: false }));
            } else {
              userSockets.set(uid, set);
            }
          }
        }
        logger.info(`socket disconnected ${socket.id} user:${uid || 'anon'}`);
      } catch (err) {
        logger.error('disconnect error', (err as any).stack || err);
      }
    });
  });
}
