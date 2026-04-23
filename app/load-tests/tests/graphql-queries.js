import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  STANDARD_THRESHOLDS,
  rampingRateScenario,
} from '../lib/config.js';
import {
  hasuraQuery,
  checkGraphQLResponse,
  loadTestUsers,
  randomUser,
} from '../lib/helpers.js';

// Custom metrics
const contributionsQuerySuccess = new Rate('contributions_query_success');
const campaignsQuerySuccess = new Rate('campaigns_query_success');
const transactionsQuerySuccess = new Rate('transactions_query_success');
const subscriptionSimSuccess = new Rate('subscription_sim_success');
const queryDuration = new Trend('graphql_query_duration', true);
const hasuraErrors = new Counter('hasura_errors');

const TARGET_TPS = parseInt(__ENV.TARGET_TPS || '10');

export const options = {
  scenarios: {
    // Test 1: Contributions list query — common page load query
    contributions: {
      ...rampingRateScenario(TARGET_TPS, '2m'),
      exec: 'testContributionsList',
    },
    // Test 2: Campaigns list query — another common page load
    campaigns: {
      ...rampingRateScenario(TARGET_TPS, '2m'),
      exec: 'testCampaignsList',
    },
    // Test 3: User transaction history — involves joins
    transactions: {
      ...rampingRateScenario(Math.ceil(TARGET_TPS * 0.5), '2m'),
      exec: 'testUserTransactions',
    },
    // Test 4: Mixed workload — simulates realistic page navigation
    mixed_reads: {
      ...rampingRateScenario(TARGET_TPS * 2, '2m'),
      exec: 'testMixedReads',
      startTime: '30s',
    },
  },
  thresholds: {
    ...STANDARD_THRESHOLDS,
    contributions_query_success: ['rate>0.95'],
    campaigns_query_success: ['rate>0.95'],
    graphql_query_duration: ['p(95)<1000', 'p(99)<3000'],
  },
};

const testUsers = loadTestUsers();

// Queries matching what the frontend actually sends

const CONTRIBUTIONS_LIST_QUERY = `
  query GetContributions($limit: Int!, $offset: Int!) {
    contributions(limit: $limit, offset: $offset, order_by: {created_at: desc}) {
      id
      title
      description
      contribution_type
      token_reward
      is_active
      created_at
    }
  }
`;

const CAMPAIGNS_LIST_QUERY = `
  query GetCampaigns($limit: Int!, $offset: Int!) {
    campaigns(limit: $limit, offset: $offset, order_by: {created_at: desc}) {
      id
      title
      description
      goal_tokens
      category
      is_active
      created_at
    }
  }
`;

const USER_TRANSACTIONS_QUERY = `
  query GetUserTransactions($userId: uuid!, $limit: Int!, $offset: Int!) {
    token_transactions(
      where: {user_id: {_eq: $userId}}
      limit: $limit
      offset: $offset
      order_by: {timestamp: desc}
    ) {
      id
      transaction_type
      token_amount
      transaction_status
      cardano_tx_hash
      description
      timestamp
      confirmed_at
    }
  }
`;

const CAMPAIGNS_COUNT_QUERY = `
  query GetCampaignsCount {
    campaigns(limit: 1) {
      id
    }
  }
`;

export function testContributionsList() {
  const user = randomUser(testUsers);
  const jwt = user ? user.jwt : null;

  const res = hasuraQuery(
    CONTRIBUTIONS_LIST_QUERY,
    { limit: 20, offset: 0 },
    jwt
  );

  queryDuration.add(res.timings.duration);
  const passed = checkGraphQLResponse(res, 'contributions-list');
  contributionsQuerySuccess.add(passed);

  if (res.status >= 500) hasuraErrors.add(1);
}

export function testCampaignsList() {
  const user = randomUser(testUsers);
  const jwt = user ? user.jwt : null;

  const res = hasuraQuery(
    CAMPAIGNS_LIST_QUERY,
    { limit: 20, offset: 0 },
    jwt
  );

  queryDuration.add(res.timings.duration);
  const passed = checkGraphQLResponse(res, 'campaigns-list');
  campaignsQuerySuccess.add(passed);

  if (res.status >= 500) hasuraErrors.add(1);
}

export function testUserTransactions() {
  const user = randomUser(testUsers);
  if (!user) return;

  const res = hasuraQuery(
    USER_TRANSACTIONS_QUERY,
    { userId: user.userId, limit: 20, offset: 0 },
    user.jwt
  );

  queryDuration.add(res.timings.duration);
  const passed = checkGraphQLResponse(res, 'user-transactions');
  transactionsQuerySuccess.add(passed);

  if (res.status >= 500) hasuraErrors.add(1);
}

// Simulates realistic user behavior — navigating between pages
export function testMixedReads() {
  const user = randomUser(testUsers);
  const jwt = user ? user.jwt : null;

  // Randomly pick a query to simulate page navigation
  const rand = Math.random();

  if (rand < 0.3) {
    // 30%: contributions list (most visited page)
    const res = hasuraQuery(CONTRIBUTIONS_LIST_QUERY, { limit: 20, offset: 0 }, jwt);
    queryDuration.add(res.timings.duration);
    checkGraphQLResponse(res, 'mixed-contributions');
  } else if (rand < 0.55) {
    // 25%: campaigns list
    const res = hasuraQuery(CAMPAIGNS_LIST_QUERY, { limit: 20, offset: 0 }, jwt);
    queryDuration.add(res.timings.duration);
    checkGraphQLResponse(res, 'mixed-campaigns');
  } else if (rand < 0.75 && user) {
    // 20%: user transactions (requires auth)
    const res = hasuraQuery(USER_TRANSACTIONS_QUERY, { userId: user.userId, limit: 20, offset: 0 }, user.jwt);
    queryDuration.add(res.timings.duration);
    checkGraphQLResponse(res, 'mixed-transactions');
  } else {
    // 25%: campaigns count (lightweight read)
    const res = hasuraQuery(CAMPAIGNS_COUNT_QUERY, {}, jwt);
    queryDuration.add(res.timings.duration);
    checkGraphQLResponse(res, 'mixed-campaigns-count');
  }
}
