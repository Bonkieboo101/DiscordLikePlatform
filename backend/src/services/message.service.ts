import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createMessage(authorId: string, content: string, opts: { channelId?: string; conversationId?: string; mentions?: string[]; attachments?: { url: string; filename: string; mimeType: string; size: number }[]; reactions?: any }) {
  const { channelId, conversationId } = opts;
  if (!channelId && !conversationId) throw new Error('channelId or conversationId required');
  let mentions = opts.mentions || [];

  // parse mentions from content if none provided
  if ((!mentions || mentions.length === 0) && /@\w+/.test(content)) {
    const names = Array.from(content.matchAll(/@(\w+)/g)).map((m) => m[1]);
    if (names.length) {
      if (channelId) {
        // find users in the channel's workspace with those names
        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (channel) {
          const members = await prisma.workspaceMember.findMany({ where: { workspaceId: channel.workspaceId } });
          const memberIds = members.map((m) => m.userId);
          const users = await prisma.user.findMany({ where: { id: { in: memberIds }, AND: [{ name: { in: names } }] } });
          mentions = users.map((u) => u.id);
        }
      } else if (conversationId) {
        // find users in the DM conversation with those names
        const participants = await prisma.dmParticipant.findMany({ where: { conversationId } });
        const participantIds = participants.map((p) => p.userId);
        const users = await prisma.user.findMany({ where: { id: { in: participantIds }, AND: [{ name: { in: names } }] } });
        mentions = users.map((u) => u.id);
      }
    }
  }

  const msg = await prisma.message.create({
    data: {
      content,
      authorId,
      channelId: channelId ? channelId : undefined,
      conversationId: conversationId ? conversationId : undefined,
      reactions: opts.reactions ? opts.reactions : undefined
    }
  });

  // persist attachments if any
  if (opts.attachments && opts.attachments.length > 0) {
    const attachCreates = opts.attachments.map((a) => ({ messageId: msg.id, url: a.url, filename: a.filename, mimeType: a.mimeType, size: a.size }));
    await prisma.attachment.createMany({ data: attachCreates, skipDuplicates: true });
  }

  if (mentions && mentions.length > 0) {
    const mentionCreates = mentions.map((userId) => ({ messageId: msg.id, userId }));
    await prisma.messageMention.createMany({ data: mentionCreates, skipDuplicates: true });
  }

  // update lastMessageAt on conversation if applicable
  const affectedUserIds: string[] = [];
  if (conversationId) {
    await prisma.dMConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
    const participants = await prisma.dMParticipant.findMany({ where: { conversationId } });
    for (const p of participants) {
      if (p.userId === authorId) continue;
      affectedUserIds.push(p.userId);
      await prisma.unread.upsert({
        where: { userId_channelId_conversationId: { userId: p.userId, channelId: null, conversationId } },
        create: { userId: p.userId, conversationId, count: 1 },
        update: { count: { increment: 1 } }
      });
    }
  }

  if (channelId) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (channel) {
      const members = await prisma.workspaceMember.findMany({ where: { workspaceId: channel.workspaceId } });
      for (const m of members) {
        if (m.userId === authorId) continue;
        affectedUserIds.push(m.userId);
        await prisma.unread.upsert({
          where: { userId_channelId_conversationId: { userId: m.userId, channelId, conversationId: null } },
          create: { userId: m.userId, channelId, count: 1 },
          update: { count: { increment: 1 } }
        });
      }
    }
  }

  const full = await prisma.message.findUnique({ where: { id: msg.id }, include: { author: true, mentions: { include: { user: true } }, attachments: true } });
  return { message: full, affectedUserIds };
}

export async function editMessage(messageId: string, editorId: string, content: string, mentions: string[] = [], attachments: { url: string; filename: string; mimeType: string; size: number }[] = []) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');
  if (msg.authorId !== editorId) throw new Error('Not allowed');
  const updated = await prisma.message.update({ where: { id: messageId }, data: { content, editedAt: new Date() } });

  // update mentions
  await prisma.messageMention.deleteMany({ where: { messageId } });
  if (mentions && mentions.length > 0) {
    const mentionCreates = mentions.map((userId) => ({ messageId, userId }));
    await prisma.messageMention.createMany({ data: mentionCreates, skipDuplicates: true });
  }

  // replace attachments
  await prisma.attachment.deleteMany({ where: { messageId } });
  if (attachments && attachments.length > 0) {
    const attachCreates = attachments.map((a) => ({ messageId, url: a.url, filename: a.filename, mimeType: a.mimeType, size: a.size }));
    await prisma.attachment.createMany({ data: attachCreates, skipDuplicates: true });
  }

  return prisma.message.findUnique({ where: { id: updated.id }, include: { author: true, mentions: { include: { user: true } }, attachments: true } });
}

export async function deleteMessage(messageId: string, requesterId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');
  if (msg.authorId !== requesterId) throw new Error('Not allowed');
  const updated = await prisma.message.update({ where: { id: messageId }, data: { deleted: true } });
  return updated;
}

export async function getMessages(opts: { channelId?: string; conversationId?: string }, limit = 50, cursor?: string) {
  const where: any = {};
  if (opts.channelId) where.channelId = opts.channelId;
  else if (opts.conversationId) where.conversationId = opts.conversationId;
  else throw new Error('Either channelId or conversationId is required');

  let messages;
  if (cursor) {
    messages = await prisma.message.findMany({
      where,
      take: limit,
      skip: 0,
      orderBy: { createdAt: 'desc' },
      cursor: { id: cursor },
      include: { author: true, mentions: { include: { user: true } } }
    });
  } else {
    messages = await prisma.message.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, include: { author: true, mentions: { include: { user: true } } } });
  }
  return messages;
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');
  const reactions = (msg.reactions as any) || {};
  const users = new Set(reactions[emoji] || []);
  users.add(userId);
  reactions[emoji] = Array.from(users);
  const updated = await prisma.message.update({ where: { id: messageId }, data: { reactions } });
  return updated;
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Message not found');
  const reactions = (msg.reactions as any) || {};
  const users = new Set(reactions[emoji] || []);
  users.delete(userId);
  if (users.size === 0) delete reactions[emoji];
  else reactions[emoji] = Array.from(users);
  const updated = await prisma.message.update({ where: { id: messageId }, data: { reactions } });
  return updated;
}
