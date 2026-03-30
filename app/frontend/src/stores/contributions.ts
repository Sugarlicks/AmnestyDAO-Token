import { defineStore } from 'pinia';
import { useApolloStore } from './apollo';
import { useAuthStore } from './auth';
import { useLocaleStore } from './locale';
import { gql } from '@apollo/client/core';
import { getImageUrl } from '../utils/imageUtils';
import { logger } from '../utils/logger';

export interface Contribution {
  id: string;
  title: string;
  description: string;
  fullDetails?: string;
  imageUrl?: string;
  imageData?: string | { data: number[], type: string };
  tokenReward: number;
  contributionType: 'visit' | 'share' | 'scan';
  actionButtonText: string;
  externalLink?: string;
  deadline?: string;
  targetParticipants?: number;
  currentParticipants: number;
  country?: string;
  language?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  isCompleted?: boolean;
}

interface UserContribution {
  id: string;
  userId: string;
  contributionId: string;
  completedAt: string;
  tokensAwarded: number;
}

interface ContributionStats {
  actionsDone: number;
  tokensEarned: number;
}

// Image handling functions moved to utils/imageUtils.ts

export const useContributionsStore = defineStore('contributions', {
  state: () => ({
    contributions: [] as Contribution[],
    currentContribution: null as Contribution | null,
    userContributions: [] as UserContribution[],
    stats: {
      actionsDone: 0,
      tokensEarned: 0
    } as ContributionStats,
    loading: false,
    error: null as string | null
  }),

  getters: {
    activeContributions: (state) => {
      return state.contributions
        .filter(c => c.isActive)
        .sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA; // Newest first (descending)
        });
    },
    completedContributionIds: (state) => new Set(state.userContributions.map(uc => uc.contributionId))
  },

  actions: {
    async fetchContributions() {
      console.log('fetchContributions');
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      const localeStore = useLocaleStore();
      
      if (!apolloStore.client || !authStore.jwt) {
        throw new Error('Not authenticated or Apollo client not initialized');
      }

      // Performance monitoring: Start
      const perfStart = performance.now();
      const perfId = `fetchContributions-${Date.now()}`;
      performance.mark(`${perfId}-start`);

      this.loading = true;
      this.error = null;

      // Get user's country for filtering
      // Priority: user's country from database > locale store > null
      // This ensures we use the source of truth (database) first
      const userCountryStart = performance.now();
      const userCountry = (authStore.user as any)?.country || localeStore.currentCountry || null;
      const userCountryTime = performance.now() - userCountryStart;
      console.log(`[PERF] fetchContributions: User country resolution took ${userCountryTime.toFixed(2)}ms`);

      try {
        // Build where condition: show contributions for user's country OR global contributions (country is null)
        // Users see:
        // 1. Contributions matching their country
        // 2. Global contributions (country is null) - visible to everyone
        // 3. All active contributions if user has no country set
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
        console.log(`[PERF] fetchContributions: Where condition build took ${whereConditionTime.toFixed(2)}ms`);

        // GraphQL Query
        performance.mark(`${perfId}-graphql-start`);
        const graphqlStart = performance.now();
        const result = await apolloStore.client.query({
          query: gql`
            query GetContributions($where: contributions_bool_exp) {
              contributions(where: $where) {
                id
                title
                description
                full_details
                image_url
                image_data
                token_reward
                contribution_type
                action_button_text
                external_link
                deadline
                target_participants
                current_participants
                country
                language
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
        console.log(`[PERF] fetchContributions: GraphQL query took ${graphqlTime.toFixed(2)}ms`);
        console.log(`[PERF] fetchContributions: Received ${result.data.contributions?.length || 0} contributions`);

        // Data Transformation
        performance.mark(`${perfId}-transform-start`);
        const transformStart = performance.now();
        const contributions = result.data.contributions.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          fullDetails: c.full_details,
          imageUrl: c.image_url,
          imageData: c.image_data,
          tokenReward: parseFloat(c.token_reward),
          contributionType: c.contribution_type,
          actionButtonText: c.action_button_text || 'Complete Action',
          externalLink: c.external_link,
          deadline: c.deadline,
          targetParticipants: c.target_participants,
          currentParticipants: c.current_participants || 0,
          country: c.country,
          language: c.language,
          isActive: c.is_active,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          createdBy: c.created_by
        }));
        const transformTime = performance.now() - transformStart;
        performance.mark(`${perfId}-transform-end`);
        performance.measure(`${perfId}-transform`, `${perfId}-transform-start`, `${perfId}-transform-end`);
        console.log(`[PERF] fetchContributions: Data transformation took ${transformTime.toFixed(2)}ms`);

        this.contributions = contributions;

        // Fetch User Contributions
        performance.mark(`${perfId}-user-contributions-start`);
        const userContributionsStart = performance.now();
        await this.fetchUserContributions();
        const userContributionsTime = performance.now() - userContributionsStart;
        performance.mark(`${perfId}-user-contributions-end`);
        performance.measure(`${perfId}-user-contributions`, `${perfId}-user-contributions-start`, `${perfId}-user-contributions-end`);
        console.log(`[PERF] fetchContributions: Fetch user contributions took ${userContributionsTime.toFixed(2)}ms`);

        // Total Time
        const totalTime = performance.now() - perfStart;
        performance.mark(`${perfId}-end`);
        performance.measure(`${perfId}-total`, `${perfId}-start`, `${perfId}-end`);
        console.log(`[PERF] fetchContributions: TOTAL TIME ${totalTime.toFixed(2)}ms`);
        console.log(`[PERF] fetchContributions: Breakdown - GraphQL: ${graphqlTime.toFixed(2)}ms (${((graphqlTime/totalTime)*100).toFixed(1)}%), Transform: ${transformTime.toFixed(2)}ms (${((transformTime/totalTime)*100).toFixed(1)}%), User Contributions: ${userContributionsTime.toFixed(2)}ms (${((userContributionsTime/totalTime)*100).toFixed(1)}%)`);
      } catch (error: any) {
        const totalTime = performance.now() - perfStart;
        console.error(`[PERF] fetchContributions: FAILED after ${totalTime.toFixed(2)}ms`);
        logger.error('Failed to fetch contributions', error);
        this.error = error.message || 'Failed to fetch contributions';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchUserContributions() {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      
      if (!apolloStore.client || !authStore.jwt || !authStore.userId) {
        return;
      }

      // Performance monitoring
      const perfStart = performance.now();
      const perfId = `fetchUserContributions-${Date.now()}`;
      performance.mark(`${perfId}-start`);

      try {
        // GraphQL Query
        performance.mark(`${perfId}-graphql-start`);
        const graphqlStart = performance.now();
        const result = await apolloStore.client.query({
          query: gql`
            query GetUserContributions {
              user_contributions(where: { user_id: { _eq: "${authStore.userId}" } }) {
                id
                user_id
                contribution_id
                completed_at
                tokens_awarded
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
        console.log(`[PERF] fetchUserContributions: GraphQL query took ${graphqlTime.toFixed(2)}ms`);
        console.log(`[PERF] fetchUserContributions: Received ${result.data.user_contributions?.length || 0} user contributions`);

        // Data Transformation
        performance.mark(`${perfId}-transform-start`);
        const transformStart = performance.now();
        this.userContributions = result.data.user_contributions.map((uc: any) => ({
          id: uc.id,
          userId: uc.user_id,
          contributionId: uc.contribution_id,
          completedAt: uc.completed_at,
          tokensAwarded: parseFloat(uc.tokens_awarded)
        }));
        const transformTime = performance.now() - transformStart;
        performance.mark(`${perfId}-transform-end`);
        performance.measure(`${perfId}-transform`, `${perfId}-transform-start`, `${perfId}-transform-end`);
        console.log(`[PERF] fetchUserContributions: Data transformation took ${transformTime.toFixed(2)}ms`);

        // Update stats
        performance.mark(`${perfId}-stats-start`);
        const statsStart = performance.now();
        this.stats.actionsDone = this.userContributions.length;
        this.stats.tokensEarned = this.userContributions.reduce((sum, uc) => sum + uc.tokensAwarded, 0);
        const statsTime = performance.now() - statsStart;
        performance.mark(`${perfId}-stats-end`);
        performance.measure(`${perfId}-stats`, `${perfId}-stats-start`, `${perfId}-stats-end`);
        console.log(`[PERF] fetchUserContributions: Stats calculation took ${statsTime.toFixed(2)}ms`);

        // Mark contributions as completed
        performance.mark(`${perfId}-mark-completed-start`);
        const markCompletedStart = performance.now();
        const completedIds = new Set(this.userContributions.map(uc => uc.contributionId));
        this.contributions = this.contributions.map(c => ({
          ...c,
          isCompleted: completedIds.has(c.id)
        }));
        const markCompletedTime = performance.now() - markCompletedStart;
        performance.mark(`${perfId}-mark-completed-end`);
        performance.measure(`${perfId}-mark-completed`, `${perfId}-mark-completed-start`, `${perfId}-mark-completed-end`);
        console.log(`[PERF] fetchUserContributions: Mark completed took ${markCompletedTime.toFixed(2)}ms`);

        // Total Time
        const totalTime = performance.now() - perfStart;
        performance.mark(`${perfId}-end`);
        performance.measure(`${perfId}-total`, `${perfId}-start`, `${perfId}-end`);
        console.log(`[PERF] fetchUserContributions: TOTAL TIME ${totalTime.toFixed(2)}ms`);
      } catch (error: any) {
        const totalTime = performance.now() - perfStart;
        console.error(`[PERF] fetchUserContributions: FAILED after ${totalTime.toFixed(2)}ms`);
        console.error('Failed to fetch user contributions:', error);
      }
    },

    async fetchContributionById(id: string) {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      
      if (!apolloStore.client || !authStore.jwt) {
        throw new Error('Not authenticated or Apollo client not initialized');
      }

      // Performance monitoring
      const perfStart = performance.now();
      const perfId = `fetchContributionById-${id}-${Date.now()}`;
      performance.mark(`${perfId}-start`);

      try {
        // GraphQL Query
        performance.mark(`${perfId}-graphql-start`);
        const graphqlStart = performance.now();
        const result = await apolloStore.client.query({
          query: gql`
            query GetContribution($id: uuid!) {
              contributions_by_pk(id: $id) {
                id
                title
                description
                full_details
                image_url
                image_data
                token_reward
                contribution_type
                action_button_text
                external_link
                deadline
                target_participants
                current_participants
                country
                language
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
        console.log(`[PERF] fetchContributionById: GraphQL query took ${graphqlTime.toFixed(2)}ms`);

        const c = result.data.contributions_by_pk;
        if (!c) {
          throw new Error('Contribution not found');
        }

        // Data Transformation
        performance.mark(`${perfId}-transform-start`);
        const transformStart = performance.now();
        const contribution: Contribution = {
          id: c.id,
          title: c.title,
          description: c.description,
          fullDetails: c.full_details,
          imageUrl: c.image_url,
          imageData: c.image_data,
          tokenReward: parseFloat(c.token_reward),
          contributionType: c.contribution_type,
          actionButtonText: c.action_button_text || 'Complete Action',
          externalLink: c.external_link,
          deadline: c.deadline,
          targetParticipants: c.target_participants,
          currentParticipants: c.current_participants || 0,
          country: c.country,
          language: c.language,
          isActive: c.is_active,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          createdBy: c.created_by
        };
        const transformTime = performance.now() - transformStart;
        performance.mark(`${perfId}-transform-end`);
        performance.measure(`${perfId}-transform`, `${perfId}-transform-start`, `${perfId}-transform-end`);
        console.log(`[PERF] fetchContributionById: Data transformation took ${transformTime.toFixed(2)}ms`);

        this.currentContribution = contribution;

        // Total Time
        const totalTime = performance.now() - perfStart;
        performance.mark(`${perfId}-end`);
        performance.measure(`${perfId}-total`, `${perfId}-start`, `${perfId}-end`);
        console.log(`[PERF] fetchContributionById: TOTAL TIME ${totalTime.toFixed(2)}ms`);
        console.log(`[PERF] fetchContributionById: Breakdown - GraphQL: ${graphqlTime.toFixed(2)}ms (${((graphqlTime/totalTime)*100).toFixed(1)}%), Transform: ${transformTime.toFixed(2)}ms (${((transformTime/totalTime)*100).toFixed(1)}%)`);

        return contribution;
      } catch (error: any) {
        const totalTime = performance.now() - perfStart;
        console.error(`[PERF] fetchContributionById: FAILED after ${totalTime.toFixed(2)}ms`);
        console.error('Failed to fetch contribution:', error);
        throw error;
      }
    },

    async completeContribution(contributionId: string) {
      const apolloStore = useApolloStore();
      const authStore = useAuthStore();
      
      if (!apolloStore.client || !authStore.jwt || !authStore.userId) {
        throw new Error('Not authenticated');
      }

      try {
        // First, get the contribution to get the token reward
        const contribution = this.contributions.find(c => c.id === contributionId);
        if (!contribution) {
          throw new Error('Contribution not found');
        }

        // Check if already completed
        const alreadyCompleted = this.userContributions.some(uc => uc.contributionId === contributionId);
        if (alreadyCompleted) {
          throw new Error('Contribution already completed');
        }

        // First, award the reward - only complete contribution if reward is successful
        const rewardResult = await apolloStore.client.mutate({
          mutation: gql`
            mutation RewardUser($toUserId: uuid!, $amount: Float!, $description: String!) {
              rewardUser(toUserId: $toUserId, amount: $amount, description: $description) {
                id
                toUserId
                amount
                description
                type
                timestamp
                cardanoTxHash
              }
            }
          `,
          variables: {
            toUserId: authStore.userId,
            amount: contribution.tokenReward,
            description: `Reward for completing: ${contribution.title}`
          },
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });

        // Check if reward was successful
        if (!rewardResult.data?.rewardUser) {
          throw new Error('Failed to award reward');
        }

        // Only create user contribution record if reward was successful
        const contributionResult = await apolloStore.client.mutate({
          mutation: gql`
            mutation CompleteContribution($userId: uuid!, $contributionId: uuid!, $tokensAwarded: numeric!) {
              insert_user_contributions_one(object: {
                user_id: $userId,
                contribution_id: $contributionId,
                tokens_awarded: $tokensAwarded
              }) {
                id
                user_id
                contribution_id
                completed_at
                tokens_awarded
              }
            }
          `,
          variables: {
            userId: authStore.userId,
            contributionId,
            tokensAwarded: contribution.tokenReward.toString()
          },
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });

        // Track reward transaction for confirmation if cardanoTxHash is returned
        const { useBlockchainStore } = await import('./blockchain');
        const blockchainStore = useBlockchainStore();
        
        if (rewardResult.data?.rewardUser?.cardanoTxHash) {
          const txHash = rewardResult.data.rewardUser.cardanoTxHash;
          blockchainStore.trackPendingTransaction(txHash);
          // Call confirmation endpoint with balance refresh callback
          blockchainStore.confirmTransaction(txHash, 'REWARD', async () => {
            // Refresh balance after transaction confirms
            const { useTokenStore } = await import('./token');
            const tokenStore = useTokenStore();
            await tokenStore.refreshBalances();
          }).catch(err => {
            console.error('Error confirming reward transaction:', err);
            // Transaction stays in pending array, user can retry if needed
          });
        }

        // Refresh user contributions and contributions
        await this.fetchUserContributions();
        await this.fetchContributions();

        return contributionResult.data.insert_user_contributions_one;
      } catch (error: any) {
        console.error('Failed to complete contribution:', error);
        throw error;
      }
    },

    getContributionImageUrl(contribution: Contribution): string | null {
      if (!contribution) {
        return null;
      }
      
      // Check for imageUrl first (HTTP URLs or base64)
      if (contribution.imageUrl && typeof contribution.imageUrl === 'string') {
        const url = contribution.imageUrl.trim();
        if (url) {
          const result = getImageUrl(url);
          return result.url;
        }
      }
      
      // Check for imageData and convert using unified utility
      // Always returns a URL (falls back to placeholder if invalid)
      if (contribution.imageData) {
        // Handle object format by converting to base64 first
        if (typeof contribution.imageData === 'object' && contribution.imageData !== null && 'data' in contribution.imageData) {
          try {
            const uint8Array = new Uint8Array(contribution.imageData.data);
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
        if (typeof contribution.imageData === 'string') {
          const result = getImageUrl(contribution.imageData);
          return result.url;
        }
      }
      
      // Return placeholder if no image data
      const result = getImageUrl(null);
      return result.url;
    }
  }
});

