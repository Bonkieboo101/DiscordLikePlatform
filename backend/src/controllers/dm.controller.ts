import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as dmService from '../services/dm.service';
import { AuthedRequest } from '../middleware/auth.middleware';

const createSchema = z.object({ participantIds: z.array(z.string()).min(1), name: z.string().optional(), isGroup: z.boolean().optional() });

export async function createConversationHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = createSchema.parse(req.body);
    const conv = await dmService.createConversation(req.userId!, parsed.participantIds, parsed.name, parsed.isGroup || false);
    res.json(conv);
  } catch (err) {
    next(err);
  }
}

export async function listConversationsHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const convs = await dmService.getConversationsForUser(req.userId!);
    res.json(convs);
  } catch (err) {
    next(err);
  }
}

export async function getConversationHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const conv = await dmService.getConversationById(id, req.userId!);
    res.json(conv);
  } catch (err) {
    next(err);
  }
}
