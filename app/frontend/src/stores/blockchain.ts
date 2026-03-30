import { defineStore } from 'pinia';
import { MeshWallet, stringToHex } from '@meshsdk/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import config from '../config';
import axios from 'axios';
import { logger } from '../utils/logger';

interface CachedBalance {
  balance: string;
  timestamp: number;
}

export const useBlockchainStore = defineStore('blockchain', {
  state: () => ({
    wallet: null as MeshWallet | null,
    walletAddress: '',
    pendingTxHashes: [] as string[],
    networkId: 0, // 0: testnet, 1: mainnet
    balanceCache: new Map<string, CachedBalance>(),
    cacheTTL: 120000, // 2 minute cache TTL
  }),

  getters: {
    isWalletInitialized: (state) => state.wallet !== null && state.walletAddress !== '',
    hasPendingTransactions: (state) => state.pendingTxHashes.length > 0,
  },

  actions: {
    /**
     * Initialize wallet from stored mnemonic
     */
    async initializeWallet(): Promise<MeshWallet> {
      if (this.wallet && typeof this.wallet.init === 'function') {
        return this.wallet;
      }

      const { value: mnemonic } = await SecureStoragePlugin.get({ key: 'mnemonic' });
      if (!mnemonic) {
        throw new Error('Mnemonic not found on device');
      }

      const wallet = new MeshWallet({
        networkId: this.networkId,
        key: {
          type: 'mnemonic',
          words: mnemonic.split(' ')
        }
      });
      
      await wallet.init();
      this.wallet = wallet;
      this.walletAddress = await wallet.getChangeAddress();
      return wallet;
    },

    /**
     * Get balance for an address from blockchain
     * Calls backend API directly with caching
     */
    async getBalance(address: string, tokenAssetUnit: string, useCache: boolean = true): Promise<string> {
      const cacheKey = `${address}:${tokenAssetUnit}`;
      
      // Check cache first
      if (useCache) {
        const cached = this.balanceCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
          return cached.balance;
        }
      }

      try {
        // Call backend API directly
        const response = await axios.get(
          `${config.authUrl}/api/${address}/balance`
        );
        
        // Backend returns { balance: string }
        const balanceString = response.data.balance || '0';
        
        // Cache the result
        this.balanceCache.set(cacheKey, {
          balance: balanceString,
          timestamp: Date.now()
        });
        
        return balanceString;
      } catch (error) {
        logger.error('Failed to get balance for address', { address, error });
        // Return cached value if available, even if expired
        const cached = this.balanceCache.get(cacheKey);
        if (cached) {
          return cached.balance;
        }
        return '0';
      }
    },

    /**
     * Clear balance cache for a specific address or all addresses
     */
    clearBalanceCache(address?: string, tokenAssetUnit?: string) {
      if (address && tokenAssetUnit) {
        const cacheKey = `${address}:${tokenAssetUnit}`;
        this.balanceCache.delete(cacheKey);
      } else {
        this.balanceCache.clear();
      }
    },

    /**
     * Unified method to refresh user and treasury balances
     * Only fetches treasury balance if user is admin
     */
    async refreshBalances(isAdmin: boolean = false): Promise<{ userBalance: string; treasuryBalance?: string }> {
      await this.initializeWallet();
      const tokenAssetUnit = this.getTokenAssetUnit();
      
      // Always fetch user balance
      const userBalance = await this.getBalance(this.walletAddress, tokenAssetUnit, false);
      
      const result: { userBalance: string; treasuryBalance?: string } = {
        userBalance
      };
      
      // Only fetch treasury balance if user is admin
      if (isAdmin && config.TREASURY_SCRIPT_ADDRESS) {
        const treasuryBalance = await this.getBalance(config.TREASURY_SCRIPT_ADDRESS, tokenAssetUnit, false);
        result.treasuryBalance = treasuryBalance;
      }
      
      return result;
    },

    /**
     * Get token asset unit (policyId + tokenNameHex)
     */
    getTokenAssetUnit(): string {
      if (!config.POLICY_ID || !config.TOKEN_NAME) {
        logger.error('POLICY_ID or TOKEN_NAME not configured');
        throw new Error('POLICY_ID or TOKEN_NAME not configured');
      }
      const policyId = config.POLICY_ID;
      const tokenName = config.TOKEN_NAME;
      const tokenNameHex = stringToHex(tokenName);
      return policyId + tokenNameHex;
    },

    /**
     * Build unsigned donation transaction via backend
     * Backend uses BLOCKFROST_KEY to build transaction
     */
    async buildDonationTransaction(
      campaignId: string,
      amount: number
    ): Promise<any> {
      const { useAuthStore } = await import('./auth');
      const authStore = useAuthStore();
      
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      if (!this.wallet) {
        await this.initializeWallet();
      }

      // Call backend to build unsigned transaction
        const response = await axios.post(
          `${config.authUrl}/actions/buildDonationTransaction`,
          {
            input: {
              campaignId,
              amount,
              userAddress: this.walletAddress
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${authStore.jwt}`
            }
          }
        );

      return response.data.unsignedTransaction;
    },

    /**
     * Sign transaction with user's wallet
     */
    async signTransaction(unsignedTx: any): Promise<string> {
      if (!this.wallet) {
        await this.initializeWallet();
      }

      const signedTx = await this.wallet!.signTx(unsignedTx);
      // Convert signed transaction to CBOR hex string
      return signedTx;
    },

    /**
     * Add transaction hash to pending array
     */
    trackPendingTransaction(txHash: string) {
      if (!this.pendingTxHashes.includes(txHash)) {
        this.pendingTxHashes.push(txHash);
      }
    },

    /**
     * Confirm transaction by calling backend endpoint
     * Removes from pending array on success and clears balance cache
     * Optionally triggers balance refresh callback
     */
    async confirmTransaction(txHash: string, type: 'DONATION' | 'REWARD', onSuccess?: () => void | Promise<void>): Promise<void> {
      const { useAuthStore } = await import('./auth');
      const authStore = useAuthStore();
      
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await axios.post(
          `${config.authUrl}/api/tx/confirm`,
          { txHash, type },
          {
            headers: {
              'Authorization': `Bearer ${authStore.jwt}`
            },
            timeout: 300000 // 5 minutes timeout
          }
        );

        if (response.data.success) {
          // Remove from pending array on success
          this.pendingTxHashes = this.pendingTxHashes.filter(hash => hash !== txHash);
          
          // Clear balance cache for user wallet and treasury (if applicable)
          const tokenAssetUnit = this.getTokenAssetUnit();
          this.clearBalanceCache(this.walletAddress, tokenAssetUnit);
          if (config.TREASURY_SCRIPT_ADDRESS) {
            this.clearBalanceCache(config.TREASURY_SCRIPT_ADDRESS, tokenAssetUnit);
          }
          
          // Trigger balance refresh callback if provided
          if (onSuccess) {
            await onSuccess();
          }
        } else {
          // Keep in array if confirmation failed (user can retry)
          throw new Error(response.data.errorMessage || 'Transaction confirmation failed');
        }
      } catch (error: any) {
        // Keep transaction in pending array on error
        const errorMessage = error.response?.data?.errorMessage || error.message || 'Transaction confirmation failed';
        throw new Error(errorMessage);
      }
    },
  },
});

