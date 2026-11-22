import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Puzzle, ExternalLink, Paintbrush, Sparkles } from 'lucide-react';

export interface DiscordNativeEmbedProps {
  onClose: () => void;
  onOpenEquicord?: () => void;
  onOpenConnectModal?: () => void;
}

const PROTUTECH_DISCORD_THEME_CSS = `
  /* Protutech Native Embed Theme Polish */
  ::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
  ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.45) !important; border-radius: 999px !important; }
`;

export const DiscordNativeEmbed: React.FC<DiscordNativeEmbedProps> = ({
  onClose,
  onOpenEquicord,
  onOpenConnectModal,
}) => {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  const webviewRef = useRef<HTMLElement | null>(null);
  const [injectTheme, setInjectTheme] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const el = webviewRef.current as (HTMLElement & {
      insertCSS?: (css: string) => Promise<string>;
      addEventListener: (event: string, fn: () => void) => void;
      removeEventListener: (event: string, fn: () => void) => void;
    }) | null;
    if (!el || !isElectron) return;

    const handleDomReady = () => {
      if (injectTheme && typeof el.insertCSS === 'function') {
        void el.insertCSS(PROTUTECH_DISCORD_THEME_CSS).catch(() => {});
      }
    };

    el.addEventListener('dom-ready', handleDomReady);
    return () => el.removeEventListener('dom-ready', handleDomReady);
  }, [isElectron, injectTheme, reloadKey]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[#16181f] min-w-0 overflow-hidden">
      {/* Top Control Bar */}
      <div className="h-11 px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-channels)] flex items-center justify-between gap-2 flex-shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-md bg-[var(--bg-item-hover)] hover:bg-[var(--discord-blurple)] text-[var(--text-header)] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Protutech</span>
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[var(--text-header)] truncate">
            <Sparkles className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
            <span>Native Discord Client</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--discord-blurple)]/20 text-[var(--discord-blurple)] font-semibold">
              Vesktop / Equicord Mode
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isElectron && (
            <>
              <button
                type="button"
                onClick={() => setInjectTheme(v => !v)}
                className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                  injectTheme
                    ? 'bg-[var(--discord-blurple)]/20 text-[var(--accent-cyan)] border-[var(--discord-blurple)]/40'
                    : 'bg-[var(--bg-userpanel)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                }`}
                title="Toggle Protutech CSS Theme Injection"
              >
                <Paintbrush className="w-3 h-3" />
                <span className="hidden md:inline">Theme CSS</span>
              </button>
              <button
                type="button"
                onClick={() => setReloadKey(k => k + 1)}
                className="p-1.5 rounded bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-white cursor-pointer"
                title="Reload Discord"
                aria-label="Reload Discord"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {onOpenEquicord && (
            <button
              type="button"
              onClick={onOpenEquicord}
              className="px-2.5 py-1 rounded bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-normal)] hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Puzzle className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Equicord Plugins</span>
            </button>
          )}
          <a
            href="https://discord.com/app"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-white"
            title="Open Discord in External Browser"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Embedded Chromium Webview (Desktop) or Web Fallback */}
      {isElectron ? (
        <div className="flex-1 w-full min-h-0 relative bg-[#313338]">
          {React.createElement('webview', {
            key: reloadKey,
            ref: webviewRef,
            src: 'https://discord.com/app',
            partition: 'persist:discord-native',
            allowpopups: 'true',
            style: { width: '100%', height: '100%', border: 'none' },
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-channels)] p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[var(--discord-blurple)]/20 text-[var(--discord-blurple)] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-header)]">
              Native Embedded Discord (Desktop App)
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Modded clients like Vesktop, ArmCord, and Equicord embed Discord inside a native Chromium <code className="text-[var(--accent-cyan)]">&lt;webview&gt;</code> with CSS &amp; plugin injection. Download the Windows Desktop app for full embedded Discord, or use Official Discord OAuth2 / External Browser below.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
              <a
                href="https://discord.com/app"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Discord Web</span>
              </a>
              {onOpenConnectModal && (
                <button
                  type="button"
                  onClick={onOpenConnectModal}
                  className="px-4 py-2 rounded-lg bg-[#252834] hover:bg-[#323646] text-white text-xs font-semibold cursor-pointer"
                >
                  Official OAuth2 / Bridge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
