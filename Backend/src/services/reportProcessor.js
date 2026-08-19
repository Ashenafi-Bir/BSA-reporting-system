import logger from '../config/logger.js';
import { submitReport, getReportStatus } from './bsaService.js';
import { formatLocalDateTime } from '../utils/dateHelpers.js';
import * as submissionModel from '../models/submissionModel.js';

export async function buildReportPayload(reportKey, startDate, endDate) {
  const safeReportKey = reportKey.replace(/\s+/g, '_');
  const configModule = await import(`../config/reports/${safeReportKey}.js`);
  let config = configModule.default;

  if (typeof config === 'function') {
    config = config();
  }

  if (typeof config.dataFetcher !== 'function') {
    throw new Error(`Report ${reportKey} does not have a dataFetcher.`);
  }
  const rawData = await config.dataFetcher(startDate, endDate);

  if (typeof config.prepare === 'function') {
    config.prepare(rawData);
  }

  const fieldMap = {};

  for (const field of config.fields) {
    let value = null;
    if (field.source === 'cbs') {
      if (typeof field.cbsQuery === 'function') {
        value = field.cbsQuery(rawData);
      } else {
        value = 0;
      }
    } else if (field.source === 'calculated') {
      if (typeof field.calculation === 'function') {
        value = field.calculation(fieldMap, rawData);
      } else {
        value = 0;
      }
    } else if (field.source === 'static') {
      value = field.value;
    } else {
      value = 0;
    }
    fieldMap[field.code] = value;
  }

  // Build ReturnItemsList
  const returnItemsList = [];
  const includeZeroValues = config.includeZeroValues === true;

  for (const field of config.fields) {
    const value = fieldMap[field.code];
    if (includeZeroValues) {
      returnItemsList.push({
        Code: field.code,
        Value: String(value !== undefined && value !== null ? value : 0)
      });
      continue;
    }
    // Skip zero values
    if (value === 0 || value === '0' || value === undefined || value === null) {
      continue;
    }
    returnItemsList.push({
      Code: field.code,
      Value: String(value)
    });
  }

  const dateStr = startDate.toISOString().slice(0, 10);
  const filename = `${reportKey}_${dateStr}.json`;

  const payload = {
    ReturnKey: config.reportKey,
    InstCode: config.instCode,
    FinYear: config.finYear,
    StartDate: formatLocalDateTime(startDate),
    EndDate: formatLocalDateTime(endDate),
    ReturnItemsList: returnItemsList,
    DynamicItemsList: [],
  };

  return payload;
}

export async function processReport(reportKey, startDate, endDate) {
  try {
    const payload = await buildReportPayload(reportKey, startDate, endDate);
    logger.info(`📦 Payload built with ${payload.ReturnItemsList.length} items.`);

    const response = await submitReport(payload);
    logger.info(`✅ Report submitted successfully.`);

    const filename = response?.filename || payload.Filename || `${reportKey}_${startDate.toISOString().slice(0,10)}.json`;

    const submissionId = await submissionModel.createSubmission({
      report_key: reportKey,
      filename: filename,
      start_date: startDate,
      end_date: endDate,
      status: 'submitted',
      response: JSON.stringify(response),
    });

    setTimeout(async () => {
      try {
        logger.info(`⏳ Checking status for submission ${submissionId} (${filename})`);
        const statusData = await getReportStatus(filename);
        if (statusData) {
          await submissionModel.updateSubmission(submissionId, {
            bsa_status: statusData.status,
            bsa_notification: JSON.stringify(statusData.notification || ''),
            processing_results: JSON.stringify(statusData.processingResults || []),
            status_checked_at: new Date(),
            status: statusData.status === 'Processed' ? 'success' : statusData.status === 'Failed' ? 'failed' : 'processing',
          });
          logger.info(`✅ Status updated for submission ${submissionId}: ${statusData.status}`);
        } else {
          await submissionModel.updateSubmission(submissionId, {
            status: 'processing',
            status_checked_at: new Date(),
          });
          logger.warn(`⚠️ Status check returned no data for ${filename}`);
        }
      } catch (error) {
        logger.error(`❌ Status check failed for submission ${submissionId}: ${error.message}`);
        await submissionModel.updateSubmission(submissionId, {
          error: `Status check failed: ${error.message}`,
        });
      }
    }, 1 * 60 * 1000);

    return { ...response, submissionId };
  } catch (error) {
    logger.error(`❌ Report processing failed: ${error.message}`);
    await submissionModel.createSubmission({
      report_key: reportKey,
      status: 'failed',
      error: error.message,
      start_date: startDate,
      end_date: endDate,
    });
    throw error;
  }
}