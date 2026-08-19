import express from 'express';
import { triggerReport, previewReport } from '../controllers/reportController.js';
import { getSubmissions, getSubmission, checkSubmissionStatus } from '../controllers/submissionController.js';

const router = express.Router();

// Report routes
router.post('/reports/:reportKey/trigger', triggerReport);
router.get('/reports/:reportKey/preview', previewReport);

// Submission history routes
router.get('/submissions', getSubmissions);
router.get('/submissions/:id', getSubmission);
router.post('/submissions/:id/check-status', checkSubmissionStatus);

export default router;