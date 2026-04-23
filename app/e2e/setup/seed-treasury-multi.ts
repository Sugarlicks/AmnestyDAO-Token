/**
 * Seed Treasury with Multiple UTxOs
 *
 * Creates 20 separate UTxOs at the treasury script address, each with
 * tokens + ADA. This prevents UTxO contention when multiple rewards
 * are processed in quick succession.
 *
 * Usage: npx tsx e2e/setup/seed-treasury-multi.ts
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

const NUM_UTXOS = 20;
const TOKENS_PER_UTXO = 100;  // 100 tokens per UTxO (2,000 total)
const ADA_PER_UTXO = '25000000'; // 25 ADA per UTxO (500 ADA total)

async function main() {
  const missing = ['BLOCKFROST_KEY', 'ORACLE_MNEMONIC', 'POLICY_ID', 'TOKEN_NAME', 'TREASURY_SCRIPT_ADDRESS']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('=== Seeding Treasury with Multiple UTxOs ===\n');

  const provider = new BlockfrostProvider(BLOCKFROST_KEY);
  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: 'mnemonic', words: ORACLE_MNEMONIC.split(' ') },
  });

  const oracleAddress = await wallet.getChangeAddress();
  const tokenNameHex = stringToHex(TOKEN_NAME);
  const assetUnit = POLICY_ID + tokenNameHex;

  console.log(`Oracle: ${oracleAddress}`);
  console.log(`Treasury: ${TREASURY_SCRIPT_ADDRESS}`);
  console.log(`Creating ${NUM_UTXOS} UTxOs, each with ${TOKENS_PER_UTXO} ${TOKEN_NAME} + ${Number(ADA_PER_UTXO) / 1e6} ADA\n`);

  // Check oracle has enough tokens
  const utxos = await provider.fetchAddressUTxOs(oracleAddress);
  let tokenBalance = 0n;
  for (const utxo of utxos) {
    const amounts = utxo.output?.amount || [];
    const token = amounts.find((a: any) => a.unit === assetUnit);
    if (token) tokenBalance += BigInt(token.quantity);
  }

  const totalTokensNeeded = NUM_UTXOS * TOKENS_PER_UTXO;
  console.log(`Oracle has ${tokenBalance} ${TOKEN_NAME}, need ${totalTokensNeeded}`);
  if (tokenBalance < BigInt(totalTokensNeeded)) {
    console.error(`Not enough tokens! Mint more first.`);
    process.exit(1);
  }

  // Build a single transaction with 20 outputs to the treasury
  const tx = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  // Add all 20 outputs
  for (let i = 0; i < NUM_UTXOS; i++) {
    tx.txOut(TREASURY_SCRIPT_ADDRESS, [
      { unit: assetUnit, quantity: String(TOKENS_PER_UTXO) },
      { unit: 'lovelace', quantity: ADA_PER_UTXO },
    ]);
    tx.txOutInlineDatumValue(mConStr(0, []));
  }

  const unsignedTx = await tx
    .changeAddress(oracleAddress)
    .selectUtxosFrom(utxos)
    .complete();

  console.log('Signing transaction...');
  const signedTx = await wallet.signTx(unsignedTx);

  console.log('Submitting transaction...');
  const txHash = await wallet.submitTx(signedTx);
  console.log(`TX: ${txHash}`);

  console.log('Waiting for confirmation...');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 300_000);
    provider.onTxConfirmed(txHash, () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  console.log('Confirmed!\n');

  // Verify
  const treasuryUtxos = await provider.fetchAddressUTxOs(TREASURY_SCRIPT_ADDRESS);
  let totalTokens = 0n;
  let tokenUtxoCount = 0;
  for (const utxo of treasuryUtxos) {
    const amounts = utxo.output?.amount || [];
    const token = amounts.find((a: any) => a.unit === assetUnit);
    if (token) {
      totalTokens += BigInt(token.quantity);
      tokenUtxoCount++;
    }
  }

  console.log(`Treasury: ${tokenUtxoCount} UTxOs with ${totalTokens} ${TOKEN_NAME} total`);
  console.log('Done!');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
