import { test, expect } from '@playwright/test';

test.describe('Kin Family Safety Assistant - Comprehensive Frontend Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Loads homepage and verifies main elements', async ({ page }) => {
    // Title & header
    await expect(page).toHaveTitle(/Kin/i);
    const mainHeading = page.locator('.page-heading h1');
    await expect(mainHeading).toBeVisible();

    // Conversation inputs
    await expect(page.getByTestId('input-message')).toBeVisible();
    await expect(page.getByTestId('button-send-message')).toBeVisible();

    // Mode Pill
    const modePill = page.locator('.mode-pill');
    await expect(modePill).toBeVisible();
  });

  test('2. Submits a safety query in the chat input', async ({ page }) => {
    const input = page.getByTestId('input-message');
    const sendButton = page.getByTestId('button-send-message');

    // Type a suspicious scam scenario
    await input.fill('Someone called saying my bank account was hacked and told me to install AnyDesk.');
    await sendButton.click();

    // Verify user turn appears in transcript
    const userTurn = page.locator('.turn.you');
    await expect(userTurn).toBeVisible();
    await expect(userTurn).toContainText('install AnyDesk');

    // In demo mode, verify Kin generates a protective response
    const kinTurn = page.locator('.turn.kin');
    await expect(kinTurn).toBeVisible({ timeout: 5000 });
  });

  test('3. Navigates to Dashboard (P1) page', async ({ page }) => {
    await page.getByTestId('link-dashboard').click();
    await expect(page).toHaveURL(/.*dashboard/);

    const heading = page.locator('.page-heading h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Family Guardian Dashboard/i);

    // Verify dashboard cards exist
    const cards = page.locator('.kin-card');
    await expect(cards.first()).toBeVisible();
  });

  test('4. Navigates to Phishing Lab page', async ({ page }) => {
    await page.getByTestId('link-scam-lab').click();
    await expect(page).toHaveURL(/.*scam-lab/);

    const heading = page.locator('.page-heading h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Phishing/i);

    // Check that interactive test scenario cards are present
    const scenarioCards = page.locator('.scenario-card, .kin-card');
    await expect(scenarioCards.first()).toBeVisible();
  });

  test('5. Navigates to Alert history and Preferences pages', async ({ page }) => {
    // History
    await page.getByTestId('link-history').click();
    await expect(page).toHaveURL(/.*history/);
    const historyHeading = page.locator('.page-heading h1');
    await expect(historyHeading).toBeVisible();

    // Preferences
    await page.getByTestId('link-settings').click();
    await expect(page).toHaveURL(/.*settings/);
    const settingsHeading = page.locator('.page-heading h1');
    await expect(settingsHeading).toBeVisible();

    // Test form controls in preferences
    const familyNameInput = page.getByTestId('input-family-name');
    await expect(familyNameInput).toBeVisible();
    await familyNameInput.fill('Maya & Family');
    await expect(familyNameInput).toHaveValue('Maya & Family');

    // Language dropdown
    const languageSelect = page.getByTestId('select-language');
    await expect(languageSelect).toBeVisible();
  });

  test('6. Verifies locked light mode with off-white styling', async ({ page }) => {
    // Confirm dark class is not applied to root element
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(false);

    // Verify theme toggle button was removed
    const themeBtn = page.getByTestId('button-theme-toggle');
    await expect(themeBtn).toHaveCount(0);
  });
});
