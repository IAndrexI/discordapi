import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
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
      ? 'text-[var(--status-online)]'
      : rtcPing <= 100
      ? 'text-[var(--status-idle)]'
      : 'text-[var(--status-dnd)]';

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
      role="region"
      aria-label="Overlay HUD"
      className={`fixed z-[70] flex flex-col gap-2 w-80 max-w-[calc(100vw/var(--app-zoom,1)-2rem)] ${POSITION_CLASSES[config.position]} ${
        config.isInteractive ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{ opacity: Math.max(0.25, Math.min(1, config.opacity)) }}
    >
      {/* Main Floating Voice & Telemetry HUD */}
      <div className="w-full rounded-xl bg-[var(--bg-popout)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-[0_12px_36px_rgba(0,0,0,0.7)] overflow-hidden text-[var(--text-normal)]">
        {/* Compact Lock / Unlock HUD Bar (always interactive so user can unlock or close) */}
        <div className="pointer-events-auto flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-channels)] border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[var(--discord-blurple)] flex-shrink-0" />
            <span className="text-[11px] font-bold tracking-wide text-[var(--text-header)] truncate">
              Overlay HUD
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {config.hotkey}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => overlayService.toggleInteractive()}
              aria-label={config.isInteractive ? 'Lock overlay' : 'Unlock overlay'}
              aria-pressed={!config.isInteractive}
              title={config.isInteractive ? 'Lock (Click-through)' : 'Unlock (Interactive)'}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                config.isInteractive
                  ? 'bg-[var(--discord-blurple)]/15 text-[var(--text-header)] hover:bg-[var(--discord-blurple)]/25 border-[var(--discord-blurple)]/40'
                  : 'bg-[var(--status-idle)]/20 text-[var(--status-idle)] hover:bg-[var(--status-idle)]/30 border-[var(--status-idle)]/40'
              }`}
            >
              {config.isInteractive ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
              <span>{config.isInteractive ? 'Unlocked' : 'Locked'}</span>
            </button>

            <button
              type="button"
              onClick={() => overlayService.updateConfig({ compactMode: !config.compactMode })}
              aria-label={config.compactMode ? 'Expand overlay' : 'Compact overlay'}
              aria-pressed={config.compactMode}
              title={config.compactMode ? 'Expand' : 'Compact'}
              className="w-6 h-6 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer"
            >
              {config.compactMode ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => overlayService.updateConfig({ enabled: false })}
              aria-label="Close overlay"
              title="Close"
              className="w-6 h-6 rounded hover:bg-[var(--status-dnd)]/20 text-[var(--text-muted)] hover:text-[var(--status-dnd)] flex items-center justify-center transition-colors cursor-pointer"
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
                  activeVoiceRoom ? 'text-[var(--status-online)] animate-pulse' : 'text-[var(--text-muted)]'
                }`}
              />
              <span className="text-xs font-semibold text-[var(--text-header)] truncate">
                {activeVoiceRoom || 'Voice Standby'}
              </span>
            </div>

            {config.showTelemetry && (
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] font-mono">
                <span className={`px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] ${pingColor}`}>
                  {activeVoiceRoom ? `${rtcPing}ms` : '--ms'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-link)] flex items-center gap-1">
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
                <div className="text-[11px] text-[var(--text-muted)] italic px-1 py-0.5">
                  {config.showOnlySpeaking ? 'No active speakers' : 'No participants'}
                </div>
              ) : (
                <div className={`flex flex-col gap-1 ${config.compactMode ? 'max-h-24' : 'max-h-40'} overflow-y-auto pr-0.5`}>
                  {visibleParticipants.map(p => (
                    <div
                      key={p.identity}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg border transition-all ${
                        p.isSpeaking
                          ? 'bg-[var(--status-online)]/15 border-[var(--status-online)]/50'
                          : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 transition-all ${
                            p.isSpeaking
                              ? 'bg-[var(--status-online)] ring-2 ring-[var(--status-online)]/60'
                              : 'bg-[var(--discord-blurple)]'
                          }`}
                        >
                          {p.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span
                          className={`text-xs truncate ${
                            p.isSpeaking
                              ? 'text-[var(--text-header)] font-semibold'
                              : 'text-[var(--text-normal)]'
                          }`}
                        >
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {p.isMuted && <MicOff className="w-3 h-3 text-[var(--status-dnd)]" />}
                        {p.isDeafened && <VolumeX className="w-3 h-3 text-[var(--status-dnd)]" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            !config.compactMode && (
              <div className="text-[11px] text-[var(--text-muted)] px-2 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                Join a voice channel to see live speakers.
              </div>
            )
          )}

          {/* Voice Quick Controls (Interactive Mode + Connected) */}
          {config.isInteractive && activeVoiceRoom && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={handleMuteClick}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={isMuted}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                  isMuted
                    ? 'bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] border-[var(--status-dnd)]/40'
                    : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border-[var(--border-subtle)]'
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeafenClick}
                aria-label={isDeafened ? 'Undeafen audio' : 'Deafen audio'}
                aria-pressed={isDeafened}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                  isDeafened
                    ? 'bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] border-[var(--status-dnd)]/40'
                    : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border-[var(--border-subtle)]'
                }`}
              >
                {isDeafened ? (
                  <HeadphoneOff className="w-3.5 h-3.5" />
                ) : (
                  <Headphones className="w-3.5 h-3.5" />
                )}
                <span>{isDeafened ? 'Undeafen' : 'Deafen'}</span>
              </button>

              <button
                type="button"
                onClick={onDisconnectVoice}
                aria-label="Disconnect voice"
                title="Disconnect"
                className="py-1.5 px-2.5 rounded-lg bg-[var(--status-dnd)]/20 hover:bg-[var(--status-dnd)] text-[var(--status-dnd)] hover:text-white border border-[var(--status-dnd)]/40 flex items-center justify-center transition-colors cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Chat Toasts */}
      {config.showChatToasts && toasts.length > 0 && (
        <div className={`w-full flex flex-col gap-1.5 ${interactiveBodyClass}`}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="w-full rounded-xl bg-[var(--bg-popout)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-xl p-2.5 space-y-1.5 animate-fadeIn text-[var(--text-normal)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0 border ${
                      toast.source === 'discord'
                        ? 'bg-[var(--discord-blurple)]/20 text-[var(--text-header)] border-[var(--discord-blurple)]/40'
                        : 'bg-[var(--bg-card)] text-[var(--text-link)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {toast.source === 'discord' ? 'Bridge' : 'App'}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-header)] truncate">
                    {toast.senderName}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] truncate">
                    #{toast.roomName}
                  </span>
                </div>

                {config.isInteractive && (
                  <button
                    type="button"
                    onClick={() => overlayService.dismissToast(toast.id)}
                    aria-label="Dismiss notification"
                    className="text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex-shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="text-xs text-[var(--text-normal)] line-clamp-2 break-words flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 text-[var(--discord-blurple)] mt-0.5 flex-shrink-0" />
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
                    aria-label={`Quick reply to #${toast.roomName}`}
                    placeholder={`Reply to #${toast.roomName}...`}
                    className="flex-1 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-md px-2 py-1 text-[11px] text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!(replyDrafts[toast.id] || '').trim()}
                    aria-label="Send quick reply"
                    className="px-2 py-1 rounded-md bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Send"
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
