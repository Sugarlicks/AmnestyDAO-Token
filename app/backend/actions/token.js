const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { rewardReceiverFromTreasury } = require('./rewards');
const { getBalance } = require('./helpers');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Helper function to extract user ID from JWT token
function extractUserIdFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.decode(token);
    return decoded?.['https://hasura.io/jwt/claims']?.['x-hasura-user-id'];
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
}

// Helper function to get user balance
async function getUserBalance(userId) {
  // Ensure userId is a valid UUID
  if (!isValidUUID(userId)) {
    return { balance: 0, last_updated: new Date() };
  }

  // Calculate balance from token_transactions (balances are tracked on-chain, this is for display)
  const result = await pool.query(
    `SELECT 
      COALESCE(
        (SELECT COALESCE(SUM(COALESCE(tt_in.token_amount, tt_in.amount, 0)), 0)
         FROM token_transactions tt_in
         WHERE tt_in.to_user_id = $1
           AND (tt_in.transaction_status IS NULL OR tt_in.transaction_status = 'confirmed')
        ) - 
        (SELECT COALESCE(SUM(COALESCE(tt_out.token_amount, tt_out.amount, 0)), 0)
         FROM token_transactions tt_out
         WHERE tt_out.from_user_id = $1
           AND (tt_out.transaction_status IS NULL OR tt_out.transaction_status = 'confirmed')
        ),
        0
      ) as balance,
      NOW() as last_updated`,
    [userId]
  );
  return result.rows[0] || { balance: 0, last_updated: new Date() };
}

// Helper function to create transaction
async function createTransaction(fromUserId, toUserId, amount, description, transactionType) {
  const result = await pool.query(
    `INSERT INTO token_transactions 
     (from_user_id, to_user_id, token_amount, description, transaction_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fromUserId, toUserId, amount, description, transactionType]
  );
  return result.rows[0];
}

// Helper function to validate UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Helper function to get treasury balance from blockchain
async function getTreasuryBalanceFromBlockchain() {
  const treasuryAddress = process.env.TREASURY_SCRIPT_ADDRESS;
  if (!treasuryAddress) {
    throw new Error('Treasury address not configured');
  }
  const balance = await getBalance(treasuryAddress);
  return parseFloat(balance);
}

// Action handlers
module.exports = {
  async rewardUser(req, res) {
    const { toUserId, amount, description } = req.body.input;
    const userId = extractUserIdFromToken(req.headers.authorization);

    if (!isValidUUID(userId) || !isValidUUID(toUserId)) {
      return res.status(400).json({
        message: 'Invalid user ID format'
      });
    }

    // Users can only reward themselves (for completing contributions)
    if (userId !== toUserId) {
      return res.status(403).json({
        message: 'You can only reward yourself'
      });
    }

    try {
      // Ensure amount is a number and positive
      const rewardAmount = Number(amount);
      if (isNaN(rewardAmount) || rewardAmount <= 0) {
        return res.status(400).json({
          message: 'Invalid reward amount'
        });
      }

      // Get user's wallet address (public_key) from database
      const userResult = await pool.query(
        'SELECT public_key FROM users WHERE user_id = $1',
        [toUserId]
      );

      if (!userResult.rows[0] || !userResult.rows[0].public_key) {
        return res.status(400).json({
          message: 'User wallet address not found'
        });
      }

      const receiverAddress = userResult.rows[0].public_key;

      // Try to extract contributionId from the most recent user_contribution
      // This is a best-effort approach - if not found, contributionId will be null
      let contributionId = null;
      try {
        const contributionResult = await pool.query(
          `SELECT contribution_id FROM user_contributions 
           WHERE user_id = $1 
           ORDER BY completed_at DESC 
           LIMIT 1`,
          [toUserId]
        );
        if (contributionResult.rows[0]) {
          contributionId = contributionResult.rows[0].contribution_id;
        }
      } catch (err) {
        console.warn('Could not extract contributionId:', err.message);
        // Continue without contributionId
      }

      // Send reward from treasury using blockchain
      const { txHash, transactionId } = await rewardReceiverFromTreasury(
        receiverAddress,
        rewardAmount.toString(),
        toUserId,
        contributionId,
        description || 'Reward'
      );

      // If we have a transaction ID from the insert, use it directly
      if (transactionId) {
        const transactionResult = await pool.query(
          `SELECT id, user_id, transaction_type, cardano_tx_hash, from_wallet_address, 
                  to_wallet_address, token_amount, contribution_id, transaction_status, 
                  description, timestamp
           FROM token_transactions 
           WHERE id = $1`,
          [transactionId]
        );

        if (transactionResult.rows[0]) {
          const transaction = transactionResult.rows[0];
          return res.json({
            id: transaction.id,
            toUserId: transaction.user_id,
            amount: parseFloat(transaction.token_amount),
            description: transaction.description,
            type: transaction.transaction_type,
            timestamp: transaction.timestamp,
            cardanoTxHash: transaction.cardano_tx_hash,
            transaction_status: transaction.transaction_status
          });
        }
      }

      // Fallback: Query by tx hash if transactionId wasn't available
      const transactionResult = await pool.query(
        `SELECT id, user_id, transaction_type, cardano_tx_hash, from_wallet_address, 
                to_wallet_address, token_amount, contribution_id, transaction_status, 
                description, timestamp
         FROM token_transactions 
         WHERE cardano_tx_hash = $1`,
        [txHash]
      );

      if (transactionResult.rows[0]) {
        const transaction = transactionResult.rows[0];
        return res.json({
          id: transaction.id,
          toUserId: transaction.user_id,
          amount: parseFloat(transaction.token_amount),
          description: transaction.description,
          type: transaction.transaction_type,
          timestamp: transaction.timestamp,
          cardanoTxHash: transaction.cardano_tx_hash,
          transaction_status: transaction.transaction_status
        });
      }

      // If transaction not found in DB, return a minimal response
      return res.json({
        id: null,
        toUserId: toUserId,
        amount: rewardAmount,
        description: description || 'Reward',
        type: 'REWARD',
        timestamp: new Date().toISOString(),
        cardanoTxHash: txHash,
        transaction_status: 'PENDING'
      });
    } catch (error) {
      console.error('Reward error:', error);
      return res.status(500).json({
        message: 'Failed to reward user: ' + error.message
      });
    }
  }
}; 