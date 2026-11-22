import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Film, X, Download, Trash2, Share2, Sparkles, Video } from 'lucide-react';
import { clipsService, type SavedClip, type ClipsConfig } from '../services/clips';

export interface ClipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomName?: string;
  onShareClipToChat?: (clip: SavedClip) => void;
}

export const ClipsModal: React.FC<ClipsModalProps> = ({
  isOpen,
  onClose,
  activeRoomName,
  onShareClipToChat,
}) => {
  const [clips, setClips] = useState<SavedClip[]>(() => clipsService.getClips());
  const [config, setConfig] = useState<ClipsConfig>(() => clipsService.getConfig());
  const [capturing, setCapturing] = useState(false);
  const [selectedClip, setSelectedClip] = useState<SavedClip | null>(null);

  useEffect(() => {
    return clipsService.subscribe(() => {
      setClips(clipsService.getClips());
      setConfig(clipsService.getConfig());
    });
  }, []);

  if (!isOpen) return null;

  const handleSaveNow = async () => {
    setCapturing(true);
    try {
      const clip = await clipsService.captureInstantClip(activeRoomName);
      setSelectedClip(clip);
    } finally {
      setCapturing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Protutech Clips"
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[#2d323e] bg-[#16181f] text-white shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#252834] px-5 py-4 bg-[#12141a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Protutech Clips</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  {config.enabled ? `Replay Buffer (${config.durationSec}s)` : 'Paused'}
                </span>
              </h2>
              <p className="text-xs text-[#949ba4]">
                Built-in instant replay &amp; clipping software • Hotkey: <kbd className="px-1.5 py-0.5 rounded bg-[#252834] text-white font-mono text-[10px]">{config.hotkey}</kbd>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={capturing}
              onClick={() => void handleSaveNow()}
              className="px-3.5 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{capturing ? 'Saving Clip...' : 'Save Clip Now'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Clips"
              className="rounded-lg p-1.5 text-[#949ba4] hover:bg-[#252834] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="px-5 py-3 bg-[#101218] border-b border-[#252834] flex items-center justify-between flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => clipsService.updateConfig({ enabled: e.target.checked })}
              className="h-4 w-4 accent-indigo-500"
            />
            <span className="font-semibold">Enable Clipping</span>
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[#949ba4]">Length:</span>
              <select
                value={config.durationSec}
                onChange={e =>
                  clipsService.updateConfig({ durationSec: Number(e.target.value) as 15 | 30 | 60 | 120 })
                }
                className="rounded bg-[#1a1d26] border border-[#2d323e] px-2 py-1 text-xs text-white"
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#949ba4]">Quality:</span>
              <select
                value={config.resolution}
                onChange={e =>
                  clipsService.updateConfig({ resolution: e.target.value as '720p30' | '1080p60' })
                }
                className="rounded bg-[#1a1d26] border border-[#2d323e] px-2 py-1 text-xs text-white"
              >
                <option value="720p30">720p 30fps</option>
                <option value="1080p60">1080p 60fps</option>
              </select>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selectedClip && (
            <div className="rounded-xl border border-indigo-500/30 bg-[#0d1017] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{selectedClip.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedClip(null)}
                  className="text-xs text-[#949ba4] hover:text-white cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
              <video
                src={selectedClip.url}
                controls
                autoPlay
                className="w-full max-h-64 rounded-lg bg-black"
              />
            </div>
          )}

          {clips.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Video className="w-10 h-10 text-[#4e5058] mx-auto" />
              <div className="text-sm font-semibold text-[#dbdee1]">No clips saved yet</div>
              <p className="text-xs text-[#949ba4] max-w-md mx-auto">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[#252834] text-white font-mono">Alt+C</kbd> during a screen share or voice call, or click <strong>Save Clip Now</strong> above to capture an instant replay.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clips.map(clip => (
                <div
                  key={clip.id}
                  className="rounded-xl border border-[#252834] bg-[#12141a] p-3.5 space-y-2.5 hover:border-indigo-500/40 transition-colors"
                >
                  <div
                    onClick={() => setSelectedClip(clip)}
                    className="h-28 rounded-lg bg-gradient-to-br from-[#1b1f2e] to-[#0d1017] flex items-center justify-center cursor-pointer relative overflow-hidden"
                  >
                    <Film className="w-8 h-8 text-indigo-400/70" />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white">
                      {clip.durationSec}s • {Math.max(1, Math.round(clip.sizeBytes / 1024))} KB
                    </span>
                  </div>
                  <div className="text-xs font-bold truncate" title={clip.title}>
                    {clip.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={clip.url}
                        download={`${clip.id}.webm`}
                        className="px-2.5 py-1 rounded bg-[#252834] hover:bg-[#323646] text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save</span>
                      </a>
                      {onShareClipToChat && (
                        <button
                          type="button"
                          onClick={() => {
                            onShareClipToChat(clip);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Share</span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClip?.id === clip.id) setSelectedClip(null);
                        clipsService.deleteClip(clip.id);
                      }}
                      className="p-1.5 rounded text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                      aria-label="Delete clip"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
