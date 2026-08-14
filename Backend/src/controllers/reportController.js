import { processReport, buildReportPayload } from '../services/reportProcessor.js';
import logger from '../config/logger.js';

export async function triggerReport(req, res) {
  try {
    const { reportKey } = req.params;
    let reportDate = new Date();
    if (req.query.date) {
      reportDate = new Date(req.query.date);
      if (isNaN(reportDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date format' });
      }
    }
    reportDate = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
    const result = await processReport(reportKey, reportDate, reportDate);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error in triggerReport: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function previewReport(req, res) {
  try {
    const { reportKey } = req.params;
    let reportDate = new Date();
    if (req.query.date) {
      reportDate = new Date(req.query.date);
      if (isNaN(reportDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date format' });
      }
    }
    reportDate = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
    const payload = await buildReportPayload(reportKey, reportDate, reportDate);
    res.status(200).json(payload);
  } catch (error) {
    logger.error(`Error in previewReport: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getStatus(req, res) {
  res.status(200).json({ message: 'Status endpoint not yet implemented' });
}