import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  STANDARD_THRESHOLDS,
  rampingRateScenario,
} from '../lib/config.js';
import {
  authRequest,
  checkResponse,
  loadTestUsers,
  randomUser,
  fakeUUID,
  fakeCardanoAddress,
} from '../lib/helpers.js';

// Custom metrics
const loginOptionsSuccess = new Rate('login_options_success');
const loginVerifySuccess = new Rate('login_verify_success');
const registerSuccess = new Rate('register_success');
const loginOptionsDuration = new Trend('login_options_duration', true);
const loginVerifyDuration = new Trend('login_verify_duration', true);
const registerDuration = new Trend('register_duration', true);
const dbQueryErrors = new Counter('db_query_errors');

// Target TPS from environment, default 10
const TARGET_TPS = parseInt(__ENV.TARGET_TPS || '10');

export const options = {
  scenarios: {
    // Test 1: Login options endpoint (DB read + nonce generation)
    login_options: {
      ...rampingRateScenario(TARGET_TPS, '2m'),
      exec: 'testLoginOptions',
    },
    // Test 2: Registration endpoint (DB write + blockchain reward)
    registration: {
      ...rampingRateScenario(Math.ceil(TARGET_TPS * 0.1), '2m'), // 10% of target — registrations are expensive
      exec: 'testRegister',
      startTime: '30s', // stagger start
    },
    // Test 3: Health check (baseline — should always be fast)
    healthcheck: {
      ...rampingRateScenario(TARGET_TPS * 2, '2m'),
      exec: 'testHealthCheck',
    },
  },
  thresholds: {
    ...STANDARD_THRESHOLDS,
    login_options_success: ['rate>0.95'],
    login_options_duration: ['p(95)<500'],
    register_duration: ['p(95)<15000'], // registration triggers blockchain reward
  },
};

const testUsers = loadTestUsers();

// Test login/options — this is the most common auth endpoint
// It does a DB query + nonce generation, so it tests DB connection pool under load
export function testLoginOptions() {
  const user = randomUser(testUsers);
  const userId = user ? user.userId : fakeUUID();

  const res = authRequest('POST', '/api/login/options', { userId });

  loginOptionsDuration.add(res.timings.duration);

  const passed = checkResponse(res, 'login-options');
  loginOptionsSuccess.add(passed);

  if (res.status >= 500) {
    dbQueryErrors.add(1);
  }
}

// Test registration — the heaviest auth endpoint
// It does: DB insert + blockchain reward (Plutus script spend)
// This is the worst-case auth scenario for scaling
export function testRegister() {
  const publicKey = fakeCardanoAddress();

  const res = authRequest('POST', '/api/register', {
    publicKey: publicKey,
    firstName: `LoadTest_${Date.now()}`,
    lastName: 'User',
    reason: 'Load testing registration flow',
    email: `loadtest_${Date.now()}@test.local`,
    country: 'nz',
    language: 'en',
  });

  registerDuration.add(res.timings.duration);

  const passed = checkResponse(res, 'register');
  registerSuccess.add(passed);

  if (res.status >= 500) {
    dbQueryErrors.add(1);
  }
}

// Baseline health check — should always respond < 10ms
export function testHealthCheck() {
  const res = authRequest('GET', '/healthz');
  checkResponse(res, 'healthz');
}
