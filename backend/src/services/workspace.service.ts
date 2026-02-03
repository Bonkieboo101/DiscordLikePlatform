import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

export async function createWorkspace(ownerId: string, name: string, description?: string, iconUrl?: string) {
  const slug = await generateUniqueSlug(name);
  const workspace = await prisma.workspace.create({
    data: { name, slug, description, iconUrl, ownerId, members: { create: { userId: ownerId, role: 'owner' } } },
    include: { members: true }
  });
  return workspace;
}

export async function getWorkspacesForUser(userId: string) {
  // find workspaces where user is a member
  const memberships = await prisma.workspaceMember.findMany({ where: { userId }, include: { workspace: true } });
  return memberships.map((m) => m.workspace);
}

export async function getWorkspaceById(id: string) {
  return prisma.workspace.findUnique({ where: { id }, include: { members: { include: { user: true } }, channels: true } });
}

export async function updateWorkspace(id: string, data: { name?: string; description?: string; iconUrl?: string }) {
  const updateData: any = { ...data };
  if (data.name) updateData.slug = await generateUniqueSlug(data.name);
  return prisma.workspace.update({ where: { id }, data: updateData });
}

export async function deleteWorkspace(id: string) {
  // cascade deletes via Prisma relations if configured; to be safe, remove members and channels first
  await prisma.channel.deleteMany({ where: { workspaceId: id } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: id } });
  return prisma.workspace.delete({ where: { id } });
}

export async function addMemberToWorkspace(workspaceId: string, userId: string, role = 'member') {
  return prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

async function generateUniqueSlug(name: string) {
  let base = slugify(name, { lower: true, strict: true }).slice(0, 40) || 'w';
  let slug = base;
  let i = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}
