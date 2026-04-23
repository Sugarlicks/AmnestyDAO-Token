import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { BASE_URL, HASURA_URL, HASURA_ADMIN_SECRET } from './config.js';

// Load test users from seeded data file
// SharedArray is read once and shared across all VUs (memory efficient)
let testUsersLoaded = false;
let _testUsers = [];

export function loadTestUsers(filePath) {
  try {
    return new SharedArray('test-users', function () {
      return JSON.parse(open(filePath || '../results/test-users.json'));
    });
  } catch (e) {
    // Return empty array if file doesn't exist — tests will use generated data
    return [];
  }
}

// Pick a random test user
export function randomUser(users) {
  if (!users || users.length === 0) return null;
  return users[Math.floor(Math.random() * users.length)];
}

// Make authenticated REST request to Express auth service
export function authRequest(method, path, body, jwt) {
  const url = `${BASE_URL}${path}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { endpoint: path },
  };

  if (jwt) {
    params.headers['Authorization'] = `Bearer ${jwt}`;
  }

  const payload = body ? JSON.stringify(body) : null;

  switch (method.toUpperCase()) {
    case 'GET':
      return http.get(url, params);
    case 'POST':
      return http.post(url, payload, params);
    case 'PUT':
      return http.put(url, payload, params);
    default:
      return http.request(method, url, payload, params);
  }
}

// Make GraphQL request to Hasura
export function hasuraQuery(query, variables, jwt) {
  const url = `${HASURA_URL}/v1/graphql`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'hasura-graphql' },
  };

  if (jwt) {
    params.headers['Authorization'] = `Bearer ${jwt}`;
  } else {
    params.headers['x-hasura-admin-secret'] = HASURA_ADMIN_SECRET;
  }

  const payload = JSON.stringify({ query, variables: variables || {} });
  return http.post(url, payload, params);
}

// Make Hasura Action request (these go through Express backend)
export function hasuraAction(actionName, input, jwt) {
  const url = `${BASE_URL}/actions/${actionName}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { endpoint: `action-${actionName}` },
  };

  if (jwt) {
    params.headers['Authorization'] = `Bearer ${jwt}`;
  }

  const payload = JSON.stringify({
    input: input,
    action: { name: actionName },
  });

  return http.post(url, payload, params);
}

// Standard response checks
export function checkResponse(res, name) {
  return check(res, {
    [`${name}: status 200`]: (r) => r.status === 200,
    [`${name}: response time < 2s`]: (r) => r.timings.duration < 2000,
    [`${name}: has body`]: (r) => r.body && r.body.length > 0,
  });
}

export function checkGraphQLResponse(res, name) {
  let body;
  try {
    body = res.json();
  } catch (e) {
    return false;
  }

  return check(res, {
    [`${name}: status 200`]: (r) => r.status === 200,
    [`${name}: no errors`]: () => !body.errors || body.errors.length === 0,
    [`${name}: has data`]: () => body.data !== undefined && body.data !== null,
  });
}

// Generate a fake UUID for testing
export function fakeUUID() {
  const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return hex;
}

// Bech32 encoding for valid Cardano testnet addresses
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32Checksum(hrp, data) {
  const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const polymod = bech32Polymod(values) ^ 1;
  const ret = [];
  for (let i = 0; i < 6; i++) ret.push((polymod >> (5 * (5 - i))) & 31);
  return ret;
}

function bytesToFivebit(data) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  for (const b of data) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      ret.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) ret.push((acc << (5 - bits)) & 31);
  return ret;
}

// Generate a valid Bech32-encoded Cardano testnet address
// Header byte 0x00 = base address on testnet, followed by 28-byte payment + 28-byte stake credential
export function fakeCardanoAddress() {
  const hrp = 'addr_test';
  const addrBytes = [0x00]; // testnet base address header
  for (let i = 0; i < 56; i++) { // 28 payment + 28 stake credential bytes
    addrBytes.push(Math.floor(Math.random() * 256));
  }
  const fiveBit = bytesToFivebit(addrBytes);
  const checksum = bech32Checksum(hrp, fiveBit);
  const combined = fiveBit.concat(checksum);
  let addr = hrp + '1';
  for (const b of combined) addr += BECH32_CHARSET[b];
  return addr;
}
