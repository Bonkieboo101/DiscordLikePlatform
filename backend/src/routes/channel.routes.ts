import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as channelCtrl from '../controllers/channel.controller';

const router = express.Router();

router.use(requireAuth);

// channels nested under workspace
router.post('/workspaces/:workspaceId/channels', channelCtrl.createChannelHandler);
router.get('/workspaces/:workspaceId/channels', channelCtrl.listChannelsHandler);

// channel operations by id
router.patch('/channels/:id', channelCtrl.updateChannelHandler);
router.delete('/channels/:id', channelCtrl.deleteChannelHandler);

export default router;
