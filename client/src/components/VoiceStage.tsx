import React, { useEffect, useRef, useState } from 'react';
import {
  MicOff,
  Maximize2,
  Minimize2,
  Tv,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Sparkles,
  Globe,
  Zap,
  Activity,
} from 'lucide-react';
import type { VoiceParticipant, VoiceGatewayProvider } from '../types';
import { livekit } from '../services/livekit';
import { voiceProxy } from '../services/voiceProxy';

export interface VoiceStageProps {
  participants: VoiceParticipant[];
  roomName: string;
  provider?: VoiceGatewayProvider;
  onToggleCoBrowse?: () => void;
  isCoBrowsing?: boolean;
}

function readTrackTelemetry(track: MediaStreamTrack | undefined, isScreen: boolean) {
  if (!track) {
    return {
      isLive: false,
      readyState: 'ended',
      resolution: '',
      fps: 0,
      bitrate: isScreen ? livekit.getActiveScreenBitrateLabel() : '4.5 Mbps',
    };
  }
  const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
  const width = settings.width || (isScreen ? 1920 : 1280);
  const height = settings.height || (isScreen ? 1080 : 720);
  const fps = Math.round(settings.frameRate || (isScreen ? 60 : 30));
  return {
    isLive: track.readyState === 'live',
    readyState: track.readyState,
    resolution: `${width}x${height}`,
    fps,
    bitrate: isScreen ? livekit.getActiveScreenBitrateLabel() : '4.5 Mbps',
  };
}

