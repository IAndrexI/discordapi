import React, { useState, useEffect } from 'react';
import {
  Minus,
  Square,
  Copy,
  X,
  Layers,
  Store,
  Trophy,
  Puzzle,
  Terminal,
  Globe,
  Zap,
  Home,
} from 'lucide-react';
import type { EngineMode } from '../types';
import { appIconService } from '../services/appIcon';
import { desktopBridge } from '../services/desktopBridge';
import { overlayService, type OverlayConfig } from '../services/overlay';
import { MicrosoftStoreModal } from './MicrosoftStoreModal';

export interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMax: boolean) => void) => () => void;
  openThemeFileDialog?: () => Promise<{ path: string; name: string; content: string } | null>;
  getDesktopSources?: () => Promise<Array<{ id: string; name: string; thumbnail: string; appIcon?: string }>>;
  selectCaptureSource?: (sourceId: string) => void;
  setOverlayMode?: (enabled: boolean, interactive: boolean) => void;
  onToggleOverlay?: (callback: () => void) => () => void;
  setTrayBadge?: (count: number) => void;
  setAppIcon?: (dataUrl: string) => void;
  onToggleMute?: (callback: () => void) => () => void;
  onToggleDeafen?: (callback: () => void) => () => void;
  onJoinVoice?: (callback: (roomName: string) => void) => () => void;
  relaunchApp?: () => void;
  clearCacheAndReload?: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

