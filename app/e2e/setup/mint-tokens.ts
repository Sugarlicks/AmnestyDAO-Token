/**
 * Step 3: Create Minting Policy & Mint Tokens
 *
 * Creates a simple native script minting policy using the oracle's key,
 * mints test HRDAO tokens, and sends them to the oracle wallet.
 *
 * Usage: npx tsx e2e/setup/mint-tokens.ts
 *
 * Output: POLICY_ID and TOKEN_NAME for backend/.env
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  ForgeScript,
  Mint,
  stringToHex,
  resolveScriptHash,
} from '@meshsdk/core';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const BLOCKFROST_KEY = process.env.BLOCKFROST_KEY!;
const ORACLE_MNEMONIC = process.env.ORACLE_MNEMONIC!;
const TOKEN_NAME_STRING = 'HRDT';
const MINT_AMOUNT = 10_000; // mint 10,000 tokens

async function main() {
  if (!BLOCKFROST_KEY || !ORACLE_MNEMONIC) {
    console.error('Missing BLOCKFROST_KEY or ORACLE_MNEMONIC in backend/.env');
    process.exit(1);
  }

  console.log('=== Minting HRDAO Tokens ===\n');

  // Set up provider and wallet
  const provider = new BlockfrostProvider(BLOCKFROST_KEY);
  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: 'mnemonic', words: ORACLE_MNEMONIC.split(' ') },
  });
  await wallet.init();

  const oracleAddress = await wallet.getChangeAddress();
  console.log(`Oracle address: ${oracleAddress}`);

  // Check balance
  const utxos = await provider.fetchAddressUTxOs(oracleAddress);
  const totalLovelace = utxos.reduce((sum: bigint, u: any) => {
    const ada = u.output.amount.find((a: any) => a.unit === 'lovelace');
    return sum + BigInt(ada?.quantity || 0);
  }, 0n);
  console.log(`Oracle balance: ${Number(totalLovelace) / 1_000_000} ADA`);

  if (totalLovelace < 5_000_000n) {
    console.error('Not enough ADA. Need at least 5 ADA to mint.');
    process.exit(1);
  }

  // Create a simple native script minting policy (oracle's key can mint)
  const forgingScript = ForgeScript.withOneSignature(oracleAddress);
  const policyId = resolveScriptHash(forgingScript);
  const tokenNameHex = stringToHex(TOKEN_NAME_STRING);

  console.log(`\nPolicy ID: ${policyId}`);
  console.log(`Token Name: ${TOKEN_NAME_STRING}`);
  console.log(`Token Name (hex): ${tokenNameHex}`);
  console.log(`Asset Unit: ${policyId}${tokenNameHex}`);
  console.log(`Minting: ${MINT_AMOUNT} tokens\n`);

  // Build mint transaction
  const tx = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const mint: Mint = {
    assetName: TOKEN_NAME_STRING,
    assetQuantity: String(MINT_AMOUNT),
    metadata: {
      [policyId]: {
        [TOKEN_NAME_STRING]: {
          name: 'HRDT',
          description: 'Human Rights DAO Token (Testnet)',
          ticker: 'HRDT',
        },
      },
    },
    recipient: oracleAddress,
  };

  const unsignedTx = await tx
    .mint(mint.assetQuantity, policyId, tokenNameHex)
    .mintingScript(forgingScript)
    .txOut(oracleAddress, [
      { unit: `${policyId}${tokenNameHex}`, quantity: String(MINT_AMOUNT) },
    ])
    .changeAddress(oracleAddress)
    .selectUtxosFrom(utxos)
    .complete();

  console.log('Signing transaction...');
  const signedTx = await wallet.signTx(unsignedTx);

  console.log('Submitting transaction...');
  const txHash = await wallet.submitTx(signedTx);
  console.log(`Transaction submitted: ${txHash}`);
  console.log(`View on explorer: https://preview.cardanoscan.io/transaction/${txHash}\n`);

  // Wait for confirmation
  console.log('Waiting for confirmation...');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for confirmation')), 300_000);
    provider.onTxConfirmed(txHash, () => {
      clearTimeout(timeout);
      console.log('Transaction confirmed!\n');
      resolve();
    });
  });

  console.log('=== Add to backend/.env ===\n');
  console.log(`POLICY_ID=${policyId}`);
  console.log(`TOKEN_NAME=${TOKEN_NAME_STRING}`);

  console.log('\n=== Next Steps ===');
  console.log('1. Copy POLICY_ID and TOKEN_NAME to backend/.env');
  console.log('2. Update constants.ak with the policy ID and token name');
  console.log('3. Compile the Aiken smart contract: cd AmnestyDAO-Token/smart-contracts && aiken build');
  console.log('4. Run: npx tsx e2e/setup/seed-treasury.ts');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
