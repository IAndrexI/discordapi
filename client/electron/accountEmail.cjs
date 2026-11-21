'use strict';

/**
 * Email-linked accounts & password management for the self-hosted Protutech server.
 *
 * Credentials live in `db.accounts[userId]` (never in `db.users`, which is embedded
 * into room member lists and sent to clients).
 *
 * Email delivery:
 *   - SMTP via nodemailer when configured (env vars or `<dataDir>/smtp.json`).
 *   - Otherwise messages are written to `<dataDir>/outbox/` and logged to the console,
 *     so a self-hosted admin can still read codes without SMTP.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SEND_COOLDOWN_MS = 30 * 1000;
const MAX_SESSIONS_PER_USER = 25;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  return email.length <= 254 && EMAIL_RE.test(email);
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(1, Math.min(6, local.length - visible.length)))}@${domain}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algo, n, r, p, saltHex, hashHex] = String(stored || '').split('$');
    if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password || ''), Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function validateNewPassword(password) {
  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function loadSmtpConfig(dataDir) {
  const env = process.env;
  if (env.SMTP_HOST) {
    return {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: String(env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(env.SMTP_PORT) === 465,
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || env.SMTP_USER || 'Protutech <no-reply@localhost>',
    };
  }
  try {
    const file = path.join(dataDir, 'smtp.json');
    if (fs.existsSync(file)) {
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (cfg && cfg.host) {
        return {
          host: String(cfg.host),
          port: Number(cfg.port || 587),
          secure: Boolean(cfg.secure) || Number(cfg.port) === 465,
          user: String(cfg.user || ''),
          pass: String(cfg.pass || ''),
          from: String(cfg.from || cfg.user || 'Protutech <no-reply@localhost>'),
        };
      }
    }
  } catch (err) {
    console.warn('[accountEmail] Failed to read smtp.json:', err.message);
  }
  return null;
}

function createMailer(dataDir) {
  const outboxDir = path.join(dataDir, 'outbox');
  let transporter = null;
  let transporterKey = '';

  function getTransport() {
    const cfg = loadSmtpConfig(dataDir);
    if (!cfg) return null;
    const key = JSON.stringify(cfg);
    if (transporter && transporterKey === key) return { transporter, cfg };
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch {
      console.warn('[accountEmail] nodemailer not installed; falling back to outbox delivery.');
      return null;
    }
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    transporterKey = key;
    return { transporter, cfg };
  }

  function deliveryMode() {
    return loadSmtpConfig(dataDir) ? 'smtp' : 'outbox';
  }

  async function send({ to, subject, text, html }) {
    const transport = getTransport();
    if (transport) {
      try {
        await transport.transporter.sendMail({ from: transport.cfg.from, to, subject, text, html });
        return { ok: true, delivery: 'smtp' };
      } catch (err) {
        console.error('[accountEmail] SMTP send failed:', err.message);
        return { ok: false, delivery: 'smtp', error: 'Email could not be sent. Check the server SMTP settings.' };
      }
    }
    try {
      fs.mkdirSync(outboxDir, { recursive: true });
      const safeTo = to.replace(/[^a-zA-Z0-9@._-]/g, '_');
      const file = path.join(outboxDir, `${Date.now()}_${safeTo}.txt`);
      fs.writeFileSync(file, `To: ${to}\nSubject: ${subject}\nDate: ${new Date().toISOString()}\n\n${text}\n`, 'utf8');
      console.log(`[accountEmail] SMTP not configured. Email to ${to} saved to ${file}\n  Subject: ${subject}`);
      return { ok: true, delivery: 'outbox' };
    } catch (err) {
      console.error('[accountEmail] Outbox write failed:', err.message);
      return { ok: false, delivery: 'outbox', error: 'Email could not be queued.' };
    }
  }

  return { send, deliveryMode };
}

function buildCodeEmail(kind, code, username) {
  const titles = {
    verify: 'Confirm your email',
    reset: 'Reset your password',
    change: 'Change your password',
  };
  const intros = {
    verify: `Use this code to link this email to your Protutech account (${username}).`,
    reset: `Someone (hopefully you) asked to reset the password for ${username}.`,
    change: `Use this code to change the password for ${username}.`,
  };
  const title = titles[kind] || 'Your Protutech code';
  const intro = intros[kind] || '';
  const text = `${intro}\n\nYour code: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#080c16;color:#f8fafc;padding:24px">
  <div style="max-width:420px;margin:0 auto;background:#121a2d;border:1px solid rgba(0,242,254,.2);border-radius:12px;padding:24px">
    <h2 style="margin:0 0 8px;color:#f8fafc">${escapeHtml(title)}</h2>
    <p style="color:#94a3b8;font-size:14px">${escapeHtml(intro)}</p>
    <div style="font-size:30px;letter-spacing:8px;font-weight:800;color:#00f2fe;margin:16px 0">${code}</div>
    <p style="color:#64748b;font-size:12px">Expires in 15 minutes. If you did not request this, ignore this email.</p>
  </div>
</div>`;
  return { subject: `Protutech: ${title}`, text, html };
}

function createAccountService(store) {
  const db = store.db;
  const dataDir = store.resolvedDir;
  const mailer = createMailer(dataDir);
  const lastSendAt = new Map();

  function ensureCollections() {
    if (!db.accounts || typeof db.accounts !== 'object') db.accounts = {};
    if (!db.sessions || typeof db.sessions !== 'object') db.sessions = {};
    if (!Array.isArray(db.emailCodes)) db.emailCodes = [];
  }
  ensureCollections();

  function getAccount(userId) {
    ensureCollections();
    if (!db.accounts[userId]) {
      db.accounts[userId] = {
        email: null,
        emailVerified: false,
        pendingEmail: null,
        passwordHash: null,
        passwordUpdatedAt: null,
      };
    }
    return db.accounts[userId];
  }

  function publicAccount(userId) {
    const acc = getAccount(userId);
    const user = db.users[userId] || {};
    return {
      userId,
      username: user.username || userId.replace(/^@/, '').split(':')[0],
      email: acc.emailVerified ? acc.email : null,
      emailVerified: Boolean(acc.emailVerified && acc.email),
      pendingEmail: acc.pendingEmail || null,
      hasPassword: Boolean(acc.passwordHash),
      passwordUpdatedAt: acc.passwordUpdatedAt || null,
      emailDelivery: mailer.deliveryMode(),
    };
  }

  function findUserIdByEmail(email) {
    ensureCollections();
    const target = normalizeEmail(email);
    for (const [userId, acc] of Object.entries(db.accounts)) {
      if (acc && acc.emailVerified && acc.email === target) return userId;
    }
    return null;
  }

  function pruneCodes() {
    const now = Date.now();
    db.emailCodes = db.emailCodes.filter((c) => c.expiresAt > now && !c.usedAt);
  }

  // ---------------- Sessions ----------------
  function createSession(userId) {
    ensureCollections();
    const token = `syt_pt_${crypto.randomBytes(24).toString('hex')}`;
    db.sessions[sha256(token)] = { userId, createdAt: Date.now() };
    const mine = Object.entries(db.sessions)
      .filter(([, s]) => s.userId === userId)
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    while (mine.length > MAX_SESSIONS_PER_USER) {
      const [oldKey] = mine.shift();
      delete db.sessions[oldKey];
    }
    return token;
  }

  function getSessionUserId(req) {
    ensureCollections();
    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    const session = db.sessions[sha256(token)];
    return session ? session.userId : null;
  }

  function revokeSessions(userId, exceptReq) {
    const keepKey = (() => {
      if (!exceptReq) return null;
      const header = String(exceptReq.headers.authorization || '');
      const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
      return token ? sha256(token) : null;
    })();
    for (const [key, s] of Object.entries(db.sessions)) {
      if (s.userId === userId && key !== keepKey) delete db.sessions[key];
    }
  }

  // ---------------- Codes ----------------
  async function issueCode({ userId, email, purpose }) {
    const throttleKey = `${purpose}:${userId}:${email}`;
    const last = lastSendAt.get(throttleKey) || 0;
    const waitMs = SEND_COOLDOWN_MS - (Date.now() - last);
    if (waitMs > 0) {
      return { ok: false, status: 429, error: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another code.` };
    }
    pruneCodes();
    // Invalidate any earlier codes for the same purpose/user
    db.emailCodes = db.emailCodes.filter((c) => !(c.userId === userId && c.purpose === purpose));
    const id = crypto.randomBytes(8).toString('hex');
    const code = generateCode();
    db.emailCodes.push({
      id,
      userId,
      email,
      purpose,
      codeHash: sha256(`${id}:${code}`),
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + CODE_TTL_MS,
    });
    store.save();

    const username = (db.users[userId] && db.users[userId].username) || userId;
    const mail = buildCodeEmail(purpose, code, username);
    const result = await mailer.send({ to: email, ...mail });
    if (!result.ok) {
      db.emailCodes = db.emailCodes.filter((c) => c.id !== id);
      store.save();
      return { ok: false, status: 502, error: result.error };
    }
    lastSendAt.set(throttleKey, Date.now());
    return { ok: true, delivery: result.delivery };
  }

  function consumeCode({ userId, purpose, code }) {
    pruneCodes();
    const entry = db.emailCodes.find((c) => c.userId === userId && c.purpose === purpose);
    if (!entry) return { ok: false, error: 'Code expired or not found. Request a new one.' };
    entry.attempts += 1;
    const cleanCode = String(code || '').replace(/\D/g, '');
    const expected = Buffer.from(entry.codeHash, 'hex');
    const actual = Buffer.from(sha256(`${entry.id}:${cleanCode}`), 'hex');
    if (!crypto.timingSafeEqual(expected, actual)) {
      if (entry.attempts >= MAX_CODE_ATTEMPTS) {
        db.emailCodes = db.emailCodes.filter((c) => c.id !== entry.id);
        store.save();
        return { ok: false, error: 'Too many wrong attempts. Request a new code.' };
      }
      store.save();
      return { ok: false, error: `Incorrect code. ${MAX_CODE_ATTEMPTS - entry.attempts} attempt(s) left.` };
    }
    entry.usedAt = Date.now();
    db.emailCodes = db.emailCodes.filter((c) => c.id !== entry.id);
    store.save();
    return { ok: true, email: entry.email };
  }

  function resolveIdentifier(identifier, sanitizeUsername) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;
    if (raw.includes('@') && isValidEmail(raw.replace(/^@/, ''))) {
      return findUserIdByEmail(raw);
    }
    const username = sanitizeUsername(raw);
    const userId = `@${username}:local.protutech`;
    return db.users[userId] ? userId : null;
  }

  return {
    mailer,
    getAccount,
    publicAccount,
    findUserIdByEmail,
    createSession,
    getSessionUserId,
    revokeSessions,
    issueCode,
    consumeCode,
    resolveIdentifier,
  };
}

/**
 * Handles /api/account/* and /api/auth/password/* routes.
 * Returns true when the request was handled.
 */
