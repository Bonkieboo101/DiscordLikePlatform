import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as msgCtrl from '../controllers/message.controller';

const router = express.Router();

router.use(requireAuth);

router.get('/workspaces/:workspaceId/channels/:channelId/messages', msgCtrl.fetchMessagesHandler);
import { multerUpload } from '../services/upload.service';

router.post('/workspaces/:workspaceId/channels/:channelId/messages', multerUpload.array('files'), msgCtrl.sendMessageHandler);

// Direct messages
router.get('/dms/:conversationId/messages', msgCtrl.fetchMessagesHandler);
router.post('/dms/:conversationId/messages', multerUpload.array('files'), msgCtrl.sendMessageHandler);

router.patch('/messages/:id', msgCtrl.editMessageHandler);
router.delete('/messages/:id', msgCtrl.deleteMessageHandler);
router.post('/messages/:id/reactions', msgCtrl.addReactionHandler);
router.delete('/messages/:id/reactions', msgCtrl.removeReactionHandler);

export default router;