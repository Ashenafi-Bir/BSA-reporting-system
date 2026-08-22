import axios from 'axios';
import { bsaConfig } from '../config/bsa.js';
import logger from '../config/logger.js';

let accessToken = null;
let tokenExpiry = null;

// ============================================================
// RETRY HELPERS
// ============================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeWithRetry(fn, maxRetries = 3, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt < maxRetries) {
        logger.info(`⏳ Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        delayMs *= 1.5;
      }
    }
  }
  throw lastError;
}

// ============================================================
// LOGIN (with retry)
// ============================================================
export async function loginToBsa() {
  return await executeWithRetry(async () => {
    const url = bsaConfig.getLoginUrl();
    logger.info(`🔐 Logging into BSA at: ${url}`);

    if (!bsaConfig.baseURL) throw new Error('BSA_BASE_URL is empty');

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
      tokenExpiry = new Date(response.data.expiration);
      logger.info(`✅ BSA Login successful. Token expires at ${tokenExpiry}`);
      return accessToken;
    } else {
      throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
    }
  }, 3, 2000);
}

async function ensureToken() {
  if (!accessToken || (tokenExpiry && new Date() >= tokenExpiry)) {
    logger.info('BSA token expired or missing. Logging in...');
    await loginToBsa();
  }
  return accessToken;
}

// ============================================================
// SUBMIT REPORT (with retry)
// ============================================================
export async function submitReport(payload) {
  return await executeWithRetry(async () => {
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
  }, 3, 3000);
}

// ============================================================
// GET REPORT STATUS (with retry)
// ============================================================
export async function getReportStatus(filename) {
  return await executeWithRetry(async () => {
    const token = await ensureToken();
    const url = `${bsaConfig.baseURL}/api/Status/v${bsaConfig.version}?fileName=${encodeURIComponent(filename)}`;
    logger.info(`📊 Checking status for: ${filename}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain',
      },
      timeout: 15000,
    });

    if (response.status === 200) {
      logger.info(`✅ Status retrieved for ${filename}`);
      return response.data;
    } else {
      logger.warn(`⚠️ Status check returned ${response.status}`);
      return null;
    }
  }, 3, 3000);
}