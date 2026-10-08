import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { handleImageUpload, handleProofImagesUpload } from '../middleware/upload.js';
import {
  createReport,
  getMapFeed,
  getIssueDetails,
  submitAction,
  toggleLike,
  addComment,
  appealIssue,
  updateIssue,
  deleteIssue,
  getMyReports,
} from '../controllers/report.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getMapFeed);
router.get('/mine', getMyReports);
router.get('/:id', getIssueDetails);

router.post('/', handleProofImagesUpload, createReport);
router.post('/:id/action', handleImageUpload, submitAction);
router.post('/:id/like', toggleLike);
router.post('/:id/comment', addComment);
router.post('/:id/appeal', handleProofImagesUpload, appealIssue);

router.put('/:id', updateIssue);
router.delete('/:id', deleteIssue);

export default router;
