import * as submissionModel from '../models/submissionModel.js';
import logger from '../config/logger.js';

export async function saveSubmissionHistory(reportKey, status, response, error) {
  try {
    await submissionModel.createSubmission({
      report_key: reportKey,
      status: status,
      response: response,
      error: error,
    });
    logger.debug(`Submission history saved for ${reportKey}`);
  } catch (err) {
    logger.error(`Failed to save submission history: ${err.message}`);
  }
}