import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(currentDir, '..');
const PORT = 4195;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_DATA_DIR = path.resolve(clientDir, `server-data-email-test-${Date.now()}`);

function stopProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32' && proc.pid) {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {}
}

function readLatestOutboxCode() {
  const outbox = path.join(TEST_DATA_DIR, 'outbox');
  if (!fs.existsSync(outbox)) return null;
  const files = fs.readdirSync(outbox).sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  const content = fs.readFileSync(path.join(outbox, latest), 'utf8');
  const match = content.match(/Your code: (\d{6})/);
  return match ? match[1] : null;
}

async function isReachable(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function run() {
  console.log('--- STARTING EMAIL LINK & PASSWORD CHANGE E2E TEST ---');
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

  const proc = spawn(`npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`, {
    cwd: clientDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DATA_DIR: TEST_DATA_DIR },
  });

  const start = Date.now();
  while (Date.now() - start < 20000) {
    if (await isReachable(BASE_URL)) break;
    await new Promise(r => setTimeout(r, 250));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle' });

    // 1. Sign In as andrex
    console.log('1. Signing in via Quick Sign In...');
    await page.waitForSelector('[data-testid="quick-signin-andrex-btn"]');
    await page.click('[data-testid="quick-signin-andrex-btn"]');
    await page.waitForSelector('button[aria-label="Settings"]', { timeout: 10000 });
    console.log('   Signed in successfully.');

    // 2. Open Settings -> My Account
    console.log('2. Opening Settings -> My Account...');
    await page.click('button[aria-label="Settings"]');
    await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 10000 });
    await page.click('button:has-text("My Account")');
    await page.waitForSelector('text=Email Address & Linking', { timeout: 5000 });

    // 3. Link an email
    console.log('3. Linking email address (andrex@test.local)...');
    await page.fill('input[type="email"]', 'andrex@test.local');
    await page.click('button:has-text("Send Verification Code")');

    await page.waitForTimeout(1000);
    const linkCode = readLatestOutboxCode();
    console.log(`   Captured email verification code: ${linkCode}`);
    if (!linkCode) throw new Error('No verification code found in outbox!');

    await page.fill('input[placeholder="123456"]', linkCode);
    await page.click('button:has-text("Verify & Link Email")');

    await page.waitForSelector('text=Linked & Verified', { timeout: 5000 });
    await page.waitForSelector('text=andrex@test.local', { timeout: 5000 });
    console.log('   Email linked and verified successfully!');

    // 4. Change Password via Email
    console.log('4. Changing password via email verification...');
    await page.click('button:has-text("Set Password via Email"), button:has-text("Change Password via Email")');
    await page.waitForTimeout(1000);

    const pwChangeCode = readLatestOutboxCode();
    console.log(`   Captured password change code: ${pwChangeCode}`);
    if (!pwChangeCode) throw new Error('No password change code found in outbox!');

    await page.fill('input[placeholder="123456"]', pwChangeCode);
    await page.fill('input[placeholder="Min 8 characters"]', 'NewSecurePassword123!');
    await page.fill('input[placeholder="Confirm password"]', 'NewSecurePassword123!');
    await page.click('button:has-text("Update Password")');

    await page.waitForSelector('text=Password Set', { timeout: 5000 });
    await page.waitForSelector('text=Password successfully updated!', { timeout: 5000 });
    console.log('   Password updated successfully!');

    // 5. Close settings & Log Out
    console.log('5. Logging out to test login with password & email...');
    await page.click('button:has-text("Log Out")');
    await page.waitForSelector('[data-testid="quick-signin-andrex-btn"]', { timeout: 10000 });
    console.log('   Logged out successfully.');

    // 6. Test login with wrong password
    console.log('6. Testing sign-in with wrong password...');
    await page.fill('#login-username', 'andrex');
    await page.fill('#login-password', 'wrongpassword');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForSelector('role=alert', { timeout: 5000 });
    const errText = await page.textContent('role=alert');
    console.log(`   Expected error shown: "${errText?.trim()}"`);

    // 7. Test sign-in using linked email address + correct new password
    console.log('7. Testing sign-in using linked email address + correct new password...');
    await page.fill('#login-username', 'andrex@test.local');
    await page.fill('#login-password', 'NewSecurePassword123!');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForSelector('button[aria-label="Settings"]', { timeout: 10000 });
    console.log('   Successfully signed in using linked email address!');

    // 8. Test Forgot Password flow from LoginModal
    console.log('8. Testing Forgot Password flow from login screen...');
    await page.click('button[aria-label="Settings"]');
    await page.waitForSelector('[data-testid="settings-modal"]', { timeout: 5000 });
    await page.click('button:has-text("Log Out")');
    await page.waitForSelector('#login-password', { timeout: 10000 });

    await page.click('button:has-text("Forgot?")');
    await page.waitForSelector('#forgot-identifier', { timeout: 5000 });
    await page.fill('#forgot-identifier', 'andrex@test.local');
    await page.click('button:has-text("Send Reset Code")');

    await page.waitForTimeout(1000);
    const resetCode = readLatestOutboxCode();
    console.log(`   Captured forgot password reset code: ${resetCode}`);
    if (!resetCode) throw new Error('No reset code found in outbox!');

    await page.fill('#reset-code', resetCode);
    await page.fill('#reset-new-pw', 'ResetPassword456!');
    await page.fill('#reset-confirm-pw', 'ResetPassword456!');
    await page.click('button:has-text("Reset Password")');

    await page.waitForSelector('text=Password successfully reset!', { timeout: 5000 });
    console.log('   Password successfully reset via email code!');

    console.log('🎉 ALL EMAIL & PASSWORD CHANGE E2E TESTS PASSED 100%!');
  } finally {
    await browser.close();
    stopProcessTree(proc);
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
