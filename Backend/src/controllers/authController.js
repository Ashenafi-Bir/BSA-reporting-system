import { authenticateUser } from '../services/authService.js';
import { findUserByUsername } from '../models/userModel.js';
import { getAllRoles, getReportsForRole } from '../models/roleModel.js';
import logger from '../config/logger.js';

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    logger.info(`Login attempt for username: ${username}`);

    if (!username || !password) {
      logger.warn('Login attempt with missing credentials');
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const result = await authenticateUser(username, password);
    logger.info(`Login result for ${username}: ${result.success}`);

    if (!result.success) {
      logger.warn(`Login failed for ${username}: ${result.message}`);
      return res.status(401).json({ success: false, error: result.message });
    }

    logger.info(`Login successful for ${username}`);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Login failed due to server error' });
  }
}

export async function me(req, res) {
  try {
    const user = await findUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const allowedReports = await getReportsForRole(user.role_id);
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role_name,
        allowedReports,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
}