import { verifyToken } from '../services/authService.js';
import logger from '../config/logger.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  req.user = decoded;
  next();
}

export function requireRole(roleName) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (req.user.role !== roleName && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireReportAccess(reportKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    // Admin has access to all
    if (req.user.role === 'Admin') return next();
    // ITMaker has access to all for testing
    if (req.user.role === 'ITMaker') return next();
    if (!req.user.allowedReports || !req.user.allowedReports.includes(reportKey)) {
      return res.status(403).json({ success: false, error: 'You do not have access to this report' });
    }
    next();
  };
}