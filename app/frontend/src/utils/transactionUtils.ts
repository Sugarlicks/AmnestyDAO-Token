import { format } from 'date-fns';
import type { TokenTransaction, TransactionType } from '../stores/token';

/**
 * Normalize transaction data from GraphQL response
 * Converts snake_case to camelCase and ensures transactionType is set
 */
export function normalizeTransaction(tx: any): TokenTransaction {
  // Get transaction type - prefer transactionType, fallback to type for compatibility
  const transactionType = (tx.transactionType || tx.type || tx.transaction_type) as TransactionType;
  
  // Get amount - prefer tokenAmount/token_amount, fallback to amount
  const amount = tx.tokenAmount ?? tx.token_amount ?? tx.amount ?? 0;
  
  return {
    id: tx.id,
    fromUserId: tx.fromUserId ?? tx.from_user_id ?? null,
    toUserId: tx.toUserId ?? tx.to_user_id ?? null,
    userId: tx.userId ?? tx.user_id ?? null,
    from_user_id: tx.from_user_id ?? null,
    to_user_id: tx.to_user_id ?? null,
    amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
    tokenAmount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
    token_amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
    description: tx.description || '',
    timestamp: tx.timestamp,
    transactionType,
    type: transactionType, // Keep for backward compatibility
    contribution_id: tx.contributionId ?? tx.contribution_id ?? null,
    campaign_id: tx.campaignId ?? tx.campaign_id ?? null,
    contribution: tx.contribution ?? null,
    campaign: tx.campaign ?? null,
    user: tx.user ?? null
  };
}

/**
 * Format transaction timestamp to relative time string
 * Uses date-fns format() for consistency
 */
export function formatTransactionTime(timestamp: string, t: (key: string, params?: any[]) => string): string {
  const now = new Date();
  const txDate = new Date(timestamp);
  const diffMs = now.getTime() - txDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return t('justNow');
  } else if (diffMins < 60) {
    return `${diffMins}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else {
    return format(txDate, 'MMM d');
  }
}

/**
 * Format token balance to locale string
 */
export function formatTokenBalance(balance: number): string {
  return balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Determine if a transaction is positive (money coming in) based on context
 * @param transaction - The transaction to check
 * @param context - 'user' for user wallet view, 'treasury' for treasury view
 * @returns true if transaction represents money coming in for the given context
 */
export function isPositiveTransaction(
  transaction: TokenTransaction | any,
  context: 'user' | 'treasury' = 'user'
): boolean {
  // Normalize transaction type
  const txType = transaction.transactionType || transaction.type || transaction.transaction_type;
  
  if (context === 'user') {
    // For user wallet: positive = money coming TO user
    if (txType === 'REWARD') {
      return true; // Rewards are always positive for the user
    }
    if (txType === 'TRANSFER') {
      // Positive if user is the receiver
      return transaction.toUserId !== null || transaction.to_user_id !== null;
    }
    if (txType === 'DONATION') {
      return false; // Donations are outgoing from user
    }
    // TREASURY_DEPOSIT and TREASURY_WITHDRAWAL don't apply to user wallet
    return false;
  } else {
    // For treasury view: positive = money coming TO treasury
    if (txType === 'TREASURY_DEPOSIT' || txType === 'DONATION') {
      return true;
    }
    if (txType === 'TREASURY_WITHDRAWAL' || txType === 'REWARD') {
      return false;
    }
    // For TRANSFER, check if it's incoming to treasury (to_user_id is null or treasury)
    if (txType === 'TRANSFER') {
      return transaction.toUserId === null || transaction.to_user_id === null;
    }
    return false;
  }
}

/**
 * Get transaction title based on transaction type and direction
 */
export function getTransactionTitle(
  transaction: TokenTransaction | any,
  context: 'user' | 'treasury' = 'user',
  t: (key: string) => string
): string {
  const isPositive = isPositiveTransaction(transaction, context);
  const txType = transaction.transactionType || transaction.type || transaction.transaction_type;
  
  if (context === 'user') {
    if (!isPositive) {
      // Outgoing transactions
      if (transaction.description?.toLowerCase().includes('campaign')) {
        return t('campaignDonation');
      }
      return t('tokensSent');
    } else {
      // Incoming transactions
      if (txType === 'REWARD') {
        return t('actionReward');
      }
      return t('tokensReceived');
    }
  } else {
    // Treasury context
    if (!isPositive) {
      return t('actionReward');
    } else {
      return t('campaignDonation');
    }
  }
}

/**
 * Get transaction subtitle (description or related entity)
 */
export function getTransactionSubtitle(
  transaction: TokenTransaction | any,
  t: (key: string) => string
): string {
  // Try to extract campaign name from description
  if (transaction.description) {
    const desc = transaction.description.trim();
    // Remove common prefixes
    const cleaned = desc
      .replace(/^(Donation to campaign|Tokens sent to campaign|Campaign donation):\s*/i, '')
      .replace(/^(Action completed|Reward for):\s*/i, '');
    return cleaned || t('transaction');
  }
  return t('transaction');
}

/**
 * Get user display name from user object
 */
export function getUserDisplayName(user: any): string {
  if (!user) return '';
  return user.preferred_name || user.preferredName || `${user.first_name || user.firstName} ${user.last_name || user.lastName}`;
}

/**
 * Get transaction user name from transaction object
 */
export function getTransactionUserName(
  transaction: TokenTransaction | any,
  t: (key: string) => string
): string {
  const txType = transaction.transactionType || transaction.type || transaction.transaction_type;
  
  // For REWARD transactions, use transaction.user
  if (txType === 'REWARD' && transaction.user) {
    return getUserDisplayName(transaction.user);
  }
  
  // For DONATION transactions, use transaction.from_user or transaction.user
  if (txType === 'DONATION') {
    if (transaction.from_user) {
      return getUserDisplayName(transaction.from_user);
    }
    if (transaction.user) {
      return getUserDisplayName(transaction.user);
    }
  }
  
  // For other transaction types, try from_user or to_user
  if (transaction.from_user) {
    return getUserDisplayName(transaction.from_user);
  }
  if (transaction.to_user) {
    return getUserDisplayName(transaction.to_user);
  }
  
  return '-';
}

/**
 * Get transaction action/campaign name
 */
export function getTransactionActionCampaign(
  transaction: TokenTransaction | any,
  t: (key: string) => string
): string {
  const txType = transaction.transactionType || transaction.type || transaction.transaction_type;
  
  // For REWARD transactions, return contribution title
  if (txType === 'REWARD') {
    return transaction.contribution?.title || t('action');
  }
  
  // For DONATION transactions, return campaign title
  if (txType === 'DONATION') {
    return transaction.campaign?.title || t('campaign');
  }
  
  // For other transaction types, return '-'
  return '-';
}




