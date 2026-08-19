import logger from '../config/logger.js';
import { submitReport } from './bsaService.js';
import { saveSubmissionHistory } from '../utils/history.js';
import { formatLocalDateTime } from '../utils/dateHelpers.js';

export async function buildReportPayload(reportKey, startDate, endDate) {
  // Sanitize report key for file name (replace spaces with underscores)
  const safeReportKey = reportKey.replace(/\s+/g, '_');
  const configModule = await import(`../config/reports/${safeReportKey}.js`);
  let config = configModule.default;

  // If config is a function (for dynamic loading), call it
  if (typeof config === 'function') {
    config = config();
  }

  // Fetch raw data using dataFetcher
  if (typeof config.dataFetcher !== 'function') {
    throw new Error(`Report ${reportKey} does not have a dataFetcher.`);
  }
  const rawData = await config.dataFetcher(startDate, endDate);

  // Prepare the config (e.g., generate fields dynamically)
  if (typeof config.prepare === 'function') {
    config.prepare(rawData);
  }

  const fieldMap = {};

  // Process each field
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
        // Pass fieldMap and rawData (for new reports that need it)
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

  // Build ReturnItemsList – exclude zero values
  const returnItemsList = [];
  for (const field of config.fields) {
    const value = fieldMap[field.code];
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
    await saveSubmissionHistory(reportKey, 'SUCCESS', JSON.stringify(response), null);
    return response;
  } catch (error) {
    await saveSubmissionHistory(reportKey, 'FAILED', null, error.message);
    throw error;
  }
}