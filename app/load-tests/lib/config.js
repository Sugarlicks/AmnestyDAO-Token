// Shared configuration for all load tests
// Override via environment variables when running k6

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
export const HASURA_URL = __ENV.HASURA_URL || 'http://localhost:8080';
export const HASURA_ADMIN_SECRET = __ENV.HASURA_ADMIN_SECRET || 'change-me-hasura-admin-secret';

// Test user pool — seeded by scripts/seed-test-data.js
// Each entry needs: userId, publicKey (wallet address), jwt
export const TEST_USERS_FILE = __ENV.TEST_USERS_FILE || '../results/test-users.json';

// Target TPS levels for ramp testing
export const TPS_LEVELS = [1, 10, 25, 50, 100];

// Thresholds — requests should meet these to be considered passing
export const STANDARD_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<2000'],   // 95th < 500ms, 99th < 2s
  http_req_failed: ['rate<0.05'],                     // < 5% error rate
};

export const BLOCKCHAIN_THRESHOLDS = {
  http_req_duration: ['p(95)<10000', 'p(99)<30000'],  // blockchain ops are slower
  http_req_failed: ['rate<0.10'],                      // allow 10% for UTxO contention
};

// Cardano-specific constants
export const TREASURY_SCRIPT_ADDRESS = __ENV.TREASURY_SCRIPT_ADDRESS || '';
export const POLICY_ID = __ENV.POLICY_ID || '';
export const TOKEN_NAME = __ENV.TOKEN_NAME || '';

// Standard ramp-up scenario generator
export function rampScenario(targetVUs, duration) {
  return {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: Math.ceil(targetVUs * 0.25) },  // warm up
      { duration: '30s', target: Math.ceil(targetVUs * 0.5) },   // ramp to 50%
      { duration: '30s', target: targetVUs },                     // ramp to target
      { duration: duration || '2m', target: targetVUs },          // sustain
      { duration: '30s', target: 0 },                             // cool down
    ],
  };
}

// Constant arrival rate scenario — more realistic for TPS testing
export function constantRateScenario(targetTPS, duration) {
  return {
    executor: 'constant-arrival-rate',
    rate: targetTPS,
    timeUnit: '1s',
    duration: duration || '2m',
    preAllocatedVUs: targetTPS * 2,     // headroom for slow responses
    maxVUs: targetTPS * 10,             // upper bound
  };
}

// Ramping arrival rate — gradual increase to target TPS
export function rampingRateScenario(targetTPS, duration) {
  return {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs: targetTPS * 2,
    maxVUs: targetTPS * 10,
    stages: [
      { duration: '30s', target: Math.ceil(targetTPS * 0.1) },
      { duration: '30s', target: Math.ceil(targetTPS * 0.25) },
      { duration: '30s', target: Math.ceil(targetTPS * 0.5) },
      { duration: '1m', target: targetTPS },
      { duration: duration || '2m', target: targetTPS },
      { duration: '30s', target: 0 },
    ],
  };
}
