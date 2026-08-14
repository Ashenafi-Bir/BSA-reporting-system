// cronJobs.js
import cron from 'node-cron';
import { processReport } from '../services/reportProcessor.js';
import logger from '../config/logger.js';

// Schedule for SINGLE_CURRENCYOP001: daily at 9:00 AM (example)
export function initSchedulers() {
  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('⏰ Cron job started for SINGLE_CURRENCYOP001');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    try {
      await processReport('SINGLE_CURRENCYOP001', startDate, endDate);
    } catch (error) {
      logger.error(`Cron job failed: ${error.message}`);
    }
  });

  logger.info('✅ Schedulers initialized.');
}

// You can add more reports with different schedules here.