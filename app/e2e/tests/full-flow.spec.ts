import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  setUserStatus,
  resetTestData,
  cleanup,
  getIdByTitle,
  getUserIdByEmail,
  waitForRewardConfirmation,
} from '../helpers/db';
import {
  ADMIN_USER,
  MEMBER_USER,
  TEST_CONTRIBUTION,
  TEST_CAMPAIGN,
  TEST_CHAT,
} from '../fixtures/test-data';

// ─── Navigation helpers ───

async function navTo(page: Page, label: 'Actions' | 'Campaigns' | 'Chat') {
  await page.locator('.horizontal-navbar').getByRole('link', { name: label }).click();
  await page.waitForLoadState('networkidle');
}

async function registerViaUI(
  page: Page,
  user: typeof ADMIN_USER,
  targetStatus: 'admin' | 'approved',
) {
  // Clear all auth state before registering.
  // Navigate to about:blank first so localStorage.clear() runs before the Vue app loads.
  await page.goto('about:blank');
  await page.goto('/', { waitUntil: 'commit' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });

  await expect(page.getByText('Continue', { exact: false })).toBeVisible({ timeout: 15_000 });
  await page.getByText('Continue', { exact: false }).click();

  await expect(page.getByText('Get Started')).toBeVisible({ timeout: 10_000 });
  await page.getByText('Get Started').click();
  await page.waitForTimeout(500);

  const dialog = page.locator('.q-dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  await page.getByPlaceholder('How should we call you').fill(`${user.firstName} ${user.lastName}`);
  await page.getByPlaceholder('your@email.com').fill(user.email);

  const countrySelect = dialog.locator('.q-select').first();
  await countrySelect.click();
  await page.getByText('New Zealand', { exact: false }).first().click();
  await page.waitForTimeout(300);

  await dialog.locator('.q-card').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(300);
  await dialog.getByText('I agree to the terms', { exact: false }).click();
  await page.waitForTimeout(200);
  await dialog.locator('.q-card').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: /join the movement/i }).click();

  // Wait for registration — the backend tries to reward tokens from treasury.
  // With retry logic, this can take up to ~2 minutes if UTxOs are contended.
  await expect(page.getByText('Registration successful', { exact: false }))
    .toBeVisible({ timeout: 120_000 });

  const userId = await getUserIdByEmail(user.email);
  await setUserStatus(userId, targetStatus);

  // Reload to trigger login with the new status
  await page.goto('/');
  await page.waitForTimeout(5000);

  // Wait for the registration reward to confirm on-chain.
  // Poll the DB for confirmation, then reload the page to refresh the balance.
  console.log(`Waiting for ${user.firstName}'s registration reward to confirm on-chain...`);
  const { waitForRewardConfirmation } = require('../helpers/db');
  await waitForRewardConfirmation(userId, 300_000);

  // Reload to pick up the confirmed balance
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`${user.firstName} reward confirmed — proceeding.`);

  return userId;
}

// ══════════════════════════════════════════════
// ADMIN FLOW — Steps 1-4 share a single page
// ══════════════════════════════════════════════

