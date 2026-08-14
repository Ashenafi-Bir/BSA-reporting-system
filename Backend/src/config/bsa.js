import logger from './logger.js';

// These will be populated after env.js is loaded
const baseURL = (process.env.BSA_BASE_URL || '').trim();
const version = (process.env.BSA_API_VERSION || '2').trim();
const username = (process.env.BSA_USERNAME || '').trim();
const password = (process.env.BSA_PASSWORD || '').trim();
const instCode = (process.env.BSA_INST_CODE || '').trim();

logger.info(`BSA Config loaded: baseURL=${baseURL}, version=${version}, username=${username}, instCode=${instCode}`);

if (!baseURL) {
  logger.error('❌ BSA_BASE_URL is not set in environment!');
}
if (!username) {
  logger.error('❌ BSA_USERNAME is not set in environment!');
}
if (!password) {
  logger.error('❌ BSA_PASSWORD is not set in environment!');
}

export const bsaConfig = {
  baseURL,
  version,
  username,
  password,
  instCode,
  getLoginUrl() {
    return `${this.baseURL}${this.loginEndpoint}`;
  },
  getSubmitUrl() {
    return `${this.baseURL}${this.submitEndpoint}`;
  },
  get loginEndpoint() {
    return `/api/Login/v${this.version}`;
  },
  get submitEndpoint() {
    return `/api/Submissionv2/v${this.version}`;
  },
};