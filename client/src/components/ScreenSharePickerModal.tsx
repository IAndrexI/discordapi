import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Monitor,
  AppWindow,
  Volume2,
  VolumeX,
  Zap,
  RefreshCw,
  Cast,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { desktopBridge, type DesktopCaptureSource } from '../services/desktopBridge';

export interface ScreenShareSelection {
  sourceId?: string;
  quality: '720p30' | '1080p60' | '1440p60' | '4k60';
  includeAudio: boolean;
  lowLatencyMode: boolean;
}

export interface ScreenSharePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartShare: (selection: ScreenShareSelection) => void;
}

const QUALITY_OPTIONS: Array<{
  id: ScreenShareSelection['quality'];
  label: string;
  detail: string;
  badge?: string;
}> = [
  { id: '720p30', label: '720p • 30 FPS', detail: 'Low bandwidth' },
  { id: '1080p60', label: '1080p • 60 FPS', detail: 'Balanced 60fps', badge: 'Recommended' },
  { id: '1440p60', label: '1440p • 60 FPS', detail: 'QHD sharp' },
  { id: '4k60', label: '4K • 60 FPS', detail: 'Ultra HD', badge: 'Pro' },
];

const STORAGE_KEY_SCREEN_QUALITY = 'protutech_screen_quality';
const VALID_QUALITIES: readonly ScreenShareSelection['quality'][] = [
  '720p30',
  '1080p60',
  '1440p60',
  '4k60',
];

function readStoredPickerQuality(): ScreenShareSelection['quality'] {
  try {
    if (typeof localStorage === 'undefined') return '1080p60';
    const raw = localStorage.getItem(STORAGE_KEY_SCREEN_QUALITY);
    if (raw === '4k30') return '4k60';
    if (raw && (VALID_QUALITIES as readonly string[]).includes(raw)) {
      return raw as ScreenShareSelection['quality'];
    }
  } catch {
    // Ignore storage read errors
  }
  return '1080p60';
}

function writeStoredPickerQuality(quality: ScreenShareSelection['quality']): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SCREEN_QUALITY, quality);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('protutech:screen-quality-changed', { detail: quality })
      );
    }
  } catch {
    // Ignore storage write errors
  }
}

function sortDesktopSources(list: DesktopCaptureSource[]): DesktopCaptureSource[] {
  return [...list].sort((a, b) => {
    const aIsScreen = a.id.startsWith('screen:') ? 0 : 1;
    const bIsScreen = b.id.startsWith('screen:') ? 0 : 1;
    if (aIsScreen !== bIsScreen) return aIsScreen - bIsScreen;
    return a.name.localeCompare(b.name);
  });
}

async function queryAllDesktopSources(): Promise<DesktopCaptureSource[]> {
  const fromBridge = await desktopBridge.getDesktopSources().catch(() => []);
  if (Array.isArray(fromBridge) && fromBridge.length > 0) {
    return sortDesktopSources(fromBridge);
  }
  const electronApi = (
    window as unknown as {
      electronAPI?: {
        getDesktopSources?: () => Promise<DesktopCaptureSource[]>;
      };
    }
  ).electronAPI;
  if (electronApi?.getDesktopSources) {
    const list = await electronApi.getDesktopSources();
    return Array.isArray(list) ? sortDesktopSources(list) : [];
  }
  return [];
}

