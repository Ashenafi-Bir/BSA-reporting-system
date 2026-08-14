import logger from '../config/logger.js';
import { fetchCbsData } from './cbsService.js';
import { submitReport } from './bsaService.js';
import { saveSubmissionHistory } from '../utils/history.js';
import { formatLocalDateTime } from '../utils/dateHelpers.js';

export async function buildReportPayload(reportKey, startDate, endDate) {
  const configModule = await import(`../config/reports/SINGLE_CURRENCYOP001.js`);
  const config = configModule.default;
  const rawData = await fetchCbsData(startDate, endDate);
  const fieldMap = {};

  // Compute all fields in the original order (which respects dependencies)
  for (const field of config.fields) {
    let value = null;
    if (field.source === 'cbs') {
      if (typeof field.cbsQuery === 'function') {
        value = field.cbsQuery(rawData);
      } else value = 0;
    } else if (field.source === 'calculated') {
      if (typeof field.calculation === 'function') {
        value = field.calculation(fieldMap);
      } else value = 0;
    } else if (field.source === 'static') {
      value = field.value;
    } else value = 0;
    if (typeof value !== 'number') value = parseFloat(value) || 0;
    fieldMap[field.code] = value;
  }

  // Build the ReturnItemsList sorted by code ascending (164_00001 to 164_00686)
  const sortedCodes = Object.keys(fieldMap).sort((a, b) => a.localeCompare(b));
  const returnItemsList = sortedCodes.map(code => ({
    Code: code,
    Value: fieldMap[code]?.toString() || '0'
  }));

  const dateStr = startDate.toISOString().slice(0,10);
  const filename = `${reportKey}_${dateStr}.json`;

  const payload = {
    ReturnKey: config.reportKey,
    InstCode: config.instCode,
    FinYear: config.finYear,
    StartDate: formatLocalDateTime(startDate),
    EndDate: formatLocalDateTime(endDate),
    ReturnItemsList: returnItemsList,
    DynamicItemsList: []
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