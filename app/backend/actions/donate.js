const { submitSignedTransaction, getTxBuilder, getTokenAssetUnit, getAddressUtxos } = require('./helpers');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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

// Helper function to validate UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Build unsigned donation transaction (Hasura action handler)
 * Builds transaction on backend using BLOCKFROST_KEY, returns unsigned transaction for frontend to sign
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function buildDonationTransaction(req, res) {
  const { campaignId, amount, userAddress } = req.body.input;
  const userId = extractUserIdFromToken(req.headers.authorization);

  if (!isValidUUID(userId) || !isValidUUID(campaignId)) {
    return res.status(400).json({
      message: 'Invalid user ID or campaign ID format'
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      message: 'Amount must be greater than 0'
    });
  }

  if (!userAddress) {
    return res.status(400).json({
      message: 'User address is required'
    });
  }

  try {
    // Check if campaign exists and is active
    const campaignResult = await pool.query(
      'SELECT id, is_active FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (!campaignResult.rows[0]) {
      return res.status(404).json({
        message: 'Campaign not found'
      });
    }

    if (!campaignResult.rows[0].is_active) {
      return res.status(400).json({
        message: 'Campaign is not active'
      });
    }

    const treasuryAddress = process.env.TREASURY_SCRIPT_ADDRESS;
    if (!treasuryAddress) {
      return res.status(500).json({
        message: 'Treasury address not configured'
      });
    }

    // Build unsigned transaction on backend
    const tokenAssetUnit = getTokenAssetUnit();
    const txBuilder = getTxBuilder();

    // Fetch UTXOs from user's address
    const userUtxos = await getAddressUtxos(userAddress);
    
    if (!userUtxos || userUtxos.length === 0) {
      return res.status(400).json({
        message: 'No UTXOs found for user address'
      });
    }

    // Calculate minimum ADA required for the output
    const outputAssets = [
      { unit: tokenAssetUnit, quantity: amount.toString() },
      { unit: 'lovelace', quantity: '2000000' } // Initial ADA estimate
    ];

    const minAda = await txBuilder.calculateMinLovelaceForOutput({
      address: treasuryAddress,
      amount: outputAssets,
    });

    // Build the transaction with explicit UTXO inputs
    const unsignedTx = await txBuilder
      .selectUtxosFrom(userUtxos)
      .txOut(treasuryAddress, [
        { unit: tokenAssetUnit, quantity: amount.toString() },
        { unit: 'lovelace', quantity: minAda.toString() }
      ])
      .changeAddress(userAddress)
      .setNetwork(process.env.NETWORK === 'testnet' ? 0 : 1)
      .complete();

    // Return unsigned transaction (will be serialized as CBOR)
    return res.json({
      unsignedTransaction: unsignedTx,
      treasuryAddress,
      tokenAssetUnit
    });
  } catch (error) {
    console.error('Build donation transaction error:', error);
    return res.status(500).json({
      message: 'Failed to build transaction: ' + error.message
    });
  }
}

/**
 * Donate tokens from user wallet to campaign treasury (Hasura action handler)
 * Receives already-signed transaction from frontend and submits it to blockchain
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function donateToCampaign(req, res) {
  const { campaignId, amount, signedTransaction } = req.body.input;
  const userId = extractUserIdFromToken(req.headers.authorization);

  if (!isValidUUID(userId) || !isValidUUID(campaignId)) {
    return res.status(400).json({
      message: 'Invalid user ID or campaign ID format'
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      message: 'Amount must be greater than 0'
    });
  }

  if (!signedTransaction) {
    return res.status(400).json({
      message: 'Signed transaction is required'
    });
  }

  try {
    // Check if campaign exists and is active
    const campaignResult = await pool.query(
      'SELECT id, is_active FROM campaigns WHERE id = $1',
      [campaignId]
    );
    const campaign = campaignResult.rows[0];

    if (!campaign) {
      return res.status(404).json({
        message: 'Campaign not found'
      });
    }

    if (!campaign.is_active) {
      return res.status(400).json({
        message: 'Campaign is not active'
      });
    }

    // Get user's wallet address from users table
    const userResult = await pool.query(
      'SELECT public_key FROM users WHERE user_id = $1',
      [userId]
    );

    if (!userResult.rows[0] || !userResult.rows[0].public_key) {
      return res.status(400).json({
        message: 'User wallet address not found'
      });
    }

    const userAddress = userResult.rows[0].public_key;
    const treasuryAddress = process.env.TREASURY_SCRIPT_ADDRESS;

    // Submit signed transaction to Cardano blockchain
    const txHash = await submitSignedTransaction(signedTransaction);
    
    if (!txHash) {
      throw new Error('Transaction submission returned no hash');
    }

    // Log transaction to database
    const transactionResult = await pool.query(
      `INSERT INTO token_transactions 
       (user_id, transaction_type, cardano_tx_hash, from_wallet_address, to_wallet_address, 
        token_amount, campaign_id, transaction_status, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        'DONATION',
        txHash,
        userAddress,
        treasuryAddress,
        amount,
        campaignId,
        'PENDING',
        `Donation to campaign: ${campaign.title}`
      ]
    );

    const transactionId = transactionResult.rows[0].id;

    // Create donation record linking to transaction
    await pool.query(
      `INSERT INTO campaign_donations 
       (campaign_id, user_id, amount, transaction_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [campaignId, userId, amount, transactionId]
    );
    
    // Return txHash for frontend to track confirmation
    return res.json({
      id: transactionId,
      campaignId,
      userId,
      amount: parseFloat(amount),
      donatedAt: new Date().toISOString(),
      txHash
    });
  } catch (error) {
    console.error('Donate to campaign error:', error);
    return res.status(500).json({
      message: 'Failed to process donation: ' + error.message
    });
  }
}

module.exports = {
  buildDonationTransaction,
  donateToCampaign
};

