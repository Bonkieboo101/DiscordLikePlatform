import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createConversation(creatorId: string, participantIds: string[], name?: string, isGroup = false) {
  // ensure unique participants and include creator
  const unique = Array.from(new Set([creatorId, ...participantIds]));

  // if one-to-one DM, try to find existing conversation between the two
  if (!isGroup && unique.length === 2) {
    const otherId = unique.find((id) => id !== creatorId)!;
    const myParts = await prisma.dMParticipant.findMany({ where: { userId: creatorId } });
    const convIds = myParts.map((p) => p.conversationId);
    for (const cid of convIds) {
      const participants = await prisma.dMParticipant.findMany({ where: { conversationId: cid } });
      const ids = participants.map((p) => p.userId);
      if (ids.length === 2 && ids.includes(otherId)) {
        return prisma.dMConversation.findUnique({ where: { id: cid }, include: { participants: { include: { user: true } } } });
      }
    }
  }

  const conv = await prisma.dMConversation.create({ data: { name, isGroup } });
  const partCreates = unique.map((userId) => ({ conversationId: conv.id, userId }));
  await prisma.dMParticipant.createMany({ data: partCreates, skipDuplicates: true });
  return prisma.dMConversation.findUnique({ where: { id: conv.id }, include: { participants: { include: { user: true } } } });
}

export async function getConversationsForUser(userId: string) {
  const parts = await prisma.dMParticipant.findMany({ where: { userId }, include: { conversation: { include: { participants: { include: { user: true } } } } }, orderBy: { conversation: { lastMessageAt: 'desc' } } });
  return parts.map((p) => p.conversation);
}

export async function getConversationById(conversationId: string, userId: string) {
  const conv = await prisma.dMConversation.findUnique({ where: { id: conversationId }, include: { participants: { include: { user: true } } } });
  if (!conv) throw new Error('Conversation not found');
  const isParticipant = conv.participants.some((p) => p.userId === userId);
  if (!isParticipant) throw new Error('Not a participant');
  return conv;
}
