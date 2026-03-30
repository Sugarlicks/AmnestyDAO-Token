const { config } = require('dotenv');
const assert = require('assert');
const path = require('path');
const { stringToHex, deserializeAddress, mConStr } = require('@meshsdk/core');
const { getWallet, waitForTransaction, getAddressUtxos, getTxBuilder } = require('./helpers.js');
const { Pool } = require('pg');

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const REQUIRED_KEYS = [
  'ORACLE_MNEMONIC',
  'ORACLE_ADDRESS',
  'POLICY_ID',
  'TOKEN_NAME'
];

const missingKeys = REQUIRED_KEYS.filter((k) => !process.env[k]);

const oracleMnemonic = process.env.ORACLE_MNEMONIC;
const oracleAddress = process.env.ORACLE_ADDRESS;
const policyId = process.env.POLICY_ID;
const tokenName = process.env.TOKEN_NAME;
const network = process.env.NETWORK || 'testnet';

/**
 * Get diagnostic information about wallet UTxOs for collateral debugging
 * @param {Object} wallet - MeshWallet instance
 * @returns {Promise<Object>} Diagnostic information
 */
async function getWalletCollateralDiagnostics(wallet) {
  try {
    const walletAddress = await wallet.getChangeAddress();
    const walletUtxos = await getAddressUtxos(walletAddress);
    
    // Count ADA-only UTxOs (required for collateral)
    const adaOnlyUtxos = walletUtxos.filter(utxo => {
      const amounts = utxo?.output?.amount ?? utxo?.amount ?? [];
      const hasOnlyAda = amounts.length === 1 && amounts[0]?.unit === 'lovelace';
      return hasOnlyAda;
    });
    
    // Calculate total ADA in ADA-only UTxOs
    const totalAdaOnly = adaOnlyUtxos.reduce((sum, utxo) => {
      const amounts = utxo?.output?.amount ?? utxo?.amount ?? [];
      const ada = amounts.find(a => a?.unit === 'lovelace');
      return sum + BigInt(ada?.quantity || 0);
    }, 0n);
    
    return {
      walletAddress,
      totalUtxos: walletUtxos.length,
      adaOnlyUtxos: adaOnlyUtxos.length,
      totalAdaOnly: totalAdaOnly.toString(),
      totalAdaOnlyAda: (Number(totalAdaOnly) / 1_000_000).toFixed(2) + ' ADA'
    };
  } catch (error) {
    console.error('❌ Failed to get wallet diagnostics:', error?.message);
    return null;
  }
}

