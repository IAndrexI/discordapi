import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4174;
const BASE_URL = process.env.PREVIEW_URL || `http://127.0.0.1:${PORT}`;
const DB_PATH = path.resolve(currentDir, 'server-data/db.json');

function saveScreenshotCopies(buffer, relativeTargets) {
  for (const rel of relativeTargets) {
    const dest = path.resolve(currentDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buffer);
    console.log(`Saved ${rel} (${buffer.length} bytes)`);
  }
}

async function isReachable(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

function stopProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32' && proc.pid) {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {
      // Ignore already exited
    }
  }
}

async function ensurePreviewServer() {
  if (await isReachable(BASE_URL)) {
    return null;
  }
  if (process.env.PREVIEW_URL) {
    throw new Error(`PREVIEW_URL ${BASE_URL} is not reachable`);
  }

  console.log(`Starting Vite preview server on ${BASE_URL}...`);
  const proc = spawn(`npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`, {
    cwd: currentDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const start = Date.now();
  while (Date.now() - start < 25000) {
    if (await isReachable(BASE_URL)) {
      console.log('Preview server is ready.');
      return proc;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  stopProcessTree(proc);
  throw new Error(`Timed out waiting for preview server at ${BASE_URL}`);
}

async function captureAllStoreScreenshots() {
  const originalDbBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  const previewProc = await ensurePreviewServer();
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
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('[data-testid="quick-signin-andrex-btn"]', { timeout: 15000 });
    await page.waitForTimeout(2300);

    const loginBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(loginBuf, [
      'store_screenshots/screenshot_app_login.png',
      'screenshot_app_login.png',
      'screenshot_app_actual.png',
      'screenshot_app.png',
      'screenshot_client_login.png',
    ]);

    // 2. Quick Sign In -> Protutech Obsidian Main Chat & Channels View (1920x1080)
    await page.click('[data-testid="quick-signin-andrex-btn"]');
    await page.waitForSelector('[data-testid="userbar-loopback-btn"]', { timeout: 15000 });
    await page.waitForSelector('textarea[aria-label^="Message #"]', { timeout: 15000 });
    await page.waitForTimeout(1200);

    const chatBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(chatBuf, [
      'store_screenshots/screenshot_1_chat_channels.png',
      'screenshot_1_chat_channels.png',
      'screenshot_app_main.png',
      'screenshot_chat.png',
    ]);

    // 3. Full-Viewport Settings -> Appearance (Protutech Obsidian, Revolt / Stoat, Classic Dark, Light Mode)
    await page.click('button[aria-label="Settings"]');
    await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 10000 });
    await page.click('[data-testid="settings-modal"] button:has-text("Appearance")');
    await page.waitForSelector('[data-testid="theme-card-dark"]', { timeout: 10000 });
    await page.locator('[data-testid="theme-card-dark"]').scrollIntoViewIfNeeded();
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

    // 5. Camera Preview & Virtual Backgrounds Modal (autoStart)
    await page.click('[data-testid="topbar-tools-menu-btn"]');
    await page.click('[data-testid="topbar-camera-preview-btn"]');
    await page.waitForSelector('[data-testid="webcam-background-modal"] [data-testid="camera-preview-video"]', {
      timeout: 10000,
    });
    await page.click('[data-testid="bg-tile-aurora_borealis"]');
    await page.waitForTimeout(600);

    const camModalBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(camModalBuf, [
      'store_screenshots/screenshot_camera_preview.png',
    ]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    // 6. Community Hub Modal (Quests & Perks)
    await page.click('[data-testid="topbar-tools-menu-btn"]');
    await page.click('[data-testid="topbar-discord-hub-btn"]');
    await page.waitForSelector('[role="dialog"][aria-labelledby="community-hub-title"]', {
      timeout: 10000,
    });
    await page.waitForTimeout(450);

    const hubBuf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(hubBuf, [
      'store_screenshots/screenshot_community_hub.png',
    ]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    // 7. Live Voice Stage + Camera + Spotlight Screen Share + Mic Playback + Soundboard Popover
    await page.locator('div[title="Join Voice Lounge"]').first().click();
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

    // 8. TeamSpeak 3 Classic Layout Mode (1920x1080)
    await page.click('[data-testid="layout-toggle-ts3"]');
    await page.waitForSelector('[data-testid="teamspeak-layout"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const ts3Buf = await page.screenshot({ type: 'png' });
    saveScreenshotCopies(ts3Buf, [
      'store_screenshots/screenshot_teamspeak_mode.png',
    ]);

    // 9. Website Landing Page (../index.html at 1920x1080)
    const landingFile = path.resolve(currentDir, '../index.html');
    await page.goto(`file:///${landingFile.replace(/\\/g, '/')}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1000);

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
    stopProcessTree(previewProc);
    await new Promise(r => setTimeout(r, 200));
    if (originalDbBuffer) {
      try {
        fs.writeFileSync(DB_PATH, originalDbBuffer);
      } catch {
        // Ignore db restore errors
      }
    } else if (fs.existsSync(DB_PATH)) {
      try {
        fs.rmSync(DB_PATH, { force: true });
      } catch {
        // Ignore temp db cleanup errors
      }
    }
  }
}

captureAllStoreScreenshots().catch((err) => {
  console.error('Error capturing store screenshots:', err);
  process.exit(1);
});
