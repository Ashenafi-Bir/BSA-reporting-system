// routes/schedules.js
import express from 'express';
import {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  runNow,
} from '../controllers/scheduleController.js';
import { authenticate } from '../middleware/auth.js'; // adjust path if needed

const router = express.Router();

// All schedule routes require authentication
router.use(authenticate);

// Admin / ITMaker can modify; others can view
function requireAdminOrITMaker(req, res, next) {
  const role = req.user?.role;
  if (role === 'Admin' || role === 'ITMaker') return next();
  return res.status(403).json({ success: false, error: 'Insufficient permissions' });
}

router.get('/', listSchedules);
router.get('/:id', getSchedule);
router.post('/', requireAdminOrITMaker, createSchedule);
router.put('/:id', requireAdminOrITMaker, updateSchedule);
router.delete('/:id', requireAdminOrITMaker, deleteSchedule);
router.patch('/:id/toggle', requireAdminOrITMaker, toggleSchedule);
router.post('/:id/run', requireAdminOrITMaker, runNow);

export default router;