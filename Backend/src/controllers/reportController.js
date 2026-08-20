import { processReport, buildReportPayload } from '../services/reportProcessor.js';
import logger from '../config/logger.js';

function parseDateParam(dateParam) {
  logger.info(`Raw dateParam: ${dateParam}`);

  if (!dateParam) {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate())
    };
  }

  const decoded = decodeURIComponent(dateParam);
  logger.info(`Decoded dateParam: ${decoded}`);

  if (decoded.includes('/')) {
    const parts = decoded.split('/');
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date range format. Use YYYY-MM-DD/YYYY-MM-DD');
    }
    return {
      startDate: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
      endDate: new Date(end.getFullYear(), end.getMonth(), end.getDate())
    };
  } else {
    const date = new Date(decoded);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    return {
      startDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      endDate: new Date(date.getFullYear(), date.getMonth(), date.getDate())
    };
  }
}

export async function triggerReport(req, res) {
  try {
    const { reportKey } = req.params;
    // Check permission
    const { allowedReports, role } = req.user;
    if (role !== 'Admin' && role !== 'ITMaker' && (!allowedReports || !allowedReports.includes(reportKey))) {
      return res.status(403).json({ success: false, error: 'You do not have access to this report' });
    }
    const { startDate, endDate } = parseDateParam(req.query.date);
    logger.info(`Triggering ${reportKey} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const result = await processReport(reportKey, startDate, endDate);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error in triggerReport: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function previewReport(req, res) {
  try {
    const { reportKey } = req.params;
    const { allowedReports, role } = req.user;
    if (role !== 'Admin' && role !== 'ITMaker' && (!allowedReports || !allowedReports.includes(reportKey))) {
      return res.status(403).json({ success: false, error: 'You do not have access to this report' });
    }
    const { startDate, endDate } = parseDateParam(req.query.date);
    logger.info(`Previewing ${reportKey} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const payload = await buildReportPayload(reportKey, startDate, endDate);
    res.status(200).json(payload);
  } catch (error) {
    logger.error(`Error in previewReport: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getStatus(req, res) {
  res.status(200).json({ message: 'Status endpoint not yet implemented' });
}