import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Load environment variables in priority order
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production'
  : process.env.NODE_ENV === 'development'
  ? '.env.development'
  : '.env';

dotenv.config({ path: path.join(rootDir, envFile) });
dotenv.config({ path: path.join(rootDir, '.env.local') }); // Local overrides

export const getEnv = (key, defaultValue = '') => {
  return process.env[key] || defaultValue;
};
