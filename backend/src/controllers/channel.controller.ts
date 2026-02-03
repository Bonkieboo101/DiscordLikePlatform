import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as channelService from '../services/channel.service';
import { AuthedRequest } from '../middleware/auth.middleware';

const createSchema = z.object({ name: z.string().min(1), type: z.enum(['TEXT','VOICE','ANNOUNCEMENT']).optional(), topic: z.string().optional() });

export async function createChannelHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId;
    const parsed = createSchema.parse(req.body);
    // check membership
    const membership = await (await import('../services/workspace.service')).getWorkspaceById(workspaceId);
    if (!membership) return res.status(404).json({ error: 'Workspace not found' });
    const isMember = membership.members.some((m: any) => m.userId === req.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member of workspace' });

    const ch = await channelService.createChannel(workspaceId, parsed.name, parsed.type || 'TEXT', parsed.topic);
    res.json(ch);
  } catch (err) {
    next(err);
  }
}

export async function listChannelsHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId;
    const ws = await (await import('../services/workspace.service')).getWorkspaceById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const isMember = ws.members.some((m: any) => m.userId === req.userId);
    if (!isMember) return res.status(403).json({ error: 'Not a member of workspace' });

    const list = await channelService.getChannelsByWorkspace(workspaceId);
    res.json(list);
  } catch (err) {
    next(err);
  }
}

export async function updateChannelHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const parsed = z.object({ name: z.string().optional(), topic: z.string().optional() }).parse(req.body);
    const updated = await channelService.updateChannel(id, parsed);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteChannelHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    await channelService.deleteChannel(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
