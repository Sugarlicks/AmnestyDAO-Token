import { MeshWallet } from '@meshsdk/core';

export interface TestWallet {
  mnemonic: string;
  address: string;
  wallet: MeshWallet;
}

/**
 * Create a new test wallet with a fresh mnemonic.
 * Mirrors the logic in frontend/src/stores/auth.ts:registerWithSeed().
 */
export async function createTestWallet(): Promise<TestWallet> {
  const mnemonicRaw = await MeshWallet.brew();
  const mnemonic = Array.isArray(mnemonicRaw) ? mnemonicRaw.join(' ') : mnemonicRaw;
  const words = Array.isArray(mnemonicRaw) ? mnemonicRaw : mnemonicRaw.split(' ');

  const wallet = new MeshWallet({
    networkId: 0, // testnet
    key: { type: 'mnemonic', words },
  });
  await wallet.init();
  const address = await wallet.getChangeAddress();

  return { mnemonic, address, wallet };
}

/**
 * Sign a login nonce using the wallet (CIP-8).
 * Mirrors the login flow in frontend/src/stores/auth.ts:login().
 */
export async function signLoginNonce(
  wallet: MeshWallet,
  nonce: string,
  address: string
): Promise<string> {
  return wallet.signData(nonce, address);
}
