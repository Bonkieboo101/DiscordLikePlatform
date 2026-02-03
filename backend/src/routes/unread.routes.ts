import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as unreadCtrl from '../controllers/unread.controller';

const router = express.Router();
router.use(requireAuth);

router.post('/workspaces/:workspaceId/channels/:channelId/read', unreadCtrl.resetChannelUnreadHandler);
router.post('/dms/:id/read', unreadCtrl.resetConversationUnreadHandler);
router.get('/unreads', unreadCtrl.getUnreadsHandler);

export default router;
