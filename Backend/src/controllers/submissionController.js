import * as submissionModel from '../models/submissionModel.js';
import { getReportStatus } from '../services/bsaService.js';
import logger from '../config/logger.js';

export async function getSubmissions(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const { role, allowedReports, username } = req.user;

    let submissions;
    // Admin and ITMaker can see all
    if (role === 'Admin' || role === 'ITMaker') {
      submissions = await submissionModel.getSubmissions(limit, offset);
    } else {
      // Filter by allowed reports
      if (!allowedReports || allowedReports.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      submissions = await submissionModel.getSubmissionsByReportKeys(allowedReports, limit, offset);
    }
    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    logger.error(`Error fetching submissions: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSubmission(req, res) {
  try {
    const { id } = req.params;
    const submission = await submissionModel.getSubmissionById(id);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    // Check access
    const { role, allowedReports } = req.user;
    if (role !== 'Admin' && role !== 'ITMaker' && (!allowedReports || !allowedReports.includes(submission.report_key))) {
      return res.status(403).json({ success: false, error: 'You do not have access to this submission' });
    }
    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    logger.error(`Error fetching submission: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function checkSubmissionStatus(req, res) {
  try {
    const { id } = req.params;
    const submission = await submissionModel.getSubmissionById(id);
    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    if (!submission.filename) {
      return res.status(400).json({ success: false, error: 'No filename associated with this submission' });
    }
    const statusData = await getReportStatus(submission.filename);
    if (statusData) {
      await submissionModel.updateSubmission(id, {
        bsa_status: statusData.status,
        bsa_notification: JSON.stringify(statusData.notification || ''),
        processing_results: JSON.stringify(statusData.processingResults || []),
        status_checked_at: new Date(),
        status: statusData.status === 'Processed' ? 'success' : statusData.status === 'Failed' ? 'failed' : 'processing',
      });
      res.status(200).json({ success: true, data: statusData });
    } else {
      res.status(404).json({ success: false, error: 'Status not available yet' });
    }
  } catch (error) {
    logger.error(`Error checking status: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}