test.describe.serial('Admin Flow', () => {
  let adminPage: Page;
  let adminContext: BrowserContext;
  let adminUserId: string;

  test.beforeAll(async ({ browser }) => {
    await resetTestData();
    adminContext = await browser.newContext({ ...test.info().project.use });
    adminPage = await adminContext.newPage();
  });

  test.afterAll(async () => {
    await adminContext.close();
  });

  test('Step 1: Register admin and set status to admin', async () => {
    adminUserId = await registerViaUI(adminPage, ADMIN_USER, 'admin');
    await expect(adminPage.locator('.horizontal-navbar')).toBeVisible({ timeout: 15_000 });
  });

  test('Step 2: Admin creates a contribution', async () => {
    await adminPage.goto('/#/admin/contributions');
    await adminPage.waitForLoadState('networkidle');

    await adminPage.getByText('Add Contribution').click();
    await adminPage.waitForTimeout(500);

    const dialog = adminPage.locator('.q-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.locator('input').first().fill(TEST_CONTRIBUTION.title);
    await dialog.locator('textarea').first().fill(TEST_CONTRIBUTION.description);

    await dialog.locator('.q-card').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await adminPage.waitForTimeout(300);
    await dialog.locator('input[type="number"]').first().fill(String(TEST_CONTRIBUTION.tokenReward));
    await dialog.locator('input[type="url"]').first().fill(TEST_CONTRIBUTION.externalLink!);

    await dialog.locator('.q-card').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await adminPage.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Create Contribution' }).click();
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(1000);

    await navTo(adminPage, 'Actions');
    await expect(adminPage.getByText(TEST_CONTRIBUTION.title)).toBeVisible({ timeout: 15_000 });
  });

  test('Step 3: Admin creates a campaign', async () => {
    await adminPage.goto('/#/admin/campaigns');
    await adminPage.waitForLoadState('networkidle');

    await adminPage.getByText('Add Campaign').click();
    await adminPage.waitForTimeout(500);

    const dialog = adminPage.locator('.q-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.locator('input').first().fill(TEST_CAMPAIGN.title);
    await dialog.locator('textarea').first().fill(TEST_CAMPAIGN.description);

    await dialog.locator('.q-card').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await adminPage.waitForTimeout(300);
    await dialog.locator('input[type="number"]').first().fill(String(TEST_CAMPAIGN.goalTokens));

    const categorySelect = dialog.locator('.q-select').first();
    await categorySelect.click();
    await adminPage.waitForTimeout(500);
    await adminPage.locator('[role="option"]').filter({ hasText: 'Digital Rights' }).click();
    await adminPage.waitForTimeout(300);

    await dialog.locator('.q-card').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await adminPage.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Create Campaign' }).click();
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(1000);

    await navTo(adminPage, 'Campaigns');
    await expect(adminPage.getByText(TEST_CAMPAIGN.title)).toBeVisible({ timeout: 15_000 });
  });

  test('Step 4: Admin creates a chat channel', async () => {
    await adminPage.goto('/#/admin/chats');
    await adminPage.waitForLoadState('networkidle');

    await adminPage.getByText('Add Channel').click();
    await adminPage.waitForTimeout(500);

    const dialog = adminPage.locator('.q-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.locator('input').first().fill(TEST_CHAT.name);
    await dialog.getByRole('button', { name: 'Create Channel' }).click();
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(1000);

    await navTo(adminPage, 'Chat');
    await expect(adminPage.getByText(TEST_CHAT.name).first()).toBeVisible({ timeout: 15_000 });
  });
});

// ══════════════════════════════════════════════
// MEMBER FLOW — Steps 5-8 share a single page
// ══════════════════════════════════════════════

test.describe.serial('Member Flow', () => {
  let memberPage: Page;
  let memberContext: BrowserContext;
  let memberUserId: string;
  let contributionId: string;
  let campaignId: string;
  let chatId: string;

  test.beforeAll(async ({ browser }) => {
    contributionId = await getIdByTitle('contributions', TEST_CONTRIBUTION.title);
    campaignId = await getIdByTitle('campaigns', TEST_CAMPAIGN.title);
    chatId = await getIdByTitle('chats', TEST_CHAT.name, 'name');

    memberContext = await browser.newContext({ ...test.info().project.use });
    memberPage = await memberContext.newPage();
  });

  test.afterAll(async () => {
    await memberContext.close();
    await cleanup();
  });

  test('Step 5: Register member with status approved', async () => {
    memberUserId = await registerViaUI(memberPage, MEMBER_USER, 'approved');
    await expect(memberPage.locator('.horizontal-navbar')).toBeVisible({ timeout: 15_000 });

    await navTo(memberPage, 'Actions');
    await expect(memberPage.getByText(TEST_CONTRIBUTION.title)).toBeVisible({ timeout: 15_000 });
  });

  test('Step 6: Member completes contribution and earns reward', async () => {
    // Wait for the treasury UTxO change from registration reward to settle in Blockfrost
    await memberPage.waitForTimeout(30_000);

    // Wait for contributions to load, then tap to view details
    await expect(memberPage.getByText(TEST_CONTRIBUTION.title)).toBeVisible({ timeout: 15_000 });
    await memberPage.getByText(TEST_CONTRIBUTION.title).click();
    await memberPage.waitForLoadState('networkidle');
    await expect(memberPage.getByText('5 HR Tokens').first()).toBeVisible({ timeout: 15_000 });

    // Scroll down to reveal the action button
    await memberPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await memberPage.waitForTimeout(300);

    // Click "Complete Action" — on web this opens a new tab via window.open()
    // and immediately calls completeContribution() which triggers the real
    // rewardUser → blockchain flow. Close the popup tab after it opens.
    const completeBtn = memberPage.getByRole('button', { name: /complete action/i });
    await expect(completeBtn).toBeVisible({ timeout: 5_000 });

    // Listen for the new tab that window.open() creates, and close it
    memberPage.context().once('page', async (popup) => {
      await popup.close();
    });

    await completeBtn.click();

    // Wait for the reward success notification
    // The completeContribution() store method shows "You earned X HR Tokens!"
    // Blockchain confirmation can take 1-5 minutes on testnet
    await expect(memberPage.getByText(/you earned/i)).toBeVisible({ timeout: 300_000 });

    // The button should now show "Action Completed"
    await expect(memberPage.getByRole('button', { name: /action completed/i }))
      .toBeVisible({ timeout: 10_000 });

    // Wait for the contribution reward to confirm on-chain
    // so the member's wallet balance updates before Step 7
    console.log('Waiting for contribution reward to confirm...');
    await waitForRewardConfirmation(memberUserId, 300_000);
    console.log('Contribution reward confirmed.');

    // Go back to list and reload to pick up the new balance
    await memberPage.goBack();
    await memberPage.waitForLoadState('networkidle');
    await memberPage.reload({ waitUntil: 'networkidle' });
    await memberPage.waitForTimeout(3000);
  });

  test('Step 7: Member donates reward tokens to campaign', async () => {

    // Navigate to campaigns
    await navTo(memberPage, 'Campaigns');
    await expect(memberPage.getByText(TEST_CAMPAIGN.title)).toBeVisible({ timeout: 15_000 });

    // Tap campaign to see details
    await memberPage.getByText(TEST_CAMPAIGN.title).click();
    await memberPage.waitForLoadState('networkidle');
    await expect(memberPage.getByText(TEST_CAMPAIGN.title)).toBeVisible({ timeout: 15_000 });

    // Scroll to donation section
    await memberPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await memberPage.waitForTimeout(300);

    // Enter donation amount
    const amountInput = memberPage.locator('input[type="number"]');
    await expect(amountInput).toBeVisible({ timeout: 10_000 });
    await amountInput.fill('5');

    // Click "Send Tokens" — triggers the real donation flow:
    // buildDonationTransaction → sign with wallet → donateToCampaign → blockchain
    const sendBtn = memberPage.getByRole('button', { name: /send tokens/i });
    await expect(sendBtn).toBeEnabled({ timeout: 60_000 });
    await sendBtn.click();

    // Wait for the success notification — blockchain confirmation can take 1-5 min
    await expect(memberPage.getByText(/donation successful/i))
      .toBeVisible({ timeout: 300_000 });

    // Go back
    await memberPage.goBack();
    await memberPage.waitForLoadState('networkidle');
  });

  test('Step 8: Member sends message in chat channel', async () => {
    await navTo(memberPage, 'Chat');
    await expect(memberPage.getByText(TEST_CHAT.name).first()).toBeVisible({ timeout: 15_000 });

    await memberPage.getByText(TEST_CHAT.name).first().click();
    await memberPage.waitForLoadState('networkidle');

    const messageInput = memberPage.locator('.message-input input').first();
    await expect(messageInput).toBeVisible({ timeout: 15_000 });
    await messageInput.fill('Hello from E2E test');
    await messageInput.press('Enter');

    await expect(memberPage.getByText('Hello from E2E test')).toBeVisible({ timeout: 10_000 });
  });
});
