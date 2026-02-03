import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as dmCtrl from '../controllers/dm.controller';

const router = express.Router();
router.use(requireAuth);

router.post('/dms', dmCtrl.createConversationHandler);
router.get('/dms', dmCtrl.listConversationsHandler);
router.get('/dms/:id', dmCtrl.getConversationHandler);

export default router;
