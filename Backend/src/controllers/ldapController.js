import axios from 'axios';
import logger from '../config/logger.js';

const LDAP_BASE_URL = process.env.LDAP_BASE_URL || 'http://192.168.6.63:8080';

/**
 * Search LDAP users by username or full name
 */
export async function searchLdapUsers(req, res) {
  try {
    const { searchTerm } = req.query;
    if (!searchTerm) {
      return res.status(400).json({ success: false, error: 'searchTerm is required' });
    }

    const url = `${LDAP_BASE_URL}/api/Ldap/users/search?searchTerm=${encodeURIComponent(searchTerm)}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error(`LDAP search error: ${error.message}`);
    if (error.response) {
      return res.status(error.response.status).json({ 
        success: false, 
        error: error.response.data || 'LDAP search failed' 
      });
    }
    res.status(500).json({ success: false, error: 'Failed to search LDAP users' });
  }
}

/**
 * Get LDAP user by username
 */
export async function getLdapUserByUsername(req, res) {
  try {
    const { username } = req.params;
    const url = `${LDAP_BASE_URL}/api/Ldap/users/by-username/${encodeURIComponent(username)}`;
    const response = await axios.get(url, { timeout: 10000 });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    logger.error(`LDAP get user error: ${error.message}`);
    if (error.response) {
      return res.status(error.response.status).json({ 
        success: false, 
        error: error.response.data || 'User not found' 
      });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch user from LDAP' });
  }
}