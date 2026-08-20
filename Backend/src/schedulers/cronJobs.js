import cron from 'node-cron';
import { processReport } from '../services/reportProcessor.js';
import logger from '../config/logger.js';

/**
 * Initialize all scheduled jobs.
 * Each report can be individually enabled/disabled via .env:
 *   SCHEDULE_SINGLE_CURRENCYOP001=true
 *   SCHEDULE_LSR_Statutory_ZS001=true
 * Global master switch: ENABLE_SCHEDULERS=true
 */
export function initSchedulers() {
  // Global master switch
  if (process.env.ENABLE_SCHEDULERS !== 'true') {
    logger.info('⏹️ Schedulers are globally disabled. Set ENABLE_SCHEDULERS=true in .env to enable.');
    return;
  }

  // =============================================
  // 1. Daily report: SINGLE_CURRENCYOP001 at 9:00 AM
  // Sends data for YESTERDAY (since today's data is not ready yet)
  // =============================================
  if (process.env.SCHEDULE_SINGLE_CURRENCYOP001 !== 'false') {
    cron.schedule('0 9 * * *', async () => {
      logger.info('⏰ Cron job started for SINGLE_CURRENCYOP001 (daily, for yesterday)');
      const now = new Date();
      // Send yesterday's data
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const startDate = new Date(yesterday);
      const endDate = new Date(yesterday);

      try {
        await processReport('SINGLE_CURRENCYOP001', startDate, endDate);
      } catch (error) {
        logger.error(`Cron job for SINGLE_CURRENCYOP001 failed: ${error.message}`);
      }
    });
    logger.info('✅ Scheduled SINGLE_CURRENCYOP001 daily at 9:00 AM (for yesterday)');
  } else {
    logger.info('⏹️ SINGLE_CURRENCYOP001 scheduler is disabled.');
  }

  // =============================================
  // 2. Weekly report: LSR-Statutory ZS001 every Thursday at 9:30 AM
  // Sends data for the previous Thu–Wed (the week that ended yesterday)
  // =============================================
  if (process.env.SCHEDULE_LSR_Statutory_ZS001 !== 'false') {
    cron.schedule('30 9 * * 4', async () => { // 4 = Thursday
      logger.info('⏰ Cron job started for LSR-Statutory ZS001 (weekly, for Thu–Wed)');
      const now = new Date();
      // End date: yesterday (Wednesday)
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      end.setHours(0, 0, 0, 0);

      // Start date: 6 days before end (Thursday of previous week)
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      try {
        await processReport('LSR-Statutory ZS001', start, end);
      } catch (error) {
        logger.error(`Cron job for LSR-Statutory ZS001 failed: ${error.message}`);
      }
    });
    logger.info('✅ Scheduled LSR-Statutory ZS001 weekly on Thursday at 9:30 AM (for previous Thu–Wed)');
  } else {
    logger.info('⏹️ LSR-Statutory ZS001 scheduler is disabled.');
  }

  logger.info('✅ Schedulers initialized.');
}