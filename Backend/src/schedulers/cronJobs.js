import cron from 'node-cron';
import { processReport } from '../services/reportProcessor.js';
import logger from '../config/logger.js';

export function initSchedulers() {
  if (process.env.ENABLE_SCHEDULERS !== 'true') {
    logger.info('⏹️ Schedulers are disabled. Set ENABLE_SCHEDULERS=true in .env to enable.');
    return;
  }

  // --- Daily report: SINGLE_CURRENCYOP001 at 9:00 AM ---
  cron.schedule('0 9 * * *', async () => {
    logger.info('⏰ Cron job started for SINGLE_CURRENCYOP001');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    try {
      await processReport('SINGLE_CURRENCYOP001', startDate, endDate);
    } catch (error) {
      logger.error(`Cron job for SINGLE_CURRENCYOP001 failed: ${error.message}`);
    }
  });

  // --- Weekly report: LSR-Statutory ZS001 every Thursday at 9:30 AM ---
  // The report covers the previous Thu–Wed week. We'll run it on Thursday morning.
  cron.schedule('30 9 * * 4', async () => { // 4 = Thursday
    logger.info('⏰ Cron job started for LSR-Statutory ZS001 (weekly)');
    const now = new Date();
    // We need to get the previous Thursday as start date, and Wednesday as end date.
    // If today is Thursday, the week is (Thu last week – Wed this week).
    // But the user expects a weekly range. Let's compute the current week's Thu–Wed.
    const currentDay = now.getDay(); // 4 = Thursday
    let startDate = new Date(now);
    let endDate = new Date(now);
    if (currentDay !== 4) {
      // If not Thursday, adjust to previous Thursday? For simplicity, we'll run on Thursday.
      // But if the job runs on Thursday, the week is Thu last week – Wed this week.
      // We'll compute the start as 7 days ago from today? Actually we want the week that just ended.
      // Let's set startDate = Thursday of last week, endDate = Wednesday of this week.
      // This is a bit complex; we'll simplify: run it with a fixed range from the previous week.
      // We'll compute the most recent Thursday – Wednesday.
    }
    // Simpler: we'll run the report for the previous 7 days ending yesterday (Wednesday).
    // That covers Thu–Wed.
    const end = new Date(now);
    end.setDate(end.getDate() - 1); // yesterday (Wednesday)
    const start = new Date(end);
    start.setDate(start.getDate() - 6); // 6 days before Wednesday = Thursday
    // Reset time to midnight
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    try {
      await processReport('LSR-Statutory ZS001', start, end);
    } catch (error) {
      logger.error(`Cron job for LSR-Statutory ZS001 failed: ${error.message}`);
    }
  });

  logger.info('✅ Schedulers initialized.');
}