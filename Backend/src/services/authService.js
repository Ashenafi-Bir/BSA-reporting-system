import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/auth.js';
import { validateLdapUser, getUserByUsername } from './ldapService.js';
import { findUserByUsername } from '../models/userModel.js';
import { getReportsForRole } from '../models/roleModel.js';
import logger from '../config/logger.js';

export async function authenticateUser(username, password) {
  try {
    logger.info(`Authenticating user: ${username}`);

    // 1. Validate with LDAP
    const ldapUser = await validateLdapUser(username, password);
    if (!ldapUser) {
      logger.warn(`LDAP validation failed for ${username}`);
      return { success: false, message: 'LDAP authentication failed. Check credentials.' };
    }
    logger.info(`LDAP validation successful for ${username}`);

    // 2. Check if user exists in local DB
    const localUser = await findUserByUsername(username);
    if (!localUser) {
      logger.warn(`User ${username} not found in local database`);
      return { success: false, message: 'User not registered in system. Contact administrator.' };
    }
    logger.info(`User ${username} found in local DB with role: ${localUser.role_name}`);

    // 3. Get allowed reports for this role
    const allowedReports = await getReportsForRole(localUser.role_id);
    logger.info(`User ${username} has ${allowedReports.length} allowed reports`);

    // 4. Generate JWT
    const token = jwt.sign(
      {
        userId: localUser.id,
        username: localUser.username,
        role: localUser.role_name,
        roleId: localUser.role_id,
        allowedReports,
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    return {
      success: true,
      token,
      user: {
        id: localUser.id,
        username: localUser.username,
        fullName: localUser.full_name,
        role: localUser.role_name,
        allowedReports,
      },
    };
  } catch (error) {
    logger.error(`Authentication error for ${username}: ${error.message}`);
    return { success: false, message: 'Authentication failed due to server error' };
  }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, jwtConfig.secret);
  } catch (error) {
    return null;
  }
}