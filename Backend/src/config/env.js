import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');
console.log('[ENV] Loading .env from:', envPath);
console.log('[ENV] File exists?', fs.existsSync(envPath));

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('[ENV] Error loading .env:', result.error);
} else {
  console.log('[ENV] .env loaded successfully.');
  console.log('[ENV] BSA_BASE_URL:', process.env.BSA_BASE_URL);
  console.log('[ENV] ORACLE_USER:', process.env.ORACLE_USER);
}