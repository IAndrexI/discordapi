import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(scriptsDir, '..');
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.resolve(clientDir, 'server-data/db.json');

const PROFILES = [
  { name: '1280x720 @ 100%', width: 1280, height: 720, zoomClicks: 0, expectedZoom: '100%' },
  { name: '960x600 @ 100%', width: 960, height: 600, zoomClicks: 0, expectedZoom: '100%' },
  { name: '1280x720 @ 125%', width: 1280, height: 720, zoomClicks: 2, expectedZoom: '125%' },
];

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not up yet
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for preview server at ${url}`);
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
      // Process already exited
    }
  }
}

async function runAudit() {
  const originalDbBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;

  console.log(`Starting Vite preview server on ${BASE_URL}...`);
  const previewProc = spawn(
    `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    {
      cwd: clientDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let serverLogs = '';
  previewProc.stdout?.on('data', d => {
    serverLogs += d.toString();
  });
  previewProc.stderr?.on('data', d => {
    serverLogs += d.toString();
  });

  let browser;
  const allFailures = [];

  try {
    await waitForServer(BASE_URL);
    console.log('Preview server is ready.');

    browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    });

    for (const profile of PROFILES) {
      console.log(`\n============================================================`);
      console.log(`PROFILE: ${profile.name}`);
      console.log(`============================================================`);

      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: 1,
        permissions: ['camera', 'microphone'],
      });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);

      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', err => {
        pageErrors.push(err?.message || String(err));
      });

      const vw = profile.width;
      const vh = profile.height;
      const profileFailures = [];

      const recordFailure = (step, err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  [FAIL] (${profile.name}) ${step}: ${message}`);
        profileFailures.push({ profile: profile.name, step, message });
      };

      const checkStep = async (stepName, fn) => {
        try {
          await fn();
          console.log(`  [PASS] ${stepName}`);
        } catch (err) {
          recordFailure(stepName, err);
          // Attempt to close any lingering modal/popover before next step
          for (let i = 0; i < 2; i++) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(100);
          }
        }
      };

      const assertInViewport = async (locator, label, timeout = 6000) => {
        await locator.waitFor({ state: 'visible', timeout });
        // Let CSS fadeIn/slide transitions (160ms) settle before measuring box
        await page.waitForTimeout(200);
        const visible = await locator.isVisible();
        if (!visible) {
          throw new Error(`${label} is not visible`);
        }
        const box = await locator.boundingBox();
        if (!box) {
          throw new Error(`${label} has null boundingBox`);
        }
        const right = box.x + box.width;
        const bottom = box.y + box.height;
        if (
          box.width <= 0 ||
          box.height <= 0 ||
          box.x < 0 ||
          box.y < 0 ||
          right > vw ||
          bottom > vh
        ) {
          throw new Error(
            `${label} out of viewport (${vw}x${vh}): x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, w=${box.width.toFixed(1)}, h=${box.height.toFixed(1)}, right=${right.toFixed(1)}, bottom=${bottom.toFixed(1)}`
          );
        }
        return box;
      };

      const applyTargetZoom = async () => {
        await page.locator('[data-testid="zoom-reset-btn"]').click();
        await page.waitForTimeout(120);
        for (let i = 0; i < profile.zoomClicks; i++) {
          await page.locator('[data-testid="zoom-in-btn"]').click();
          await page.waitForTimeout(120);
        }
        const zoomText = await page.locator('[data-testid="zoom-reset-btn"]').innerText();
        if (!zoomText.includes(profile.expectedZoom)) {
          throw new Error(`Expected zoom ${profile.expectedZoom}, got "${zoomText}"`);
        }
      };

      try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
        await page.locator('[data-testid="login-mode-hybrid"]').waitFor({ state: 'visible', timeout: 15000 });

        if (profile.zoomClicks > 0) {
          await applyTargetZoom();
        }

        // a) LoginModal
        await checkStep('a) LoginModal modes & Advanced Options', async () => {
          for (const modeId of ['hybrid', 'proprietary', 'discord_proxy']) {
            const card = page.locator(`[data-testid="login-mode-${modeId}"]`);
            await assertInViewport(card, `login-mode-${modeId}`);
            await card.click();
            const checked = await card.getAttribute('aria-checked');
            if (checked !== 'true') {
              throw new Error(`login-mode-${modeId} aria-checked expected true, got ${checked}`);
            }
          }
          await page.locator('[data-testid="login-mode-hybrid"]').click();

          const advBtn = page.locator('button:has-text("Advanced Options")');
          await advBtn.click();
          const expanded = await advBtn.getAttribute('aria-expanded');
          if (expanded !== 'true') {
            throw new Error(`Advanced Options aria-expanded expected true, got ${expanded}`);
          }
          await assertInViewport(page.locator('#login-bridge-token'), 'Login Advanced Bridge Token input');
          await assertInViewport(page.locator('#login-server-url'), 'Login Advanced Server URL input');
          await advBtn.click();
        });

        await checkStep('a.2) LoginModal Guest Mode entry & Quick Sign-In', async () => {
          const advBtn = page.locator('button:has-text("Advanced Options")');
          if ((await advBtn.getAttribute('aria-expanded')) === 'true') {
            await advBtn.click();
          }
          const guestBtn = page.locator('button:has-text("Try Guest Mode")');
          let guestBoundsErr = null;
          try {
            await assertInViewport(guestBtn, 'Try Guest Mode button');
          } catch (err) {
            guestBoundsErr = err;
          }
          await guestBtn.click();
          await page.locator('[data-testid="userbar-loopback-btn"]').waitFor({ state: 'visible', timeout: 15000 });
          await assertInViewport(page.getByText('Sandbox Mode').first(), 'Guest Sandbox Mode banner');
          await page.locator('button:has-text("Sign In")').click();
          await page.locator('[data-testid="quick-signin-andrex-btn"]').waitFor({ state: 'visible', timeout: 10000 });

          if (profile.zoomClicks > 0) {
            await applyTargetZoom();
          }

          // Quick Sign-In
          const quickBtn = page.locator('[data-testid="quick-signin-andrex-btn"]');
          let quickBoundsErr = null;
          try {
            await assertInViewport(quickBtn, 'Quick Sign In button');
          } catch (err) {
            quickBoundsErr = err;
          }
          await quickBtn.click();
          await page.locator('[data-testid="userbar-loopback-btn"]').waitFor({ state: 'visible', timeout: 15000 });
          await page.locator('textarea[aria-label^="Message #"]').waitFor({ state: 'visible', timeout: 15000 });
          await page.waitForTimeout(500);

          if (guestBoundsErr) throw guestBoundsErr;
          if (quickBoundsErr) throw quickBoundsErr;
        });

        // b) Discord Text & Simplification Audit
        await checkStep('b) Discord text & simplification audit (<= 2 occurrences in Standard view)', async () => {
          const audit = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const matches = [];
            const re = /discord/gi;
            let m;
            while ((m = re.exec(text)) !== null) {
              const start = Math.max(0, m.index - 25);
              const end = Math.min(text.length, m.index + m[0].length + 25);
              matches.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
            }
            return { count: matches.length, matches };
          });
          console.log(`    -> "discord" innerText count=${audit.count}: ${JSON.stringify(audit.matches)}`);
          if (audit.count > 2) {
            throw new Error(`Found ${audit.count} occurrences of "discord" (expected <= 2): ${JSON.stringify(audit.matches)}`);
          }
        });

        // c) TitleBar & Expansions
        await checkStep('c) TitleBar layout toggles, zoom controls, Tools dropdown & Camera Preview modal', async () => {
          await page.locator('[data-testid="layout-toggle-ts3"]').click();
          await assertInViewport(page.locator('[data-testid="teamspeak-layout"]'), 'TeamSpeak layout via TitleBar toggle');
          await page.locator('[data-testid="layout-toggle-discord"]').click();
          await page.locator('[data-testid="userbar-loopback-btn"]').waitFor({ state: 'visible', timeout: 8000 });

          // Zoom buttons
          await page.locator('[data-testid="zoom-out-btn"]').click();
          await page.waitForTimeout(100);
          await page.locator('[data-testid="zoom-reset-btn"]').click();
          await page.waitForTimeout(100);
          const resetText = await page.locator('[data-testid="zoom-reset-btn"]').innerText();
          if (!resetText.includes('100%')) {
            throw new Error(`zoom-reset-btn expected 100%, got "${resetText}"`);
          }
          await page.locator('[data-testid="zoom-in-btn"]').click();
          await page.waitForTimeout(100);
          const inText = await page.locator('[data-testid="zoom-reset-btn"]').innerText();
          if (!inText.includes('110%')) {
            throw new Error(`zoom-in-btn expected 110%, got "${inText}"`);
          }
          await applyTargetZoom();

          // Tools dropdown & every menuitem
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          const toolsMenu = page.locator('header [role="menu"]');
          await assertInViewport(toolsMenu, 'Topbar Tools dropdown menu');
          const menuItems = toolsMenu.locator('[role="menuitem"]');
          const itemCount = await menuItems.count();
          if (itemCount < 8) {
            throw new Error(`Expected >= 8 Tools menuitems, got ${itemCount}`);
          }
          for (let i = 0; i < itemCount; i++) {
            const item = menuItems.nth(i);
            const itemLabel = (await item.innerText()).replace(/\s+/g, ' ').trim();
            await assertInViewport(item, `Tools menuitem "${itemLabel}"`);
          }

          // Camera Preview modal from Tools menu
          await page.locator('[data-testid="topbar-camera-preview-btn"]').click();
          const camModal = page.locator('[data-testid="webcam-background-modal"] [role="dialog"]');
          await assertInViewport(camModal, 'WebcamBackgroundModal');
          const previewVideo = page.locator('[data-testid="camera-preview-video"]');
          await previewVideo.waitFor({ state: 'visible', timeout: 8000 });
          const isVideoActive = await previewVideo.evaluate(el => {
            const v = el;
            return Boolean(v.srcObject) && !v.paused;
          });
          if (!isVideoActive) {
            // Wait briefly for stream init
            await page.waitForTimeout(800);
            const retryActive = await previewVideo.evaluate(el => Boolean(el.srcObject));
            if (!retryActive) {
              throw new Error('camera-preview-video srcObject not active under autoStart');
            }
          }

          await page.locator('[data-testid="bg-tile-blur"]').click();
          await assertInViewport(page.locator('[data-testid="camera-blur-slider"]'), 'Camera Blur Slider');
          await page.locator('[data-testid="camera-blur-slider"]').fill('20');
          await page.locator('[data-testid="bg-tile-aurora_borealis"]').click();

          const mirrorBtn = page.locator('[data-testid="camera-mirror-toggle-btn"]');
          const beforeMirror = await mirrorBtn.getAttribute('aria-pressed');
          await mirrorBtn.click();
          const afterMirror = await mirrorBtn.getAttribute('aria-pressed');
          if (beforeMirror === afterMirror) {
            throw new Error(`Mirror toggle aria-pressed did not change (${beforeMirror})`);
          }

          await page.keyboard.press('Escape');
          await page.locator('[data-testid="webcam-background-modal"]').waitFor({ state: 'hidden', timeout: 5000 });
        });

        // d) ServerRail & ChannelSidebar & Expansions
        await checkStep('d) ServerRail, ChannelSidebar server menu, category collapses, Home/DMs & MemberList', async () => {
          const serverMenuBtn = page.locator('button[aria-haspopup="menu"][aria-label$="server menu"]');
          await serverMenuBtn.click();
          const serverMenu = page.locator('div.w-60 [role="menu"]');
          await assertInViewport(serverMenu, 'ChannelSidebar Server dropdown');
          const items = serverMenu.locator('[role="menuitem"]');
          const count = await items.count();
          for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const txt = (await item.innerText()).replace(/\s+/g, ' ').trim();
            await assertInViewport(item, `Server menuitem "${txt}"`);
          }
          await serverMenu.locator('[role="menuitem"]:has-text("Copy Server ID")').click();
          await page.keyboard.press('Escape');
          await serverMenu.waitFor({ state: 'hidden', timeout: 4000 });

          // Text & Voice category collapses
          const textCollapse = page.locator('button:has-text("Text Channels")');
          const t0 = await textCollapse.getAttribute('aria-expanded');
          await textCollapse.click();
          const t1 = await textCollapse.getAttribute('aria-expanded');
          if (t0 === t1) throw new Error('Text Channels aria-expanded did not toggle');
          await textCollapse.click();

          const voiceCollapse = page.locator('button:has-text("Voice Channels")');
          const v0 = await voiceCollapse.getAttribute('aria-expanded');
          await voiceCollapse.click();
          const v1 = await voiceCollapse.getAttribute('aria-expanded');
          if (v0 === v1) throw new Error('Voice Channels aria-expanded did not toggle');
          await voiceCollapse.click();

          // Home/DMs switch and back
          await page.locator('aside[aria-label="Servers"] button[aria-label="Direct Messages"]').click();
          await assertInViewport(page.locator('input[aria-label="Search conversations"]'), 'Home Search conversations input');
          await page.locator('aside[aria-label="Servers"] button[aria-label="Protutech HQ"]').click();
          await page.locator('textarea[aria-label^="Message #"]').waitFor({ state: 'visible', timeout: 5000 });

          // MemberList toggle & UserProfileModal
          const memberToggle = page.locator('button[aria-label="Toggle Member List"]');
          const m0 = await memberToggle.getAttribute('aria-pressed');
          await memberToggle.click();
          const m1 = await memberToggle.getAttribute('aria-pressed');
          if (m0 === m1) throw new Error('MemberList toggle aria-pressed did not change');
          if (m1 !== 'true') {
            await memberToggle.click();
          }

          const memberAside = page.locator('aside[aria-label="Members"]');
          if (await memberAside.isVisible()) {
            const firstMember = memberAside.locator('button').first();
            await assertInViewport(firstMember, 'First member in MemberList');
            await firstMember.click();
            const profileModal = page.locator('[role="dialog"][aria-label$="profile"]');
            await assertInViewport(profileModal, 'UserProfileModal');
            await page.keyboard.press('Escape');
            await profileModal.waitFor({ state: 'hidden', timeout: 5000 });
          } else {
            console.log('    -> MemberList aside hidden at this viewport width (<1024px CSS breakpoint)');
          }
        });

        // e) ChatArea & Expansions
        await checkStep('e) ChatArea message send, top-row reaction picker, pins popover, composer +/emoji, channel tools, search', async () => {
          const msgInput = page.locator('textarea[aria-label^="Message #"]');
          const testMsgText = `E2E audit ping ${Date.now()}`;
          await msgInput.fill(testMsgText);
          await msgInput.press('Enter');
          await page.locator(`text=${testMsgText}`).first().waitFor({ state: 'visible', timeout: 8000 });

          // Top message (index 0) hover + reaction picker
          const messagesViewport = page.locator('div.flex-1.overflow-y-auto.px-4.py-4');
          const topMessage = messagesViewport.locator('> div.group.relative').first();
          await topMessage.scrollIntoViewIfNeeded();
          await topMessage.hover();
          const addReactionBtn = topMessage.locator('button[aria-label="Add Reaction"]');
          await addReactionBtn.waitFor({ state: 'visible', timeout: 4000 });
          await addReactionBtn.click();
          const reactionPicker = page.locator('[role="dialog"][aria-label="Reaction Picker"]');
          await assertInViewport(reactionPicker, 'Top message Reaction Picker popover');
          await page.keyboard.press('Escape');
          await reactionPicker.waitFor({ state: 'hidden', timeout: 4000 });

          // Pin a message & verify Pins popover
          await topMessage.hover();
          const pinActionBtn = topMessage.locator('button[aria-label="Pin message"], button[aria-label="Unpin message"]').first();
          const pinLabelBefore = await pinActionBtn.getAttribute('aria-label');
          if (pinLabelBefore === 'Pin message') {
            await pinActionBtn.click();
          }
          const pinsBtn = page.locator('[data-testid="chat-pins-btn"]');
          await pinsBtn.click();
          const pinsPopover = page.locator('[data-testid="chat-pins-popover"]');
          await assertInViewport(pinsPopover, 'Pinned Messages popover');
          const pinsText = await pinsPopover.innerText();
          if (pinsText.includes('No pinned messages yet')) {
            throw new Error('Pinned Messages popover shows empty state after pinning a message');
          }
          await page.keyboard.press('Escape');
          await pinsPopover.waitFor({ state: 'hidden', timeout: 4000 });

          // Unpin to restore clean state
          if (pinLabelBefore === 'Pin message') {
            await topMessage.hover();
            await topMessage.locator('button[aria-label="Unpin message"]').click();
          }

          // Composer + menu
          await page.locator('button[aria-label="Message Actions"]').click();
          const plusMenu = page.locator('div:has(> button[aria-label="Message Actions"]) [role="menu"]');
          await assertInViewport(plusMenu, 'Composer + actions menu');
          const plusItems = plusMenu.locator('[role="menuitem"]');
          const plusCount = await plusItems.count();
          for (let i = 0; i < plusCount; i++) {
            await assertInViewport(plusItems.nth(i), `Composer + item #${i}`);
          }
          await page.keyboard.press('Escape');
          await plusMenu.waitFor({ state: 'hidden', timeout: 4000 });

          // Composer Emoji tray
          await page.locator('button[aria-label="Add Emoji"]').click();
          const emojiTray = page.locator('[role="dialog"][aria-label="Emoji Picker"]');
          await assertInViewport(emojiTray, 'Composer Emoji Picker tray');
          await emojiTray.locator('button').first().click();
          await emojiTray.waitFor({ state: 'hidden', timeout: 4000 });

          // Clear injected emoji text if any
          await msgInput.fill('');

          // Channel Tools menu
          await page.locator('button[aria-label="Channel Tools"]').click();
          const channelToolsMenu = page.locator('div:has(> button[aria-label="Channel Tools"]) [role="menu"]');
          await assertInViewport(channelToolsMenu, 'Channel Tools menu');
          const ctCount = await channelToolsMenu.locator('[role="menuitem"]').count();
          for (let i = 0; i < ctCount; i++) {
            await assertInViewport(channelToolsMenu.locator('[role="menuitem"]').nth(i), `Channel Tools item #${i}`);
          }
          await page.keyboard.press('Escape');
          await channelToolsMenu.waitFor({ state: 'hidden', timeout: 4000 });

          // Chat search filter
          const searchInput = page.locator('input[aria-label="Search messages"]');
          await searchInput.fill(testMsgText);
          await page.locator(`text=${testMsgText}`).first().waitFor({ state: 'visible', timeout: 4000 });
          await page.locator('button[aria-label="Clear search"]').click();
        });

        // f) UserBar & Expansions
        await checkStep('f) UserBar status popover, audio toggles, camera preview & Soundboard add-sound drawer', async () => {
          await page.locator('button[aria-label="Account status"]').click();
          const statusDialog = page.locator('[role="dialog"][aria-label="Status"]');
          await assertInViewport(statusDialog, 'UserBar Status Popover');
          await assertInViewport(statusDialog.locator('button[aria-label="Toggle Overlay"]'), 'Status Popover Overlay button');
          await assertInViewport(statusDialog.locator('button[aria-label="Open Minecraft Console"]'), 'Status Popover MC Console button');
          await page.keyboard.press('Escape');
          await statusDialog.waitFor({ state: 'hidden', timeout: 4000 });

          // Mute & Deafen
          await page.locator('button[aria-label="Mute"]').click();
          await page.locator('button[aria-label="Unmute"]').click();
          await page.locator('button[aria-label="Deafen"]').click();
          await page.locator('button[aria-label="Undeafen"]').click();
          await page.locator('button[aria-label="Unmute"]').click();

          // Loopback
          const loopbackBtn = page.locator('[data-testid="userbar-loopback-btn"]');
          await loopbackBtn.click();
          if ((await loopbackBtn.getAttribute('aria-pressed')) !== 'true') {
            throw new Error('userbar-loopback-btn failed to activate');
          }
          await loopbackBtn.click();

          // Camera Preview from UserBar
          let userbarCamErr = null;
          try {
            await page.locator('[data-testid="userbar-camera-preview-btn"]').click();
            await assertInViewport(page.locator('[data-testid="webcam-background-modal"] [role="dialog"]'), 'Webcam modal from UserBar');
            await page.keyboard.press('Escape');
            await page.locator('[data-testid="webcam-background-modal"]').waitFor({ state: 'hidden', timeout: 4000 });
          } catch (err) {
            userbarCamErr = err;
            await page.keyboard.press('Escape').catch(() => {});
          }

          // Soundboard + Add Custom Sound drawer
          await page.locator('[data-testid="userbar-soundboard-btn"]').click();
          const sb = page.locator('[data-testid="soundboard-popover"]');
          await assertInViewport(sb, 'Soundboard Popover');
          await page.locator('[data-testid="soundboard-add-toggle-btn"]').click();
          await assertInViewport(sb.locator('button[aria-label="Choose audio file"]'), 'Soundboard custom audio upload button');
          await assertInViewport(sb.locator('input[placeholder="e.g. Bruh"]'), 'Soundboard custom sound name input');
          await assertInViewport(sb.locator('button[type="submit"]:has-text("Upload Sound")'), 'Soundboard Upload Sound submit button');
          await page.keyboard.press('Escape');
          await sb.waitFor({ state: 'hidden', timeout: 4000 });
          if (userbarCamErr) throw userbarCamErr;
        });

        // g) Voice Call, VoicePanel & VoiceStage Expansions
        await checkStep('g) Voice Call, VoicePanel settings popover, Camera, Screen Picker, VoiceStage, Co-Browse, Theater, Volume slider', async () => {
          await page.locator('div[title="Join Voice Lounge"]').first().click();
          const voiceStage = page.locator('[data-testid="voice-stage"]');
          await assertInViewport(voiceStage, 'VoiceStage');

          try {
            const voiceSettingsBtn = page.locator('button[aria-label="Audio Quality & Stream Settings"]');
            await voiceSettingsBtn.click();
            const voiceSettingsPopover = page.locator('[role="dialog"][aria-label="Voice Settings"]');
            await assertInViewport(voiceSettingsPopover, 'VoicePanel floating settings popover');
            await page.keyboard.press('Escape');
            await voiceSettingsPopover.waitFor({ state: 'hidden', timeout: 4000 });

            // Camera ON -> mini preview strip -> preview modal
            await page.locator('[data-testid="voice-camera-btn"]').click();
            await assertInViewport(page.locator('[data-testid="voice-mini-camera-preview"]'), 'VoicePanel mini camera preview');
            await page.locator('[data-testid="voice-camera-preview-btn"]').click();
            await assertInViewport(page.locator('[data-testid="webcam-background-modal"] [role="dialog"]'), 'Webcam modal from VoicePanel');
            await page.keyboard.press('Escape');
            await page.locator('[data-testid="webcam-background-modal"]').waitFor({ state: 'hidden', timeout: 4000 });

            // Screen Share Picker Modal
            let screenPickerErr = null;
            try {
              await page.locator('[data-testid="voice-screen-picker-btn"]').click();
              const screenModal = page.locator('[data-testid="screen-share-picker-modal"]');
              await assertInViewport(screenModal, 'ScreenSharePickerModal');
              await screenModal.locator('[data-testid="screen-picker-tab-screen"]').click();
              await screenModal.locator('[data-testid="screen-picker-tab-window"]').click();
              await screenModal.locator('[data-testid="screen-picker-tab-all"]').click();
              await screenModal.locator('button:has-text("1080p")').click();
              await screenModal.locator('button:has-text("System Audio")').click();
              await screenModal.locator('button:has-text("Cancel")').click();
              await screenModal.waitFor({ state: 'hidden', timeout: 4000 });
            } catch (err) {
              screenPickerErr = err;
              await page.keyboard.press('Escape').catch(() => {});
            }

            // VoiceStage buttons
            await page.locator('[data-testid="voicestage-camera-preview-btn"]').click();
            await assertInViewport(page.locator('[data-testid="webcam-background-modal"] [role="dialog"]'), 'Webcam modal from VoiceStage');
            await page.keyboard.press('Escape');
            await page.locator('[data-testid="webcam-background-modal"]').waitFor({ state: 'hidden', timeout: 4000 });

            await page.locator('[data-testid="voicestage-soundboard-btn"]').click();
            await assertInViewport(page.locator('[data-testid="soundboard-popover"]'), 'Soundboard from VoiceStage');
            await page.keyboard.press('Escape');
            await page.locator('[data-testid="soundboard-popover"]').waitFor({ state: 'hidden', timeout: 4000 });

            // Co-Browse
            await page.locator('[data-testid="voicestage-cobrowse-btn"]').click();
            const cobrowse = page.locator('[data-testid="shared-browser-stage"]');
            await assertInViewport(cobrowse, 'SharedBrowserStage (Co-Browse)');
            await cobrowse.locator('[data-testid="cobrowse-search-input"]').fill('protutech');
            await cobrowse.locator('[data-testid="cobrowse-search-btn"]').click();
            await cobrowse.locator('[data-testid="cobrowse-result-card"]').first().waitFor({ state: 'visible', timeout: 6000 });
            await cobrowse.locator('[data-testid="cobrowse-close-btn"]').click();
            await cobrowse.waitFor({ state: 'hidden', timeout: 4000 });

            // Theater Mode expand & Compact
            await page.locator('[data-testid="voicestage-theater-btn"]').click();
            await assertInViewport(page.locator('[data-testid="voice-stage"]'), 'VoiceStage in Theater Mode');
            const spotlight = page.locator('[data-testid="voice-spotlight-container"]');
            if (await spotlight.isVisible()) {
              await assertInViewport(spotlight, 'VoiceStage Spotlight in Theater Mode');
            }
            await page.locator('[data-testid="voicestage-theater-btn"]').click();

            // Collapse & Expand Stage
            await page.locator('[data-testid="voicestage-collapse-btn"]').click();
            await assertInViewport(page.locator('[data-testid="voicestage-expand-stage-btn"]'), 'Expand Voice Stage button');
            await page.locator('[data-testid="voicestage-expand-stage-btn"]').click();
            await page.locator('[data-testid="voicestage-collapse-btn"]').waitFor({ state: 'visible', timeout: 4000 });

            // Participant Volume Slider Popover
            const firstTile = page.locator('[data-testid^="participant-tile-"]').first();
            await firstTile.hover();
            const volBtn = firstTile.locator('button[aria-label^="Adjust volume for "]');
            await volBtn.click();
            const volDialog = page.locator('[role="dialog"][aria-label^="Volume controls for "]');
            await assertInViewport(volDialog, 'Participant Volume Slider Popover');
            await assertInViewport(volDialog.locator('input[type="range"]'), 'Participant Volume range slider');
            await assertInViewport(volDialog.locator('button[aria-label="Mute participant"]'), 'Participant Volume Mute button');
            await assertInViewport(volDialog.locator('button[aria-label="Boost participant volume to 200%"]'), 'Participant Volume Boost button');
            await page.keyboard.press('Escape');
            await volDialog.waitFor({ state: 'hidden', timeout: 4000 });
            if (screenPickerErr) throw screenPickerErr;
          } finally {
            await page.keyboard.press('Escape').catch(() => {});
            const camBtn = page.locator('[data-testid="voice-camera-btn"]');
            if (await camBtn.isVisible().catch(() => false)) {
              if ((await camBtn.getAttribute('aria-pressed')) === 'true') {
                await camBtn.click().catch(() => {});
              }
            }
            const discBtn = page.locator('button[aria-label="Disconnect from Voice"]');
            if (await discBtn.isVisible().catch(() => false)) {
              await discBtn.click().catch(() => {});
              await voiceStage.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
            }
          }
        });

        // h) ALL 11 Modals Open/Close/Viewport Audit
        await checkStep('h.1) SettingsModal (all 9 tabs, quality select, themes, version, Escape close)', async () => {
          await page.locator('button[aria-label="Settings"]').click();
          const settingsModal = page.locator('[data-testid="settings-modal"]');
          await assertInViewport(settingsModal, 'SettingsModal');

          // 1. User Profile
          await settingsModal.locator('button:has-text("User Profile")').click();
          // 2. My Account
          await settingsModal.locator('button:has-text("My Account")').click();
          // 3. Voice & Video
          await settingsModal.locator('button:has-text("Voice & Video")').click();
          const camPreviewPanel = settingsModal.locator('[data-testid="camera-preview-panel"]');
          await camPreviewPanel.scrollIntoViewIfNeeded();
          await assertInViewport(camPreviewPanel, 'Settings Voice & Video CameraPreviewPanel');
          const qualitySel = settingsModal.locator('[data-testid="settings-screen-quality-select"]');
          await qualitySel.scrollIntoViewIfNeeded();
          await qualitySel.selectOption('1440p60');
          if ((await qualitySel.inputValue()) !== '1440p60') {
            throw new Error('settings-screen-quality-select failed to update to 1440p60');
          }
          await qualitySel.selectOption('1080p60');
          // 4. In-Game Overlay
          await settingsModal.locator('button:has-text("In-Game Overlay")').click();
          // 5. Appearance
          await settingsModal.locator('button:has-text("Appearance")').click();
          await settingsModal.locator('[data-testid="theme-card-revolt"]').click();
          await settingsModal.locator('[data-testid="theme-card-light"]').click();
          await settingsModal.locator('[data-testid="theme-card-dark"]').click();
          await settingsModal.locator('[data-testid="settings-layout-teamspeak"]').click();
          await settingsModal.locator('[data-testid="settings-layout-discord"]').click();
          await assertInViewport(settingsModal.locator('[data-testid="settings-zoom-slider"]'), 'Settings Zoom Slider');
          // 6. Plugins
          await settingsModal.locator('button:has-text("Plugins")').first().click();
          // 7. Add Plugins
          await settingsModal.locator('button:has-text("Add Plugins")').click();
          // 8. Desktop App
          await settingsModal.locator('button:has-text("Desktop App")').click();
          const appVer = (await settingsModal.locator('[data-testid="settings-app-version"]').innerText()).trim();
          if (appVer === 'v1.0.0') {
            throw new Error(`settings-app-version still reports hardcoded v1.0.0`);
          }
          // 9. App Icon
          await settingsModal.locator('button:has-text("App Icon")').click();

          await page.keyboard.press('Escape');
          await settingsModal.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.2) Community Hub (DiscordHubModal all 5 tabs)', async () => {
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          await page.locator('[data-testid="topbar-discord-hub-btn"]').click();
          const hub = page.locator('[role="dialog"][aria-labelledby="community-hub-title"]');
          await assertInViewport(hub, 'DiscordHubModal (Community Hub)');
          for (const tabName of ['Quests', 'Friends', 'Perks', 'Inbox', 'Discover']) {
            await hub.locator(`button:has-text("${tabName}")`).first().click();
            await page.waitForTimeout(100);
          }
          await page.keyboard.press('Escape');
          await hub.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.3) Equicord Plugins Modal', async () => {
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          await page.locator('[data-testid="topbar-equicord-btn"]').click();
          const eq = page.locator('[role="dialog"][aria-labelledby="equicord-modal-title"]');
          await assertInViewport(eq, 'EquicordModal');
          await page.keyboard.press('Escape');
          await eq.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.4) Scripts & MC Bridge Modal', async () => {
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          await page.locator('[data-testid="topbar-scripts-btn"]').click();
          const sc = page.locator('[role="dialog"][aria-labelledby="scripting-modal-title"]');
          await assertInViewport(sc, 'ScriptingModal');
          await page.keyboard.press('Escape');
          await sc.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.5) Minecraft Console Modal (bottom RCON input in viewport)', async () => {
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          await page.locator('[data-testid="topbar-mc-console-btn"]').click();
          const mc = page.locator('[role="dialog"][aria-labelledby="minecraft-console-title"]');
          await assertInViewport(mc, 'MinecraftConsoleModal');
          await assertInViewport(mc.locator('input[aria-label="Minecraft RCON command"]'), 'Minecraft Console bottom RCON input');
          await assertInViewport(mc.locator('button:has-text("Execute")'), 'Minecraft Console Execute button');
          await page.keyboard.press('Escape');
          await mc.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.6) Large File Share Modal', async () => {
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          await page.locator('[data-testid="topbar-large-file-btn"]').click();
          const lf = page.locator('[role="dialog"][aria-labelledby="large-file-modal-title"]');
          await assertInViewport(lf, 'LargeFileShareModal');
          await page.keyboard.press('Escape');
          await lf.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.7) Activity Modal', async () => {
          await page.locator('button[aria-label="Channel Tools"]').click();
          await page.locator('div:has(> button[aria-label="Channel Tools"]) [role="menuitem"]:has-text("Activities")').click();
          const act = page.locator('[role="dialog"][aria-labelledby="activity-modal-title"]');
          await assertInViewport(act, 'ActivityModal');
          await page.keyboard.press('Escape');
          await act.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.8) Voice Proxy Modal (Call Bridge)', async () => {
          await page.locator('button[aria-haspopup="menu"][aria-label$="server menu"]').click();
          await page.locator('div.w-60 [role="menu"] [role="menuitem"]:has-text("Call Bridge")').click();
          const vp = page.locator('[role="dialog"][aria-labelledby="voice-proxy-title"]');
          await assertInViewport(vp, 'VoiceProxyModal');
          await page.keyboard.press('Escape');
          await vp.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.9) AddConversationModal (Create Native & Sync modes)', async () => {
          await page.locator('aside[aria-label="Servers"] button[aria-label="Add Server"]').click();
          const addModal = page.locator('[role="dialog"][aria-labelledby="add-conversation-title"]');
          await assertInViewport(addModal, 'AddConversationModal');
          await addModal.locator('[data-testid="add-server-mode-create"]').click();
          await assertInViewport(addModal.locator('input[placeholder*="engineering"]'), 'AddConversation Create Native name input');
          await addModal.locator('[data-testid="add-server-mode-sync"]').click();
          await assertInViewport(addModal.locator('input[aria-label="Search external servers"]'), 'AddConversation Sync search input');
          await page.keyboard.press('Escape');
          await addModal.waitFor({ state: 'hidden', timeout: 5000 });
        });

        await checkStep('h.10) Microsoft Store Hub Modal', async () => {
          await page.locator('[data-testid="topbar-tools-menu-btn"]').click();
          await page.locator('[data-testid="topbar-store-btn"]').click();
          const ms = page.locator('[role="dialog"][aria-labelledby="ms-store-modal-title"]');
          await assertInViewport(ms, 'MicrosoftStoreModal');
          await page.keyboard.press('Escape');
          await ms.waitFor({ state: 'hidden', timeout: 5000 });
        });

        // i) TeamSpeak Mode (TS3)
        await checkStep('i) TeamSpeak Mode (TS3) tree, chat, log pane, camera preview, voice & media buttons', async () => {
          await page.locator('[data-testid="layout-toggle-ts3"]').click();
          const ts3 = page.locator('[data-testid="teamspeak-layout"]');
          await assertInViewport(ts3, 'TeamSpeakLayout');
          await assertInViewport(ts3.locator('[data-testid="ts3-chat-input"]'), 'TS3 chat input');
          await ts3.locator('button:has-text("<Server Event Log>")').click();
          await assertInViewport(ts3.locator('button:has-text("Clear Log")'), 'TS3 Server Event Log pane');
          await ts3.locator('button:has-text("<Channel #")').click();

          // TS3 Camera Preview button
          await ts3.locator('[data-testid="ts3-camera-preview-btn"]').click();
          await assertInViewport(page.locator('[data-testid="webcam-background-modal"] [role="dialog"]'), 'Webcam modal from TS3');
          await page.keyboard.press('Escape');
          await page.locator('[data-testid="webcam-background-modal"]').waitFor({ state: 'hidden', timeout: 4000 });

          // Join voice channel in TS3
          const voiceNode = ts3.locator('div[title="Double-click to join voice channel"]').first();
          await voiceNode.dblclick();
          await page.locator('button[aria-label="Disconnect from Voice Channel"]').waitFor({ state: 'visible', timeout: 8000 });

          try {
            // Playback toggle
            const playbackBtn = ts3.locator('[data-testid="ts3-mic-playback-btn"]');
            await playbackBtn.click();
            if ((await playbackBtn.getAttribute('aria-pressed')) !== 'true') {
              throw new Error('ts3-mic-playback-btn did not toggle on');
            }
            await playbackBtn.click();

            // Video toggle
            const ts3CamBtn = ts3.locator('button[aria-label="Turn On Camera"], button[aria-label="Turn Off Camera"]');
            const wasCamOn = (await ts3CamBtn.getAttribute('aria-pressed')) === 'true';
            if (wasCamOn) {
              await ts3CamBtn.click();
            }
            await ts3.locator('button[aria-label="Turn On Camera"]').click();
            await ts3.locator('button[aria-label="Turn Off Camera"]').click();

            // Soundboard
            await ts3.locator('[data-testid="ts3-soundboard-btn"]').click();
            await assertInViewport(page.locator('[data-testid="soundboard-popover"]'), 'Soundboard from TS3');
            await page.keyboard.press('Escape');
            await page.locator('[data-testid="soundboard-popover"]').waitFor({ state: 'hidden', timeout: 4000 });

            // Co-Browse
            await ts3.locator('[data-testid="ts3-cobrowse-btn"]').click();
            await assertInViewport(page.locator('[data-testid="shared-browser-stage"]'), 'Co-Browse from TS3');
            await page.locator('[data-testid="cobrowse-close-btn"]').click();
            await page.locator('[data-testid="shared-browser-stage"]').waitFor({ state: 'hidden', timeout: 4000 });
          } finally {
            await ts3.locator('button[aria-label="Disconnect from Voice Channel"]').click().catch(() => {});
            await page.locator('[data-testid="layout-toggle-discord"]').click().catch(() => {});
          }
          await ts3.waitFor({ state: 'hidden', timeout: 5000 });
          await assertInViewport(page.locator('[data-testid="userbar-loopback-btn"]'), 'Standard workspace restored');
        });

        // Assert 0 console errors & 0 page errors
        if (consoleErrors.length > 0) {
          recordFailure('Console errors check', new Error(`${consoleErrors.length} console.error(s): ${consoleErrors.join(' | ')}`));
        } else {
          console.log('  [PASS] 0 console.error events');
        }
        if (pageErrors.length > 0) {
          recordFailure('Page errors check', new Error(`${pageErrors.length} pageerror(s): ${pageErrors.join(' | ')}`));
        } else {
          console.log('  [PASS] 0 pageerror events');
        }
      } finally {
        await context.close();
      }

      allFailures.push(...profileFailures);
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    stopProcessTree(previewProc);
    if (originalDbBuffer) {
      try {
        fs.writeFileSync(DB_PATH, originalDbBuffer);
      } catch {
        // Ignore db restore errors
      }
    } else if (fs.existsSync(DB_PATH)) {
      try {
        fs.unlinkSync(DB_PATH);
      } catch {
        // Ignore temp db cleanup errors
      }
    }
  }

  console.log(`\n============================================================`);
  if (allFailures.length > 0) {
    console.error(`E2E AUDIT FAILED with ${allFailures.length} failure(s):`);
    for (const f of allFailures) {
      console.error(`  - [${f.profile}] ${f.step}: ${f.message}`);
    }
    if (serverLogs.trim()) {
      console.error('\nPreview server output:\n' + serverLogs.slice(-1500));
    }
    process.exit(1);
  }
  console.log('ALL 3 PROFILES PASSED 100% WITH 0 ERRORS!');
}

runAudit().catch(err => {
  console.error('Fatal error in e2e_full_audit:', err);
  process.exit(1);
});
