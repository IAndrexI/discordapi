import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';

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

interface DesktopSourceItem {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
}

const QUALITY_OPTIONS: Array<{
  id: ScreenShareSelection['quality'];
  label: string;
  detail: string;
  badge?: string;
}> = [
  { id: '720p30', label: '720p • 30 FPS', detail: 'Low bandwidth' },
  { id: '1080p60', label: '1080p • 60 FPS', detail: 'Crisp smooth motion', badge: 'Recommended' },
  { id: '1440p60', label: '1440p • 60 FPS', detail: 'QHD gaming fidelity' },
  { id: '4k60', label: '4K • 60 FPS', detail: 'Ultra sharp capture', badge: 'Pro' },
];

export const ScreenSharePickerModal: React.FC<ScreenSharePickerModalProps> = ({
  isOpen,
  onClose,
  onStartShare,
}) => {
  const [sources, setSources] = useState<DesktopSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'screen' | 'window'>('all');
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined);
  const [quality, setQuality] = useState<ScreenShareSelection['quality']>('1080p60');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [lowLatencyMode, setLowLatencyMode] = useState(true);

  const fetchSources = useCallback(async () => {
    const api = (
      window as unknown as {
        electronAPI?: {
          getDesktopSources?: () => Promise<DesktopSourceItem[]>;
        };
      }
    ).electronAPI;

    if (!api?.getDesktopSources) {
      setSources([]);
      return;
    }

    setLoading(true);
    try {
      const list = await api.getDesktopSources();
      const valid = Array.isArray(list) ? list : [];
      setSources(valid);
      if (valid.length > 0) {
        setSelectedSourceId(prev =>
          prev && valid.some(s => s.id === prev) ? prev : valid[0].id
        );
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
    const api = (
      window as unknown as {
        electronAPI?: {
          getDesktopSources?: () => Promise<DesktopSourceItem[]>;
        };
      }
    ).electronAPI;

    if (!api?.getDesktopSources) return;

    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      try {
        const list = await api.getDesktopSources!();
        if (!active) return;
        const valid = Array.isArray(list) ? list : [];
        setSources(valid);
        if (valid.length > 0) {
          setSelectedSourceId(prev =>
            prev && valid.some(s => s.id === prev) ? prev : valid[0].id
          );
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

  if (!isOpen) return null;

  const filteredSources = sources.filter(s => {
    if (sourceFilter === 'screen') return s.id.startsWith('screen:');
    if (sourceFilter === 'window') return s.id.startsWith('window:');
    return true;
  });

  const handleStart = () => {
    onStartShare({
      sourceId: selectedSourceId,
      quality,
      includeAudio,
      lowLatencyMode,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#0b101d] border border-cyan-500/25 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0e1629] to-[#131d35] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Cast className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Screen Share &amp; Stream Settings</h2>
              <p className="text-xs text-gray-400">
                Choose a display or window and tune ultra-low-latency streaming quality
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Desktop Source Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10">
                {(
                  [
                    { id: 'all', label: 'All Sources' },
                    { id: 'screen', label: 'Screens' },
                    { id: 'window', label: 'Windows' },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSourceFilter(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      sourceFilter === tab.id
                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void fetchSources()}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {filteredSources.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                {filteredSources.map(src => {
                  const isSelected = selectedSourceId === src.id;
                  const isScreen = src.id.startsWith('screen:');
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setSelectedSourceId(src.id)}
                      className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer bg-[#0f1628] ${
                        isSelected
                          ? 'border-cyan-400 ring-2 ring-cyan-400/50 shadow-[0_0_16px_rgba(0,242,254,0.25)]'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-video bg-black relative overflow-hidden">
                        <img
                          src={src.thumbnail}
                          alt={src.name}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-gray-200 flex items-center gap-1">
                          {isScreen ? (
                            <Monitor className="w-2.5 h-2.5 text-cyan-400" />
                          ) : (
                            <AppWindow className="w-2.5 h-2.5 text-indigo-400" />
                          )}
                          <span>{isScreen ? 'Screen' : 'Window'}</span>
                        </div>
                      </div>
                      <div className="p-2 flex items-center gap-1.5">
                        {src.appIcon && (
                          <img src={src.appIcon} alt="" className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold text-white truncate">
                          {src.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#0e1526] border border-white/10 flex items-center gap-3">
                <Globe className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                <div className="text-xs text-gray-300">
                  <div className="font-semibold text-white mb-0.5">
                    {loading ? 'Scanning screens and windows...' : 'Browser Native Capture Picker'}
                  </div>
                  <p className="text-gray-400">
                    {loading
                      ? 'Enumerating available monitors and application windows.'
                      : 'Running in web browser mode — clicking Start Stream will open your browser screen/window/tab selector with the resolution and audio settings below.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resolution & FPS */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Stream Resolution &amp; Frame Rate
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUALITY_OPTIONS.map(opt => {
                const active = quality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setQuality(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,242,254,0.2)]'
                        : 'bg-[#0e1526] border-white/10 text-gray-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold">{opt.label}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{opt.detail}</div>
                    {opt.badge && (
                      <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio & Zero-Buffer Mode Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIncludeAudio(v => !v)}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                includeAudio
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                  : 'bg-[#0e1526] border-white/10 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                {includeAudio ? (
                  <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-500 flex-shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">Share System Audio</div>
                  <div className="text-[10px] text-gray-400">Include game &amp; app sound</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  includeAudio ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/10 text-gray-400'
                }`}
              >
                {includeAudio ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLowLatencyMode(v => !v)}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                lowLatencyMode
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                  : 'bg-[#0e1526] border-white/10 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2.5 text-left">
                <Zap
                  className={`w-4 h-4 flex-shrink-0 ${
                    lowLatencyMode ? 'text-cyan-400' : 'text-gray-500'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-white">Zero-Buffer Low Latency</div>
                  <div className="text-[10px] text-gray-400">0ms playout delay + H.264</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  lowLatencyMode ? 'bg-cyan-500/25 text-cyan-300' : 'bg-white/10 text-gray-400'
                }`}
              >
                {lowLatencyMode ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#090d16] border-t border-white/10 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <Cast className="w-3.5 h-3.5" />
            <span>Go Live ({quality})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
