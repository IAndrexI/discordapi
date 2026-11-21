import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Wrench,
  Music,
  Package,
  Pickaxe,
  RotateCcw,
} from 'lucide-react';
import type { EngineMode } from '../types';
import { appIconService } from '../services/appIcon';
import { desktopBridge } from '../services/desktopBridge';
import { overlayService, type OverlayConfig } from '../services/overlay';
import { vencord } from '../services/vencord';
import { MicrosoftStoreModal } from './MicrosoftStoreModal';

export interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  selfHostedServerUrl?: string;
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
  setZoomFactor?: (factor: number) => void;
  getZoomFactor?: () => Promise<number>;
  onZoomChanged?: (callback: (factor: number) => void) => () => void;
  resetWindowBounds?: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export interface TitleBarProps {
  onToggleOverlay?: () => void;
  onOpenMicrosoftStore?: () => void;
  engineMode?: EngineMode;
  onToggleEngineMode?: () => void;
  onOpenDiscordHub?: () => void;
  onOpenEquicord?: () => void;
  onOpenScripts?: () => void;
  onOpenCoBrowse?: () => void;
  isCoBrowsing?: boolean;
  layoutFormat?: 'discord' | 'teamspeak';
  onToggleLayoutFormat?: (format: 'discord' | 'teamspeak') => void;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onOpenSoundboard?: () => void;
  onOpenMinecraftConsole?: () => void;
  onOpenLargeFileShare?: () => void;
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
  layoutFormat = 'discord',
  onToggleLayoutFormat,
  zoomLevel = 100,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenSoundboard,
  onOpenMinecraftConsole,
  onOpenLargeFileShare,
}) => {
  const isDesktop = desktopBridge.isDesktopApp();
  const runtimeKind = desktopBridge.getRuntimeKind();

  const [isMaximized, setIsMaximized] = useState(false);
  const [currentIcon, setCurrentIcon] = useState<string>(appIconService.getIcon());
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() => overlayService.getConfig());
  const [showLocalStoreModal, setShowLocalStoreModal] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!toolsMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setToolsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolsMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toolsMenuOpen]);

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

  const handleLayoutSwitch = (format: 'discord' | 'teamspeak') => {
    if (onToggleLayoutFormat) {
      onToggleLayoutFormat(format);
    } else {
      const current = vencord.getTheme();
      vencord.setTheme({ ...current, layoutFormat: format });
    }
  };

  const handleResetWindowBounds = () => {
    const bridgeExt = desktopBridge as unknown as { resetWindowBounds?: () => void };
    if (typeof bridgeExt.resetWindowBounds === 'function') {
      bridgeExt.resetWindowBounds();
    } else {
      window.electronAPI?.resetWindowBounds?.();
    }
  };

  const runMenuAction = (action?: () => void) => {
    setToolsMenuOpen(false);
    action?.();
  };

  const modePill =
    engineMode === 'proprietary'
      ? {
          label: 'Proprietary',
          dotClass: 'bg-[#23a55a]',
          title: 'Proprietary Mode (100% Self-Hosted) — click to switch mode',
        }
      : engineMode === 'discord_proxy'
      ? {
          label: 'Bridge',
          dotClass: 'bg-[#5865f2]',
          title: 'Discord Bridge Mode — click to switch mode',
        }
      : {
          label: 'Hybrid',
          dotClass: 'bg-[#23a55a]',
          title: 'Hybrid Mode (Self-Hosted + Discord) — click to switch mode',
        };

  return (
    <>
      <header
        data-tauri-drag-region
        className="flex items-center justify-between h-[28px] w-full bg-[var(--bg-frame)] border-b border-[var(--border-subtle)] select-none z-50 text-[var(--text-muted)] text-xs flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: App Icon, Brand & Mode Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 flex-shrink-0 min-w-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <img
            src={currentIcon}
            alt="Protutech"
            className="w-3.5 h-3.5 rounded-sm object-cover flex-shrink-0"
          />
          <span className="text-[11px] font-semibold text-[var(--text-header)] tracking-tight whitespace-nowrap">
            Protutech
          </span>

          {runtimeKind !== 'web' && (
            <span className="hidden sm:inline px-1 py-0.2 rounded bg-white/[0.06] text-[var(--text-muted)] text-[9px] font-semibold uppercase tracking-wide">
              {runtimeKind}
            </span>
          )}

          {onToggleEngineMode ? (
            <button
              type="button"
              onClick={onToggleEngineMode}
              data-testid="topbar-mode-badge"
              title={modePill.title}
              className="h-[18px] px-1.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-[var(--text-normal)] hover:text-[var(--text-header)] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${modePill.dotClass}`} />
              <span>{modePill.label}</span>
            </button>
          ) : (
            <span
              data-testid="topbar-mode-badge"
              className="h-[18px] px-1.5 rounded bg-white/[0.06] text-[var(--text-muted)] text-[10px] font-medium flex items-center gap-1 flex-shrink-0"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${modePill.dotClass}`} />
              <span>{modePill.label}</span>
            </span>
          )}
        </div>

        {/* Center Draggable Spacer */}
        <div className="flex-1 h-full min-w-[8px]" data-tauri-drag-region />

        {/* Right: Layout Switcher, Compact Zoom, Tools Dropdown & Window Controls */}
        <div
          className="flex items-center h-full gap-1.5 pr-1 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Segmented Layout Switcher: Discord | TS3 */}
          <div
            className="inline-flex items-center bg-black/20 rounded p-0.5 border border-[var(--border-subtle)] flex-shrink-0"
            role="group"
            aria-label="Layout Format"
          >
            <button
              type="button"
              onClick={() => handleLayoutSwitch('discord')}
              data-testid="layout-toggle-discord"
              title="Discord Layout (Standard)"
              className={`h-[18px] px-2 rounded-[3px] text-[10px] font-semibold transition-colors cursor-pointer ${
                layoutFormat === 'discord'
                  ? 'bg-[var(--discord-blurple)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
              }`}
            >
              Discord
            </button>
            <button
              type="button"
              onClick={() => handleLayoutSwitch('teamspeak')}
              data-testid="layout-toggle-ts3"
              title="TeamSpeak 3 Classic Hierarchy Format"
              className={`h-[18px] px-2 rounded-[3px] text-[10px] font-semibold transition-colors cursor-pointer ${
                layoutFormat === 'teamspeak'
                  ? 'bg-[var(--discord-blurple)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
              }`}
            >
              TS3
            </button>
          </div>

          {/* Compact Zoom Control: - | 100% | + */}
          <div
            className="inline-flex items-center bg-black/20 rounded border border-[var(--border-subtle)] h-[20px] flex-shrink-0"
            role="group"
            aria-label="Zoom Controls"
          >
            <button
              type="button"
              onClick={onZoomOut}
              data-testid="zoom-out-btn"
              title="Zoom Out (Ctrl+-)"
              className="w-5 h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] rounded-l text-[11px] font-bold transition-colors cursor-pointer"
            >
              −
            </button>
            <button
              type="button"
              onClick={onZoomReset}
              data-testid="zoom-reset-btn"
              title="Reset Zoom to 100% (Ctrl+0)"
              className="px-1.5 h-full flex items-center justify-center text-[10px] font-medium tabular-nums text-[var(--text-normal)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] border-x border-[var(--border-subtle)] transition-colors cursor-pointer min-w-[36px]"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              data-testid="zoom-in-btn"
              title="Zoom In (Ctrl+=)"
              className="w-5 h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] rounded-r text-[11px] font-bold transition-colors cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Single Clean Tools & Plugins Dropdown */}
          <div className="relative flex-shrink-0" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setToolsMenuOpen(prev => !prev)}
              data-testid="topbar-tools-menu-btn"
              aria-expanded={toolsMenuOpen}
              title="Tools, Plugins, Soundboard & Window Utilities"
              className={`h-[20px] px-2 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
                toolsMenuOpen
                  ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border-white/10'
                  : 'bg-white/[0.05] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
              }`}
            >
              <Wrench className="w-3 h-3 flex-shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Tools &amp; Plugins</span>
              <ChevronDown className="w-3 h-3 opacity-75 flex-shrink-0" />
            </button>

            {toolsMenuOpen && (
              <div
                className="absolute right-0 top-[26px] w-56 bg-[#111214] text-[#dbdee1] border border-white/10 rounded-md shadow-2xl py-1.5 px-1.5 z-[120] text-xs"
                role="menu"
              >
                {onOpenDiscordHub && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-discord-hub-btn"
                    onClick={() => runMenuAction(onOpenDiscordHub)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-[#f0b232]" />
                      <span>Quests &amp; Discord Hub</span>
                    </span>
                  </button>
                )}

                {onOpenEquicord && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-equicord-btn"
                    onClick={() => runMenuAction(onOpenEquicord)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Puzzle className="w-3.5 h-3.5 text-[#a78bfa]" />
                      <span>Equicord Plugins</span>
                    </span>
                  </button>
                )}

                {onOpenSoundboard && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-soundboard-btn"
                    onClick={() => runMenuAction(onOpenSoundboard)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-[#23a55a]" />
                      <span>Soundboard</span>
                    </span>
                  </button>
                )}

                {onOpenScripts && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-scripts-btn"
                    onClick={() => runMenuAction(onOpenScripts)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-[#23a55a]" />
                      <span>Scripts / MC API</span>
                    </span>
                  </button>
                )}

                {onOpenMinecraftConsole && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-mc-console-btn"
                    onClick={() => runMenuAction(onOpenMinecraftConsole)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Pickaxe className="w-3.5 h-3.5 text-[#23a55a]" />
                      <span>Minecraft Console</span>
                    </span>
                  </button>
                )}

                {onOpenCoBrowse && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-cobrowse-btn"
                    onClick={() => runMenuAction(onOpenCoBrowse)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-[#00a8fc]" />
                      <span>Co-Browse Search</span>
                    </span>
                    {isCoBrowsing && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#23a55a]" />
                    )}
                  </button>
                )}

                {onOpenLargeFileShare && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="topbar-large-file-btn"
                    onClick={() => runMenuAction(onOpenLargeFileShare)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-[#00a8fc]" />
                      <span>Large File Share</span>
                    </span>
                  </button>
                )}

                <div className="h-px bg-white/[0.08] my-1 mx-1" />

                <button
                  type="button"
                  role="menuitem"
                  data-testid="topbar-overlay-btn"
                  onClick={() => runMenuAction(handleToggleOverlay)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#949ba4]" />
                    <span>In-Game Overlay</span>
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      overlayConfig.enabled
                        ? 'bg-[#23a55a]/25 text-[#23a55a]'
                        : 'bg-white/[0.08] text-[#949ba4]'
                    }`}
                  >
                    {overlayConfig.enabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  data-testid="topbar-store-btn"
                  onClick={() => runMenuAction(handleOpenStore)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-[#00a8fc]" />
                    <span>Microsoft Store Hub</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  data-testid="topbar-reset-window-btn"
                  onClick={() => runMenuAction(handleResetWindowBounds)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-[#949ba4]" />
                    <span>Reset Window Position</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Pinned Desktop Window Controls (Electron & Tauri via desktopBridge) */}
          {isDesktop && (
            <div className="flex items-center h-full ml-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => desktopBridge.minimize()}
                title="Minimize"
                className="w-9 h-full flex items-center justify-center hover:bg-white/[0.08] text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => desktopBridge.maximize()}
                title={isMaximized ? 'Restore Down' : 'Maximize'}
                className="w-9 h-full flex items-center justify-center hover:bg-white/[0.08] text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
              >
                {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => desktopBridge.close()}
                title="Close (Minimize to Tray)"
                className="w-9 h-full flex items-center justify-center hover:bg-[#da373c] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {!onOpenMicrosoftStore && (
        <MicrosoftStoreModal
          isOpen={showLocalStoreModal}
          onClose={() => setShowLocalStoreModal(false)}
        />
      )}
    </>
  );
};
