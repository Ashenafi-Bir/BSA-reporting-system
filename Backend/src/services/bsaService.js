import axios from 'axios';
import { bsaConfig } from '../config/bsa.js';
import logger from '../config/logger.js';

let accessToken = null;
let tokenExpiry = null;

export async function loginToBsa() {
  try {
    const url = bsaConfig.getLoginUrl();
    logger.info(`🔐 Logging into BSA at: ${url}`);

    if (!bsaConfig.baseURL) {
      throw new Error('BSA_BASE_URL is empty. Check .env file.');
    }

    const payload = {
      userUser: bsaConfig.username,
      userPass: bsaConfig.password,
    };

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    if (response.status === 200 && response.data.authenticated) {
      accessToken = response.data.accessToken;
      const expDate = new Date(response.data.expiration);
      tokenExpiry = expDate;
      logger.info(`✅ BSA Login successful. Token expires at ${expDate}`);
      return accessToken;
    } else {
      throw new Error('Login failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    logger.error(`❌ BSA Login error: ${error.message}`);
    if (error.response) {
      logger.error(`Response status: ${error.response.status}`);
      logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      logger.error(`No response received. Network error?`);
    }
    throw error;
  }
}

async function ensureToken() {
  if (!accessToken || (tokenExpiry && new Date() >= tokenExpiry)) {
    logger.info('BSA token expired or missing. Logging in...');
    await loginToBsa();
  }
  return accessToken;
}

export async function submitReport(payload) {
  try {
    const token = await ensureToken();
    const url = bsaConfig.getSubmitUrl();
    logger.info(`📤 Submitting report to: ${url}`);

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info(`✅ Report submitted successfully. Status: ${response.status}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error(`❌ BSA submission error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      logger.error(`❌ BSA submission error: No response received. ${error.message}`);
    } else {
      logger.error(`❌ BSA submission error: ${error.message}`);
      // In submitReport, after building URL:
// After getting response, log the full response data
logger.debug(`BSA response data: ${JSON.stringify(response.data)}`);
    }
    throw error;
  }
}