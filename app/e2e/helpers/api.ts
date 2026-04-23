import { Page } from '@playwright/test';
import { MeshWallet } from '@meshsdk/core';
import { env } from './env';
import { signLoginNonce } from './wallet';

// ─── REST API calls (existing Express endpoints) ───

export async function registerUser(data: {
  publicKey: string;
  firstName: string;
  lastName: string;
  email: string;
  reason: string;
  country?: string;
  language?: string;
}): Promise<{ userId: string; status: string }> {
  const formData = new FormData();
  formData.append('publicKey', data.publicKey);
  formData.append('firstName', data.firstName);
  formData.append('lastName', data.lastName);
  formData.append('email', data.email);
  formData.append('reason', data.reason);
  if (data.country) formData.append('country', data.country);
  if (data.language) formData.append('language', data.language);

  const res = await fetch(`${env.AUTH_URL}/api/register`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Registration failed: ${err.error || res.statusText}`);
  }

  return res.json();
}

export async function loginUser(
  userId: string,
  wallet: MeshWallet,
  address: string
): Promise<{ jwt: string; user: Record<string, any> }> {
  // Step 1: Get nonce
  const optionsRes = await fetch(`${env.AUTH_URL}/api/login/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!optionsRes.ok) {
    const err = await optionsRes.json().catch(() => ({ error: optionsRes.statusText }));
    throw new Error(`Login options failed: ${err.error || optionsRes.statusText}`);
  }

  const options = await optionsRes.json();
  if (options.status === 'pending') {
    throw new Error('User account is still pending approval');
  }

  // Step 2: Sign the nonce
  const signature = await signLoginNonce(wallet, options.nonce, address);

  // Step 3: Verify signature and get JWT
  const verifyRes = await fetch(`${env.AUTH_URL}/api/login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, signature }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({ error: verifyRes.statusText }));
    throw new Error(`Login verify failed: ${err.error || verifyRes.statusText}`);
  }

  const data = await verifyRes.json();
  const { jwt, ...user } = data;
  return { jwt, user };
}

export async function createChat(
  jwt: string,
  data: { name: string; isPrivate: boolean }
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${env.AUTH_URL}/api/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Create chat failed: ${err.error || res.statusText}`);
  }

  return res.json();
}

export async function sendChatMessage(
  jwt: string,
  chatId: string,
  content: string
): Promise<any> {
  const res = await fetch(`${env.AUTH_URL}/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Send message failed: ${err.error || res.statusText}`);
  }

  return res.json();
}

// ─── GraphQL (Hasura direct) ───

async function hasuraMutation(
  query: string,
  variables: Record<string, any>,
  jwt: string
): Promise<any> {
  const res = await fetch(env.HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function createContribution(
  jwt: string,
  data: {
    title: string;
    description: string;
    contributionType: string;
    tokenReward: number;
    externalLink?: string;
    isActive: boolean;
    createdBy: string;
  }
): Promise<{ id: string }> {
  const query = `
    mutation CreateContribution($object: contributions_insert_input!) {
      insert_contributions_one(object: $object) {
        id
      }
    }
  `;
  const result = await hasuraMutation(
    query,
    {
      object: {
        title: data.title,
        description: data.description,
        contribution_type: data.contributionType,
        token_reward: data.tokenReward.toString(),
        external_link: data.externalLink || null,
        is_active: data.isActive,
        created_by: data.createdBy,
        action_button_text: 'Complete Action',
      },
    },
    jwt
  );
  return result.insert_contributions_one;
}

export async function createCampaign(
  jwt: string,
  data: {
    title: string;
    description: string;
    goalTokens: number;
    category: string;
    isActive: boolean;
    createdBy: string;
  }
): Promise<{ id: string }> {
  const query = `
    mutation CreateCampaign($object: campaigns_insert_input!) {
      insert_campaigns_one(object: $object) {
        id
      }
    }
  `;
  const result = await hasuraMutation(
    query,
    {
      object: {
        title: data.title,
        description: data.description,
        goal_tokens: data.goalTokens,
        category: data.category,
        is_active: data.isActive,
        created_by: data.createdBy,
      },
    },
    jwt
  );
  return result.insert_campaigns_one;
}

// ─── Playwright auth injection ───

/**
 * Inject auth state into the browser's localStorage so the app
 * recognizes the user as logged in on next navigation.
 *
 * Sets both capacitor-secure-storage-plugin keys (cap_sec_*) and
 * Pinia persisted state for the auth store.
 */
export async function injectAuthIntoPage(
  page: Page,
  data: {
    userId: string;
    jwt: string;
    mnemonic: string;
    user: Record<string, any>;
  }
): Promise<void> {
  // Must navigate to the origin first so localStorage is accessible
  await page.goto('/');
  await page.evaluate(
    ({ userId, jwt, mnemonic, user }) => {
      // capacitor-secure-storage-plugin web fallback keys
      localStorage.setItem('cap_sec_mnemonic', mnemonic);
      localStorage.setItem('cap_sec_user-id', userId);
      localStorage.setItem('cap_sec_jwt', jwt);

      // Pinia persisted state for auth store
      localStorage.setItem(
        'auth',
        JSON.stringify({
          userId,
          jwt,
          accountStatus: user.status || 'approved',
          user: {
            id: userId,
            firstName: user.firstName,
            lastName: user.lastName,
            preferredName: user.preferredName || null,
            profileImage: user.profileImage || null,
            affiliations: user.affiliations || null,
            status: user.status || 'approved',
            email: user.email || null,
            walletAddress: user.walletAddress || null,
            country: user.country || null,
            language: user.language || null,
          },
          users: [],
        })
      );
    },
    data
  );
}
