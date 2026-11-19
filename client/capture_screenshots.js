import { chromium } from 'playwright';
import path from 'path';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('Navigating to website...');
  try {
    await page.goto('https://chat.protutech.vip', { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log('Falling back to domcontentloaded...');
    await page.goto('https://chat.protutech.vip', { waitUntil: 'domcontentloaded' });
  }

  await page.waitForTimeout(2000);

  // 1. Capture Website Homepage / Landing Page
  const landingPath = path.resolve('screenshot_landing.png');
  await page.screenshot({ path: landingPath });
  console.log('Saved screenshot_landing.png');

  // 2. Open chat client
  console.log('Navigating to Web Client...');
  await page.goto('https://chat.protutech.vip/chat/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const clientPath = path.resolve('screenshot_client_login.png');
  await page.screenshot({ path: clientPath });
  console.log('Saved screenshot_client_login.png');

  // 3. Mock demo session state if login modal is present
  await page.evaluate(() => {
    localStorage.setItem('matrix_access_token', 'mock_token_store_demo');
    localStorage.setItem('matrix_user_id', '@andrex:chat.protutech.vip');
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const appPath = path.resolve('screenshot_app.png');
  await page.screenshot({ path: appPath });
  console.log('Saved screenshot_app.png');

  await browser.close();
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
