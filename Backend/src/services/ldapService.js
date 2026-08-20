import axios from 'axios';
import logger from '../config/logger.js';

const LDAP_BASE_URL = process.env.LDAP_BASE_URL || 'http://192.168.6.63:8080';

export async function validateLdapUser(username, password) {
  try {
    const url = `${LDAP_BASE_URL}/api/Ldap/users/validate`;
    logger.info(`Validating LDAP user ${username} at ${url}`);
    const response = await axios.post(url, { username, password }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    logger.info(`LDAP validation response status: ${response.status}`);
    return response.data;
  } catch (error) {
    logger.error(`LDAP validation error for ${username}: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

export async function getUserByUsername(username) {
  try {
    const url = `${LDAP_BASE_URL}/api/Ldap/users/by-username/${encodeURIComponent(username)}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    logger.error(`LDAP get user error: ${error.message}`);
    return null;
  }
}