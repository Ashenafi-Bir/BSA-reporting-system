// schedulers/bootstrap.js
import { getPmsPool } from '../config/db.js';
import { seedLegacySchedules } from '../config/seedLegacySchedules.js';
import { initSchedulers } from './cronJobs.js';
import logger from '../config/logger.js';

/**
 * Waits for the PMS pool, then seeds legacy schedules and loads cron jobs.
 */
export async function bootstrapSchedulers({ retries = 20, delayMs = 500 } = {}) {
  // Wait for pool to exist
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (getPmsPool()) {
      logger.info(`✅ Scheduler bootstrap: PMS pool ready (attempt ${attempt}).`);
      break;
    }
    if (attempt === retries) {
      logger.error(`❌ Scheduler bootstrap: PMS pool never ready after ${retries} attempts.`);
      return;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  // 1. Seed legacy schedules (idempotent)
  try {
    await seedLegacySchedules();
  } catch (err) {
    logger.error(`❌ seedLegacySchedules failed: ${err.message}`);
  }

  // 2. Load dynamic schedulers
  if (process.env.ENABLE_SCHEDULERS === 'false') {
    logger.info('⏹️  Schedulers globally disabled (ENABLE_SCHEDULERS=false).');
    return;
  }

  try {
    await initSchedulers();
  } catch (err) {
    logger.error(`❌ initSchedulers failed: ${err.message}`);
  }
}