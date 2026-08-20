import express from 'express';
import { triggerReport, previewReport } from '../controllers/reportController.js';
import { getSubmissions, getSubmission, checkSubmissionStatus } from '../controllers/submissionController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Apply authenticate to individual routes
router.post('/reports/:reportKey/trigger', authenticate, triggerReport);
router.get('/reports/:reportKey/preview', authenticate, previewReport);

router.get('/submissions', authenticate, getSubmissions);
router.get('/submissions/:id', authenticate, getSubmission);
router.post('/submissions/:id/check-status', authenticate, checkSubmissionStatus);

export default router;