export const ScreenSharePickerModal: React.FC<ScreenSharePickerModalProps> = ({
  isOpen,
  onClose,
  onStartShare,
}) => {
  const [sources, setSources] = useState<DesktopCaptureSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'screen' | 'window'>('all');
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined);
  const [quality, setQuality] = useState<ScreenShareSelection['quality']>(() =>
    readStoredPickerQuality()
  );
  const [includeAudio, setIncludeAudio] = useState(true);
  const [lowLatencyMode, setLowLatencyMode] = useState(true);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const sorted = await queryAllDesktopSources();
      setSources(sorted);
      if (sorted.length > 0) {
        const firstScreen = sorted.find((s) => s.id.startsWith('screen:'));
        setSelectedSourceId((prev) =>
          prev && sorted.some((s) => s.id === prev) ? prev : (firstScreen?.id ?? sorted[0].id)
        );
      } else {
        setSelectedSourceId(undefined);
      }
    } catch (err) {
      console.warn('[ScreenSharePicker] Failed to load desktop sources:', err);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    void Promise.resolve().then(async () => {
      if (!active) return;
      setSourceFilter('all');
      setQuality(readStoredPickerQuality());
      setLoading(true);
      try {
        const sorted = await queryAllDesktopSources();
        if (!active) return;
        setSources(sorted);
        if (sorted.length > 0) {
          const firstScreen = sorted.find((s) => s.id.startsWith('screen:'));
          setSelectedSourceId((prev) =>
            prev && sorted.some((s) => s.id === prev) ? prev : (firstScreen?.id ?? sorted[0].id)
          );
        } else {
          setSelectedSourceId(undefined);
        }
      } catch (err) {
        console.warn('[ScreenSharePicker] Failed to load desktop sources:', err);
        if (active) setSources([]);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const screenSources = useMemo(
    () => sources.filter((s) => s.id.startsWith('screen:')),
    [sources]
  );
  const windowSources = useMemo(
    () => sources.filter((s) => s.id.startsWith('window:')),
    [sources]
  );

  if (!isOpen) return null;

  const handleSelectQuality = (nextQuality: ScreenShareSelection['quality']) => {
    setQuality(nextQuality);
    writeStoredPickerQuality(nextQuality);
  };

  const handleStart = () => {
    writeStoredPickerQuality(quality);
    onStartShare({
      sourceId: selectedSourceId,
      quality,
      includeAudio,
      lowLatencyMode,
    });
    onClose();
  };

  const handleUseSystemPicker = () => {
    writeStoredPickerQuality(quality);
    onStartShare({
      sourceId: undefined,
      quality,
      includeAudio,
      lowLatencyMode,
    });
    onClose();
  };

  const renderSourceGrid = (items: DesktopCaptureSource[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {items.map((src) => {
        const isSelected = selectedSourceId === src.id;
        const isScreen = src.id.startsWith('screen:');
        return (
          <button
            key={src.id}
            type="button"
            data-testid={`screen-source-${src.id}`}
            aria-label={src.name}
            aria-pressed={isSelected}
            onClick={() => setSelectedSourceId(src.id)}
            className={`group rounded-lg overflow-hidden border text-left transition-all cursor-pointer bg-[var(--bg-card)] ${
              isSelected
                ? 'border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/60 shadow-lg'
                : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]/40'
            }`}
          >
            <div className="aspect-video bg-[var(--bg-popout)] relative overflow-hidden">
              {src.thumbnail ? (
                <img
                  src={src.thumbnail}
                  alt={src.name}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                  {isScreen ? <Monitor className="w-6 h-6" /> : <AppWindow className="w-6 h-6" />}
                </div>
              )}
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[var(--bg-popout)]/85 border border-[var(--border-subtle)] text-[9px] font-bold text-[var(--text-header)] flex items-center gap-1">
                {isScreen ? (
                  <Monitor className="w-2.5 h-2.5 text-[var(--status-online)]" />
                ) : (
                  <AppWindow className="w-2.5 h-2.5 text-[var(--discord-blurple)]" />
                )}
                <span>{isScreen ? 'Screen' : 'Window'}</span>
              </div>
            </div>
            <div className="p-2 flex items-center gap-1.5">
              {src.appIcon && (
                <img src={src.appIcon} alt="" className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="text-[11px] font-semibold text-[var(--text-header)] truncate">
                {src.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-share-picker-title"
        data-testid="screen-share-picker-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[min(740px,100%)] max-h-full bg-[var(--bg-chat)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-normal)]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[var(--bg-channels)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--discord-blurple)]/20 border border-[var(--discord-blurple)]/40 flex items-center justify-center flex-shrink-0">
              <Cast className="w-5 h-5 text-[var(--discord-blurple)]" />
            </div>
            <div className="min-w-0">
              <h2
                id="screen-share-picker-title"
                className="text-base font-bold text-[var(--text-header)] truncate"
              >
                Screen Share
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate">
                Pick a screen or window to share.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Screen Share Picker"
            className="w-8 h-8 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Source Filter Tabs + Refresh + System Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[var(--bg-popout)] p-1 rounded-lg border border-[var(--border-subtle)]">
                {(
                  [
                    { id: 'screen', label: `Screens (${screenSources.length})` },
                    { id: 'window', label: `Windows (${windowSources.length})` },
                    { id: 'all', label: `All (${sources.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`screen-picker-tab-${tab.id}`}
                    aria-pressed={sourceFilter === tab.id}
                    onClick={() => setSourceFilter(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      sourceFilter === tab.id
                        ? 'bg-[var(--discord-blurple)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="use-system-screen-picker-btn"
                  onClick={handleUseSystemPicker}
                  aria-label="System Picker"
                  title="Open OS or browser screen picker"
                  className="px-2.5 py-1.5 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-header)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                  <span>System Picker</span>
                </button>

                <button
                  type="button"
                  onClick={() => void fetchSources()}
                  disabled={loading}
                  aria-label="Refresh sources"
                  className="px-2.5 py-1.5 rounded-md bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-normal)] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="w-6 h-6 text-[var(--discord-blurple)] flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-[var(--text-header)] mb-0.5">
                      {loading ? 'Scanning screens...' : 'System Capture Picker'}
                    </div>
                    <p className="text-[var(--text-muted)]">
                      {loading
                        ? 'Finding displays and windows.'
                        : 'Click Go Live or System Picker to choose a display or window.'}
                    </p>
                  </div>
                </div>
                {!loading && (
                  <button
                    type="button"
                    onClick={handleUseSystemPicker}
                    className="px-3 py-1.5 rounded-md bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-semibold cursor-pointer flex-shrink-0"
                  >
                    Open Picker
                  </button>
                )}
              </div>
            ) : sourceFilter === 'all' ? (
              <div className="space-y-4 max-h-[240px] overflow-y-auto pr-1">
                {/* Pinned Monitors / Screens Section ALWAYS first */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-header)] flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-[var(--status-online)]" />
                      <span>Screens ({screenSources.length})</span>
                    </span>
                  </div>
                  {screenSources.length > 0 ? (
                    renderSourceGrid(screenSources)
                  ) : (
                    <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap text-xs">
                      <span className="text-[var(--text-muted)]">
                        No monitor thumbnails available.
                      </span>
                      <button
                        type="button"
                        onClick={handleUseSystemPicker}
                        className="px-2.5 py-1 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold cursor-pointer"
                      >
                        System Picker
                      </button>
                    </div>
                  )}
                </div>

                {/* Application Windows Section */}
                {windowSources.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <AppWindow className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                      <span>Windows ({windowSources.length})</span>
                    </div>
                    {renderSourceGrid(windowSources)}
                  </div>
                )}
              </div>
            ) : sourceFilter === 'screen' ? (
              <div className="max-h-[240px] overflow-y-auto pr-1">
                {screenSources.length > 0 ? (
                  renderSourceGrid(screenSources)
                ) : (
                  <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap text-xs">
                    <span className="text-[var(--text-muted)]">
                      No screens listed. Open the system picker instead.
                    </span>
                    <button
                      type="button"
                      onClick={handleUseSystemPicker}
                      className="px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold cursor-pointer"
                    >
                      System Picker
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-h-[240px] overflow-y-auto pr-1">
                {windowSources.length > 0 ? (
                  renderSourceGrid(windowSources)
                ) : (
                  <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                    No open windows found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stream Resolution & Frame Rate */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Quality
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const active = quality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectQuality(opt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[var(--discord-blurple)]/20 border-[var(--discord-blurple)] text-[var(--text-header)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-normal)] hover:border-[var(--text-muted)]/40'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.detail}</div>
                    {opt.badge && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--discord-blurple)]/25 text-[var(--text-header)]">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio & Zero-Buffer Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={includeAudio}
              onClick={() => setIncludeAudio((v) => !v)}
              className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                includeAudio
                  ? 'bg-[var(--status-online)]/10 border-[var(--status-online)]/40 text-[var(--text-header)]'
                  : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                {includeAudio ? (
                  <Volume2 className="w-4 h-4 text-[var(--status-online)] flex-shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold text-[var(--text-header)]">System Audio</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Include app &amp; game sound</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  includeAudio
                    ? 'bg-[var(--status-online)]/25 text-[var(--status-online)]'
                    : 'bg-[var(--bg-popout)] text-[var(--text-muted)]'
                }`}
              >
                {includeAudio ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={lowLatencyMode}
              onClick={() => setLowLatencyMode((v) => !v)}
              className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                lowLatencyMode
                  ? 'bg-[var(--discord-blurple)]/15 border-[var(--discord-blurple)]/50 text-[var(--text-header)]'
                  : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Zap
                  className={`w-4 h-4 flex-shrink-0 ${
                    lowLatencyMode ? 'text-[var(--discord-blurple)]' : 'text-[var(--text-muted)]'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-[var(--text-header)]">Low Latency</div>
                  <div className="text-[10px] text-[var(--text-muted)]">0ms buffer • H.264</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  lowLatencyMode
                    ? 'bg-[var(--discord-blurple)]/25 text-[var(--text-header)]'
                    : 'bg-[var(--bg-popout)] text-[var(--text-muted)]'
                }`}
              >
                {lowLatencyMode ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer — Always Pinned Inside Modal */}
        <div className="px-5 py-3 bg-[var(--bg-channels)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2.5 flex-shrink-0">
          <div className="text-[11px] text-[var(--text-muted)] truncate">
            {selectedSourceId
              ? `Selected: ${sources.find((s) => s.id === selectedSourceId)?.name || selectedSourceId}`
              : 'System picker ready'}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-transparent hover:bg-[var(--bg-item-hover)] text-xs font-semibold text-[var(--text-normal)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStart}
              className="px-5 py-2 rounded-md bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold shadow flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Cast className="w-3.5 h-3.5" />
              <span>Go Live</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
