/**
 * Seed test data for load testing
 *
 * This script creates test users, campaigns, and contributions in the database
 * and outputs a JSON file with user credentials that k6 tests can consume.
 *
 * Prerequisites:
 *   - Backend services running (docker compose up -d)
 *   - Database migrated (hasura migrate apply)
 *
 * Usage:
 *   cp ../backend/.env .env   # or set DATABASE_URL, JWT_SECRET manually
 *   node scripts/seed-test-data.js [--users 50] [--campaigns 5] [--contributions 20]
 */

// Load env from load-tests/.env first, fall back to backend/.env
const localEnv = require('path').resolve(__dirname, '../.env');
const backendEnv = require('path').resolve(__dirname, '../../backend/.env');
const fs_ = require('fs');
require('dotenv').config({ path: fs_.existsSync(localEnv) ? localEnv : backendEnv });

// DATABASE_URL in .env may point to 'postgres' (Docker network hostname).
// When running from the host, replace with localhost for direct DB access.
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/@postgres:/, '@localhost:');
}

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Copy backend/.env or set it manually.');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('JWT_SECRET not set. Copy backend/.env or set it manually.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1]);
  return defaultVal;
}

const NUM_USERS = getArg('users', 50);
const NUM_CAMPAIGNS = getArg('campaigns', 5);
const NUM_CONTRIBUTIONS = getArg('contributions', 5);

// Generate a fake Cardano testnet address
function fakeAddress(index) {
  const hex = index.toString(16).padStart(8, '0');
  return `addr_test1qz${hex}${'a'.repeat(44)}`;
}

// Generate a Hasura-compatible JWT for a test user
function generateJWT(userId, status) {
  return jwt.sign(
    {
      sub: userId,
      'https://hasura.io/jwt/claims': {
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': ['user'],
        'x-hasura-user-id': userId,
        'x-hasura-user-status': status || 'approved',
      },
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function seed() {
  const client = await pool.connect();
  const testUsers = [];
  const campaignIds = [];
  const contributionIds = [];

  try {
    await client.query('BEGIN');

    console.log(`Seeding ${NUM_CAMPAIGNS} campaigns...`);
    for (let i = 0; i < NUM_CAMPAIGNS; i++) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO campaigns (id, title, description, goal_tokens, category, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, `LoadTest Campaign ${i + 1}`, `Campaign for load testing (${i + 1})`, 10000, 'Digital Rights']
      );
      campaignIds.push(id);
    }

    console.log(`Seeding ${NUM_CONTRIBUTIONS} contributions...`);
    const contributionTypes = ['visit', 'share', 'scan'];
    for (let i = 0; i < NUM_CONTRIBUTIONS; i++) {
      const id = uuidv4();
      const type = contributionTypes[i % contributionTypes.length];
      await client.query(
        `INSERT INTO contributions (id, title, description, contribution_type, token_reward, is_active, action_button_text, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, `LoadTest ${type} ${i + 1}`, `Contribution for load testing`, type, (5 + (i % 10)).toString(), 'Complete Action']
      );
      contributionIds.push(id);
    }

    console.log(`Seeding ${NUM_USERS} test users...`);
    for (let i = 0; i < NUM_USERS; i++) {
      const userId = uuidv4();
      const walletAddress = fakeAddress(i);

      await client.query(
        `INSERT INTO users (user_id, public_key, first_name, last_name, reason, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'approved', NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, walletAddress, `LoadTest${i}`, `User${i}`, 'Load testing']
      );

      const jwtToken = generateJWT(userId, 'approved');

      testUsers.push({
        userId,
        walletAddress,
        jwt: jwtToken,
        testCampaignId: campaignIds[i % campaignIds.length],
        testContributionId: contributionIds[i % contributionIds.length],
        // Pre-signed transactions would go here if we had wallet mnemonics
        preSignedDonationTx: null,
      });
    }

    await client.query('COMMIT');

    // Write test users to file for k6 consumption
    const outputPath = path.resolve(__dirname, '../results/test-users.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(testUsers, null, 2));

    console.log(`\nSeeding complete:`);
    console.log(`  ${NUM_USERS} users`);
    console.log(`  ${NUM_CAMPAIGNS} campaigns`);
    console.log(`  ${NUM_CONTRIBUTIONS} contributions`);
    console.log(`\nTest users written to: ${outputPath}`);
    console.log(`\nJWT tokens expire in 24h — re-run this script to refresh.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Clean up all load test data from the database.
 * Follows the same dependency-order deletion as e2e/helpers/db.ts:resetTestData()
 * but matches 'LoadTest' prefix instead of 'E2E'.
 */
async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT user_id FROM users WHERE first_name LIKE 'LoadTest%'`
    );
    const userIds = userResult.rows.map((r) => r.user_id);

    if (userIds.length > 0) {
      await client.query(`DELETE FROM campaign_donations WHERE user_id = ANY($1)`, [userIds]);
      await client.query(
        `DELETE FROM token_transactions WHERE user_id = ANY($1) OR from_user_id = ANY($1) OR to_user_id = ANY($1)`,
        [userIds]
      );
      await client.query(`DELETE FROM user_contributions WHERE user_id = ANY($1)`, [userIds]);
      await client.query(`DELETE FROM users WHERE user_id = ANY($1)`, [userIds]);
    }

    await client.query(`DELETE FROM campaigns WHERE title LIKE 'LoadTest%'`);
    await client.query(`DELETE FROM contributions WHERE title LIKE 'LoadTest%'`);

    await client.query('COMMIT');
    console.log(`Cleaned up ${userIds.length} load test users and associated data.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// CLI: --cleanup to remove test data, otherwise seed
if (args.includes('--cleanup')) {
  cleanup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
