import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as workspaceService from '../services/workspace.service';
import { AuthedRequest } from '../middleware/auth.middleware';

const createSchema = z.object({ name: z.string().min(2), description: z.string().optional(), iconUrl: z.string().optional() });

export async function createWorkspaceHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = createSchema.parse(req.body);
    const ws = await workspaceService.createWorkspace(req.userId!, parsed.name, parsed.description, parsed.iconUrl);
    res.json(ws);
  } catch (err) {
    next(err);
  }
}

export async function listWorkspacesHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const list = await workspaceService.getWorkspacesForUser(req.userId!);
    res.json(list);
  } catch (err) {
    next(err);
  }
}

export async function getWorkspaceHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const ws = await workspaceService.getWorkspaceById(id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (err) {
    next(err);
  }
}

export async function listMembersHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const ws = await workspaceService.getWorkspaceById(id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws.members.map((m:any)=>m.user));
  } catch (err) {
    next(err);
  }
}

const updateSchema = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), iconUrl: z.string().optional() });

export async function updateWorkspaceHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const parsed = updateSchema.parse(req.body);

    // ownership check
    const ws = await workspaceService.getWorkspaceById(id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can update workspace' });

    const updated = await workspaceService.updateWorkspace(id, parsed);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkspaceHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const ws = await workspaceService.getWorkspaceById(id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can delete workspace' });

    await workspaceService.deleteWorkspace(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

const addMemberSchema = z.object({ userId: z.string() });
export async function addMemberHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.id;
    const parsed = addMemberSchema.parse(req.body);
    const ws = await workspaceService.getWorkspaceById(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can add members' });
    const member = await workspaceService.addMemberToWorkspace(workspaceId, parsed.userId);
    res.json(member);
  } catch (err) {
    next(err);
  }
}
