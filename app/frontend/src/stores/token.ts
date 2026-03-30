import { defineStore } from 'pinia';
import { useApolloStore } from './apollo';
import { useAuthStore } from './auth';
import { useBlockchainStore } from './blockchain';
import { gql } from '@apollo/client/core';
import { MeshWallet } from '@meshsdk/core';
import { normalizeTransaction } from '../utils/transactionUtils';
import { logger } from '../utils/logger';

const GET_USER_TRANSACTIONS = gql`
  query GetUserTransactions($userId: uuid!) {
    getUserTransactions(userId: $userId) {
      id
      fromUserId
      toUserId
      amount
      tokenAmount
      description
      timestamp
      transactionType
    }
  }
`

const GET_TREASURY_TRANSACTIONS = gql`
  query GetTreasuryTransactions {
    token_transactions(
      where: {
        _or: [
          { transaction_type: { _eq: "TREASURY_DEPOSIT" } },
          { transaction_type: { _eq: "TREASURY_WITHDRAWAL" } },
          { transaction_type: { _eq: "TRANSFER" } },
          { transaction_type: { _eq: "DONATION" } },
          { transaction_type: { _eq: "REWARD" } }
        ]
      },
      order_by: { timestamp: desc }
    ) {
      id
      from_user_id
      to_user_id
      user_id
      amount
      token_amount
      description
      timestamp
      transaction_type
      contribution_id
      campaign_id
      contribution {
        id
        title
      }
      campaign {
        id
        title
      }
      user {
        user_id
        first_name
        last_name
        preferred_name
      }
      from_user {
        user_id
        first_name
        last_name
        preferred_name
      }
      to_user {
        user_id
        first_name
        last_name
        preferred_name
      }
    }
  }
`

// GraphQL Mutations (none currently - all token operations handled via blockchain)
export type TransactionType = 'TRANSFER' | 'TREASURY_DEPOSIT' | 'TREASURY_WITHDRAWAL' | 'REWARD' | 'DONATION';

export interface TokenTransaction {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  userId?: string | null;
  from_user_id?: string | null;
  to_user_id?: string | null;
  amount: number;
  tokenAmount?: number | null;
  token_amount?: number | null; // Legacy snake_case support
  description: string;
  timestamp: string;
  transactionType: TransactionType;
  type?: TransactionType; // Deprecated - use transactionType. Kept for backward compatibility
  contribution_id?: string | null;
  campaign_id?: string | null;
  contribution?: {
    id: string;
    title: string;
  } | null;
  campaign?: {
    id: string;
    title: string;
  } | null;
  user?: {
    user_id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
  } | null;
}

// GraphQL Response Types
// TreasuryBalanceResponse removed - no longer using GraphQL for treasury balance

interface UserTransactionsResponse {
  getUserTransactions: TokenTransaction[];
}

