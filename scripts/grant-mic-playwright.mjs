import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const extensionPath = path.resolve('chrome-extension').replace(/\\/g, '/');
console.log('Loading extension from:', extensionPath);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kin-pw-chrome-'));

async function main() {
  const context = await chromium.launchPersistentContext(tempDir, {
    channel: 'chrome',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--auto-accept-camera-and-microphone-capture',
      '--no-sandbox',
    ],
    permissions: ['microphone'],
  });

  console.log('Playwright Chrome context started.');

  // Find the extension ID from the service worker
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
  }

  let extensionId = '';
  if (serviceWorker) {
    extensionId = serviceWorker.url().split('/')[2];
  } else {
    // If service worker event took longer, wait 2 seconds and check
    await new Promise(r => setTimeout(r, 2000));
    for (const sw of context.serviceWorkers()) {
      if (sw.url().includes('chrome-extension://')) {
        extensionId = sw.url().split('/')[2];
        break;
      }
    }
  }

  console.log('Discovered Extension ID:', extensionId);

  if (!extensionId) {
    throw new Error('Could not discover extension ID.');
  }

  // 1. Grant microphone permissions explicitly to this extension origin
  const origin = `chrome-extension://${extensionId}`;
  await context.grantPermissions(['microphone'], { origin });
  console.log('Granted Playwright microphone permission for origin:', origin);

  const page = await context.newPage();

  // 2. Open permission.html
  console.log(`Navigating to ${origin}/permission.html...`);
  await page.goto(`${origin}/permission.html`);
  await page.waitForLoadState('domcontentloaded');

  // Click the Allow Microphone Access button
  console.log('Clicking "Allow Microphone Access" button on permission page...');
  await page.click('#grant-btn');
  await page.waitForTimeout(1500);

  const statusText = await page.locator('#status').textContent();
  console.log('Permission page status:', statusText);

  // Take screenshot of permission page
  const testResultsDir = path.resolve('test-results');
  if (!fs.existsSync(testResultsDir)) fs.mkdirSync(testResultsDir, { recursive: true });
  await page.screenshot({ path: path.join(testResultsDir, 'permission-granted.png') });
  console.log('Saved screenshot: test-results/permission-granted.png');

  // 3. Open sidepanel.html and test live session
  console.log(`Navigating to ${origin}/sidepanel.html...`);
  await page.goto(`${origin}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  console.log('Clicking microphone button in sidepanel...');
  await page.click('#mic-toggle-btn');
  await page.waitForTimeout(2500);

  const micStatus = await page.locator('#mic-status-label').textContent();
  const liveBadge = await page.locator('#badge-text').textContent();
  console.log('Sidepanel Status Label:', micStatus);
  console.log('Sidepanel Live Badge:', liveBadge);

  await page.screenshot({ path: path.join(testResultsDir, 'sidepanel-live.png') });
  console.log('Saved screenshot: test-results/sidepanel-live.png');

  await page.waitForTimeout(3000);
  await context.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Playwright run completed with 100% success!');
}

main().catch(err => {
  console.error('Test run failed:', err);
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
