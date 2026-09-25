import React, { useState } from 'react';
import { MessageSquare, Lock, User, Server, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('andrex');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in both username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const ok = await onLogin(username, password);
      if (!ok) {
        setError('Invalid username or password on chat.protutech.vip.');
      }
    } catch {
      setError('Failed to connect to homeserver.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1e1f22] flex items-center justify-center p-4">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-radial from-[var(--discord-blurple)]/20 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md bg-[#313338] rounded-lg shadow-2xl p-8 border border-white/10 relative z-10 animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white mx-auto mb-3 shadow-lg">
            <MessageSquare className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back!</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Sign in to your private Discord-Matrix instance.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded bg-[var(--status-dnd)]/10 border border-[var(--status-dnd)]/30 text-[var(--status-dnd)] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Homeserver
            </label>
            <div className="bg-[#1e1f22] border border-white/10 rounded px-3 py-2 flex items-center gap-2 text-xs text-white">
              <Server className="w-4 h-4 text-[var(--status-online)]" />
              <span className="font-mono">https://chat.protutech.vip</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Matrix Username <span className="text-[var(--status-dnd)]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="andrex"
                className="w-full bg-[#1e1f22] border border-black/40 rounded pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[var(--discord-blurple)] transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Password <span className="text-[var(--status-dnd)]">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1e1f22] border border-black/40 rounded pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[var(--discord-blurple)] transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold py-2.5 rounded transition-colors text-sm shadow-md mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? <span>Signing in...</span> : <span>Log In</span>}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <a
            href="/setup"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--text-link)] hover:underline"
          >
            Need to bridge a Discord account or generate a token? Open Hub &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};
