import express from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as workspaceCtrl from '../controllers/workspace.controller';

const router = express.Router();

router.use(requireAuth);

router.post('/', workspaceCtrl.createWorkspaceHandler);
router.get('/', workspaceCtrl.listWorkspacesHandler);
router.get('/:id', workspaceCtrl.getWorkspaceHandler);
router.patch('/:id', workspaceCtrl.updateWorkspaceHandler);
router.delete('/:id', workspaceCtrl.deleteWorkspaceHandler);
router.post('/:id/members', workspaceCtrl.addMemberHandler);
router.get('/:id/members', workspaceCtrl.listMembersHandler);

export default router;
