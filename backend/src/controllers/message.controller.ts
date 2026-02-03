import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as messageService from '../services/message.service';
import { AuthedRequest } from '../middleware/auth.middleware';
import { filesToAttachmentInfos } from '../services/upload.service';

const attachmentSchema = z.object({ url: z.string().url(), filename: z.string(), mimeType: z.string(), size: z.number() });
const sendSchema = z.object({ content: z.string().min(1), mentions: z.array(z.string()).optional(), attachments: z.array(attachmentSchema).optional() });

export async function fetchMessagesHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const channelId = req.params.channelId;
    const conversationId = req.params.conversationId;
    const limit = Number(req.query.limit || 50);
    const cursor = req.query.cursor as string | undefined;
    const messages = await messageService.getMessages({ channelId, conversationId }, limit, cursor);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function sendMessageHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const channelId = req.params.channelId;
    const conversationId = req.params.conversationId;

    // if files were uploaded via multer, convert them to attachment infos
    let attachments = undefined as any;
    if ((req.files as Express.Multer.File[] | undefined)?.length) {
      attachments = filesToAttachmentInfos(req.files as Express.Multer.File[]);
    }

    const parsed = sendSchema.parse(req.body);

    // prefer attachments from multipart upload if present
    const finalAttachments = attachments ?? parsed.attachments;

    let msg;
    let result: any;
    if (channelId) {
      result = await messageService.createMessage(req.userId!, parsed.content, { channelId, mentions: parsed.mentions || [], attachments: finalAttachments });
    } else if (conversationId) {
      result = await messageService.createMessage(req.userId!, parsed.content, { conversationId, mentions: parsed.mentions || [], attachments: finalAttachments });
    } else {
      throw new Error('ChannelId or conversationId required');
    }
    res.json(result.message || result);
  } catch (err) {
    next(err);
  }
}

export async function editMessageHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const messageId = req.params.id;
    const attachmentSchema = z.object({ url: z.string().url(), filename: z.string(), mimeType: z.string(), size: z.number() });
    const parsed = z.object({ content: z.string().min(1), mentions: z.array(z.string()).optional(), attachments: z.array(attachmentSchema).optional() }).parse(req.body);
    const updated = await messageService.editMessage(messageId, req.userId!, parsed.content, parsed.mentions || [], parsed.attachments || []);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteMessageHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    await messageService.deleteMessage(id, req.userId!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function addReactionHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const { emoji } = z.object({ emoji: z.string().min(1) }).parse(req.body);
    const updated = await messageService.addReaction(id, req.userId!, emoji);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function removeReactionHandler(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    const { emoji } = z.object({ emoji: z.string().min(1) }).parse(req.body);
    const updated = await messageService.removeReaction(id, req.userId!, emoji);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
