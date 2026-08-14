import { getSqliteDb } from '../config/db.js';
import logger from '../config/logger.js';

export async function saveSubmissionHistory(reportKey, status, response, error) {
  const db = getSqliteDb();
  if (!db) {
    logger.warn('SQLite DB not available; history not saved.');
    return;
  }
  try {
    await db.run(
      `INSERT INTO submissions (report_key, status, response, error) VALUES (?, ?, ?, ?)`,
      [reportKey, status, response, error]
    );
    logger.debug(`Submission history saved for ${reportKey}`);
  } catch (err) {
    logger.error(`Failed to save submission history: ${err.message}`);
  }
}