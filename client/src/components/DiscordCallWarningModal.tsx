import React, { useState, useEffect } from 'react';
import { PhoneCall, AlertTriangle, X, Volume2, ShieldAlert } from 'lucide-react';
import type { MatrixRoom } from '../types';

export interface DiscordCallWarningModalProps {
  room: MatrixRoom;
  onConfirm: () => void;
  onCancel: () => void;
}

const STORAGE_KEY = 'protutech_suppress_discord_latency_warning';

export const isDiscordLatencyWarningSuppressed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setDiscordLatencyWarningSuppressed = (suppressed: boolean): void => {
  try {
    if (suppressed) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
};

export const DiscordCallWarningModal: React.FC<DiscordCallWarningModalProps> = ({
  room,
  onConfirm,
  onCancel,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const dontShowAgainRef = React.useRef(dontShowAgain);
  dontShowAgainRef.current = dontShowAgain;

  const handleProceed = React.useCallback(() => {
    if (dontShowAgainRef.current) {
      setDiscordLatencyWarningSuppressed(true);
    }
    onConfirm();
  }, [onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        handleProceed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleProceed, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discord-call-warning-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#16181f] text-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#252834] bg-amber-500/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="discord-call-warning-title" className="text-base font-bold text-white">
                Joining Discord Call
              </h2>
              <p className="text-xs text-amber-300 font-medium">Higher Latency Notice</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-[#252834] hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs leading-relaxed text-[#dbdee1]">
          <div className="p-3.5 rounded-xl bg-[#0f1117] border border-[#232734] flex items-center gap-3">
            <PhoneCall className="h-5 w-5 text-[var(--discord-blurple)] flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] text-[#949ba4] block uppercase tracking-wider font-semibold">
                Destination Channel
              </span>
              <span className="text-sm font-bold text-white truncate block">
                #{room.name}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-[#b5bac1]">
            <p>
              You are about to connect to a <strong>bridged Discord voice call</strong>.
            </p>
            <div className="rounded-lg bg-amber-950/25 border border-amber-500/20 p-3 space-y-1.5 text-amber-200">
              <div className="flex items-start gap-2 font-semibold text-xs text-amber-300">
                <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Notice: Increased Relay Latency</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-200/90 pl-6">
                Bridged Discord calls relay through Discord&apos;s remote voice gateway and typically experience 
                <strong> 40–120ms higher round-trip latency</strong> compared to native 48kHz voice (0ms buffer).
              </p>
            </div>
            <p className="text-[11px] text-[#949ba4]">
              For real-time competitive gaming or crystal-clear studio audio, recommend your group join a native 
              voice channel with custom 8–384 kbps bitrates.
            </p>
          </div>

          {/* Don't show again toggle */}
          <label className="flex items-center gap-2.5 pt-2 border-t border-[#252834] cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-[#3f4454] bg-[#1a1d26] accent-[var(--discord-blurple)] cursor-pointer"
            />
            <span className="text-xs text-[#949ba4] group-hover:text-white transition-colors">
              Don&apos;t show this warning again (can be toggled back on in Voice &amp; Video settings)
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#252834] bg-[#12141a] px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-[#b5bac1] hover:bg-[#252834] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] px-4 py-2 text-xs font-bold text-white transition-colors flex items-center gap-2"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Continue to Discord Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