async function handleAccountRoutes(ctx) {
  const { pathname, method, req, res, accounts, readJsonBody, sendJson, store, sanitizeUsername } = ctx;

  const requireUser = () => {
    const userId = accounts.getSessionUserId(req);
    if (!userId) {
      sendJson(res, 401, { errcode: 'M_UNKNOWN_TOKEN', error: 'Session expired. Please sign in again.' });
      return null;
    }
    return userId;
  };

  // GET /api/account
  if (pathname === '/api/account' && method === 'GET') {
    const userId = requireUser();
    if (!userId) return true;
    sendJson(res, 200, { ok: true, account: accounts.publicAccount(userId) });
    return true;
  }

  // POST /api/account/email/link { email }
  if (pathname === '/api/account/email/link' && method === 'POST') {
    const userId = requireUser();
    if (!userId) return true;
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: 'Enter a valid email address.' });
      return true;
    }
    const owner = accounts.findUserIdByEmail(email);
    if (owner && owner !== userId) {
      sendJson(res, 409, { ok: false, error: 'That email is already linked to another account.' });
      return true;
    }
    const acc = accounts.getAccount(userId);
    if (acc.emailVerified && acc.email === email) {
      sendJson(res, 200, { ok: true, alreadyLinked: true, account: accounts.publicAccount(userId) });
      return true;
    }
    const result = await accounts.issueCode({ userId, email, purpose: 'verify' });
    if (!result.ok) {
      sendJson(res, result.status || 400, { ok: false, error: result.error });
      return true;
    }
    acc.pendingEmail = email;
    store.save();
    sendJson(res, 200, {
      ok: true,
      delivery: result.delivery,
      sentTo: maskEmail(email),
      account: accounts.publicAccount(userId),
    });
    return true;
  }

  // POST /api/account/email/verify { code }
  if (pathname === '/api/account/email/verify' && method === 'POST') {
    const userId = requireUser();
    if (!userId) return true;
    const body = await readJsonBody(req);
    const result = accounts.consumeCode({ userId, purpose: 'verify', code: body.code });
    if (!result.ok) {
      sendJson(res, 400, { ok: false, error: result.error });
      return true;
    }
    const owner = accounts.findUserIdByEmail(result.email);
    if (owner && owner !== userId) {
      sendJson(res, 409, { ok: false, error: 'That email is already linked to another account.' });
      return true;
    }
    const acc = accounts.getAccount(userId);
    acc.email = result.email;
    acc.emailVerified = true;
    acc.pendingEmail = null;
    acc.emailLinkedAt = Date.now();
    store.save();
    sendJson(res, 200, { ok: true, account: accounts.publicAccount(userId) });
    return true;
  }

  // DELETE /api/account/email { password? }
  if (pathname === '/api/account/email' && method === 'DELETE') {
    const userId = requireUser();
    if (!userId) return true;
    const body = await readJsonBody(req);
    const acc = accounts.getAccount(userId);
    if (acc.passwordHash && !verifyPassword(body.password, acc.passwordHash)) {
      sendJson(res, 403, { ok: false, error: 'Enter your current password to remove this email.' });
      return true;
    }
    acc.email = null;
    acc.emailVerified = false;
    acc.pendingEmail = null;
    store.save();
    sendJson(res, 200, { ok: true, account: accounts.publicAccount(userId) });
    return true;
  }

  // POST /api/account/password/request -> emails a change code to the linked address
  if (pathname === '/api/account/password/request' && method === 'POST') {
    const userId = requireUser();
    if (!userId) return true;
    const acc = accounts.getAccount(userId);
    if (!acc.emailVerified || !acc.email) {
      sendJson(res, 400, { ok: false, error: 'Link and verify an email first.' });
      return true;
    }
    const result = await accounts.issueCode({ userId, email: acc.email, purpose: 'change' });
    if (!result.ok) {
      sendJson(res, result.status || 400, { ok: false, error: result.error });
      return true;
    }
    sendJson(res, 200, { ok: true, delivery: result.delivery, sentTo: maskEmail(acc.email) });
    return true;
  }

  // POST /api/account/password/change { code, newPassword }
  if (pathname === '/api/account/password/change' && method === 'POST') {
    const userId = requireUser();
    if (!userId) return true;
    const body = await readJsonBody(req);
    const pwError = validateNewPassword(body.newPassword);
    if (pwError) {
      sendJson(res, 400, { ok: false, error: pwError });
      return true;
    }
    const result = accounts.consumeCode({ userId, purpose: 'change', code: body.code });
    if (!result.ok) {
      sendJson(res, 400, { ok: false, error: result.error });
      return true;
    }
    const acc = accounts.getAccount(userId);
    acc.passwordHash = hashPassword(body.newPassword);
    acc.passwordUpdatedAt = Date.now();
    accounts.revokeSessions(userId, req); // sign out other devices, keep this one
    store.save();
    sendJson(res, 200, { ok: true, account: accounts.publicAccount(userId) });
    return true;
  }

  // POST /api/auth/password/forgot { identifier } (email or username)
  if (pathname === '/api/auth/password/forgot' && method === 'POST') {
    const body = await readJsonBody(req);
    const identifier = String(body.identifier || body.email || body.username || '').trim();
    const generic = {
      ok: true,
      delivery: accounts.mailer.deliveryMode(),
      message: 'If an account with a linked email matches, a reset code has been sent.',
    };
    if (!identifier) {
      sendJson(res, 400, { ok: false, error: 'Enter your email or username.' });
      return true;
    }
    const userId = accounts.resolveIdentifier(identifier, sanitizeUsername);
    const acc = userId ? accounts.getAccount(userId) : null;
    if (userId && acc && acc.emailVerified && acc.email) {
      const result = await accounts.issueCode({ userId, email: acc.email, purpose: 'reset' });
      if (!result.ok && result.status === 429) {
        sendJson(res, 429, { ok: false, error: result.error });
        return true;
      }
    }
    sendJson(res, 200, generic);
    return true;
  }

  // POST /api/auth/password/reset { identifier, code, newPassword }
  if (pathname === '/api/auth/password/reset' && method === 'POST') {
    const body = await readJsonBody(req);
    const pwError = validateNewPassword(body.newPassword);
    if (pwError) {
      sendJson(res, 400, { ok: false, error: pwError });
      return true;
    }
    const userId = accounts.resolveIdentifier(body.identifier || body.email || body.username, sanitizeUsername);
    if (!userId) {
      sendJson(res, 400, { ok: false, error: 'Code expired or not found. Request a new one.' });
      return true;
    }
    const result = accounts.consumeCode({ userId, purpose: 'reset', code: body.code });
    if (!result.ok) {
      sendJson(res, 400, { ok: false, error: result.error });
      return true;
    }
    const acc = accounts.getAccount(userId);
    acc.passwordHash = hashPassword(body.newPassword);
    acc.passwordUpdatedAt = Date.now();
    accounts.revokeSessions(userId, null);
    store.save();
    const username = (store.db.users[userId] && store.db.users[userId].username) || userId;
    sendJson(res, 200, { ok: true, username, message: 'Password updated. Sign in with your new password.' });
    return true;
  }

  return false;
}

module.exports = {
  createAccountService,
  handleAccountRoutes,
  hashPassword,
  verifyPassword,
  isValidEmail,
  normalizeEmail,
  validateNewPassword,
};
