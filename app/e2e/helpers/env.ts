import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Check backend/.env`);
  }
  return value;
}

// DATABASE_URL in .env points to 'postgres' (Docker network hostname).
// E2E tests run on the host, so replace with localhost for direct DB access.
const rawDbUrl = requireEnv('DATABASE_URL');
const hostDbUrl = rawDbUrl.replace(/@postgres:/, '@localhost:');

export const env = {
  DATABASE_URL: hostDbUrl,
  JWT_SECRET: requireEnv('JWT_SECRET'),
  HASURA_ADMIN_SECRET: requireEnv('HASURA_ADMIN_SECRET'),

  AUTH_URL: process.env.AUTH_URL || 'http://localhost:4000',
  HASURA_URL: process.env.HASURA_URL || 'http://localhost:8080/v1/graphql',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:9000',
};
