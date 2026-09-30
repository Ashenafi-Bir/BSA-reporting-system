// schedulers/cronJobs.js
import cron from 'node-cron';
import * as scheduleModel from '../models/scheduleModel.js';
import { runSchedule } from '../services/scheduleRunner.js';
import logger from '../config/logger.js';

const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa';

// Keep track of registered tasks so we can destroy them on reload
const activeTasks = new Map(); // scheduleId -> cron task

/**
 * Load all enabled schedules from the database and register them.
 * This is called on startup and whenever schedules change via the API.
 */
export async function reloadSchedules() {
  // Stop all existing tasks
  for (const [id, task] of activeTasks.entries()) {
    task.stop();
    activeTasks.delete(id);
    logger.info(`🛑 Stopped cron job for schedule ${id}`);
  }

  if (process.env.ENABLE_SCHEDULERS !== 'true') {
    logger.info('⏹️ Schedulers are globally disabled (ENABLE_SCHEDULERS !== true).');
    return;
  }

  let schedules;
  try {
    schedules = await scheduleModel.getEnabledSchedules();
  } catch (err) {
    logger.error(`Failed to load schedules from DB: ${err.message}`);
    return;
  }

  logger.info(`🔄 Loading ${schedules.length} enabled schedule(s)...`);

  for (const schedule of schedules) {
    const { id, name, cron_expression, timezone, report_key } = schedule;

    if (!cron.validate(cron_expression)) {
      logger.warn(`⚠️ Schedule ${id} (${name}) has invalid cron expression: ${cron_expression}. Skipping.`);
      continue;
    }

    const tz = timezone || ETHIOPIA_TIMEZONE;

    const task = cron.schedule(
      cron_expression,
      async () => {
        logger.info(`⏰ Cron triggered: schedule ${id} (${name}) for report ${report_key}`);
        try {
          // Reload the schedule from DB to get fresh params
          const fresh = await scheduleModel.getScheduleById(id);
          if (!fresh || !fresh.enabled) {
            logger.info(`Schedule ${id} is disabled or missing. Skipping.`);
            return;
          }
          await runSchedule(fresh);
        } catch (err) {
          logger.error(`Error running schedule ${id}: ${err.message}`);
        }
      },
      { timezone: tz }
    );

    activeTasks.set(id, task);
    logger.info(`✅ Registered cron for schedule ${id} (${name}) [${cron_expression} ${tz}]`);
  }

  logger.info(`✅ All schedules loaded.`);
}

/**
 * Initialise schedulers on app startup.
 */
export async function initSchedulers() {
  if (process.env.ENABLE_SCHEDULERS !== 'true') {
    logger.info('⏹️ Schedulers are globally disabled.');
    return;
  }
  logger.info('🔄 Initializing schedulers from database...');
  await reloadSchedules();
}