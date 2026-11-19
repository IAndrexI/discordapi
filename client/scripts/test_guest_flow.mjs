import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotPath = 'C:\\Users\\Andre\\.gemini\\antigravity\\brain\\f27f96d9-06f2-4f25-a70f-c9c816a95aef\\protutech_guest_sample_screenshot.png';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

  // 1. Check for Guest Sample button on Login modal
  const sampleBtn = page.getByText('Sample App as Guest (No Sign-In Required)');
  const isSampleVisible = await sampleBtn.isVisible();
  console.log('Sample App as Guest button visible:', isSampleVisible);

  if (isSampleVisible) {
    await sampleBtn.click();
    console.log('Clicked Sample App as Guest!');
    await page.waitForTimeout(1000);
  }

  // 2. Check for Guest Notice banner
  const guestBanner = page.getByText('Guest Sampling Sandbox');
  const isBannerVisible = await guestBanner.isVisible();
  console.log('Guest banner visible:', isBannerVisible);

  // 3. Test Texting in #welcome-sandbox
  const chatInput = page.locator('textarea, input[placeholder*="Message"], input[type="text"]').last();
  if (await chatInput.isVisible()) {
    console.log('Typing test message in chat input...');
    await chatInput.fill('Hello Protutech! Testing real-time messaging latency and guest mode.');
    await page.keyboard.press('Enter');
    console.log('Message sent! Waiting for bot echo response...');
    await page.waitForTimeout(1000);
  }

  // 4. Test Create Temporary Channel
  const newTempBtn = page.getByRole('button', { name: /New Temp Channel/i });
  if (await newTempBtn.isVisible()) {
    console.log('Clicking New Temp Channel button...');
    await newTempBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="e.g. testing-lounge"], input[placeholder*="squad-voice"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('night-ops-chat');
      const createBtn = page.getByRole('button', { name: 'Create Temp Channel' });
      await createBtn.click();
      console.log('Created temporary channel #night-ops-chat!');
      await page.waitForTimeout(500);
    }
  }

  // 5. Open Settings to check App Icon
  const settingsBtn = page.locator('button[title*="Settings"], button:has(svg.lucide-settings)').first();
  if (await settingsBtn.isVisible()) {
    console.log('Opening Settings Modal...');
    await settingsBtn.click();
    await page.waitForTimeout(800);

    const appIconTab = page.getByText('App Icon');
    if (await appIconTab.isVisible()) {
      console.log('Switching to App Icon tab...');
      await appIconTab.click();
      await page.waitForTimeout(600);
    }
  }

  // Take screenshot of settings or guest app
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Saved screenshot to:', screenshotPath);

  // Close Settings to capture main chat area
  const closeSettingsBtn = page.locator('button:has(svg.lucide-x)').first();
  if (await closeSettingsBtn.isVisible()) {
    await closeSettingsBtn.click();
    await page.waitForTimeout(500);
  }

  // 6. Click Voice Loopback channel to test MediaSampleStage
  const voiceChannel = page.getByText('voice-loopback-test').first();
  if (await voiceChannel.isVisible()) {
    console.log('Clicking voice-loopback-test channel...');
    await voiceChannel.click();
    await page.waitForTimeout(1000);

    const voiceStageScreenshotPath = 'C:\\Users\\Andre\\.gemini\\antigravity\\brain\\f27f96d9-06f2-4f25-a70f-c9c816a95aef\\protutech_media_test_stage.png';
    await page.screenshot({ path: voiceStageScreenshotPath, fullPage: false });
    console.log('Saved media test stage screenshot to:', voiceStageScreenshotPath);
  }

  await browser.close();
  console.log('Done test verification!');
}

main().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
