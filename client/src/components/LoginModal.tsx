import React, { useState } from 'react';
import {
  MessageSquare,
  Lock,
  User,
  Server,
  AlertCircle,
  ShieldCheck,
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
  icon: React.ReactNode;
  accent: string;
}> = [
  {
    id: 'hybrid',
    title: '⚡ Hybrid Mode',
    subtitle: 'Self-Hosted Server + Discord Proxy & Quests Sync',
    icon: <Zap className="w-4 h-4 text-cyan-400" />,
    accent: 'border-cyan-400 bg-cyan-950/50 text-white',
  },
  {
    id: 'proprietary',
    title: '🏠 Proprietary Mode',
    subtitle: '100% Self-Hosted Internal Server (No External Discord)',
    icon: <Home className="w-4 h-4 text-emerald-400" />,
    accent: 'border-emerald-400 bg-emerald-950/50 text-white',
  },
  {
    id: 'discord_proxy',
    title: '🌐 Remote / Discord Bridge',
    subtitle: 'Connect via Remote Homeserver or Live Discord Token',
    icon: <Globe className="w-4 h-4 text-indigo-400" />,
    accent: 'border-indigo-400 bg-indigo-950/50 text-white',
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
      setError('Enter your password or Discord token for Remote / Discord Bridge mode.');
      return;
    }

    setIsLoading(true);
    setError(null);
    persistModeAndOptions(engineMode);

    try {
      const ok = await onLogin(cleanUser, effectivePass);
      if (!ok) {
        setError('Authentication failed. Verify credentials or switch to Hybrid/Proprietary mode.');
      }
    } catch {
      setError('Failed to connect to homeserver.');
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
    <div className="fixed inset-0 z-40 bg-[#1e1f22] flex items-center justify-center p-4 overflow-y-auto">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-radial from-[var(--discord-blurple)]/20 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-lg bg-[#313338] rounded-xl shadow-2xl p-6 sm:p-7 border border-white/10 relative z-10 animate-fadeIn my-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-11 h-11 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white mx-auto mb-2.5 shadow-lg">
            <MessageSquare className="w-5 h-5 fill-current" />
          </div>
          <h1 className="text-xl font-bold text-white mb-0.5">Welcome to Protutech</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Choose your engine mode and sign in instantly to your self-hosted node.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
            <Server className="w-3 h-3 text-emerald-400" />
            <span>Proxmox Self-Hosted (https://chat.protutech.vip)</span>
          </div>
        </div>

        {/* Engine Mode Selector */}
        <div className="mb-4 space-y-1.5">
          <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
            Engine Mode
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {MODE_OPTIONS.map(opt => {
              const selected = engineMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`login-mode-${opt.id}`}
                  onClick={() => handleSelectMode(opt.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    selected
                      ? opt.accent
                      : 'bg-[#1e1f22]/80 border-white/10 text-gray-300 hover:border-white/25 hover:bg-[#1e1f22]'
                  }`}
                >
                  <div className="flex-shrink-0">{opt.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight">{opt.title}</div>
                    <div className="text-[11px] text-gray-400 truncate">{opt.subtitle}</div>
                  </div>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected ? 'border-cyan-400' : 'border-gray-600'
                    }`}
                  >
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Click Self-Hosted Quick Sign-In */}
        <button
          type="button"
          onClick={handleOneClickSelfHosted}
          disabled={isLoading}
          data-testid="quick-signin-andrex-btn"
          className="w-full mb-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-4 rounded-lg text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In to Self-Hosted ({username.trim() || 'andrex'})</span>
        </button>

        {/* Client-Only Security Banner */}
        <div className="mb-4 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>
            <b>Zero-502 Self-Hosted Engine:</b> Runs locally on your node; tokens &amp; Discord overrides stay strictly in local sandbox storage.
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded bg-[var(--status-dnd)]/10 border border-[var(--status-dnd)]/30 text-[var(--status-dnd)] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="andrex"
                  className="w-full bg-[#1e1f22] border border-black/40 rounded pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-[var(--discord-blurple)] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Password{' '}
                <span className="text-[10px] font-normal text-cyan-300">
                  ({engineMode === 'discord_proxy' ? 'Required' : 'Any / Optional'})
                </span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={engineMode === 'discord_proxy' ? '••••••••' : 'Any password works'}
                  className="w-full bg-[#1e1f22] border border-black/40 rounded pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-[var(--discord-blurple)] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Collapsible Optional Discord Token & Custom Self-Hosted URL */}
          <div className="rounded-lg border border-white/10 bg-[#1e1f22]/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(prev => !prev)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Optional: Discord Token &amp; Custom Self-Hosted URL</span>
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-3 pt-1 space-y-2.5 border-t border-white/5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Discord Token (for Live Discord API &amp; Settings Sync)
                  </label>
                  <input
                    type="password"
                    value={discordToken}
                    onChange={e => setDiscordToken(e.target.value)}
                    placeholder="Optional Discord user/bot token..."
                    className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Custom Self-Hosted Server URL
                  </label>
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2.5 py-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={customServerUrl}
                      onChange={e => setCustomServerUrl(e.target.value)}
                      placeholder="Leave blank for built-in self-hosted node (http://localhost:4173)"
                      className="w-full bg-transparent border-none outline-none text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold py-2 rounded transition-colors text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? <span>Signing in...</span> : <span>Log In with Credentials</span>}
          </button>
        </form>

        {/* Guest Sampling Section */}
        {onSampleGuest && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onSampleGuest}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2 px-4 rounded-lg transition-all text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 group-hover:rotate-12 transition-transform" />
              <span>Sample App as Guest (No Sign-In Required)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
