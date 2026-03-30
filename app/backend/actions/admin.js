const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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

async function isAdmin(userId) {
  if (!userId) {
    return false;
  }
  
  try {
    const result = await pool.query(
      'SELECT status FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.status === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get user transactions
 */
async function getUserTransactions(req, res) {
  const userId = extractUserIdFromToken(req.headers.authorization);
  const { userId: requestedUserId } = req.body.input;
  
  // Users can only view their own transactions
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (userId !== requestedUserId) {
    return res.status(403).json({ message: 'You can only view your own transactions' });
  }
  
  try {
    const result = await pool.query(
      `SELECT * FROM token_transactions 
       WHERE from_user_id = $1 OR to_user_id = $1 OR user_id = $1
       ORDER BY timestamp DESC 
       LIMIT 100`,
      [requestedUserId]
    );
    
    // Transform snake_case to camelCase to match GraphQL schema
    // Use token_amount (amount column is deprecated)
    const transactions = result.rows.map(row => {
      // Parse token_amount, handling null values
      const tokenAmount = (row.token_amount != null && row.token_amount !== '') 
        ? parseFloat(row.token_amount) 
        : 0;
      
      return {
        id: row.id,
        userId: row.user_id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        amount: tokenAmount,
        tokenAmount: tokenAmount,
        description: row.description,
        type: row.transaction_type,
        transactionType: row.transaction_type,
        cardanoTxHash: row.cardano_tx_hash,
        fromWalletAddress: row.from_wallet_address,
        toWalletAddress: row.to_wallet_address,
        contributionId: row.contribution_id,
        campaignId: row.campaign_id,
        transactionStatus: row.transaction_status,
        confirmedAt: row.confirmed_at,
        errorMessage: row.error_message,
        timestamp: row.timestamp
      };
    });
    
    return res.json(transactions);
  } catch (error) {
    console.error('Error getting user transactions:', error);
    return res.status(500).json({ message: 'Failed to get user transactions: ' + error.message });
  }
}

module.exports = {
  getUserTransactions
};

