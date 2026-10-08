import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  getAdminFeed,
  getAdminStats,
  getAdminIssueDetails,
  markIssueNotFound,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(authenticateToken, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/stats', getAdminStats);
router.get('/issues', getAdminFeed);
router.get('/issues/:id', getAdminIssueDetails);
router.post('/issues/:id/not-found', markIssueNotFound);

export default router;
