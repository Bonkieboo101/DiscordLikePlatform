import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = express.Router();

router.get('/users/:id', requireAuth, async (req, res) => {
  const prisma = (await import('@prisma/client')).PrismaClient ? new (await import('@prisma/client')).PrismaClient() : null;
  const user = await prisma?.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.patch('/users/:id/status', requireAuth, async (req, res) => {
  const schema = z.object({ isOnline: z.boolean().optional(), lastSeen: z.string().optional(), status: z.enum(['ONLINE','AWAY','OFFLINE','CUSTOM']).optional(), customStatus: z.string().optional() });
  const parsed = schema.parse(req.body);
  const prisma = (await import('@prisma/client')).PrismaClient ? new (await import('@prisma/client')).PrismaClient() : null;
  const updated = await prisma?.user.update({ where: { id: req.params.id }, data: { isOnline: parsed.isOnline, lastSeen: parsed.lastSeen ? new Date(parsed.lastSeen) : undefined, status: parsed.status, customStatus: parsed.customStatus } });
  // broadcast status change to workspaces if possible
  try {
    const socketMod = await import('../socket');
    if (socketMod && socketMod.broadcastStatusUpdate) await socketMod.broadcastStatusUpdate(updated!.id, updated!.status, updated!.customStatus);
  } catch (err) {
    // non-fatal
    console.warn('status broadcast failed', err);
  }
  res.json(updated);
});

export default router;