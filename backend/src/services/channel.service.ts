import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createChannel(workspaceId: string, name: string, type: string = 'TEXT', topic?: string) {
  return prisma.channel.create({ data: { name, type, topic, workspaceId } });
}

export async function getChannelsByWorkspace(workspaceId: string) {
  return prisma.channel.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
}

export async function getChannelById(id: string) {
  return prisma.channel.findUnique({ where: { id } });
}

export async function updateChannel(id: string, data: { name?: string; topic?: string }) {
  return prisma.channel.update({ where: { id }, data });
}

export async function deleteChannel(id: string) {
  return prisma.channel.delete({ where: { id } });
}
