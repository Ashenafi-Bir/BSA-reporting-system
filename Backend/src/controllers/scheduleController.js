// controllers/scheduleController.js
import * as scheduleModel from '../models/scheduleModel.js';
import { runSchedule } from '../services/scheduleRunner.js';
import { reloadSchedules } from '../schedulers/cronJobs.js';
import logger from '../config/logger.js';
import parser from 'cron-parser';

/**
 * List all schedules with next run time.
 */
export async function listSchedules(req, res) {
  try {
    const schedules = await scheduleModel.getAllSchedules();
    const now = new Date();

    const enriched = schedules.map(s => {
      let nextRun = null;
      try {
        const interval = parser.parseExpression(s.cron_expression, {
          currentDate: now,
          tz: s.timezone || 'Africa/Addis_Ababa',
        });
        nextRun = interval.next().toDate();
      } catch (e) {
        // ignore
      }
      return {
        ...s,
        skip_holidays: !!s.skip_holidays,
        enabled: !!s.enabled,
        next_run: nextRun,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error(`listSchedules error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSchedule(req, res) {
  try {
    const schedule = await scheduleModel.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    schedule.skip_holidays = !!schedule.skip_holidays;
    schedule.enabled = !!schedule.enabled;
    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error(`getSchedule error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createSchedule(req, res) {
  try {
    const data = {
      ...req.body,
      created_by: req.user?.username || 'system',
      skip_holidays: req.body.skip_holidays ? 1 : 0,
      enabled: req.body.enabled !== false ? 1 : 0,
    };
    const schedule = await scheduleModel.createSchedule(data);
    await reloadSchedules();
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    logger.error(`createSchedule error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const data = {
      ...req.body,
      skip_holidays: req.body.skip_holidays ? 1 : 0,
      enabled: req.body.enabled !== false ? 1 : 0,
    };
    const schedule = await scheduleModel.updateSchedule(id, data);
    await reloadSchedules();
    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error(`updateSchedule error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteSchedule(req, res) {
  try {
    await scheduleModel.deleteSchedule(req.params.id);
    await reloadSchedules();
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    logger.error(`deleteSchedule error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function toggleSchedule(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const schedule = await scheduleModel.toggleSchedule(id, enabled);
    await reloadSchedules();
    res.json({ success: true, data: schedule });
  } catch (error) {
    logger.error(`toggleSchedule error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function runNow(req, res) {
  try {
    const schedule = await scheduleModel.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    const result = await runSchedule(schedule);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`runNow error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}