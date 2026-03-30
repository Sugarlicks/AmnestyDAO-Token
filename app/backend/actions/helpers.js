const fs = require('fs');
const path = require('path');
const { BlockfrostProvider, MeshWallet, MeshTxBuilder, stringToHex } = require('@meshsdk/core');
const { config } = require('dotenv');

config();

const ENV_PATH = path.resolve(process.cwd(), '.env');
const BLOCKFROST_KEY = process.env.BLOCKFROST_KEY;
if (!BLOCKFROST_KEY) {
  console.error('❌ BLOCKFROST_KEY not set in .env');
  process.exit(1);
}
const provider = new BlockfrostProvider(BLOCKFROST_KEY);

// Get network ID from environment variable (0: testnet, 1: mainnet)
function getNetworkId() {
  const network = process.env.NETWORK || 'testnet';
  return network === 'testnet' ? 0 : 1;
}

function getWallet(mnemonic) {
  const wallet = new MeshWallet({
    networkId: getNetworkId(), // 0: testnet, 1: mainnet
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: mnemonic.split(' '), // always split the string
    },
  });
  
  return wallet;
}

async function waitForTransaction(txHash) {
  // Validate input
  if (!txHash || typeof txHash !== 'string' || txHash.trim().length === 0) {
    throw new Error('Invalid transaction hash provided');
  }

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;
    let unsubscribe;

    const cleanup = (error = null) => {
      if (settled) return;
      settled = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (err) {
          console.warn('Error unsubscribing from transaction confirmation:', err.message);
        }
      }
      
      if (error) {
        reject(error);
      }
    };

    const onConfirmed = () => {
      if (settled) return;
      cleanup();
      const endTime = Date.now();
      console.log(`Transaction confirmed after ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
      resolve(true);
    };

    try {
      // Register confirmation listener (capture possible unsubscribe if the provider returns it)
      unsubscribe = provider.onTxConfirmed(txHash, onConfirmed);
      
      // Provider might not return unsubscribe function, which is okay
      // We'll handle it gracefully in cleanup
    } catch (error) {
      // Handle synchronous errors from onTxConfirmed
      cleanup(new Error(`Failed to register transaction confirmation listener: ${error.message}`));
      return;
    }

    // Set a hard timeout and guard against late logging after resolution
    timeoutId = setTimeout(() => {
      if (settled) return;
      cleanup(new Error('Transaction not confirmed within 5 minutes.'));
    }, 10 * 60 * 1000); // 10 minutes timeout
  });
}


function getTxBuilder() {
  return new MeshTxBuilder({
    networkId: getNetworkId(), // 0: testnet, 1: mainnet
    fetcher: provider,
    submitter: provider,
  });
}

async function getAddressUtxos(address) {
  const scriptUtxos = await provider.fetchAddressUTxOs(address);
  return scriptUtxos;
}



async function getBalance(address) {
  const tokenAssetUnit = getTokenAssetUnit(); 
  const utxos = await getAddressUtxos(address);
  let balance = BigInt(0);
  
  // Sum all token amounts from all UTXOs
  utxos.forEach(utxo => {
    const amounts = utxo?.output?.amount ?? utxo?.amount ?? [];
    if (Array.isArray(amounts)) {
      const tokenAmount = amounts.find(a => a && a.unit === tokenAssetUnit);
      if (tokenAmount && tokenAmount.quantity) {
        balance += BigInt(tokenAmount.quantity);
      }
    }
  });
  
  return balance.toString();
}

function getTokenAssetUnit() {
  const policyId = process.env.POLICY_ID;
  const tokenName = process.env.TOKEN_NAME;
  if (!tokenName) {
    throw new Error('TOKEN_NAME not set in environment variables');
  }
  const tokenNameHex = stringToHex(tokenName);
  return policyId + tokenNameHex;
}

/**
 * Get transaction details from Cardano blockchain
 * @param {string} txHash - Cardano transaction hash
 * @returns {Promise<Object>} - Transaction details
 */
async function getTransactionDetails(txHash) {
  try {
    const tx = await provider.fetchTxStatus(txHash);
    return {
      hash: txHash,
      status: tx.status || 'unknown',
      block: tx.block || null,
      blockHeight: tx.block_height || null,
      blockTime: tx.block_time || null
    };
  } catch (error) {
    console.error('Error getting transaction details:', error);
    throw error;
  }
}

/**
 * Submit already-signed transaction to Cardano blockchain
 * @param {string|Object} signedTx - Signed transaction (CBOR hex string or transaction object)
 * @returns {Promise<string>} - Transaction hash
 */
async function submitSignedTransaction(signedTx) {
  try {
    const txHash = await provider.submitTx(signedTx);
    return txHash;
  } catch (error) {
    console.error('Error submitting signed transaction:', error);
    throw error;
  }
}

module.exports = {
  getWallet,
  waitForTransaction,
  getTxBuilder,
  getAddressUtxos,
  getBalance,
  getTokenAssetUnit,
  getTransactionDetails,
  submitSignedTransaction
};
