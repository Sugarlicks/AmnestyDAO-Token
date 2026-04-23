/**
 * Step 4: Compile Smart Contract
 *
 * Reads ORACLE_ADDRESS and POLICY_ID/TOKEN_NAME from backend/.env,
 * updates the Aiken constants.ak with the correct values,
 * compiles the contract, and extracts SCRIPT_CBOR + TREASURY_SCRIPT_ADDRESS.
 *
 * Prerequisites:
 *   - Aiken CLI installed (aikup install)
 *   - Oracle wallet generated (e2e/setup/generate-oracle.ts)
 *   - Tokens minted (e2e/setup/mint-tokens.ts)
 *
 * Usage: npx tsx e2e/setup/compile-contract.ts
 *
 * Output: SCRIPT_CBOR and TREASURY_SCRIPT_ADDRESS for backend/.env
 */

import { deserializeAddress, resolvePlutusScriptAddress, stringToHex } from '@meshsdk/core';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const CONTRACTS_DIR = path.resolve(__dirname, '../../../AmnestyDAO-Token/smart-contracts');
const CONSTANTS_FILE = path.join(CONTRACTS_DIR, 'lib/constants.ak');
const PLUTUS_JSON = path.join(CONTRACTS_DIR, 'plutus.json');

async function main() {
  const oracleAddress = process.env.ORACLE_ADDRESS;
  const policyId = process.env.POLICY_ID;
  const tokenName = process.env.TOKEN_NAME;

  if (!oracleAddress || !policyId || !tokenName) {
    console.error('Missing required env vars: ORACLE_ADDRESS, POLICY_ID, TOKEN_NAME');
    console.error('Run generate-oracle.ts and mint-tokens.ts first.');
    process.exit(1);
  }

  // Derive oracle pubkey hash from address
  const { pubKeyHash } = deserializeAddress(oracleAddress);
  const tokenNameHex = stringToHex(tokenName);

  console.log('=== Compiling Smart Contract ===\n');
  console.log(`Oracle PubKey Hash: ${pubKeyHash}`);
  console.log(`Policy ID:          ${policyId}`);
  console.log(`Token Name:         ${tokenName} (hex: ${tokenNameHex})\n`);

  // Read current constants.ak
  if (!fs.existsSync(CONSTANTS_FILE)) {
    console.error(`constants.ak not found at: ${CONSTANTS_FILE}`);
    console.error('Make sure AmnestyDAO-Token repo is at ../AmnestyDAO-Token relative to amnesty-dao');
    process.exit(1);
  }

  let constants = fs.readFileSync(CONSTANTS_FILE, 'utf-8');

  // Update reward_policy_id
  constants = constants.replace(
    /pub const reward_policy_id: ByteArray =\n\s*#"[a-f0-9]*"/,
    `pub const reward_policy_id: ByteArray =\n  #"${policyId}"`
  );

  // Update reward_token_name
  constants = constants.replace(
    /pub const reward_token_name: ByteArray =\n\s*#"[a-f0-9]*".*$/m,
    `pub const reward_token_name: ByteArray =\n  #"${tokenNameHex}" // "${tokenName}" in hex`
  );

  // Update oracle_pkh (or oracle_verification_key depending on format)
  // Handle both formats: oracle_pkh() function or oracle_verification_key()
  if (constants.includes('pub fn oracle_pkh()')) {
    constants = constants.replace(
      /pub fn oracle_pkh\(\) -> ByteArray \{\n\s*#"[a-f0-9]*"\n\}/,
      `pub fn oracle_pkh() -> ByteArray {\n  #"${pubKeyHash}"\n}`
    );
  }

  fs.writeFileSync(CONSTANTS_FILE, constants);
  console.log('Updated constants.ak with current values.\n');

  // Compile with Aiken
  const aikenBin = path.join(process.env.HOME || '~', '.aiken/bin/aiken');
  const aikenPath = fs.existsSync(aikenBin) ? aikenBin : 'aiken';

  console.log('Compiling Aiken contract...');
  try {
    execSync(`${aikenPath} build`, { cwd: CONTRACTS_DIR, stdio: 'inherit' });
  } catch (err) {
    console.error('\nAiken compilation failed. Make sure Aiken CLI is installed:');
    console.error('  curl -sSfL https://install.aiken-lang.org | bash && aikup install');
    process.exit(1);
  }

  // Extract compiled validator
  if (!fs.existsSync(PLUTUS_JSON)) {
    console.error(`plutus.json not found at: ${PLUTUS_JSON}`);
    process.exit(1);
  }

  const plutus = JSON.parse(fs.readFileSync(PLUTUS_JSON, 'utf-8'));
  const rewardsValidator = plutus.validators.find(
    (v: any) => v.title === 'rewards/oracle_rewards.oracle_rewards.spend'
  );

  if (!rewardsValidator) {
    console.error('oracle_rewards spend validator not found in plutus.json');
    process.exit(1);
  }

  const scriptCbor = rewardsValidator.compiledCode;
  const scriptHash = rewardsValidator.hash;
  const treasuryScriptAddress = resolvePlutusScriptAddress(
    { code: scriptCbor, version: 'V3' },
    0 // preview testnet
  );

  console.log(`\nScript Hash: ${scriptHash}`);
  console.log(`Treasury Script Address: ${treasuryScriptAddress}`);
  console.log(`SCRIPT_CBOR length: ${scriptCbor.length} chars\n`);

  console.log('=== Add to backend/.env ===\n');
  console.log(`TREASURY_SCRIPT_ADDRESS=${treasuryScriptAddress}`);
  console.log(`SCRIPT_CBOR=${scriptCbor}`);

  console.log('\n=== Next Steps ===');
  console.log('1. Copy TREASURY_SCRIPT_ADDRESS and SCRIPT_CBOR to backend/.env');
  console.log('2. Run: npx tsx e2e/setup/seed-treasury-multi.ts');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
