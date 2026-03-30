import { defineStore } from 'pinia';
import { useApolloStore } from './apollo';
import { useAuthStore } from './auth';
import { useLocaleStore } from './locale';
import { useBlockchainStore } from './blockchain';
import { gql } from '@apollo/client/core';
import { getImageUrl } from '../utils/imageUtils';

// Image handling functions moved to utils/imageUtils.ts

export interface Campaign {
  id: string;
  title: string;
  description: string;
  fullDetails?: string;
  imageUrl?: string;
  imageData?: string | { data: number[], type: string };
  goalTokens: number;
  tokensRaised: number;
  category?: string;
  country?: string;
  language?: string;
  deadline?: string;
  supporterCount: number;
  campaignUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface CampaignDonation {
  id: string;
  campaignId: string;
  userId: string;
  amount: number;
  donatedAt: string;
}

export const useCampaignsStore = defineStore('campaigns', {
  state: () => ({
    campaigns: [] as Campaign[],
    currentCampaign: null as Campaign | null,
    userDonations: [] as CampaignDonation[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    activeCampaigns: (state) => state.campaigns.filter(c => c.isActive),
    campaignProgress: (state) => (campaignId: string) => {
      const campaign = state.campaigns.find(c => c.id === campaignId);
      if (!campaign || campaign.goalTokens === 0) return 0;
      return Math.min((campaign.tokensRaised / campaign.goalTokens) * 100, 100);
    },
    userDonationTotal: (state) => (campaignId: string) => {
      return state.userDonations
        .filter(d => d.campaignId === campaignId)
        .reduce((sum, d) => sum + d.amount, 0);
    }
  },

  actions: {
    async fetchCampaigns() {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      const localeStore = useLocaleStore();
      
      if (!apolloStore.client || !authStore.jwt) {
        throw new Error('Not authenticated or Apollo client not initialized');
      }

      // Performance monitoring: Start
      const perfStart = performance.now();
      const perfId = `fetchCampaigns-${Date.now()}`;
      performance.mark(`${perfId}-start`);

      this.loading = true;
      this.error = null;

      // Get user's country for filtering
      // Priority: user's country from database > locale store > null
      // This ensures we use the source of truth (database) first
      const userCountryStart = performance.now();
      const userCountry = (authStore.user as any)?.country || localeStore.currentCountry || null;
      const userCountryTime = performance.now() - userCountryStart;
      console.log(`[PERF] fetchCampaigns: User country resolution took ${userCountryTime.toFixed(2)}ms`);

      try {
        // Build where condition: show campaigns for user's country OR global campaigns (country is null)
        // Users see:
        // 1. Campaigns matching their country
        // 2. Global campaigns (country is null) - visible to everyone
        // 3. All active campaigns if user has no country set
        const whereConditionStart = performance.now();
        const whereCondition = userCountry
          ? {
              _and: [
                { is_active: { _eq: true } },
                {
                  _or: [
                    { country: { _eq: userCountry } },
                    { country: { _is_null: true } }
                  ]
                }
              ]
            }
          : { is_active: { _eq: true } };
        const whereConditionTime = performance.now() - whereConditionStart;
        console.log(`[PERF] fetchCampaigns: Where condition build took ${whereConditionTime.toFixed(2)}ms`);

        // GraphQL Query
        performance.mark(`${perfId}-graphql-start`);
        const graphqlStart = performance.now();
        const result = await apolloStore.client.query({
          query: gql`
            query GetCampaigns($where: campaigns_bool_exp) {
              campaigns(where: $where) {
                id
                title
                description
                full_details
                image_url
                image_data
                goal_tokens
                tokens_raised
                category
                country
                language
                deadline
                supporter_count
                campaign_url
                is_active
                created_at
                updated_at
                created_by
              }
            }
          `,
          variables: {
            where: whereCondition
          },
          fetchPolicy: 'network-only',
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });
        const graphqlTime = performance.now() - graphqlStart;
        performance.mark(`${perfId}-graphql-end`);
        performance.measure(`${perfId}-graphql`, `${perfId}-graphql-start`, `${perfId}-graphql-end`);
        console.log(`[PERF] fetchCampaigns: GraphQL query took ${graphqlTime.toFixed(2)}ms`);

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((e: any) => e.message).join(', ');
          throw new Error(`GraphQL errors: ${errorMessages}`);
        }

        // Check if data exists
        if (!result.data) {
          throw new Error('GraphQL query returned no data');
        }

        console.log(`[PERF] fetchCampaigns: Received ${result.data.campaigns?.length || 0} campaigns`);

        // Data Transformation
        performance.mark(`${perfId}-transform-start`);
        const transformStart = performance.now();
        this.campaigns = result.data.campaigns.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          fullDetails: c.full_details,
          imageUrl: c.image_url,
          imageData: c.image_data,
          goalTokens: parseFloat(c.goal_tokens),
          tokensRaised: parseFloat(c.tokens_raised),
          category: c.category,
          country: c.country,
          language: c.language,
          deadline: c.deadline,
          supporterCount: c.supporter_count || 0,
          campaignUrl: c.campaign_url,
          isActive: c.is_active,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          createdBy: c.created_by
        }));
        const transformTime = performance.now() - transformStart;
        performance.mark(`${perfId}-transform-end`);
        performance.measure(`${perfId}-transform`, `${perfId}-transform-start`, `${perfId}-transform-end`);
        console.log(`[PERF] fetchCampaigns: Data transformation took ${transformTime.toFixed(2)}ms`);

        // Fetch User Donations
        performance.mark(`${perfId}-user-donations-start`);
        const userDonationsStart = performance.now();
        await this.fetchUserDonations();
        const userDonationsTime = performance.now() - userDonationsStart;
        performance.mark(`${perfId}-user-donations-end`);
        performance.measure(`${perfId}-user-donations`, `${perfId}-user-donations-start`, `${perfId}-user-donations-end`);
        console.log(`[PERF] fetchCampaigns: Fetch user donations took ${userDonationsTime.toFixed(2)}ms`);

        // Total Time
        const totalTime = performance.now() - perfStart;
        performance.mark(`${perfId}-end`);
        performance.measure(`${perfId}-total`, `${perfId}-start`, `${perfId}-end`);
        console.log(`[PERF] fetchCampaigns: TOTAL TIME ${totalTime.toFixed(2)}ms`);
        console.log(`[PERF] fetchCampaigns: Breakdown - GraphQL: ${graphqlTime.toFixed(2)}ms (${((graphqlTime/totalTime)*100).toFixed(1)}%), Transform: ${transformTime.toFixed(2)}ms (${((transformTime/totalTime)*100).toFixed(1)}%), User Donations: ${userDonationsTime.toFixed(2)}ms (${((userDonationsTime/totalTime)*100).toFixed(1)}%)`);
      } catch (error: any) {
        const totalTime = performance.now() - perfStart;
        console.error(`[PERF] fetchCampaigns: FAILED after ${totalTime.toFixed(2)}ms`);
        console.error('Failed to fetch campaigns:', error);
        this.error = error.message || 'Failed to fetch campaigns';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCampaignById(id: string) {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      
      if (!apolloStore.client || !authStore.jwt) {
        throw new Error('Not authenticated or Apollo client not initialized');
      }

      // Performance monitoring
      const perfStart = performance.now();
      const perfId = `fetchCampaignById-${id}-${Date.now()}`;
      performance.mark(`${perfId}-start`);

      try {
        // GraphQL Query
        performance.mark(`${perfId}-graphql-start`);
        const graphqlStart = performance.now();
        const result = await apolloStore.client.query({
          query: gql`
            query GetCampaign($id: uuid!) {
              campaigns_by_pk(id: $id) {
                id
                title
                description
                full_details
                image_url
                image_data
                goal_tokens
                tokens_raised
                category
                country
                language
                deadline
                supporter_count
                campaign_url
                is_active
                created_at
                updated_at
                created_by
              }
            }
          `,
          variables: { id },
          fetchPolicy: 'network-only',
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });
        const graphqlTime = performance.now() - graphqlStart;
        performance.mark(`${perfId}-graphql-end`);
        performance.measure(`${perfId}-graphql`, `${perfId}-graphql-start`, `${perfId}-graphql-end`);
        console.log(`[PERF] fetchCampaignById: GraphQL query took ${graphqlTime.toFixed(2)}ms`);

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((e: any) => e.message).join(', ');
          throw new Error(`GraphQL errors: ${errorMessages}`);
        }

        // Check if data exists
        if (!result.data) {
          throw new Error('GraphQL query returned no data');
        }

        const c = result.data.campaigns_by_pk;
        if (!c) {
          throw new Error('Campaign not found');
        }

        // Data Transformation
        performance.mark(`${perfId}-transform-start`);
        const transformStart = performance.now();
        const campaign: Campaign = {
          id: c.id,
          title: c.title,
          description: c.description,
          fullDetails: c.full_details,
          imageUrl: c.image_url,
          imageData: c.image_data,
          goalTokens: parseFloat(c.goal_tokens),
          tokensRaised: parseFloat(c.tokens_raised),
          category: c.category,
          country: c.country,
          language: c.language,
          deadline: c.deadline,
          supporterCount: c.supporter_count || 0,
          campaignUrl: c.campaign_url,
          isActive: c.is_active,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          createdBy: c.created_by
        };
        const transformTime = performance.now() - transformStart;
        performance.mark(`${perfId}-transform-end`);
        performance.measure(`${perfId}-transform`, `${perfId}-transform-start`, `${perfId}-transform-end`);
        console.log(`[PERF] fetchCampaignById: Data transformation took ${transformTime.toFixed(2)}ms`);

        this.currentCampaign = campaign;

        // Total Time
        const totalTime = performance.now() - perfStart;
        performance.mark(`${perfId}-end`);
        performance.measure(`${perfId}-total`, `${perfId}-start`, `${perfId}-end`);
        console.log(`[PERF] fetchCampaignById: TOTAL TIME ${totalTime.toFixed(2)}ms`);
        console.log(`[PERF] fetchCampaignById: Breakdown - GraphQL: ${graphqlTime.toFixed(2)}ms (${((graphqlTime/totalTime)*100).toFixed(1)}%), Transform: ${transformTime.toFixed(2)}ms (${((transformTime/totalTime)*100).toFixed(1)}%)`);

        return campaign;
      } catch (error: any) {
        const totalTime = performance.now() - perfStart;
        console.error(`[PERF] fetchCampaignById: FAILED after ${totalTime.toFixed(2)}ms`);
        console.error('Failed to fetch campaign:', error);
        throw error;
      }
    },

    async fetchUserDonations() {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      
      if (!apolloStore.client || !authStore.jwt || !authStore.userId) {
        return;
      }

      // Performance monitoring
      const perfStart = performance.now();
      const perfId = `fetchUserDonations-${Date.now()}`;
      performance.mark(`${perfId}-start`);

      try {
        // GraphQL Query
        performance.mark(`${perfId}-graphql-start`);
        const graphqlStart = performance.now();
        const result = await apolloStore.client.query({
          query: gql`
            query GetUserDonations {
              campaign_donations(where: { user_id: { _eq: "${authStore.userId}" } }) {
                id
                campaign_id
                user_id
                amount
                donated_at
              }
            }
          `,
          fetchPolicy: 'network-only',
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });
        const graphqlTime = performance.now() - graphqlStart;
        performance.mark(`${perfId}-graphql-end`);
        performance.measure(`${perfId}-graphql`, `${perfId}-graphql-start`, `${perfId}-graphql-end`);
        console.log(`[PERF] fetchUserDonations: GraphQL query took ${graphqlTime.toFixed(2)}ms`);

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((e: any) => e.message).join(', ');
          throw new Error(`GraphQL errors: ${errorMessages}`);
        }

        // Check if data exists
        if (!result.data) {
          throw new Error('GraphQL query returned no data');
        }

        console.log(`[PERF] fetchUserDonations: Received ${result.data.campaign_donations?.length || 0} donations`);

        // Data Transformation
        performance.mark(`${perfId}-transform-start`);
        const transformStart = performance.now();
        this.userDonations = result.data.campaign_donations.map((d: any) => ({
          id: d.id,
          campaignId: d.campaign_id,
          userId: d.user_id,
          amount: parseFloat(d.amount),
          donatedAt: d.donated_at
        }));
        const transformTime = performance.now() - transformStart;
        performance.mark(`${perfId}-transform-end`);
        performance.measure(`${perfId}-transform`, `${perfId}-transform-start`, `${perfId}-transform-end`);
        console.log(`[PERF] fetchUserDonations: Data transformation took ${transformTime.toFixed(2)}ms`);

        // Total Time
        const totalTime = performance.now() - perfStart;
        performance.mark(`${perfId}-end`);
        performance.measure(`${perfId}-total`, `${perfId}-start`, `${perfId}-end`);
        console.log(`[PERF] fetchUserDonations: TOTAL TIME ${totalTime.toFixed(2)}ms`);
      } catch (error: any) {
        const totalTime = performance.now() - perfStart;
        console.error(`[PERF] fetchUserDonations: FAILED after ${totalTime.toFixed(2)}ms`);
        console.error('Failed to fetch user donations:', error);
      }
    },

    async donateToCampaign(campaignId: string, amount: number, onProgress?: (stage: 'building' | 'signing' | 'submitting') => void) {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      const blockchainStore = useBlockchainStore();
      
      if (!apolloStore.client || !authStore.jwt || !authStore.userId) {
        throw new Error('Not authenticated');
      }

      try {
        // 1. Initialize wallet
        await blockchainStore.initializeWallet();
        
        // 2. Build unsigned transaction on backend
        onProgress?.('building');
        const unsignedTx = await blockchainStore.buildDonationTransaction(
          campaignId,
          amount
        );

        // 3. Sign transaction with user's wallet
        onProgress?.('signing');
        const signedTx = await blockchainStore.signTransaction(unsignedTx);

        // 4. Send signed transaction to backend
        onProgress?.('submitting');
        const result = await apolloStore.client.mutate({
          mutation: gql`
            mutation DonateToCampaign($campaignId: uuid!, $amount: Float!, $signedTransaction: String!) {
              donateToCampaign(campaignId: $campaignId, amount: $amount, signedTransaction: $signedTransaction) {
                id
                campaignId
                userId
                amount
                donatedAt
                txHash
                pendingTxHash
              }
            }
          `,
          variables: {
            campaignId,
            amount,
            signedTransaction: signedTx
          },
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });

        const donation = result.data.donateToCampaign;
        
        // 6. Track and confirm transaction
        if (donation.txHash) {
          const txHash = donation.txHash;
          blockchainStore.trackPendingTransaction(txHash);
          // Call confirmation endpoint with balance refresh callback
          blockchainStore.confirmTransaction(txHash, 'DONATION', async () => {
            // Refresh balance after transaction confirms
            const { useTokenStore } = await import('./token');
            const tokenStore = useTokenStore();
            await tokenStore.refreshBalances();
          }).catch(err => {
            console.error('Error confirming donation transaction:', err);
            // Transaction stays in pending array, user can retry if needed
          });
        }

        // Refresh campaigns and user donations
        await this.fetchCampaigns();
        await this.fetchUserDonations();

        return donation;
      } catch (error: any) {
        console.error('Failed to donate to campaign:', error);
        throw error;
      }
    },

    getCampaignImageUrl(campaign: Campaign): string | null {
      if (!campaign) return null;
      
      // Check for imageUrl first (HTTP URLs or base64)
      if (campaign.imageUrl && typeof campaign.imageUrl === 'string') {
        const url = campaign.imageUrl.trim();
        if (url) {
          const result = getImageUrl(url);
          return result.url;
        }
      }
      
      // Check for imageData and convert using unified utility
      // Always returns a URL (falls back to placeholder if invalid)
      if (campaign.imageData) {
        // Handle object format by converting to base64 first
        if (typeof campaign.imageData === 'object' && campaign.imageData !== null && 'data' in campaign.imageData) {
          try {
            const uint8Array = new Uint8Array(campaign.imageData.data);
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
            const result = getImageUrl(base64);
            return result.url;
          } catch (error) {
            console.warn('Error converting object imageData to base64, using placeholder:', error);
            const result = getImageUrl(null);
            return result.url;
          }
        }
        
        // Handle string format
        if (typeof campaign.imageData === 'string') {
          const result = getImageUrl(campaign.imageData);
          return result.url;
        }
      }
      
      // Return placeholder if no image data
      const result = getImageUrl(null);
      return result.url;
    }
  }
});

