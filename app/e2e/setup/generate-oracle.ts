/**
 * Step 2: Generate Oracle Wallet
 *
 * Creates a new BIP39 mnemonic, derives the oracle wallet address
 * and verification key hash needed for the Aiken smart contract constants.
 *
 * Usage: npx tsx e2e/setup/generate-oracle.ts
 *
 * Output: Prints values to add to backend/.env and constants.ak
 */

import { MeshWallet, deserializeAddress } from '@meshsdk/core';
import * as crypto from 'crypto';

async function main() {
  console.log('=== Generating Oracle Wallet ===\n');

  // Generate mnemonic
  const mnemonicRaw = await MeshWallet.brew();
  const mnemonic = Array.isArray(mnemonicRaw) ? mnemonicRaw.join(' ') : mnemonicRaw;
  const words = Array.isArray(mnemonicRaw) ? mnemonicRaw : mnemonicRaw.split(' ');

  // Create wallet on preview testnet (networkId: 0)
  const wallet = new MeshWallet({
    networkId: 0,
    key: { type: 'mnemonic', words },
  });
  await wallet.init();

  const address = await wallet.getChangeAddress();
  const { pubKeyHash } = deserializeAddress(address);

  console.log('Oracle Mnemonic (SAVE THIS — cannot be recovered):');
  console.log(`  ${mnemonic}\n`);

  console.log('Oracle Address (fund this with ~50 test ADA):');
  console.log(`  ${address}\n`);

  console.log('Oracle PubKey Hash (28 bytes hex):');
  console.log(`  ${pubKeyHash}\n`);

  // Convert pubKeyHash to the format needed for Aiken constants.ak
  // The oracle_verification_key() in constants.ak uses a full 32-byte verification key,
  // but the validator actually calls pkh_from_vk() which blake2b_224 hashes it.
  // For our purposes, we need the hash that matches what deserializeAddress returns.
  console.log('=== Add to backend/.env ===\n');
  console.log(`ORACLE_MNEMONIC=${mnemonic}`);
  console.log(`ORACLE_ADDRESS=${address}`);

  console.log('\n=== Update in constants.ak ===\n');
  console.log('The oracle_verification_key() function needs the 32-byte ed25519 public key.');
  console.log('The pubKeyHash above is the blake2b_224 of that key.');
  console.log(`PubKey Hash for reference: ${pubKeyHash}`);

  console.log('\n=== Next Steps ===');
  console.log('1. Copy the ORACLE_MNEMONIC and ORACLE_ADDRESS to backend/.env');
  console.log('2. Fund the oracle address with ~50 test ADA from the faucet');
  console.log('3. Run: npx tsx e2e/setup/mint-tokens.ts');
}

main().catch(console.error);
