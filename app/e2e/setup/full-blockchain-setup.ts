/**
 * Full Blockchain Setup Pipeline
 *
 * Runs all steps in order to set up the Cardano testnet infrastructure
 * from scratch. Pauses for manual steps (faucet funding).
 *
 * Steps:
 *   1. Generate oracle wallet → ORACLE_MNEMONIC, ORACLE_ADDRESS
 *   2. [MANUAL] Fund oracle via testnet faucet
 *   3. Mint HRDT tokens → POLICY_ID, TOKEN_NAME
 *   4. Compile smart contract → SCRIPT_CBOR, TREASURY_SCRIPT_ADDRESS
 *   5. Seed treasury with tokens
 *
 * Usage: npx tsx e2e/setup/full-blockchain-setup.ts
 */

import { MeshWallet, BlockfrostProvider, MeshTxBuilder, ForgeScript, resolveScriptHash, resolvePlutusScriptAddress, deserializeAddress, stringToHex, mConStr } from '@meshsdk/core';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const ENV_PATH = path.resolve(__dirname, '../../backend/.env');
const CONTRACTS_DIR = path.resolve(__dirname, '../../../AmnestyDAO-Token/smart-contracts');
const CONSTANTS_FILE = path.join(CONTRACTS_DIR, 'lib/constants.ak');
const PLUTUS_JSON = path.join(CONTRACTS_DIR, 'plutus.json');

const TOKEN_NAME_STRING = 'HRDT';
const MINT_AMOUNT = 10_000;
const NUM_TREASURY_UTXOS = 20;
const TOKENS_PER_UTXO = 100;  // 100 tokens per UTxO (2,000 total)
const ADA_PER_UTXO = '25000000'; // 25 ADA per UTxO (500 ADA total)

function loadEnv() {
  dotenv.config({ path: ENV_PATH });
}

function updateEnvVar(key: string, value: string) {
  let env = fs.readFileSync(ENV_PATH, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(env)) {
    env = env.replace(regex, `${key}=${value}`);
  } else {
    env += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, env);
}

async function waitForInput(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function waitForConfirmation(provider: BlockfrostProvider, txHash: string): Promise<void> {
  console.log('Waiting for on-chain confirmation...');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout (5 min)')), 300_000);
    provider.onTxConfirmed(txHash, () => {
      clearTimeout(timeout);
      console.log('Confirmed!\n');
      resolve();
    });
  });
}