async function rewardReceiverFromTreasury(receiverAddress, amountToSend, userId = null, contributionId = null, description = 'Reward') {
  
  if (missingKeys.length) {
    console.error('❌ Required env vars missing:', missingKeys.join(', '));
    console.error('👉 Ensure you have generated & funded ORACLE, minted tokens, and seeded the treasury if needed.');
    process.exit(1);
  }

  assert(receiverAddress, '❌ Receiver address not provided');

  // 1) Load and initialize oracle wallet
  const oracleWallet = getWallet(oracleMnemonic);
  assert(oracleWallet, 'Oracle wallet not loaded');
  
  // Initialize wallet if not already initialized (required for getCollateral to work)
  try {
    if (typeof oracleWallet.init === 'function') {
      await oracleWallet.init();
    }
  } catch (initError) {
    console.error('❌ Failed to initialize oracle wallet:', initError?.message);
    throw new Error(`Oracle wallet initialization failed: ${initError?.message}`);
  }

  // 4) Prepare asset unit and amount
  const tokenNameHex = stringToHex(tokenName);
  const rewardToken = policyId + tokenNameHex;

  // 5) Load treasury script address and script CBOR
  let treasuryScriptAddress = process.env.TREASURY_SCRIPT_ADDRESS;
  let scriptCbor = process.env.SCRIPT_CBOR;
  assert(treasuryScriptAddress, '❌ Treasury script address not loaded');

  const signerHash = deserializeAddress(oracleAddress).pubKeyHash;  
  // Ensure required signer (oracle) is set to satisfy on-chain check
  assert(signerHash && signerHash.length === 56, '❌ Could not resolve 28-byte Oracle key hash');

  // 6) Fetch UTxOs at the script address and pick one containing our asset
  const scriptUtxos = await getAddressUtxos(treasuryScriptAddress);

  assert(scriptUtxos.length, '❌ No UTxOs at treasury script address');
  // Rank UTxOs that have the target token by (token qty desc, lovelace desc)

  const rankedCandidates = scriptUtxos
    .map((u) => {
      const amounts = u?.output?.amount ?? u?.amount ?? [];
      const lovelace = BigInt((amounts.find((a) => a && a.unit === 'lovelace')?.quantity) ?? 0n);
      const tokenQty = BigInt((amounts.find((a) => a && a.unit === rewardToken)?.quantity) ?? 0n);
      return { u, lovelace, tokenQty };
    })
    .filter((x) => x.tokenQty > 0n)
    .sort((a, b) => {
      if (a.tokenQty === b.tokenQty) {
        if (a.lovelace === b.lovelace) return 0;
        return a.lovelace < b.lovelace ? 1 : -1;
      }
      return a.tokenQty < b.tokenQty ? 1 : -1;
    });
  const target = rankedCandidates[0]?.u;
  assert(target, `❌ No treasury UTxO with inline datum found holding asset ${rewardToken}. Rerun seeding to create an inline-datum UTxO.`);

  const amounts = target?.output?.amount ?? target?.amount ?? [];
  const currentQty = BigInt((amounts.find((a) => a.unit === rewardToken)?.quantity) ?? 0n);
  assert(currentQty > 0n, '❌ Selected UTxO has zero asset quantity');
  
  const sendQty = BigInt(amountToSend);
  assert(currentQty >= sendQty, `❌ Treasury has insufficient reward token balance (have ${currentQty}, need ${sendQty})`);
  const changeQty = currentQty - sendQty;

  const redeemerValue = mConStr(0, [deserializeAddress(receiverAddress).pubKeyHash, Number(amountToSend)]);

  // 8) Build and submit transaction spending from the script, sending to receiver, and returning change to script
  let txHash;
  try {
    const txBuilder = getTxBuilder();

    // Calculate min ADA per-output using protocol params
    const receiverAssets = [{ unit: rewardToken, quantity: amountToSend }];
    const transactionOutputs = {
      address: receiverAddress,
      amount: [...receiverAssets, { unit: 'lovelace', quantity: '200000000' }],
      plutusData: mConStr(0, []), // empty plutus data
    };

    const receiverMinAda = await txBuilder.calculateMinLovelaceForOutput(transactionOutputs);

    // Select collateral UTxOs from oracle wallet (required for Plutus spending)
    // Collateral requirements:
    // - Must be ADA-only UTxOs (no tokens)
    // - Must be at least 150% of transaction fee (typically 3-5 ADA minimum)
    // - Must be freely spendable (not locked by scripts)
    let collateral;
    try {
      collateral = await oracleWallet.getCollateral();
    } catch (collateralError) {
      console.error('❌ Error calling getCollateral():', collateralError?.message);
      
      // Get diagnostic information about the wallet
      const diagnostics = await getWalletCollateralDiagnostics(oracleWallet);
      
      if (diagnostics) {
        console.error('📊 Wallet diagnostics:', diagnostics);
        throw new Error(
          `No collateral UTxO available. Wallet has ${diagnostics.adaOnlyUtxos} ADA-only UTxO(s) ` +
          `with ${diagnostics.totalAdaOnlyAda} total. ` +
          `Collateral requires ADA-only UTxOs with sufficient ADA (typically 3-5 ADA minimum). ` +
          `Please ensure the oracle wallet has at least one ADA-only UTxO with sufficient balance.`
        );
      } else {
        throw new Error(`No collateral UTxO available: ${collateralError?.message || 'Unknown error'}`);
      }
    }
    
    if (!collateral || !collateral[0]) {
      // Get diagnostic information before throwing error
      const diagnostics = await getWalletCollateralDiagnostics(oracleWallet);
      
      if (diagnostics) {
        console.error('📊 Wallet diagnostics:', diagnostics);
        throw new Error(
          `No collateral UTxO available. Wallet has ${diagnostics.adaOnlyUtxos} ADA-only UTxO(s) ` +
          `with ${diagnostics.totalAdaOnlyAda} total. ` +
          `Collateral requires ADA-only UTxOs with sufficient ADA (typically 3-5 ADA minimum). ` +
          `Please ensure the oracle wallet has at least one ADA-only UTxO with sufficient balance.`
        );
      } else {
        throw new Error('No collateral UTxO available. Unable to get wallet diagnostics.');
      }
    }
    
    const c = collateral[0];
    const t = target;
    const unsignedTx = await txBuilder
      // Spend the script UTxO
      .spendingPlutusScriptV3()
      .txIn(
        t.input.txHash, 
        t.input.outputIndex, 
        t.output.amount, 
        t.output.address
      )    
      .txInScript(scriptCbor)
      // Input carries inline datum
      .txInInlineDatumPresent()
      .txInRedeemerValue(redeemerValue)
      // Pay the receiver the requested tokens
      .txOut(receiverAddress, [
        ...receiverAssets,
        { unit: 'lovelace', quantity: receiverMinAda.toString() },
      ])
      .setNetwork(network)
      .requiredSignerHash(signerHash)
      // Any extra ADA change goes back to treasury to cover fees
      .changeAddress(treasuryScriptAddress)
      .txInCollateral(
        c.input.txHash,
        c.input.outputIndex,
        c.output.amount,
        c.output.address,
      )
      .complete();

    const signedTx = await oracleWallet.signTx(unsignedTx);
    txHash = await oracleWallet.submitTx(signedTx);
    
    if (!txHash) {
      throw new Error('Transaction submission returned no hash');
    }
  } catch (error) {
    console.error('❌ Failed to build/submit reward transaction:', {
      message: error?.message,
      receiverAddress,
      amountToSend
    });
    
    // Extract error message with fallback
    const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
    throw new Error(`Reward transaction submission failed: ${errorMessage}`);
  }

  // Log transaction to database
  let transactionId = null;
  if (userId) {
    try {
      const result = await pool.query(
        `INSERT INTO token_transactions 
         (user_id, transaction_type, cardano_tx_hash, from_wallet_address, to_wallet_address, 
          token_amount, contribution_id, transaction_status, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          userId,
          'REWARD',
          txHash,
          process.env.TREASURY_SCRIPT_ADDRESS,
          receiverAddress,
          amountToSend,
          contributionId,
          'PENDING',
          description
        ]
      );
      
      if (result.rows && result.rows[0]) {
        transactionId = result.rows[0].id;
      }
      
    } catch (dbError) {
      console.error('Error logging transaction to DB:', dbError);
      // Don't fail the reward if DB logging fails
    }
  }

  // Return the tx hash and transaction id; confirmation will be handled by the caller via /api/tx/confirm
  return { txHash, transactionId };
}

module.exports = { rewardReceiverFromTreasury };

