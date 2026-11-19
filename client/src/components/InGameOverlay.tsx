import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Lock,
  Unlock,
  X,
  Activity,
  Minimize2,
  Maximize2,
  Send,
  Radio,
  MessageSquare,
  VolumeX,
} from 'lucide-react';
import type { VoiceParticipant } from '../types';
import { overlayService, type OverlayConfig, type OverlayToast } from '../services/overlay';
import { livekit } from '../services/livekit';

export interface InGameOverlayProps {
  participants: VoiceParticipant[];
  activeVoiceRoom: string | null;
  rtcPing: number;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onDisconnectVoice: () => void;
  onQuickReply?: (roomId: string, text: string) => void;
}

const POSITION_CLASSES: Record<OverlayConfig['position'], string> = {
  'top-left': 'top-10 left-4 items-start',
  'top-right': 'top-10 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-right': 'bottom-4 right-4 items-end',
};

export const InGameOverlay: React.FC<InGameOverlayProps> = ({
  participants,
  activeVoiceRoom,
  rtcPing,
  onToggleMute,
  onToggleDeafen,
  onDisconnectVoice,
  onQuickReply,
}) => {
  const [config, setConfig] = useState<OverlayConfig>(() => overlayService.getConfig());
  const [toasts, setToasts] = useState<OverlayToast[]>(() => overlayService.getToasts());
  const [fps, setFps] = useState<number>(60);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [isMuted, setIsMuted] = useState<boolean>(livekit.isMuted);
  const [isDeafened, setIsDeafened] = useState<boolean>(livekit.isDeafened);

  useEffect(() => {
    const unsubOverlay = overlayService.subscribe((nextConfig, nextToasts) => {
      setConfig(nextConfig);
      setToasts(nextToasts);
    });
    const unsubVoice = livekit.subscribe(() => {
      setIsMuted(livekit.isMuted);
      setIsDeafened(livekit.isDeafened);
    });
    return () => {
      unsubOverlay();
      unsubVoice();
    };
  }, []);

  // Live FPS telemetry via requestAnimationFrame only when overlay + telemetry are active
  useEffect(() => {
    if (!config.enabled || !config.showTelemetry) return;

    let frameId = 0;
    let frames = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        setFps(Math.max(1, Math.round((frames * 1000) / elapsed)));
        frames = 0;
        lastTime = now;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [config.enabled, config.showTelemetry]);

  if (!config.enabled) return null;

  const visibleParticipants = config.showOnlySpeaking
    ? participants.filter(p => p.isSpeaking)
    : participants;

  const pingColor =
    rtcPing <= 45
      ? 'text-emerald-400'
      : rtcPing <= 100
      ? 'text-amber-400'
      : 'text-rose-400';

  const handleMuteClick = () => {
    onToggleMute();
    setIsMuted(!isMuted);
  };

  const handleDeafenClick = () => {
    onToggleDeafen();
    const next = !isDeafened;
    setIsDeafened(next);
    if (next) setIsMuted(true);
  };

  const handleReplySubmit = (e: React.FormEvent, toast: OverlayToast) => {
    e.preventDefault();
    const text = (replyDrafts[toast.id] || '').trim();
    if (!text || !onQuickReply) return;
    onQuickReply(toast.roomId, text);
    setReplyDrafts(prev => {
      const copy = { ...prev };
      delete copy[toast.id];
      return copy;
    });
    overlayService.dismissToast(toast.id);
  };

  const interactiveBodyClass = config.isInteractive
    ? 'pointer-events-auto'
    : 'pointer-events-none select-none';

  return (
    <div
      className={`fixed z-[70] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] ${POSITION_CLASSES[config.position]} ${
        config.isInteractive ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{ opacity: Math.max(0.25, Math.min(1, config.opacity)) }}
    >
      {/* Main Floating Voice & Telemetry HUD */}
      <div className="w-full rounded-xl bg-[#090d16]/90 backdrop-blur-md border border-cyan-500/30 shadow-[0_12px_36px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Compact Lock / Unlock HUD Bar (always interactive so user can unlock or close) */}
        <div className="pointer-events-auto flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-[#0d1322] to-[#121a2d] border-b border-white/10">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2fe]" />
            <span className="text-[11px] font-bold tracking-wide text-white truncate">
              PROTUTECH HUD
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
              {config.hotkey}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => overlayService.toggleInteractive()}
              title={config.isInteractive ? 'Lock HUD (Click-through)' : 'Unlock HUD (Interactive)'}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                config.isInteractive
                  ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
              }`}
            >
              {config.isInteractive ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
              <span>{config.isInteractive ? 'Unlocked' : 'Locked'}</span>
            </button>

            <button
              type="button"
              onClick={() => overlayService.updateConfig({ compactMode: !config.compactMode })}
              title={config.compactMode ? 'Expand Overlay' : 'Compact Mode'}
              className="w-6 h-6 rounded hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              {config.compactMode ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => overlayService.updateConfig({ enabled: false })}
              title="Close Overlay"
              className="w-6 h-6 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* HUD Body */}
        <div className={`p-2.5 space-y-2 ${interactiveBodyClass}`}>
          {/* Voice Room Status & Live Telemetry */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Radio
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  activeVoiceRoom ? 'text-emerald-400 animate-pulse' : 'text-gray-500'
                }`}
              />
              <span className="text-xs font-semibold text-white truncate">
                {activeVoiceRoom || 'Voice Standby'}
              </span>
            </div>

            {config.showTelemetry && (
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] font-mono">
                <span className={`px-1.5 py-0.5 rounded bg-black/50 border border-white/10 ${pingColor}`}>
                  {activeVoiceRoom ? `${rtcPing}ms` : '--ms'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-cyan-300 flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5" />
                  {fps} FPS
                </span>
              </div>
            )}
          </div>

          {/* Active Voice Participants */}
          {activeVoiceRoom ? (
            <div className="space-y-1">
              {visibleParticipants.length === 0 ? (
                <div className="text-[11px] text-gray-400 italic px-1 py-0.5">
                  {config.showOnlySpeaking ? 'No one speaking right now...' : 'Waiting for participants...'}
                </div>
              ) : (
                <div className={`flex flex-col gap-1 ${config.compactMode ? 'max-h-24' : 'max-h-40'} overflow-y-auto pr-0.5`}>
                  {visibleParticipants.map(p => (
                    <div
                      key={p.identity}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg border transition-all ${
                        p.isSpeaking
                          ? 'bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'bg-white/[0.03] border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 transition-all ${
                            p.isSpeaking
                              ? 'bg-emerald-600 ring-2 ring-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.85)]'
                              : 'bg-indigo-600/80'
                          }`}
                        >
                          {p.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span
                          className={`text-xs truncate ${
                            p.isSpeaking ? 'text-white font-semibold' : 'text-gray-300'
                          }`}
                        >
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {p.isMuted && <MicOff className="w-3 h-3 text-rose-400" />}
                        {p.isDeafened && <VolumeX className="w-3 h-3 text-rose-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            !config.compactMode && (
              <div className="text-[11px] text-gray-400 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                Join any voice channel or Discord call to display live speakers.
              </div>
            )
          )}

          {/* Voice Quick Controls (Interactive Mode + Connected) */}
          {config.isInteractive && activeVoiceRoom && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={handleMuteClick}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeafenClick}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDeafened
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>{isDeafened ? 'Undeafen' : 'Deafen'}</span>
              </button>

              <button
                type="button"
                onClick={onDisconnectVoice}
                title="Disconnect Voice"
                className="py-1.5 px-2.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 flex items-center justify-center transition-colors cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Discord / App Chat Toasts */}
      {config.showChatToasts && toasts.length > 0 && (
        <div className={`w-full flex flex-col gap-1.5 ${interactiveBodyClass}`}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="w-full rounded-xl bg-[#0b101c]/95 backdrop-blur-md border border-white/15 shadow-xl p-2.5 space-y-1.5 animate-fadeIn"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${
                      toast.source === 'discord'
                        ? 'bg-[#5865F2]/30 text-indigo-300 border border-[#5865F2]/50'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {toast.source === 'discord' ? 'Discord' : 'App'}
                  </span>
                  <span className="text-[11px] font-bold text-white truncate">
                    {toast.senderName}
                  </span>
                  <span className="text-[10px] text-gray-400 truncate">
                    #{toast.roomName}
                  </span>
                </div>

                {config.isInteractive && (
                  <button
                    type="button"
                    onClick={() => overlayService.dismissToast(toast.id)}
                    className="text-gray-500 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-200 line-clamp-2 break-words flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span>{toast.body}</span>
              </p>

              {config.isInteractive && onQuickReply && (
                <form
                  onSubmit={e => handleReplySubmit(e, toast)}
                  className="flex items-center gap-1 pt-0.5"
                >
                  <input
                    type="text"
                    value={replyDrafts[toast.id] || ''}
                    onChange={e =>
                      setReplyDrafts(prev => ({ ...prev, [toast.id]: e.target.value }))
                    }
                    placeholder={`Quick reply to #${toast.roomName}...`}
                    className="flex-1 bg-black/50 border border-white/15 focus:border-cyan-400 rounded-md px-2 py-1 text-[11px] text-white placeholder-gray-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!(replyDrafts[toast.id] || '').trim()}
                    className="px-2 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Send Reply"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