async function main() {
  loadEnv();

  const blockfrostKey = process.env.BLOCKFROST_KEY;
  if (!blockfrostKey) {
    console.error('BLOCKFROST_KEY not set in backend/.env. Get one at https://blockfrost.io');
    process.exit(1);
  }

  const provider = new BlockfrostProvider(blockfrostKey);

  // Verify Blockfrost connectivity
  try {
    await (provider as any).fetchLatestBlock?.() ||
      await fetch(`https://cardano-preview.blockfrost.io/api/v0/blocks/latest`, {
        headers: { project_id: blockfrostKey }
      });
    console.log('Blockfrost API connected (preview network)\n');
  } catch {
    console.error('Cannot connect to Blockfrost. Check your API key.');
    process.exit(1);
  }

  // ═══════════════════════════════════════════
  // STEP 1: Generate Oracle Wallet
  // ═══════════════════════════════════════════
  console.log('═══ Step 1: Generate Oracle Wallet ═══\n');

  let oracleMnemonic = process.env.ORACLE_MNEMONIC;
  let oracleAddress = process.env.ORACLE_ADDRESS;

  if (oracleMnemonic && oracleAddress) {
    console.log(`Oracle already configured: ${oracleAddress}`);
    console.log('Skipping generation.\n');
  } else {
    const mnemonicRaw = await MeshWallet.brew();
    oracleMnemonic = Array.isArray(mnemonicRaw) ? mnemonicRaw.join(' ') : mnemonicRaw;
    const words = Array.isArray(mnemonicRaw) ? mnemonicRaw : mnemonicRaw.split(' ');
    const wallet = new MeshWallet({ networkId: 0, key: { type: 'mnemonic', words } });
    await wallet.init();
    oracleAddress = await wallet.getChangeAddress();

    updateEnvVar('ORACLE_MNEMONIC', oracleMnemonic);
    updateEnvVar('ORACLE_ADDRESS', oracleAddress);

    console.log(`Generated oracle wallet: ${oracleAddress}`);
    console.log('Saved to backend/.env\n');
  }

  const { pubKeyHash: oraclePkh } = deserializeAddress(oracleAddress);
  console.log(`Oracle PubKey Hash: ${oraclePkh}\n`);

  // ═══════════════════════════════════════════
  // STEP 2: Fund Oracle (Manual)
  // ═══════════════════════════════════════════
  console.log('═══ Step 2: Fund Oracle Wallet ═══\n');

  let oracleBalance = 0n;
  try {
    const utxos = await provider.fetchAddressUTxOs(oracleAddress);
    oracleBalance = utxos.reduce((sum: bigint, u: any) => {
      const ada = (u.output?.amount || []).find((a: any) => a.unit === 'lovelace');
      return sum + BigInt(ada?.quantity || 0);
    }, 0n);
  } catch { /* address not found = 0 balance */ }

  if (oracleBalance < 10_000_000n) {
    console.log(`Oracle balance: ${Number(oracleBalance) / 1_000_000} ADA (need at least 10 ADA)\n`);
    console.log('Fund the oracle address via the Cardano Preview Testnet faucet:');
    console.log('  https://docs.cardano.org/cardano-testnets/tools/faucet/');
    console.log(`  Address: ${oracleAddress}\n`);
    await waitForInput('Press ENTER after funding the oracle...');
    loadEnv(); // reload in case something changed

    // Re-check balance
    const utxos = await provider.fetchAddressUTxOs(oracleAddress);
    oracleBalance = utxos.reduce((sum: bigint, u: any) => {
      const ada = (u.output?.amount || []).find((a: any) => a.unit === 'lovelace');
      return sum + BigInt(ada?.quantity || 0);
    }, 0n);

    if (oracleBalance < 10_000_000n) {
      console.error(`Still only ${Number(oracleBalance) / 1_000_000} ADA. Wait for the faucet tx to confirm and try again.`);
      process.exit(1);
    }
  }
  console.log(`Oracle balance: ${Number(oracleBalance) / 1_000_000} ADA ✓\n`);

  // ═══════════════════════════════════════════
  // STEP 3: Mint Tokens
  // ═══════════════════════════════════════════
  console.log('═══ Step 3: Mint HRDT Tokens ═══\n');

  let policyId = process.env.POLICY_ID;
  const tokenNameHex = stringToHex(TOKEN_NAME_STRING);

  if (policyId) {
    // Check if oracle already has tokens
    const utxos = await provider.fetchAddressUTxOs(oracleAddress);
    const assetUnit = policyId + tokenNameHex;
    let tokenBal = 0n;
    for (const u of utxos) {
      const t = (u.output?.amount || []).find((a: any) => a.unit === assetUnit);
      if (t) tokenBal += BigInt(t.quantity);
    }
    if (tokenBal > 0n) {
      console.log(`Tokens already minted. Oracle holds ${tokenBal} ${TOKEN_NAME_STRING}`);
      console.log(`Policy ID: ${policyId}`);
      console.log('Skipping minting.\n');
    } else {
      policyId = null; // force re-mint
    }
  }

  if (!policyId) {
    const wallet = new MeshWallet({
      networkId: 0, fetcher: provider, submitter: provider,
      key: { type: 'mnemonic', words: oracleMnemonic!.split(' ') },
    });
    await wallet.init();

    const forgingScript = ForgeScript.withOneSignature(oracleAddress);
    policyId = resolveScriptHash(forgingScript);
    const assetUnit = policyId + tokenNameHex;

    console.log(`Policy ID: ${policyId}`);
    console.log(`Minting ${MINT_AMOUNT} ${TOKEN_NAME_STRING}...\n`);

    const utxos = await provider.fetchAddressUTxOs(oracleAddress);
    const tx = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    const unsignedTx = await tx
      .mint(String(MINT_AMOUNT), policyId, tokenNameHex)
      .mintingScript(forgingScript)
      .txOut(oracleAddress, [{ unit: assetUnit, quantity: String(MINT_AMOUNT) }])
      .changeAddress(oracleAddress)
      .selectUtxosFrom(utxos)
      .complete();

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);
    console.log(`Tx: ${txHash}`);
    await waitForConfirmation(provider, txHash);

    updateEnvVar('POLICY_ID', policyId);
    updateEnvVar('TOKEN_NAME', TOKEN_NAME_STRING);
    console.log('Saved POLICY_ID and TOKEN_NAME to backend/.env\n');
  }

  // ═══════════════════════════════════════════
  // STEP 4: Compile Smart Contract
  // ═══════════════════════════════════════════
  console.log('═══ Step 4: Compile Smart Contract ═══\n');

  if (!fs.existsSync(CONSTANTS_FILE)) {
    console.error(`constants.ak not found at: ${CONSTANTS_FILE}`);
    console.error('Ensure AmnestyDAO-Token repo is at ../AmnestyDAO-Token relative to amnesty-dao');
    process.exit(1);
  }

  // Update constants.ak
  let constants = fs.readFileSync(CONSTANTS_FILE, 'utf-8');

  constants = constants.replace(
    /pub const reward_policy_id: ByteArray =\n\s*#"[a-f0-9]*"/,
    `pub const reward_policy_id: ByteArray =\n  #"${policyId}"`
  );
  constants = constants.replace(
    /pub const reward_token_name: ByteArray =\n\s*#"[a-f0-9]*".*$/m,
    `pub const reward_token_name: ByteArray =\n  #"${tokenNameHex}" // "${TOKEN_NAME_STRING}" in hex`
  );
  if (constants.includes('pub fn oracle_pkh()')) {
    constants = constants.replace(
      /pub fn oracle_pkh\(\) -> ByteArray \{\n\s*#"[a-f0-9]*"\n\}/,
      `pub fn oracle_pkh() -> ByteArray {\n  #"${oraclePkh}"\n}`
    );
  }

  fs.writeFileSync(CONSTANTS_FILE, constants);
  console.log('Updated constants.ak');

  // Compile
  const aikenBin = path.join(process.env.HOME || '~', '.aiken/bin/aiken');
  const aikenPath = fs.existsSync(aikenBin) ? aikenBin : 'aiken';

  console.log('Compiling...');
  try {
    execSync(`${aikenPath} build`, { cwd: CONTRACTS_DIR, stdio: 'pipe' });
    console.log('Compilation successful!\n');
  } catch (err: any) {
    console.error('Aiken compilation failed:');
    console.error(err.stderr?.toString() || err.message);
    process.exit(1);
  }

  // Extract SCRIPT_CBOR and derive TREASURY_SCRIPT_ADDRESS
  const plutus = JSON.parse(fs.readFileSync(PLUTUS_JSON, 'utf-8'));
  const validator = plutus.validators.find(
    (v: any) => v.title === 'rewards/oracle_rewards.oracle_rewards.spend'
  );
  if (!validator) {
    console.error('oracle_rewards spend validator not found in plutus.json');
    process.exit(1);
  }

  const scriptCbor = validator.compiledCode;
  const treasuryScriptAddress = resolvePlutusScriptAddress({ code: scriptCbor, version: 'V3' }, 0);

  updateEnvVar('SCRIPT_CBOR', scriptCbor);
  updateEnvVar('TREASURY_SCRIPT_ADDRESS', treasuryScriptAddress);

  console.log(`Script Hash: ${validator.hash}`);
  console.log(`Treasury Address: ${treasuryScriptAddress}`);
  console.log('Saved SCRIPT_CBOR and TREASURY_SCRIPT_ADDRESS to backend/.env\n');

  // ═══════════════════════════════════════════
  // STEP 5: Seed Treasury
  // ═══════════════════════════════════════════
  console.log('═══ Step 5: Seed Treasury ═══\n');

  // Check if treasury already has tokens
  let treasuryTokens = 0n;
  try {
    const treasuryUtxos = await provider.fetchAddressUTxOs(treasuryScriptAddress);
    const assetUnit = policyId + tokenNameHex;
    for (const u of treasuryUtxos) {
      const t = (u.output?.amount || []).find((a: any) => a.unit === assetUnit);
      if (t) treasuryTokens += BigInt(t.quantity);
    }
  } catch { /* not found = 0 */ }

  const totalTokensNeeded = NUM_TREASURY_UTXOS * TOKENS_PER_UTXO;
  if (treasuryTokens >= BigInt(totalTokensNeeded)) {
    console.log(`Treasury already holds ${treasuryTokens} ${TOKEN_NAME_STRING}. Skipping.\n`);
  } else {
    const wallet = new MeshWallet({
      networkId: 0, fetcher: provider, submitter: provider,
      key: { type: 'mnemonic', words: oracleMnemonic!.split(' ') },
    });
    await wallet.init();

    const assetUnit = policyId + tokenNameHex;
    const utxos = await provider.fetchAddressUTxOs(oracleAddress);

    console.log(`Creating ${NUM_TREASURY_UTXOS} UTxOs, each with ${TOKENS_PER_UTXO} ${TOKEN_NAME_STRING} + ${Number(ADA_PER_UTXO) / 1e6} ADA...`);

    const tx = new MeshTxBuilder({ fetcher: provider, submitter: provider });
    for (let i = 0; i < NUM_TREASURY_UTXOS; i++) {
      tx.txOut(treasuryScriptAddress, [
        { unit: assetUnit, quantity: String(TOKENS_PER_UTXO) },
        { unit: 'lovelace', quantity: ADA_PER_UTXO },
      ]);
      tx.txOutInlineDatumValue(mConStr(0, []));
    }

    const unsignedTx = await tx
      .changeAddress(oracleAddress)
      .selectUtxosFrom(utxos)
      .complete();

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);
    console.log(`Tx: ${txHash}`);
    await waitForConfirmation(provider, txHash);

    // Verify
    const treasuryUtxos = await provider.fetchAddressUTxOs(treasuryScriptAddress);
    treasuryTokens = 0n;
    let tokenUtxoCount = 0;
    for (const u of treasuryUtxos) {
      const t = (u.output?.amount || []).find((a: any) => a.unit === assetUnit);
      if (t) { treasuryTokens += BigInt(t.quantity); tokenUtxoCount++; }
    }
    console.log(`Treasury: ${tokenUtxoCount} UTxOs with ${treasuryTokens} ${TOKEN_NAME_STRING}\n`);
  }

  // ═══════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════
  console.log('═══════════════════════════════════════');
  console.log('  Blockchain setup complete!');
  console.log('═══════════════════════════════════════\n');
  console.log(`  Oracle:   ${oracleAddress}`);
  console.log(`  Treasury: ${treasuryScriptAddress}`);
  console.log(`  Policy:   ${policyId}`);
  console.log(`  Token:    ${TOKEN_NAME_STRING} (${treasuryTokens} in treasury)`);
  console.log(`\n  All values saved to backend/.env`);
  console.log(`\n  Next: rebuild auth-service and run V2 E2E tests`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