interface TitleBarProps {
  onToggleOverlay?: () => void;
  onOpenMicrosoftStore?: () => void;
  engineMode?: EngineMode;
  onToggleEngineMode?: () => void;
  onOpenDiscordHub?: () => void;
  onOpenEquicord?: () => void;
  onOpenScripts?: () => void;
  onOpenCoBrowse?: () => void;
  isCoBrowsing?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onToggleOverlay,
  onOpenMicrosoftStore,
  engineMode = 'hybrid',
  onToggleEngineMode,
  onOpenDiscordHub,
  onOpenEquicord,
  onOpenScripts,
  onOpenCoBrowse,
  isCoBrowsing = false,
}) => {
  const isDesktop = desktopBridge.isDesktopApp();
  const runtimeKind = desktopBridge.getRuntimeKind();

  const [isMaximized, setIsMaximized] = useState(false);
  const [currentIcon, setCurrentIcon] = useState<string>(appIconService.getIcon());
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() => overlayService.getConfig());
  const [showLocalStoreModal, setShowLocalStoreModal] = useState(false);

  useEffect(() => {
    const unsubIcon = appIconService.subscribe(setCurrentIcon);
    const unsubOverlay = overlayService.subscribe(setOverlayConfig);
    return () => {
      unsubIcon();
      unsubOverlay();
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    desktopBridge.isMaximized().then(setIsMaximized).catch(() => {});
    const cleanup = desktopBridge.onMaximizeChange(max => setIsMaximized(max));
    return cleanup;
  }, [isDesktop]);

  const handleToggleOverlay = () => {
    if (onToggleOverlay) {
      onToggleOverlay();
    } else {
      overlayService.toggleEnabled();
    }
  };

  const handleOpenStore = () => {
    if (onOpenMicrosoftStore) {
      onOpenMicrosoftStore();
    } else {
      setShowLocalStoreModal(true);
    }
  };

  const modeBadgeConfig =
    engineMode === 'proprietary'
      ? {
          label: 'PROPRIETARY MODE',
          icon: <Home className="w-3 h-3" />,
          classes:
            'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40',
        }
      : engineMode === 'discord_proxy'
      ? {
          label: 'DISCORD BRIDGE',
          icon: <Globe className="w-3 h-3" />,
          classes:
            'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/40',
        }
      : {
          label: 'HYBRID MODE',
          icon: <Zap className="w-3 h-3" />,
          classes:
            'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40',
        };

  return (
    <>
      <div
        data-tauri-drag-region
        className="flex items-center justify-between h-[32px] w-full bg-[#111827] border-b border-white/5 select-none z-50 text-[#9ca3af] text-xs flex-shrink-0 overflow-x-auto no-scrollbar"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: Branding, Runtime Tag & Clickable Mode Switcher */}
        <div
          className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <img src={currentIcon} alt="Protutech" className="w-4 h-4 rounded object-cover" />
          <span className="font-semibold text-gray-200 tracking-wide text-[11px]">Protutech</span>
          {runtimeKind !== 'web' && (
            <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 text-[9px] font-bold uppercase tracking-wider">
              {runtimeKind}
            </span>
          )}

          {onToggleEngineMode && (
            <button
              type="button"
              onClick={onToggleEngineMode}
              data-testid="topbar-mode-badge"
              title="Click to toggle between Hybrid Mode (Self-Hosted + Discord) and Proprietary Mode (100% Internal)"
              className={`h-[22px] px-2 rounded-full text-[10px] font-extrabold tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${modeBadgeConfig.classes}`}
            >
              {modeBadgeConfig.icon}
              <span>{modeBadgeConfig.label}</span>
            </button>
          )}
        </div>

        {/* Center Draggable Spacer */}
        <div className="flex-1 h-full min-w-[16px]" data-tauri-drag-region />

        {/* Right: Quick-Access Pills & Desktop Window Controls */}
        <div
          className="flex items-center h-full gap-1.5 pr-1.5 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {onOpenDiscordHub && (
            <button
              type="button"
              onClick={onOpenDiscordHub}
              data-testid="topbar-discord-hub-btn"
              title="Open Quests, Friends, Nitro & Discord Hub"
              className="h-[22px] px-2 rounded-full text-[10px] font-bold flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/30 transition-all cursor-pointer"
            >
              <Trophy className="w-3 h-3" />
              <span className="hidden md:inline">Quests &amp; Hub</span>
            </button>
          )}

          {onOpenEquicord && (
            <button
              type="button"
              onClick={onOpenEquicord}
              data-testid="topbar-equicord-btn"
              title="Open Equicord Plugin Manager & Custom Mod Editor"
              className="h-[22px] px-2 rounded-full text-[10px] font-bold flex items-center gap-1 bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 hover:text-white border border-purple-500/30 transition-all cursor-pointer"
            >
              <Puzzle className="w-3 h-3" />
              <span className="hidden md:inline">Equicord</span>
            </button>
          )}

          {onOpenScripts && (
            <button
              type="button"
              onClick={onOpenScripts}
              data-testid="topbar-scripts-btn"
              title="Open Scripts, Webhooks & Minecraft Chat Bridge API"
              className="h-[22px] px-2 rounded-full text-[10px] font-bold flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span className="hidden md:inline">Scripts/MC API</span>
            </button>
          )}

          {onOpenCoBrowse && (
            <button
              type="button"
              onClick={onOpenCoBrowse}
              data-testid="topbar-cobrowse-btn"
              title="Open Built-In Search Engine & Synchronized Co-Browser"
              className={`h-[22px] px-2 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                isCoBrowsing
                  ? 'bg-cyan-500/30 text-white border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border-cyan-500/30'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span className="hidden sm:inline">Co-Browse Search</span>
            </button>
          )}

          {/* Optional Overlay Quick Toggle Pill */}
          <button
            type="button"
            onClick={handleToggleOverlay}
            data-testid="topbar-overlay-btn"
            title={`Toggle Optional In-Game Overlay (${overlayConfig.hotkey || 'Alt+Shift+O'})`}
            className={`h-[22px] px-2 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
              overlayConfig.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span className="hidden lg:inline">Overlay</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                overlayConfig.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
              }`}
            />
          </button>

          {/* Microsoft Store Hub Quick Pill */}
          <button
            type="button"
            onClick={handleOpenStore}
            data-testid="topbar-store-btn"
            title="Open Microsoft Store Install & Publishing Hub"
            className="h-[22px] px-2 rounded-full text-[10px] font-bold flex items-center gap-1 bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-500/30 transition-all cursor-pointer"
          >
            <Store className="w-3 h-3" />
            <span className="hidden sm:inline">MS Store</span>
          </button>

          {/* Desktop Window Controls (Electron & Tauri via desktopBridge) */}
          {isDesktop && (
            <div className="flex items-center h-full ml-1 border-l border-white/10">
              <button
                type="button"
                onClick={() => desktopBridge.minimize()}
                title="Minimize"
                className="w-10 h-full flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => desktopBridge.maximize()}
                title={isMaximized ? 'Restore Down' : 'Maximize'}
                className="w-10 h-full flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => desktopBridge.close()}
                title="Close (Minimize to Tray)"
                className="w-10 h-full flex items-center justify-center hover:bg-[#ed4245] text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {!onOpenMicrosoftStore && (
        <MicrosoftStoreModal
          isOpen={showLocalStoreModal}
          onClose={() => setShowLocalStoreModal(false)}
        />
      )}
    </>
  );
};
