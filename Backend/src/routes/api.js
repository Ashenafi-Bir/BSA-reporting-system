import express from 'express';
import { triggerReport, previewReport, getStatus } from '../controllers/reportController.js';

const router = express.Router();

router.post('/reports/:reportKey/trigger', triggerReport);
router.get('/reports/:reportKey/preview', previewReport);
router.get('/reports/:reportKey/status', getStatus);

export default router;