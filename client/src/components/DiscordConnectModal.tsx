import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Clipboard,
  Check,
  RefreshCw,
  LogOut,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  QrCode,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { matrix } from '../services/matrix';
import { discordSettingsSync } from '../services/discordSettingsSync';

export interface DiscordConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
  onOpenNativeDiscord?: () => void;
}

const CONSOLE_SNIPPET =
  "copy((webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken())";

export const DiscordConnectModal: React.FC<DiscordConnectModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  onOpenNativeDiscord,
}) => {
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [showOauthSection, setShowOauthSection] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeAccount, setActiveAccount] = useState<{
    username: string;
    globalName?: string;
    avatarUrl?: string;
    id?: string;
    syncedGuilds?: number;
  } | null>(null);

  const checkCurrentConnection = async () => {
    try {
      const res = await matrix.getDiscordStatus();
      if (res && res.connected && res.user) {
        setActiveAccount({
          username: res.user.username,
          globalName: res.user.globalName,
          avatarUrl: res.user.avatar
            ? `https://cdn.discordapp.com/avatars/${res.user.id}/${res.user.avatar}.png`
            : undefined,
          id: res.user.id,
          syncedGuilds: (res as unknown as { guilds?: unknown[] }).guilds?.length || 0,
        });
      }
    } catch {
      // Ignore background check failure
    }
  };

  // Check current connection on modal open
  useEffect(() => {
    if (!isOpen) return;
    const currentToken = localStorage.getItem('protutech_discord_token')?.trim();
    if (currentToken) {
      setTokenInput(currentToken);
      void checkCurrentConnection();
    } else {
      setActiveAccount(null);
    }
    setStatusMessage(null);
  }, [isOpen]);

  const handleConnectWithToken = async (rawToken: string) => {
    let cleanToken = rawToken.trim();
    // Strip common wrapper formatting: quotes, "token: ", "mfa." etc
    cleanToken = cleanToken.replace(/^["']|["']$/g, '');
    cleanToken = cleanToken.replace(/^token:\s*/i, '');

    if (!cleanToken) {
      setStatusMessage({ type: 'error', text: 'Please provide a valid Discord token.' });
      return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Validating token and syncing Discord servers...' });

    try {
      discordSettingsSync.setDiscordToken(cleanToken);
      const res = await matrix.connectDiscord(cleanToken, true);

      if (res.ok && res.user) {
        setActiveAccount({
          username: res.user.username,
          globalName: res.user.globalName,
          avatarUrl: res.user.avatar
            ? `https://cdn.discordapp.com/avatars/${res.user.id}/${res.user.avatar}.png`
            : undefined,
          id: res.user.id,
          syncedGuilds: res.syncedGuilds || 0,
        });
        setStatusMessage({
          type: 'ok',
          text: `Successfully connected as ${res.user.globalName || res.user.username}! Synced ${res.syncedGuilds || 0} servers.`,
        });
        onConnected?.();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to authenticate token with Discord gateway.',
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error connecting to Discord.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBuiltInDiscordLogin = async () => {
    if (!window.electronAPI?.openDiscordLogin) {
      setStatusMessage({
        type: 'info',
        text: 'Built-in Discord login window is available in the Desktop app. Use 1-Click Clipboard Connect or QR Portal below on Web.',
      });
      return;
    }
    setLoading(true);
    setStatusMessage({
      type: 'info',
      text: 'Sign in inside the Discord window — your channels, servers, and groups will sync automatically...',
    });
    try {
      const res = await window.electronAPI.openDiscordLogin();
      if (res.ok && res.token) {
        setTokenInput(res.token);
        await handleConnectWithToken(res.token);
      } else if (res.cancelled) {
        setStatusMessage({ type: 'info', text: 'Discord sign-in window closed.' });
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Could not complete Discord sign-in.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClipboardPasteAndConnect = async () => {
    try {
      let clipboardText = '';
      if (navigator.clipboard?.readText) {
        clipboardText = await navigator.clipboard.readText();
      } else {
        clipboardText = window.prompt('Paste your Discord token here:') || '';
      }
      if (!clipboardText.trim()) {
        setStatusMessage({ type: 'error', text: 'Clipboard is empty. Copy your token first.' });
        return;
      }
      setTokenInput(clipboardText.trim());
      await handleConnectWithToken(clipboardText);
    } catch {
      const fallback = window.prompt('Paste your Discord token:') || '';
      if (fallback.trim()) {
        setTokenInput(fallback.trim());
        await handleConnectWithToken(fallback);
      }
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      discordSettingsSync.setDiscordToken('');
      localStorage.removeItem('protutech_discord_token');
      await matrix.disconnectDiscord();
      setActiveAccount(null);
      setTokenInput('');
      setStatusMessage({ type: 'info', text: 'Disconnected from Discord.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartOfficialOAuth = async () => {
    const base = window.location.protocol === 'file:' ? 'http://127.0.0.1:4175' : '';
    setLoading(true);
    try {
      if (oauthClientId.trim()) {
        await fetch(`${base}/api/discord/oauth/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: oauthClientId.trim(),
            clientSecret: oauthClientSecret.trim() || undefined,
          }),
        });
      }
      const res = await fetch(`${base}/api/discord/oauth/url`);
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Enter your Discord Application Client ID & Secret first.',
        });
        return;
      }
      window.open(data.url, '_blank', 'width=520,height=720');
      setStatusMessage({
        type: 'info',
        text: 'Authorize Protutech in the official Discord OAuth2 popup...',
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Could not start Official Discord OAuth2 flow.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyConsoleSnippet = () => {
    void navigator.clipboard?.writeText(CONSOLE_SNIPPET);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discord-connect-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--discord-blurple)]/30 bg-[#16181f] text-white shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#252834] bg-[var(--discord-blurple)]/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--discord-blurple)] text-white shadow-md">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 id="discord-connect-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Connect Discord Account</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--discord-blurple)]/25 text-[var(--discord-blurple)] font-bold border border-[var(--discord-blurple)]/40">
                  Easy Setup
                </span>
              </h2>
              <p className="text-xs text-[#949ba4]">
                Link your account to browse servers, DMs, voice calls &amp; reactions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-[#252834] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Active Account Status (if connected) */}
          {activeAccount && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {activeAccount.avatarUrl ? (
                  <img
                    src={activeAccount.avatarUrl}
                    alt={activeAccount.username}
                    className="w-10 h-10 rounded-full border border-emerald-400"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center font-bold text-white text-base">
                    {activeAccount.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {activeAccount.globalName || activeAccount.username}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Live Bridge
                    </span>
                  </div>
                  <span className="text-[11px] text-[#949ba4]">
                    @{activeAccount.username} • {activeAccount.syncedGuilds || 0} servers synced
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void matrix.syncAllDiscord()}
                  className="px-2.5 py-1.5 rounded-lg bg-[#252834] hover:bg-[#2d3242] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Resync servers & channels"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resync</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleDisconnect()}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}

          {/* Built-in Sign-In + Quick 1-Click Action */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--discord-blurple)]/25 to-indigo-600/15 border border-[var(--discord-blurple)]/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--discord-blurple)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Easiest Option: Built-in Discord Sign-In
              </span>
            </div>
            <p className="text-[11.5px] text-[#dbdee1] leading-relaxed">
              Sign in directly inside Protutech using email/password or QR code. All your Discord servers, channels, and group DMs will appear natively.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleBuiltInDiscordLogin()}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Key className="w-4 h-4" />
                <span>{loading ? 'Signing in...' : 'Sign In to Discord'}</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleClipboardPasteAndConnect()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#252834] hover:bg-[#323646] border border-[#3a3f52] text-white font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Clipboard className="w-4 h-4" />
                <span>Paste Token &amp; Connect</span>
              </button>
            </div>
            {onOpenNativeDiscord && (
              <button
                type="button"
                onClick={onOpenNativeDiscord}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Native Embedded Discord (Vesktop / Equicord Mode)</span>
              </button>
            )}
          </div>

          {/* Official Discord OAuth2 API */}
          <div className="rounded-xl border border-[#232734] bg-[#12141a] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOauthSection(v => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-[#dbdee1] hover:bg-[#1a1d26] cursor-pointer"
            >
              <span>Official Discord OAuth2 API (Developer Portal App)</span>
              <span className="text-[10px] text-[#949ba4]">{showOauthSection ? 'Hide' : 'Configure'}</span>
            </button>
            {showOauthSection && (
              <div className="p-3.5 pt-2 border-t border-[#232734] space-y-2.5">
                <p className="text-[11px] text-[#949ba4]">
                  Uses Discord&apos;s official OAuth2 (<code className="text-indigo-300">identify guilds email connections</code>). Set Redirect URI to{' '}
                  <code className="text-indigo-300">http://127.0.0.1:4175/api/discord/oauth/callback</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={oauthClientId}
                    onChange={e => setOauthClientId(e.target.value)}
                    placeholder="Discord Client ID"
                    className="rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="password"
                    value={oauthClientSecret}
                    onChange={e => setOauthClientSecret(e.target.value)}
                    placeholder="Discord Client Secret"
                    className="rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleStartOfficialOAuth()}
                  className="w-full py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Authorize with Official Discord OAuth2
                </button>
              </div>
            )}
          </div>

          {/* Manual Input Field */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#949ba4]">
              Or Paste Token Manually
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="Paste Discord token here..."
                  className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-3 py-2 pr-9 text-xs text-white font-mono focus:border-[var(--discord-blurple)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#72767d] hover:text-white"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                disabled={loading || !tokenInput.trim()}
                onClick={() => void handleConnectWithToken(tokenInput)}
                className="px-4 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>

          {/* Status Feedback */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 text-xs ${
                statusMessage.type === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
              }`}
            >
              {statusMessage.type === 'ok' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* How to Get Your Token in 5 Seconds */}
          <div className="p-4 rounded-xl bg-[#0f1117] border border-[#232734] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                How to get your Discord token in 5 seconds:
              </span>
              <a
                href="https://discord.com/app"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[var(--discord-blurple)] hover:underline flex items-center gap-1"
              >
                <span>Open Discord Web</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-[#949ba4] leading-relaxed">
              <li>
                Open <span className="text-white font-semibold">discord.com/app</span> in your browser and sign in.
              </li>
              <li>
                Press <kbd className="px-1.5 py-0.5 rounded bg-[#202430] text-white font-mono text-[10px]">Ctrl + Shift + I</kbd> (or <kbd className="px-1.5 py-0.5 rounded bg-[#202430] text-white font-mono text-[10px]">F12</kbd>) and click the <strong className="text-white">Console</strong> tab.
              </li>
              <li>
                Click the button below to copy the 1-click snippet, paste it in the Console, and press <strong className="text-white">Enter</strong>:
              </li>
            </ol>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#161822] border border-[#2d323e] rounded-lg p-2 font-mono text-[10px] text-indigo-300 truncate select-all">
                {CONSOLE_SNIPPET}
              </div>
              <button
                type="button"
                onClick={handleCopyConsoleSnippet}
                className="px-3 py-2 rounded-lg bg-[#252834] hover:bg-[#323646] text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <p className="text-[10.5px] text-[#72767d]">
              The snippet automatically puts your token on your clipboard. Then just click <strong>&quot;Paste from Clipboard &amp; Connect&quot;</strong> above!
            </p>
          </div>

          {/* QR Code Option */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#12141a] border border-[#232734]">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-semibold text-white text-xs block">
                  Scan QR with Discord Mobile App
                </span>
                <span className="text-[11px] text-[#72767d]">
                  For self-hosted mautrix-discord bridge login
                </span>
              </div>
            </div>
            <a
              href="/discord-qr.html"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#252834] hover:bg-[#323646] text-xs font-semibold text-white flex items-center gap-1 transition-colors"
            >
              <span>Open QR Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#252834] bg-[#12141a] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white bg-[#252834] hover:bg-[#323646] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