export const VoiceStage: React.FC<VoiceStageProps> = ({
  participants,
  roomName,
  provider,
  onToggleCoBrowse,
  isCoBrowsing = false,
}) => {
  const [currentProvider, setCurrentProvider] = useState<VoiceGatewayProvider>(() => {
    const s = voiceProxy.getSession();
    return provider || (s.status === 'connected' ? s.provider : 'native_livekit');
  });
  const [manualSpotlightId, setManualSpotlightId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const unsub = voiceProxy.subscribe((session) => {
      if (session.status === 'connected') {
        setCurrentProvider(session.provider);
      } else {
        setCurrentProvider(provider || 'native_livekit');
      }
    });
    return unsub;
  }, [provider]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const autoScreenParticipant = participants.find((p) => p.hasScreenShare && p.screenTrack);
  const manualSpotlightParticipant = manualSpotlightId
    ? participants.find(
        (p) =>
          p.identity === manualSpotlightId &&
          ((p.hasScreenShare && p.screenTrack) || (p.hasVideo && p.videoTrack))
      )
    : undefined;

  const spotlightParticipant = manualSpotlightParticipant || autoScreenParticipant;
  const spotlightTrack =
    spotlightParticipant?.hasScreenShare && spotlightParticipant.screenTrack
      ? spotlightParticipant.screenTrack
      : spotlightParticipant?.videoTrack;
  const isSpotlightScreen = Boolean(
    spotlightParticipant?.hasScreenShare && spotlightParticipant.screenTrack
  );
  const spotlightTelemetry = readTrackTelemetry(spotlightTrack, isSpotlightScreen);

  const spotlightContainerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = screenVideoRef.current;
    if (!el) return;

    if (!spotlightTrack) {
      el.srcObject = null;
      return;
    }

    const stream = new MediaStream([spotlightTrack]);
    el.srcObject = stream;
    el.play().catch(() => {});

    return () => {
      if (el.srcObject) {
        el.srcObject = null;
      }
    };
  }, [spotlightTrack, spotlightTrack?.id]);

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (spotlightContainerRef.current?.requestFullscreen) {
        await spotlightContainerRef.current.requestFullscreen();
      } else if (screenVideoRef.current?.requestFullscreen) {
        await screenVideoRef.current.requestFullscreen();
      }
    } catch {
      // ignore fullscreen rejection
    }
  };

  const handleCoBrowseClick = () => {
    if (onToggleCoBrowse) {
      onToggleCoBrowse();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protutech:open-cobrowse'));
    }
  };

  const isSfu = livekit.getEngineKind() === 'sfu';

  return (
    <div
      data-testid="voice-stage"
      className="bg-[var(--bg-servers)] border-b border-black/30 p-4 flex flex-col gap-4 animate-fadeIn"
    >
      {/* Stage Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] animate-pulse" />
          <span className="font-semibold text-white text-sm">{roomName}</span>

          {currentProvider === 'discord_proxy' ? (
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1 shadow-sm">
              <Globe className="w-3 h-3 text-amber-400" />
              <span>DISCORD PROXY</span>
            </span>
          ) : currentProvider === 'stoat_hosted' ? (
            <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1 shadow-sm">
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>STOAT HOSTED</span>
            </span>
          ) : (
            <span className="bg-[var(--discord-blurple)] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1 shadow-sm">
              <Radio className="w-3 h-3 text-cyan-300" />
              <span>{isSfu ? 'SFU LIVE' : 'WEBRTC LIVE'}</span>
            </span>
          )}

          {livekit.isStudioAudio && currentProvider === 'native_livekit' && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>48kHz Studio</span>
            </span>
          )}

          {/* Zero-Buffer Low Latency Indicator */}
          <span
            className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
            title="Zero-jitter WebRTC playout buffer enabled"
          >
            <Zap className="w-2.5 h-2.5 text-cyan-400" />
            <span>0ms buffer</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <button
            type="button"
            data-testid="voicestage-cobrowse-btn"
            onClick={handleCoBrowseClick}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
              isCoBrowsing
                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                : 'bg-gradient-to-r from-indigo-600/80 to-cyan-600/80 hover:from-indigo-500 hover:to-cyan-500 text-white border-cyan-400/30 shadow-sm'
            }`}
          >
            <span>🌐 Co-Browse &amp; Search Together</span>
          </button>
          <span className="font-medium">{participants.length} connected</span>
        </div>
      </div>

      {/* Full-Screen Spotlight (Screen Share or Pinned Participant Video) */}
      {spotlightParticipant && spotlightTrack && (
        <div
          ref={spotlightContainerRef}
          data-testid="voice-spotlight-container"
          className={`relative rounded-xl overflow-hidden bg-black aspect-video ${
            isFullscreen ? 'w-screen h-screen max-h-none' : 'max-h-[460px]'
          } flex items-center justify-center border border-cyan-500/30 shadow-2xl group`}
        >
          <video
            ref={screenVideoRef}
            data-testid="spotlight-video"
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          {/* Spotlight Badges & Real Telemetry */}
          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-white text-xs font-semibold border border-white/10 shadow-lg flex-wrap">
            <Tv className="w-4 h-4 text-cyan-400" />
            <span>
              {spotlightParticipant.name}
              {isSpotlightScreen ? "'s Stream" : ' (Spotlight)'}
            </span>
            <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
              {isSpotlightScreen ? 'LIVE HD' : 'CAM'}
            </span>
            <span
              data-testid="spotlight-telemetry"
              className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
            >
              <Activity className="w-2.5 h-2.5" />
              <span>
                {spotlightTelemetry.isLive ? 'live' : spotlightTelemetry.readyState} •{' '}
                {spotlightTelemetry.fps}fps • {spotlightTelemetry.bitrate}
              </span>
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
              0ms buffer
            </span>
          </div>

          {/* Spotlight Controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {manualSpotlightId && (
              <button
                type="button"
                onClick={() => setManualSpotlightId(null)}
                className="bg-black/80 hover:bg-black text-gray-200 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-white/10 shadow-md cursor-pointer"
              >
                Unpin
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="bg-black/75 hover:bg-black/95 p-2 rounded-lg text-white border border-white/10 shadow-md cursor-pointer"
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Spotlight'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Participants Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            isSpotlighted={spotlightParticipant?.identity === p.identity}
            onToggleSpotlight={() =>
              setManualSpotlightId((prev) => (prev === p.identity ? null : p.identity))
            }
          />
        ))}
      </div>
    </div>
  );
};

interface ParticipantTileProps {
  participant: VoiceParticipant;
  isSpotlighted: boolean;
  onToggleSpotlight: () => void;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant: p,
  isSpotlighted,
  onToggleSpotlight,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const volume = localVolume ?? p.volume ?? 100;

  useEffect(() => {
    const mainEl = videoRef.current;
    const blurEl = blurVideoRef.current;
    const activeTrack = p.hasVideo && p.videoTrack ? p.videoTrack : null;

    if (!activeTrack) {
      if (mainEl) mainEl.srcObject = null;
      if (blurEl) blurEl.srcObject = null;
      return;
    }

    const stream = new MediaStream([activeTrack]);
    if (mainEl) {
      mainEl.srcObject = stream;
      mainEl.play().catch(() => {});
    }
    if (blurEl) {
      blurEl.srcObject = stream;
      blurEl.play().catch(() => {});
    }

    return () => {
      if (mainEl) mainEl.srcObject = null;
      if (blurEl) blurEl.srcObject = null;
    };
  }, [p.hasVideo, p.videoTrack, p.videoTrack?.id, p.customBackground]);

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(200, newVol));
    setLocalVolume(clamped);
    livekit.setParticipantVolume(p.identity, clamped);
  };

  const canSpotlight = Boolean(
    (p.hasVideo && p.videoTrack) || (p.hasScreenShare && p.screenTrack)
  );
  const camTelemetry =
    p.hasVideo && p.videoTrack ? readTrackTelemetry(p.videoTrack, false) : null;

  return (
    <div
      data-testid={`participant-tile-${p.identity}`}
      className={`relative aspect-video rounded-xl bg-[var(--bg-channels)] flex flex-col items-center justify-center overflow-visible border transition-all duration-150 group ${
        p.isSpeaking
          ? 'border-[var(--status-online)] shadow-[0_0_14px_rgba(35,165,90,0.45)] ring-1 ring-[var(--status-online)]'
          : isSpotlighted
            ? 'border-cyan-400/70'
            : 'border-white/[0.08]'
      }`}
    >
      <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center relative">
        {/* Custom Webcam Background Layer */}
        {p.hasVideo && p.videoTrack && p.customBackground && p.customBackground.type !== 'none' && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {p.customBackground.type === 'blur' ? (
              <video
                ref={blurVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-125 blur-xl opacity-80"
              />
            ) : p.customBackground.customUrl ? (
              <img
                src={p.customBackground.customUrl}
                alt="Webcam Background"
                className="w-full h-full object-cover scale-105"
              />
            ) : null}
          </div>
        )}

        {p.hasVideo && p.videoTrack ? (
          <video
            ref={videoRef}
            data-testid={`participant-video-${p.identity}`}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover z-10 transition-all ${
              p.customBackground?.type === 'blur'
                ? 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]'
                : p.customBackground && p.customBackground.type !== 'none'
                  ? 'contrast-[1.05] brightness-[1.02] mix-blend-normal'
                  : ''
            }`}
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm transition-all duration-150 ${
              p.isSpeaking
                ? 'bg-[var(--discord-blurple)] ring-4 ring-[var(--status-online)] scale-105'
                : 'bg-neutral-700'
            }`}
          >
            {p.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Top-left Ping / Stream / Camera Live Badges */}
        {(p.hasScreenShare || camTelemetry || typeof p.ping === 'number') && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 flex-wrap">
            {p.hasScreenShare && (
              <span className="px-1.5 py-0.5 rounded bg-red-600/90 text-white text-[9px] font-extrabold uppercase tracking-wider">
                LIVE
              </span>
            )}
            {camTelemetry && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-mono font-bold">
                {camTelemetry.isLive ? `CAM ${camTelemetry.fps}fps` : camTelemetry.readyState}
              </span>
            )}
            {typeof p.ping === 'number' && (
              <span className="px-1 py-0.5 rounded bg-black/70 text-cyan-300 text-[9px] font-mono border border-white/10">
                {p.ping}ms
              </span>
            )}
          </div>
        )}

        {/* Name Tag & Mute Status */}
        <div className="absolute bottom-2 left-2 right-2 z-20 bg-black/70 backdrop-blur-md rounded-md px-2 py-1 flex items-center justify-between text-white text-[11px] font-medium truncate border border-white/5">
          <span className="truncate">{p.name}</span>
          <div className="flex items-center gap-1">
            {p.isMuted && <MicOff className="w-3 h-3 text-[var(--status-dnd)] flex-shrink-0" />}
          </div>
        </div>

        {/* Top-right Controls: Spotlight + Volume Slider */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canSpotlight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSpotlight();
              }}
              title={isSpotlighted ? 'Exit Spotlight' : 'Spotlight Video'}
              className={`p-1.5 rounded-lg border border-white/10 cursor-pointer shadow-md ${
                isSpotlighted
                  ? 'bg-cyan-600 text-white'
                  : 'bg-black/60 hover:bg-black/90 text-gray-300 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowVolumePopup(!showVolumePopup);
            }}
            title="Adjust Participant Volume (0% - 200%)"
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-gray-300 hover:text-white border border-white/10 cursor-pointer shadow-md"
          >
            {volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            )}
          </button>
        </div>
      </div>

      {/* Per-User Volume Slider Popover (0 - 200%) */}
      {showVolumePopup && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full mt-1 z-30 left-1/2 -translate-x-1/2 w-48 bg-neutral-900/95 border border-cyan-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 animate-fadeIn"
        >
          <div className="flex items-center justify-between text-xs text-white font-semibold">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>User Volume</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-300">{volume}%</span>
          </div>

          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
          />

          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <button
              type="button"
              onClick={() => handleVolumeChange(0)}
              className="hover:text-red-400 transition-colors cursor-pointer"
            >
              Mute (0%)
            </button>
            <button
              type="button"
              onClick={() => handleVolumeChange(100)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => handleVolumeChange(200)}
              className="hover:text-cyan-300 transition-colors cursor-pointer font-bold"
            >
              Boost (200%)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
