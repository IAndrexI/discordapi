import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  { id: '1080p60', label: '1080p • 60 FPS', detail: 'Smooth motion', badge: 'Recommended' },
  { id: '1440p60', label: '1440p • 60 FPS', detail: 'QHD gaming fidelity' },
  { id: '4k60', label: '4K • 60 FPS', detail: 'Ultra sharp capture', badge: 'Pro' },
];

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
  const [quality, setQuality] = useState<ScreenShareSelection['quality']>('1080p60');
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

  const handleStart = () => {
    onStartShare({
      sourceId: selectedSourceId,
      quality,
      includeAudio,
      lowLatencyMode,
    });
    onClose();
  };

  const handleUseSystemPicker = () => {
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
            onClick={() => setSelectedSourceId(src.id)}
            className={`group rounded-lg overflow-hidden border text-left transition-all cursor-pointer bg-[#1e1f22] ${
              isSelected
                ? 'border-[#5865f2] ring-2 ring-[#5865f2]/60 shadow-lg'
                : 'border-white/[0.08] hover:border-white/25'
            }`}
          >
            <div className="aspect-video bg-[#111214] relative overflow-hidden">
              {src.thumbnail ? (
                <img
                  src={src.thumbnail}
                  alt={src.name}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#949ba4]">
                  {isScreen ? <Monitor className="w-6 h-6" /> : <AppWindow className="w-6 h-6" />}
                </div>
              )}
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-[#f2f3f5] flex items-center gap-1">
                {isScreen ? (
                  <Monitor className="w-2.5 h-2.5 text-[#23a55a]" />
                ) : (
                  <AppWindow className="w-2.5 h-2.5 text-[#5865f2]" />
                )}
                <span>{isScreen ? 'Screen' : 'Window'}</span>
              </div>
            </div>
            <div className="p-2 flex items-center gap-1.5">
              {src.appIcon && (
                <img src={src.appIcon} alt="" className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="text-[11px] font-semibold text-[#f2f3f5] truncate">
                {src.name}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        data-testid="screen-share-picker-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[min(740px,calc(100vw-32px))] max-h-[calc(100vh-48px)] bg-[#313338] border border-[#1e1f22] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#dbdee1]"
      >
        {/* Discord Modal Header */}
        <div className="px-5 py-3.5 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#5865f2]/20 border border-[#5865f2]/40 flex items-center justify-center flex-shrink-0">
              <Cast className="w-5 h-5 text-[#5865f2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#f2f3f5] truncate">Screen Share</h2>
              <p className="text-xs text-[#949ba4] truncate">
                Choose a display or application window to stream
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Screen Share Picker"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-5">
          {/* Source Filter Tabs + Refresh + System Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded-lg border border-white/[0.06]">
                {(
                  [
                    { id: 'screen', label: `Screens (${screenSources.length})` },
                    { id: 'window', label: `Applications (${windowSources.length})` },
                    { id: 'all', label: `All Sources (${sources.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`screen-picker-tab-${tab.id}`}
                    onClick={() => setSourceFilter(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      sourceFilter === tab.id
                        ? 'bg-[#5865f2] text-white'
                        : 'text-[#949ba4] hover:text-white hover:bg-white/[0.05]'
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
                  title="Open native OS / browser screen selector"
                  className="px-2.5 py-1.5 rounded-md bg-[#2b2d31] hover:bg-[#383a40] border border-white/10 text-xs font-medium text-[#f2f3f5] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#5865f2]" />
                  <span>Use System Screen Picker</span>
                </button>

                <button
                  type="button"
                  onClick={() => void fetchSources()}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-md bg-[#2b2d31] hover:bg-[#383a40] border border-white/10 text-xs text-[#dbdee1] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#dbdee1] ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#2b2d31] border border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="w-6 h-6 text-[#5865f2] flex-shrink-0" />
                  <div className="text-xs">
                    <div className="font-semibold text-[#f2f3f5] mb-0.5">
                      {loading ? 'Scanning screens and windows...' : 'System Native Capture Picker'}
                    </div>
                    <p className="text-[#949ba4]">
                      {loading
                        ? 'Enumerating available monitors and application windows.'
                        : 'Click Go Live or Use System Screen Picker to pick any monitor, window, or tab.'}
                    </p>
                  </div>
                </div>
                {!loading && (
                  <button
                    type="button"
                    onClick={handleUseSystemPicker}
                    className="px-3 py-1.5 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold cursor-pointer flex-shrink-0"
                  >
                    Open Picker
                  </button>
                )}
              </div>
            ) : sourceFilter === 'all' ? (
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
                {/* Pinned Monitors / Screens Section ALWAYS first */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#f2f3f5] flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-[#23a55a]" />
                      <span>Your Screens / Monitors ({screenSources.length})</span>
                    </span>
                  </div>
                  {screenSources.length > 0 ? (
                    renderSourceGrid(screenSources)
                  ) : (
                    <div className="p-3 rounded-lg bg-[#2b2d31] border border-white/[0.08] flex items-center justify-between gap-3 flex-wrap text-xs">
                      <span className="text-[#949ba4]">
                        No direct monitor thumbnails returned by desktop capture.
                      </span>
                      <button
                        type="button"
                        onClick={handleUseSystemPicker}
                        className="px-2.5 py-1 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold cursor-pointer"
                      >
                        Use System Screen Picker
                      </button>
                    </div>
                  )}
                </div>

                {/* Application Windows Section */}
                {windowSources.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] flex items-center gap-1.5">
                      <AppWindow className="w-3.5 h-3.5 text-[#5865f2]" />
                      <span>Application Windows ({windowSources.length})</span>
                    </div>
                    {renderSourceGrid(windowSources)}
                  </div>
                )}
              </div>
            ) : sourceFilter === 'screen' ? (
              <div className="max-h-[280px] overflow-y-auto pr-1">
                {screenSources.length > 0 ? (
                  renderSourceGrid(screenSources)
                ) : (
                  <div className="p-4 rounded-lg bg-[#2b2d31] border border-white/[0.08] flex items-center justify-between gap-3 flex-wrap text-xs">
                    <span className="text-[#949ba4]">
                      No monitors listed in desktopCapturer. Launch the OS picker instead:
                    </span>
                    <button
                      type="button"
                      onClick={handleUseSystemPicker}
                      className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold cursor-pointer"
                    >
                      Use System Screen Picker
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto pr-1">
                {windowSources.length > 0 ? (
                  renderSourceGrid(windowSources)
                ) : (
                  <div className="p-4 rounded-lg bg-[#2b2d31] border border-white/[0.08] text-xs text-[#949ba4]">
                    No open application windows found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stream Resolution & Frame Rate */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider">
              Stream Quality
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const active = quality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setQuality(opt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#5865f2]/20 border-[#5865f2] text-white'
                        : 'bg-[#2b2d31] border-white/[0.06] text-[#dbdee1] hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-[#949ba4] mt-0.5">{opt.detail}</div>
                    {opt.badge && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#5865f2]/25 text-[#dbdee1]">
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
              onClick={() => setIncludeAudio((v) => !v)}
              className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                includeAudio
                  ? 'bg-[#23a55a]/10 border-[#23a55a]/40 text-white'
                  : 'bg-[#2b2d31] border-white/[0.06] text-[#949ba4]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                {includeAudio ? (
                  <Volume2 className="w-4 h-4 text-[#23a55a] flex-shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#949ba4] flex-shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold text-[#f2f3f5]">Share System Audio</div>
                  <div className="text-[10px] text-[#949ba4]">Include game &amp; app sound</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  includeAudio ? 'bg-[#23a55a]/25 text-[#23a55a]' : 'bg-white/10 text-[#949ba4]'
                }`}
              >
                {includeAudio ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLowLatencyMode((v) => !v)}
              className={`p-3 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                lowLatencyMode
                  ? 'bg-[#5865f2]/15 border-[#5865f2]/50 text-white'
                  : 'bg-[#2b2d31] border-white/[0.06] text-[#949ba4]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Zap
                  className={`w-4 h-4 flex-shrink-0 ${
                    lowLatencyMode ? 'text-[#5865f2]' : 'text-[#949ba4]'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-[#f2f3f5]">Zero-Buffer Low Latency</div>
                  <div className="text-[10px] text-[#949ba4]">0ms playout delay + H.264</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  lowLatencyMode ? 'bg-[#5865f2]/25 text-[#dbdee1]' : 'bg-white/10 text-[#949ba4]'
                }`}
              >
                {lowLatencyMode ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer — Always Pinned Inside Modal */}
        <div className="px-5 py-3 bg-[#2b2d31] border-t border-[#1e1f22] flex items-center justify-between gap-2.5 flex-shrink-0">
          <div className="text-[11px] text-[#949ba4] truncate">
            {selectedSourceId
              ? `Selected: ${sources.find((s) => s.id === selectedSourceId)?.name || selectedSourceId}`
              : 'System picker ready'}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-transparent hover:bg-white/[0.06] text-xs font-semibold text-[#dbdee1] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStart}
              className="px-5 py-2 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold shadow flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Cast className="w-3.5 h-3.5" />
              <span>Go Live</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
