import { Request, Response, NextFunction } from 'express';
import * as unreadService from '../services/unread.service';
import { AuthedRequest } from '../middleware/auth.middleware';

export async function resetChannelUnreadHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const channelId = req.params.channelId;
    const result = await unreadService.markChannelRead(userId, channelId);
    // broadcast to room that counts changed
    try { const socketMod = await import('../socket'); if (socketMod && socketMod.broadcastUnreadUpdate) socketMod.broadcastUnreadUpdate({ channelId, newCount: result.newCount }); } catch (e) {}
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function resetConversationUnreadHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const conversationId = req.params.id;
    const result = await unreadService.markConversationRead(userId, conversationId);
    try { const socketMod = await import('../socket'); if (socketMod && socketMod.broadcastUnreadUpdate) socketMod.broadcastUnreadUpdate({ conversationId, newCount: result.newCount }); } catch (e) {}
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadsHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const rows = await unreadService.getUnreadsForUser(userId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
