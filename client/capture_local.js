import { chromium } from 'playwright';
import path from 'path';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Navigating to local preview client...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Capture Login Screen of actual app
  const loginPath = path.resolve('screenshot_app_login.png');
  await page.screenshot({ path: loginPath });
  console.log('Saved screenshot_app_login.png');

  // Inject user credentials so actual chat interface renders
  await page.evaluate(() => {
    localStorage.setItem('matrix_access_token', 'store_submission_demo_token');
    localStorage.setItem('matrix_user_id', '@andrex:chat.protutech.vip');
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Capture Main Chat & Server Interface of actual app
  const mainAppPath = path.resolve('screenshot_app_main.png');
  await page.screenshot({ path: mainAppPath });
  console.log('Saved screenshot_app_main.png');

  // Also capture the root landing page from index.html in parent directory
  const rootPage = await context.newPage();
  const fileUrl = 'file:///' + path.resolve('../index.html').replace(/\\/g, '/');
  console.log('Navigating to root landing page:', fileUrl);
  await rootPage.goto(fileUrl, { waitUntil: 'load' });
  await rootPage.waitForTimeout(1000);
  const landingPath = path.resolve('screenshot_website_landing.png');
  await rootPage.screenshot({ path: landingPath });
  console.log('Saved screenshot_website_landing.png');

  await browser.close();
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
