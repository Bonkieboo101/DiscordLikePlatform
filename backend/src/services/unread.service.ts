import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function resetChannelUnread(userId: string, channelId: string) {
  // return previous count so caller can update aggregate unreadCount
  const prev = await prisma.unread.findUnique({ where: { userId_channelId_conversationId: { userId, channelId, conversationId: null } } });
  await prisma.unread.upsert({
    where: { userId_channelId_conversationId: { userId, channelId, conversationId: null } },
    create: { userId, channelId, count: 0 },
    update: { count: 0 }
  });
  return prev?.count || 0;
}

export async function resetConversationUnread(userId: string, conversationId: string) {
  const prev = await prisma.unread.findUnique({ where: { userId_channelId_conversationId: { userId, channelId: null, conversationId } } });
  await prisma.unread.upsert({
    where: { userId_channelId_conversationId: { userId, channelId: null, conversationId } },
    create: { userId, conversationId, count: 0 },
    update: { count: 0 }
  });
  return prev?.count || 0;
}

export async function getUnreadsForUser(userId: string) {
  return prisma.unread.findMany({ where: { userId } });
}

export async function markChannelRead(userId: string, channelId: string) {
  const prev = await resetChannelUnread(userId, channelId);
  if (prev <= 0) return { prev: 0, newCount: 0 };
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const newCount = Math.max(0, (ch?.unreadCount || 0) - prev);
  await prisma.channel.update({ where: { id: channelId }, data: { unreadCount: newCount } });
  return { prev, newCount };
}

export async function markConversationRead(userId: string, conversationId: string) {
  const prev = await resetConversationUnread(userId, conversationId);
  if (prev <= 0) return { prev: 0, newCount: 0 };
  const conv = await prisma.dMConversation.findUnique({ where: { id: conversationId } });
  const newCount = Math.max(0, (conv?.unreadCount || 0) - prev);
  await prisma.dMConversation.update({ where: { id: conversationId }, data: { unreadCount: newCount } });
  return { prev, newCount };
}
