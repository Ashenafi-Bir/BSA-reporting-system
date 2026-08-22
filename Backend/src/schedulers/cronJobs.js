/**
 * SCHEDULER CONFIGURATION
 * 
 * TIMEZONE: Ethiopia time (Africa/Addis_Ababa, UTC+3)
 * 
 * CONTROLS:
 *   - Global: ENABLE_SCHEDULERS=true
 *   - Per-report: SCHEDULE_SINGLE_CURRENCYOP001=true / SCHEDULE_LSR_Statutory_ZS001=true
 * 
 * HOLIDAY HANDLING (Daily report):
 *   - Uses FCUBSLIVE.STTM_LCL_HOLIDAY to check if today is a holiday.
 *   - If today is a holiday → skip submission.
 *   - If today is working → find the most recent non‑holiday date BEFORE today.
 *   - Submit the report for that date.
 */

import cron from 'node-cron';
import { processReport } from '../services/reportProcessor.js';
import { isHoliday, getLastWorkingDayBefore } from '../services/cbsService.js';
import logger from '../config/logger.js';

const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa';

export function initSchedulers() {
  if (process.env.ENABLE_SCHEDULERS !== 'true') {
    logger.info('⏹️ Schedulers are globally disabled.');
    return;
  }

  logger.info('🔄 Initializing scheduled jobs...');

  // ============================================================
  // 1. DAILY REPORT: SINGLE_CURRENCYOP001
  //    Runs at 11:00 AM Ethiopia time
  //    Only submits if TODAY is a working day (non‑holiday)
  //    Then submits the LAST working day BEFORE today.
  // ============================================================
  if (process.env.SCHEDULE_SINGLE_CURRENCYOP001 !== 'false') {
    cron.schedule(
      '0 11 * * *', // 11:00 AM every day
      async () => {
        logger.info('⏰ Cron job triggered: SINGLE_CURRENCYOP001 (daily)');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Check if today is a holiday
        const todayIsHoliday = await isHoliday(today);
        if (todayIsHoliday) {
          logger.info(`📅 Today (${today.toISOString().slice(0,10)}) is a holiday. Skipping submission.`);
          return;
        }

        // 2. Find the most recent non‑holiday date BEFORE today
        const reportDate = await getLastWorkingDayBefore(today);
        logger.info(`📤 Submitting SINGLE_CURRENCYOP001 for date: ${reportDate.toISOString().slice(0,10)}`);

        try {
          await processReport('SINGLE_CURRENCYOP001', reportDate, reportDate);
          logger.info(`✅ SINGLE_CURRENCYOP001 submitted successfully for ${reportDate.toISOString().slice(0,10)}`);
        } catch (error) {
          logger.error(`❌ SINGLE_CURRENCYOP001 cron job failed: ${error.message}`);
        }
      },
      { timezone: ETHIOPIA_TIMEZONE }
    );

    logger.info(`✅ Scheduled SINGLE_CURRENCYOP001: daily at 11:00 AM (${ETHIOPIA_TIMEZONE}) for last working day before today`);
  } else {
    logger.info('⏹️ SINGLE_CURRENCYOP001 scheduler is disabled.');
  }

  // ============================================================
  // 2. WEEKLY REPORT: LSR-Statutory ZS001
  //    Runs every Friday at 9:30 AM
  //    Always sends previous Thu–Wed week (no holiday logic)
  // ============================================================
  if (process.env.SCHEDULE_LSR_Statutory_ZS001 !== 'false') {
    cron.schedule(
      '30 9 * * 5', // 9:30 AM every Friday (5 = Friday)
      async () => {
        logger.info('⏰ Cron job triggered: LSR-Statutory ZS001 (weekly)');

        const now = new Date();
        // Find the most recent Wednesday (end of Thu–Wed week)
        const end = new Date(now);
        const dayOfWeek = end.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        const daysToWednesday = (dayOfWeek - 3 + 7) % 7;
        end.setDate(end.getDate() - daysToWednesday);
        end.setHours(0, 0, 0, 0);

        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        try {
          logger.info(`📤 Submitting LSR-Statutory ZS001 for week: ${start.toISOString().slice(0,10)} to ${end.toISOString().slice(0,10)}`);
          await processReport('LSR-Statutory ZS001', start, end);
          logger.info(`✅ LSR-Statutory ZS001 submitted successfully.`);
        } catch (error) {
          logger.error(`❌ LSR-Statutory ZS001 cron job failed: ${error.message}`);
        }
      },
      { timezone: ETHIOPIA_TIMEZONE }
    );

    logger.info(`✅ Scheduled LSR-Statutory ZS001: weekly on Friday at 9:30 AM (${ETHIOPIA_TIMEZONE}) for previous Thu-Wed`);
  } else {
    logger.info('⏹️ LSR-Statutory ZS001 scheduler is disabled.');
  }

  logger.info('✅ All scheduled jobs initialized.');
}