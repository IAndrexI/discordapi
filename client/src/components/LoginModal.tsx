import React, { useState } from 'react';
import {
  Lock,
  User,
  Server,
  AlertCircle,
  Sparkles,
  Zap,
  Home,
  Globe,
  ChevronDown,
  ChevronUp,
  KeyRound,
  LogIn,
  Mail,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import type { EngineMode } from '../types';
import { matrix } from '../services/matrix';
import { appIconService, DEFAULT_APP_ICON_FALLBACK } from '../services/appIcon';

interface LoginModalProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onSampleGuest?: () => void;
  onModeChange?: (mode: EngineMode) => void;
}

const MODE_OPTIONS: Array<{
  id: EngineMode;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'hybrid',
    title: 'Hybrid',
    subtitle: 'Local + Bridge',
    description: 'Self-hosted node + external bridge sync',
    icon: <Zap className="w-4 h-4 text-[var(--accent-cyan)]" />,
  },
  {
    id: 'proprietary',
    title: 'Local Only',
    subtitle: 'Private node',
    description: 'Self-hosted workspace without external bridges',
    icon: <Home className="w-4 h-4 text-[var(--status-online)]" />,
  },
  {
    id: 'discord_proxy',
    title: 'Remote Bridge',
    subtitle: 'Server / URL',
    description: 'Connect using a remote server or token',
    icon: <Globe className="w-4 h-4 text-[var(--text-link)]" />,
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({
  onLogin,
  onSampleGuest,
  onModeChange,
}) => {
  const [engineMode, setEngineMode] = useState<EngineMode>(() => {
    try {
      const ext = matrix as unknown as { getEngineMode?: () => EngineMode };
      const fromMatrix = ext.getEngineMode?.();
      if (fromMatrix) return fromMatrix;
      const saved = localStorage.getItem('protutech_engine_mode') as EngineMode | null;
      return saved || 'hybrid';
    } catch {
      return 'hybrid';
    }
  });
  const [username, setUsername] = useState('andrex');
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discordToken, setDiscordToken] = useState(() => {
    try {
      return localStorage.getItem('protutech_discord_token') || '';
    } catch {
      return '';
    }
  });
  const [customServerUrl, setCustomServerUrl] = useState(() => {
    try {
      return localStorage.getItem('protutech_custom_server_url') || '';
    } catch {
      return '';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot / Reset Password via Email state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const persistModeAndOptions = (mode: EngineMode) => {
    try {
      localStorage.setItem('protutech_engine_mode', mode);
      const ext = matrix as unknown as { setEngineMode?: (m: EngineMode) => void };
      ext.setEngineMode?.(mode);
      if (discordToken.trim()) {
        localStorage.setItem('protutech_discord_token', discordToken.trim());
      } else {
        localStorage.removeItem('protutech_discord_token');
      }
      if (customServerUrl.trim()) {
        localStorage.setItem('protutech_custom_server_url', customServerUrl.trim());
      } else {
        localStorage.removeItem('protutech_custom_server_url');
      }
    } catch {
      // Ignore storage failures
    }
  };

  const handleSelectMode = (mode: EngineMode) => {
    setEngineMode(mode);
    persistModeAndOptions(mode);
    onModeChange?.(mode);
  };

  const executeLogin = async (targetUser: string, targetPass: string) => {
    const cleanUser = targetUser.trim() || 'andrex';
    const effectivePass =
      targetPass || (engineMode === 'discord_proxy' ? '' : 'protutech-selfhosted');

    if (engineMode === 'discord_proxy' && !effectivePass && !discordToken.trim()) {
      setError('Enter your password or bridge token for Remote Bridge mode.');
      return;
    }

    setIsLoading(true);
    setError(null);
    persistModeAndOptions(engineMode);

    try {
      const ok = await onLogin(cleanUser, effectivePass);
      if (!ok) {
        const lastErr = matrix.getLastAuthError?.();
        setError(lastErr || 'Sign-in failed. Check your credentials or switch mode.');
      }
    } catch {
      setError('Failed to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(username, password);
  };

  const handleRequestResetCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = forgotIdentifier.trim() || username.trim();
    if (!id) {
      setForgotError('Enter your email address or username.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const res = await matrix.requestPasswordReset(id);
      if (!res.ok) {
        setForgotError(res.error || 'Failed to request reset code.');
      } else {
        setForgotStep('verify');
        setForgotSuccess(
          res.message || 'If a matching account with an email exists, a reset code was sent.'
        );
      }
    } catch {
      setForgotError('Could not reach the server.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      setForgotError('Enter the 6-digit verification code.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      const id = forgotIdentifier.trim() || username.trim();
      const res = await matrix.resetPasswordWithCode(id, resetCode, resetNewPassword);
      if (!res.ok) {
        setForgotError(res.error || 'Failed to reset password.');
      } else {
        setForgotSuccess('Password successfully reset! You can now sign in.');
        setPassword(resetNewPassword);
        setTimeout(() => {
          setShowForgotPassword(false);
          setForgotStep('request');
          setResetCode('');
          setResetNewPassword('');
          setResetConfirmPassword('');
        }, 1500);
      }
    } catch {
      setForgotError('Could not reach the server.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOneClickSelfHosted = async () => {
    const chosenMode: EngineMode = engineMode === 'discord_proxy' ? 'hybrid' : engineMode;
    handleSelectMode(chosenMode);
    const cleanUser = username.trim() || 'andrex';
    setUsername(cleanUser);
    await executeLogin(cleanUser, password || 'protutech-selfhosted');
  };

  return (
    <div className="fixed inset-x-0 top-[28px] bottom-0 z-40 bg-[var(--bg-frame)] flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-radial from-[var(--discord-blurple)]/15 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-lg max-h-full overflow-y-auto bg-[var(--bg-card)] rounded-xl shadow-2xl p-4 sm:p-5 border border-[var(--border-subtle)] relative z-10 animate-fadeIn my-auto">
        {/* Header */}
        <div className="text-center mb-3">
          <img
            src={appIconService.getIcon()}
            alt="Protutech"
            onError={e => {
              if (e.currentTarget.src !== DEFAULT_APP_ICON_FALLBACK) {
                e.currentTarget.src = DEFAULT_APP_ICON_FALLBACK;
              }
            }}
            className="w-10 h-10 rounded-xl object-cover mx-auto mb-1.5 shadow-lg border border-[var(--border-subtle)]"
          />
          <h1 className="text-lg font-bold text-[var(--text-header)] leading-tight">Protutech</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Fast, self-hosted chat &amp; voice.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-3 space-y-1">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            Mode
          </span>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-1.5"
            role="radiogroup"
            aria-label="Connection Mode"
          >
            {MODE_OPTIONS.map(opt => {
              const selected = engineMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`login-mode-${opt.id}`}
                  onClick={() => handleSelectMode(opt.id)}
                  aria-label={`${opt.title} — ${opt.description}`}
                  title={opt.description}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    selected
                      ? 'bg-[var(--bg-item-active)] border-[var(--border-accent)] text-[var(--text-header)]'
                      : 'bg-[var(--bg-channels)] border-[var(--border-subtle)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)]'
                  }`}
                >
                  <div className="flex-shrink-0">{opt.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold leading-tight truncate">{opt.title}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{opt.subtitle}</div>
                  </div>
                  <span
                    className={`w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected ? 'border-[var(--accent-cyan)]' : 'border-[var(--text-muted)]/50'
                    }`}
                  >
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Forgot / Reset Password via Email View */}
        {showForgotPassword ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-1">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
              <span className="text-xs font-semibold text-[var(--text-header)]">Reset Password</span>
            </div>

            {forgotError && (
              <div
                role="alert"
                className="p-2 rounded-lg bg-[var(--status-dnd)]/10 border border-[var(--status-dnd)]/30 text-[var(--status-dnd)] text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div
                role="status"
                className="p-2 rounded-lg bg-[var(--status-online)]/10 border border-[var(--status-online)]/30 text-[var(--status-online)] text-xs flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestResetCode} className="space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Enter your username or linked email address. We will send a 6-digit verification code.
                </p>
                <div>
                  <label
                    htmlFor="forgot-identifier"
                    className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block mb-1"
                  >
                    Username or Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                    <input
                      id="forgot-identifier"
                      type="text"
                      value={forgotIdentifier}
                      onChange={e => setForgotIdentifier(e.target.value)}
                      placeholder="andrex or you@example.com"
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)]"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold py-1.5 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                >
                  {forgotLoading ? <span>Sending Code...</span> : <span>Send Reset Code</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-2.5">
                <p className="text-xs text-[var(--text-muted)]">
                  Enter the 6-digit code received via email and choose a new password.
                </p>
                <div>
                  <label
                    htmlFor="reset-code"
                    className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block mb-1"
                  >
                    6-Digit Verification Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    maxLength={6}
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5 text-center font-mono tracking-widest text-sm text-[var(--text-header)] outline-none focus:border-[var(--accent-cyan)]"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="reset-new-pw"
                    className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block mb-1"
                  >
                    New Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                    <input
                      id="reset-new-pw"
                      type="password"
                      value={resetNewPassword}
                      onChange={e => setResetNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--accent-cyan)]"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="reset-confirm-pw"
                    className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block mb-1"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                    <input
                      id="reset-confirm-pw"
                      type="password"
                      value={resetConfirmPassword}
                      onChange={e => setResetConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--accent-cyan)]"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold py-1.5 rounded-lg text-xs cursor-pointer transition-colors disabled:opacity-60"
                  >
                    {forgotLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestResetCode()}
                    disabled={forgotLoading}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] text-xs cursor-pointer border border-[var(--border-subtle)]"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* 1-Click Quick Sign In */}
            <button
              type="button"
              onClick={handleOneClickSelfHosted}
              disabled={isLoading}
              data-testid="quick-signin-andrex-btn"
              className="w-full mb-3 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold py-2 px-4 rounded-lg text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>Quick Sign In</span>
            </button>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="mb-3 p-2 rounded-lg bg-[var(--status-dnd)]/10 border border-[var(--status-dnd)]/30 text-[var(--status-dnd)] text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="login-username"
                    className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1"
                  >
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="andrex or email"
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)] transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="login-password"
                      className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setForgotIdentifier(username);
                        setForgotError(null);
                        setForgotSuccess(null);
                        setForgotStep('request');
                      }}
                      className="text-[10px] text-[var(--accent-cyan)] hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={engineMode === 'discord_proxy' ? 'Required' : 'Optional'}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Collapsible Advanced Options */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-channels)] overflow-hidden">
                <button
                  type="button"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced(prev => !prev)}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-xs font-medium text-[var(--text-normal)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--status-idle)]" />
                    <span>Advanced Options</span>
                  </span>
                  {showAdvanced ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label
                        htmlFor="login-bridge-token"
                        className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block mb-1"
                      >
                        Bridge Token (Optional)
                      </label>
                      <input
                        id="login-bridge-token"
                        type="password"
                        value={discordToken}
                        onChange={e => setDiscordToken(e.target.value)}
                        placeholder="Optional bridge token..."
                        className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="login-server-url"
                        className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block mb-1"
                      >
                        Server URL
                      </label>
                      <div className="flex items-center gap-1.5 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md px-2.5 py-1.5">
                        <Server className="w-3.5 h-3.5 text-[var(--status-online)] flex-shrink-0" />
                        <input
                          id="login-server-url"
                          type="text"
                          value={customServerUrl}
                          onChange={e => setCustomServerUrl(e.target.value)}
                          placeholder="Default local node"
                          className="w-full bg-transparent border-none outline-none text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[var(--text-header)] font-semibold py-1.5 rounded-lg transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <span>Signing in...</span> : <span>Sign In</span>}
              </button>
            </form>
          </>
        )}

        {/* Guest Mode Section */}
        {onSampleGuest && (
          <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onSampleGuest}
              className="w-full bg-[var(--status-online)]/15 hover:bg-[var(--status-online)]/25 border border-[var(--status-online)]/35 text-[var(--text-header)] font-semibold py-1.5 px-4 rounded-lg transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--status-online)] group-hover:rotate-12 transition-transform" />
              <span>Try Guest Mode</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
