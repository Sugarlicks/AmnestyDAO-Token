import { Pool } from 'pg';
import { env } from './env';

const pool = new Pool({ connectionString: env.DATABASE_URL });

/**
 * Set a user's status directly in the database.
 * Used to promote test users to 'admin' or 'approved' without blockchain.
 */
export async function setUserStatus(userId: string, status: string): Promise<void> {
  await pool.query('UPDATE users SET status = $2 WHERE user_id = $1', [userId, status]);
}

/**
 * Simulate a token reward by inserting the DB records that the
 * blockchain reward path would produce (token_transaction + user_contribution).
 *
 * V2 will replace this with a real rewardUser GraphQL mutation.
 */
export async function simulateRewardTransaction(
  userId: string,
  amount: number,
  contributionId: string
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert token_transaction (matches the shape from backend/actions/token.js:createTransaction)
    const txResult = await client.query(
      `INSERT INTO token_transactions
         (to_user_id, user_id, transaction_type, token_amount,
          contribution_id, transaction_status, description)
       VALUES ($1, $1, 'REWARD', $2, $3, 'CONFIRMED', 'E2E simulated reward')
       RETURNING id`,
      [userId, amount, contributionId]
    );
    const transactionId = txResult.rows[0].id;

    // Insert user_contribution record
    await client.query(
      `INSERT INTO user_contributions (user_id, contribution_id, tokens_awarded)
       VALUES ($1, $2, $3)`,
      [userId, contributionId, amount]
    );

    await client.query('COMMIT');
    return transactionId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Simulate a campaign donation by inserting the DB records that the
 * blockchain donation path would produce (token_transaction + campaign_donation).
 *
 * V2 will replace this with real buildDonationTx → sign → submit → confirm.
 */
export async function simulateDonationTransaction(
  userId: string,
  campaignId: string,
  amount: number
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert token_transaction
    const txResult = await client.query(
      `INSERT INTO token_transactions
         (from_user_id, user_id, transaction_type, token_amount,
          campaign_id, transaction_status, description)
       VALUES ($1, $1, 'DONATION', $2, $3, 'CONFIRMED', 'E2E simulated donation')
       RETURNING id`,
      [userId, amount, campaignId]
    );
    const transactionId = txResult.rows[0].id;

    // Insert campaign_donation record
    await client.query(
      `INSERT INTO campaign_donations (campaign_id, user_id, amount, transaction_id)
       VALUES ($1, $2, $3, $4)`,
      [campaignId, userId, amount, transactionId]
    );

    await client.query('COMMIT');
    return transactionId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Clean up all E2E test data from the database.
 * Deletes in dependency order to avoid FK violations.
 * Matches test data by the 'E2E' prefix in user first names.
 */
export async function resetTestData(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find test user IDs
    const userResult = await client.query(
      `SELECT user_id FROM users WHERE first_name LIKE 'E2E%'`
    );
    const userIds = userResult.rows.map((r) => r.user_id);

    if (userIds.length > 0) {
      // Delete in dependency order
      await client.query(
        `DELETE FROM messages WHERE sender_id = ANY($1)`,
        [userIds]
      );
      await client.query(
        `DELETE FROM chat_read_timestamps WHERE user_id = ANY($1)`,
        [userIds]
      );
      await client.query(
        `DELETE FROM chat_participants WHERE user_id = ANY($1)`,
        [userIds]
      );
      await client.query(
        `DELETE FROM campaign_donations WHERE user_id = ANY($1)`,
        [userIds]
      );
      await client.query(
        `DELETE FROM token_transactions WHERE user_id = ANY($1) OR from_user_id = ANY($1) OR to_user_id = ANY($1)`,
        [userIds]
      );
      await client.query(
        `DELETE FROM user_contributions WHERE user_id = ANY($1)`,
        [userIds]
      );
    }

    // Delete test content by title prefix
    await client.query(`DELETE FROM chats WHERE name LIKE 'E2E%'`);
    await client.query(`DELETE FROM campaigns WHERE title LIKE 'E2E%'`);
    await client.query(`DELETE FROM contributions WHERE title LIKE 'E2E%'`);

    // Delete test users last
    if (userIds.length > 0) {
      await client.query(`DELETE FROM users WHERE user_id = ANY($1)`, [userIds]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Wait for a user's registration reward transaction to be confirmed on-chain.
 * Polls the token_transactions table until the reward status changes to CONFIRMED
 * or the timeout expires.
 */
export async function waitForRewardConfirmation(
  userId: string,
  timeoutMs: number = 120_000
): Promise<void> {
  const start = Date.now();
  const pollInterval = 5_000;

  while (Date.now() - start < timeoutMs) {
    const result = await pool.query(
      `SELECT transaction_status, cardano_tx_hash FROM token_transactions
       WHERE user_id = $1 AND transaction_type = 'REWARD'
       ORDER BY timestamp DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No reward transaction yet — the registration reward may not have been attempted
      await new Promise(r => setTimeout(r, pollInterval));
      continue;
    }

    const { transaction_status, cardano_tx_hash } = result.rows[0];

    if (transaction_status === 'CONFIRMED') {
      console.log(`Reward confirmed: ${cardano_tx_hash}`);
      return;
    }

    // Still pending — wait and poll again
    await new Promise(r => setTimeout(r, pollInterval));
  }

  // Timeout — check final state
  const final = await pool.query(
    `SELECT transaction_status FROM token_transactions
     WHERE user_id = $1 AND transaction_type = 'REWARD'
     ORDER BY timestamp DESC LIMIT 1`,
    [userId]
  );

  if (final.rows.length === 0) {
    console.warn('No reward transaction found — registration reward may have failed');
  } else {
    console.warn(`Reward status after timeout: ${final.rows[0].transaction_status}`);
  }
}

/**
 * Look up a user's ID by their email address.
 */
export async function getUserIdByEmail(email: string): Promise<string> {
  const result = await pool.query(
    `SELECT user_id FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (!result.rows[0]) {
    throw new Error(`No user found with email: ${email}`);
  }
  return result.rows[0].user_id;
}

/**
 * Look up an entity's ID by its title (or name) from a given table.
 */
export async function getIdByTitle(
  table: string,
  value: string,
  column: string = 'title'
): Promise<string> {
  const result = await pool.query(
    `SELECT id FROM ${table} WHERE ${column} = $1 LIMIT 1`,
    [value]
  );
  if (!result.rows[0]) {
    throw new Error(`No ${table} found with ${column} = "${value}"`);
  }
  return result.rows[0].id;
}

/**
 * Close the database connection pool.
 */
export async function cleanup(): Promise<void> {
  await pool.end();
}
