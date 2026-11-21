import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4174';

function saveScreenshotCopies(buffer, relativeTargets) {
  for (const rel of relativeTargets) {
    const dest = path.resolve(currentDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buffer);
    console.log(`Saved ${rel} (${buffer.length} bytes)`);
  }
}

async function captureAllStoreScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    permissions: ['camera', 'microphone'],
  });

  const page = await context.newPage();

  try {
    // 1. Login Screen (1920x1080)
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('[data-testid="quick-signin-andrex-btn"]', { timeout: 15000 });
    await page.waitForTimeout(2400);

    const loginBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(loginBuf, [
      'store_screenshots/screenshot_app_login.png',
      'screenshot_app_login.png',
      'screenshot_app_actual.png',
      'screenshot_app.png',
    ]);

    // 2. Enter Guest Mode -> 1:1 Discord Dark Main Chat & Channels View (1920x1080)
    await page.click('button:has-text("Sample App as Guest")');
    await page.waitForSelector('[data-testid="userbar-loopback-btn"]', { timeout: 15000 });
    await page.waitForTimeout(2400);

    const chatBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(chatBuf, [
      'store_screenshots/screenshot_1_chat_channels.png',
      'screenshot_1_chat_channels.png',
      'screenshot_app_main.png',
      'screenshot_chat.png',
    ]);

    // 3. Full-Viewport Discord Settings -> Appearance (Discord/TS3 Switcher + Zoom Level)
    await page.click('button[title="User Settings"]');
    await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 10000 });
    await page.click('[data-testid="settings-modal"] button:has-text("Appearance")');
    await page.waitForSelector('[data-testid="settings-zoom-slider"]', { timeout: 10000 });
    await page.locator('[data-testid="settings-zoom-slider"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(450);

    const appearanceBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(appearanceBuf, [
      'store_screenshots/screenshot_2_appearance_settings.png',
      'screenshot_2_appearance_settings.png',
    ]);

    // 4. Settings -> Voice & Video (Mic Playback + Live Camera Preview + Virtual Background)
    await page.click('[data-testid="settings-modal"] button:has-text("Voice & Video")');
    await page.waitForSelector('[data-testid="camera-preview-panel"]', { timeout: 10000 });
    await page.click('[data-testid="camera-preview-toggle-btn"]');
    await page.waitForSelector('[data-testid="camera-preview-video"]', { timeout: 10000 });
    await page.click('[data-testid="bg-tile-aurora_borealis"]');
    await page.locator('[data-testid="camera-preview-panel"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const voiceArchBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(voiceArchBuf, [
      'store_screenshots/screenshot_4_voice_architecture.png',
      'screenshot_4_voice_architecture.png',
    ]);

    // Stop camera preview cleanly & close Settings
    await page.click('[data-testid="camera-preview-toggle-btn"]');
    await page.click('[data-testid="settings-close-btn"]');
    await page.waitForTimeout(250);

    // 5. Live Voice Stage + Camera + Spotlight Screen Share + Mic Playback + Soundboard Popover
    await page.locator('div[title="Click to join Voice Lounge"]').first().click();
    await page.waitForSelector('[data-testid="voice-stage"]', { timeout: 15000 });
    await page.click('[data-testid="voice-mic-loopback-btn"]');
    await page.click('[data-testid="voice-camera-btn"]');
    await page.click('[data-testid="voice-screen-btn"]');
    await page.waitForSelector('[data-testid="voice-spotlight-container"]', { timeout: 12000 });
    await page.click('[data-testid="voice-soundboard-btn"]');
    await page.waitForSelector('[data-testid="soundboard-popover"]', { timeout: 10000 });
    await page.waitForTimeout(600);

    const liveVoiceBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(liveVoiceBuf, [
      'store_screenshots/screenshot_voice.png',
      'screenshot_voice.png',
    ]);

    await page.click('button[aria-label="Close Soundboard"]');
    await page.waitForTimeout(200);

    // 6. TeamSpeak 3 Classic Format Mode (1920x1080)
    await page.click('[data-testid="layout-toggle-ts3"]');
    await page.waitForSelector('[data-testid="teamspeak-layout"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const ts3Buf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(ts3Buf, [
      'store_screenshots/screenshot_teamspeak_mode.png',
    ]);

    // 7. Website Landing Page (../index.html at 1920x1080)
    const landingFile = path.resolve(currentDir, '../index.html');
    await page.goto(`file:///${landingFile.replace(/\\/g, '/')}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1200);

    const landingBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(landingBuf, [
      'store_screenshots/screenshot_3_website_landing.png',
      'screenshot_3_website_landing.png',
      'screenshot_landing.png',
      'screenshot_website_landing.png',
    ]);

    console.log('All 1920x1080 app and store screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

captureAllStoreScreenshots().catch((err) => {
  console.error('Error capturing store screenshots:', err);
  process.exit(1);
});
