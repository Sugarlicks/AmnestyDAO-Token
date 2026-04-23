/**
 * Step 5: Seed Treasury
 *
 * Sends HRDT tokens from the oracle wallet to the treasury script address
 * with an inline datum (required for Plutus spending).
 *
 * Usage: npx tsx e2e/setup/seed-treasury.ts
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  mConStr,
  stringToHex,
} from '@meshsdk/core';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const BLOCKFROST_KEY = process.env.BLOCKFROST_KEY!;
const ORACLE_MNEMONIC = process.env.ORACLE_MNEMONIC!;
const POLICY_ID = process.env.POLICY_ID!;
const TOKEN_NAME = process.env.TOKEN_NAME!;
const TREASURY_SCRIPT_ADDRESS = process.env.TREASURY_SCRIPT_ADDRESS!;
const TOKENS_TO_SEED = 5_000; // Enough for many test runs (5 per reward)

async function main() {
  const missing = ['BLOCKFROST_KEY', 'ORACLE_MNEMONIC', 'POLICY_ID', 'TOKEN_NAME', 'TREASURY_SCRIPT_ADDRESS']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('=== Seeding Treasury ===\n');

  const provider = new BlockfrostProvider(BLOCKFROST_KEY);
  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: 'mnemonic', words: ORACLE_MNEMONIC.split(' ') },
  });
  await wallet.init();

  const oracleAddress = await wallet.getChangeAddress();
  const tokenNameHex = stringToHex(TOKEN_NAME);
  const assetUnit = POLICY_ID + tokenNameHex;

  console.log(`Oracle address: ${oracleAddress}`);
  console.log(`Treasury address: ${TREASURY_SCRIPT_ADDRESS}`);
  console.log(`Asset unit: ${assetUnit}`);
  console.log(`Tokens to seed: ${TOKENS_TO_SEED}\n`);

  // Check oracle has the tokens
  const utxos = await provider.fetchAddressUTxOs(oracleAddress);
  let tokenBalance = 0n;
  for (const utxo of utxos) {
    const amounts = utxo.output?.amount || [];
    const token = amounts.find((a: any) => a.unit === assetUnit);
    if (token) tokenBalance += BigInt(token.quantity);
  }
  console.log(`Oracle token balance: ${tokenBalance} ${TOKEN_NAME}`);

  if (tokenBalance < BigInt(TOKENS_TO_SEED)) {
    console.error(`Not enough tokens. Have ${tokenBalance}, need ${TOKENS_TO_SEED}`);
    process.exit(1);
  }

  // Build transaction: send tokens to treasury with inline datum
  // The datum is empty constructor data: mConStr(0, [])
  // This matches how rewards.js creates the change output datum
  const tx = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const unsignedTx = await tx
    .txOut(TREASURY_SCRIPT_ADDRESS, [
      { unit: assetUnit, quantity: String(TOKENS_TO_SEED) },
      { unit: 'lovelace', quantity: '50000000' }, // 50 ADA for min UTxO + fees
    ])
    .txOutInlineDatumValue(mConStr(0, []))
    .changeAddress(oracleAddress)
    .selectUtxosFrom(utxos)
    .complete();

  console.log('Signing transaction...');
  const signedTx = await wallet.signTx(unsignedTx);

  console.log('Submitting transaction...');
  const txHash = await wallet.submitTx(signedTx);
  console.log(`Transaction submitted: ${txHash}`);
  console.log(`View on explorer: https://preview.cardanoscan.io/transaction/${txHash}\n`);

  console.log('Waiting for confirmation...');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 300_000);
    provider.onTxConfirmed(txHash, () => {
      clearTimeout(timeout);
      console.log('Transaction confirmed!\n');
      resolve();
    });
  });

  // Verify treasury balance
  const treasuryUtxos = await provider.fetchAddressUTxOs(TREASURY_SCRIPT_ADDRESS);
  let treasuryTokens = 0n;
  for (const utxo of treasuryUtxos) {
    const amounts = utxo.output?.amount || [];
    const token = amounts.find((a: any) => a.unit === assetUnit);
    if (token) treasuryTokens += BigInt(token.quantity);
  }
  console.log(`Treasury token balance: ${treasuryTokens} ${TOKEN_NAME}`);
  console.log(`Treasury UTxOs: ${treasuryUtxos.length}`);

  console.log('\n=== Treasury Seeded Successfully ===');
  console.log('\nAll blockchain setup is complete. You can now run V2 E2E tests.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
