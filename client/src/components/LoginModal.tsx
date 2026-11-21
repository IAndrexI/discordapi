import React, { useState } from 'react';
import {
  MessageSquare,
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
} from 'lucide-react';
import type { EngineMode } from '../types';
import { matrix } from '../services/matrix';

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
        setError('Sign-in failed. Check your credentials or switch mode.');
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
          <div className="w-9 h-9 rounded-xl bg-[var(--discord-blurple)] flex items-center justify-center text-white mx-auto mb-1.5 shadow-lg">
            <MessageSquare className="w-4 h-4 fill-current" />
          </div>
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
                Username
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="andrex"
                  className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1"
              >
                Password
              </label>
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