interface TreasuryTransactionsResponse {
  token_transactions: Array<{
    id: string;
    from_user_id: string | null;
    to_user_id: string | null;
    user_id: string | null;
    amount: number | null;
    token_amount: number | null;
    description: string;
    timestamp: string;
    transaction_type: string;
    contribution_id: string | null;
    campaign_id: string | null;
    contribution?: {
      id: string;
      title: string;
    } | null;
    campaign?: {
      id: string;
      title: string;
    } | null;
    user?: {
      user_id: string;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
    from_user?: {
      user_id: string;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
    to_user?: {
      user_id: string;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
  }>;
}


export const useTokenStore = defineStore('token', {
  state: () => ({
    userBalance: 0,
    treasuryBalance: 0,
    walletAddress: '',
    wallet: null as MeshWallet | null,
    userTransactions: [] as TokenTransaction[],
    treasuryTransactions: [] as TokenTransaction[],
    userTokenBalances: [] as { user_id: string; balance: number; last_updated: string }[],
    loading: {
      userBalance: false,
      treasuryBalance: false,
      userTransactions: false,
      treasuryTransactions: false
    },
    error: null as string | null
  }),

  getters: {
    getUserBalance: (state) => state.userBalance,
    getTreasuryBalance: (state) => state.treasuryBalance,
    getUserTransactions: (state) => state.userTransactions,
    getTreasuryTransactions: (state) => state.treasuryTransactions,
    getUserTokenBalances: (state) => state.userTokenBalances,
    isLoading: (state) => Object.values(state.loading).some(Boolean)
  },

  actions: {
    async getWallet(): Promise<MeshWallet> {
      // Delegate to blockchain store to avoid duplication
      const blockchainStore = useBlockchainStore();
      const wallet = await blockchainStore.initializeWallet();
      // Sync wallet state
      this.wallet = wallet;
      this.walletAddress = blockchainStore.walletAddress;
      return wallet;
    },

    /**
     * Unified method to refresh all balances
     * Uses blockchain store's refreshBalances which handles caching and admin checks
     */
    async refreshBalances() {
      const blockchainStore = useBlockchainStore();
      const { useAuthStore } = await import('./auth');
      const authStore = useAuthStore();
      
      const isAdmin = authStore.user?.status === 'admin';
      
      try {
        this.loading.userBalance = true;
        if (isAdmin) {
          this.loading.treasuryBalance = true;
        }
        
        const balances = await blockchainStore.refreshBalances(isAdmin);
        
        // Update state
        this.userBalance = parseFloat(balances.userBalance);
        if (balances.treasuryBalance !== undefined) {
          this.treasuryBalance = parseFloat(balances.treasuryBalance);
        }
      } catch (error) {
        logger.error('Failed to refresh balances', error);
        this.error = error instanceof Error ? error.message : 'Failed to refresh balances';
        // Set balances to 0 on error
        this.userBalance = 0;
        if (isAdmin) {
          this.treasuryBalance = 0;
        }
        throw error;
      } finally {
        this.loading.userBalance = false;
        if (isAdmin) {
          this.loading.treasuryBalance = false;
        }
      }
    },

    async fetchUserBalance() {
      // Use unified refresh method
      await this.refreshBalances();
    },

    async fetchTreasuryBalance() {
      // Use unified refresh method (will only fetch if admin)
      await this.refreshBalances();
    },

    async fetchUserTransactions() {
      
      try {
        this.loading.userTransactions = true;
        const apolloStore = useApolloStore();
        const authStore = useAuthStore();
        
        if (!apolloStore.client) {
          logger.error('Apollo client not initialized');
          throw new Error('Apollo client not initialized');
        }
        
        if (!authStore.userId) {
          logger.error('User ID not available');
          throw new Error('User ID not available');
        }
        
        const result = await apolloStore.client.query<UserTransactionsResponse>({
          query: GET_USER_TRANSACTIONS,
          variables: {
            userId: authStore.userId
          },
          fetchPolicy: 'network-only'
        });
        
        if (result?.data?.getUserTransactions) {
          // Normalize transactions to ensure consistent format
          this.userTransactions = result.data.getUserTransactions.map(normalizeTransaction);
        } else {
          logger.warn('No transactions found in response');
          this.userTransactions = [];
        }
      } catch (error) {
        logger.error('Error fetching user transactions', error);
        this.error = error instanceof Error ? error.message : 'Failed to fetch user transactions';
        this.userTransactions = []; // Set empty array on error
        throw error;
      } finally {
        this.loading.userTransactions = false;
      }
    },

    async fetchTreasuryTransactions() {
      try {
        this.loading.treasuryTransactions = true;
        const apolloStore = useApolloStore();
        const result = await apolloStore.client?.query<TreasuryTransactionsResponse>({
          query: GET_TREASURY_TRANSACTIONS,
          fetchPolicy: 'network-only'
        });
        
        if (result?.data?.token_transactions) {
          // Normalize transactions to ensure consistent format
          this.treasuryTransactions = result.data.token_transactions.map(tx => {
            // Map snake_case fields to normalized format
            return normalizeTransaction({
              ...tx,
              transaction_type: tx.transaction_type,
              transactionType: tx.transaction_type
            });
          });
        }
      } catch (error) {
        logger.error('Failed to fetch treasury transactions', error);
        this.error = error instanceof Error ? error.message : 'Failed to fetch treasury transactions';
        throw error;
      } finally {
        this.loading.treasuryTransactions = false;
      }
    },

    updateUserTokenBalances(balances: { user_id: string; balance: number; last_updated: string }[]) {
      this.userTokenBalances = balances;
    }
  },
  persist: {
    pick: ['userBalance', 'treasuryBalance', 'walletAddress', 'userTransactions', 'treasuryTransactions', 'userTokenBalances', 'wallet']
  }
}); 