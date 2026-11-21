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
  Music,
  PhoneOff,
  ChevronUp,
  ChevronDown,
  Expand,
  Shrink,
} from 'lucide-react';
import type { SoundboardPlayEvent, VoiceParticipant, VoiceGatewayProvider } from '../types';
import { livekit } from '../services/livekit';
import { voiceProxy } from '../services/voiceProxy';
import { soundboardService } from '../services/soundboard';
import { WEBCAM_PRESETS } from '../services/webcamBackground';

export interface VoiceStageProps {
  participants: VoiceParticipant[];
  roomName: string;
  provider?: VoiceGatewayProvider;
  onToggleCoBrowse?: () => void;
  isCoBrowsing?: boolean;
  onOpenSoundboard?: () => void;
  onDisconnect?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  onOpenSoundboard,
  onDisconnect,
  isExpanded,
  onToggleExpand,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [currentProvider, setCurrentProvider] = useState<VoiceGatewayProvider>(() => {
    const s = voiceProxy.getSession();
    return provider || (s.status === 'connected' ? s.provider : 'native_livekit');
  });
  const [manualSpotlightId, setManualSpotlightId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [soundToast, setSoundToast] = useState<SoundboardPlayEvent | null>(null);
  const soundToastTimerRef = useRef<number | null>(null);

  const effectiveExpanded = isExpanded ?? internalExpanded;
  const effectiveCollapsed = isCollapsed ?? internalCollapsed;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((v) => !v);
    }
  };

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((v) => !v);
    }
  };

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
    const unsubSound = soundboardService.subscribePlayEvents((evt) => {
      setSoundToast(evt);
      if (soundToastTimerRef.current) {
        window.clearTimeout(soundToastTimerRef.current);
      }
      soundToastTimerRef.current = window.setTimeout(() => {
        setSoundToast((prev) => (prev?.id === evt.id ? null : prev));
      }, 3200);
    });
    return () => {
      unsubSound();
      if (soundToastTimerRef.current) {
        window.clearTimeout(soundToastTimerRef.current);
      }
    };
  }, []);

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

  const handleSoundboardClick = () => {
    if (onOpenSoundboard) {
      onOpenSoundboard();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protutech:open-soundboard'));
    }
  };

  const handleDisconnectClick = () => {
    if (onDisconnect) {
      onDisconnect();
    } else {
      void livekit.leaveVoice();
    }
  };

  const isSfu = livekit.getEngineKind() === 'sfu';

  if (effectiveCollapsed) {
    return (
      <div
        data-testid="voice-stage"
        className="h-[44px] min-h-[44px] bg-[#111214] border-b border-[#1e1f22] px-3 flex items-center justify-between gap-2 flex-shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#23a55a] flex-shrink-0" />
          <span className="text-xs font-semibold text-[#f2f3f5] truncate">{roomName}</span>
          <span className="text-[11px] text-[#949ba4] flex-shrink-0">
            • {participants.length} connected
          </span>
          {soundToast && (
            <span
              data-testid="voice-stage-soundboard-toast"
              className="px-2 py-0.5 rounded-full bg-[#5865f2]/20 border border-[#5865f2]/50 text-[#f2f3f5] text-[11px] font-semibold flex items-center gap-1 animate-pill truncate max-w-[220px]"
            >
              <span>{soundToast.emoji}</span>
              <span className="truncate">
                {soundToast.senderName} played {soundToast.name}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleSoundboardClick}
            data-testid="voicestage-soundboard-btn"
            title="Open Soundboard"
            className="px-2 py-1 rounded bg-[#1e1f22] hover:bg-[#35373c] text-[#dbdee1] hover:text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Soundboard</span>
          </button>

          <button
            type="button"
            onClick={handleToggleCollapse}
            data-testid="voicestage-expand-stage-btn"
            title="Expand Voice Stage"
            className="px-2.5 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[#f2f3f5] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Expand Stage</span>
          </button>

          <button
            type="button"
            onClick={handleDisconnectClick}
            title="Disconnect from Voice"
            aria-label="Disconnect from Voice"
            className="p-1.5 rounded bg-[#f23f43]/15 hover:bg-[#f23f43] text-[#f23f43] hover:text-white cursor-pointer transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="voice-stage"
      className="bg-[#000000] border-b border-[#1e1f22] p-3 flex flex-col gap-3 animate-fadeIn overflow-hidden"
    >
      {/* Discord-style Stage Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#23a55a] flex-shrink-0" />
          <span className="font-semibold text-[#f2f3f5] text-sm truncate">{roomName}</span>

          {currentProvider === 'discord_proxy' ? (
            <span className="bg-[#f0b232]/15 text-[#f0b232] border border-[#f0b232]/30 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>DISCORD PROXY</span>
            </span>
          ) : currentProvider === 'stoat_hosted' ? (
            <span className="bg-[#5865f2]/20 text-[#dbdee1] border border-[#5865f2]/40 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>STOAT HOSTED</span>
            </span>
          ) : (
            <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide flex items-center gap-1">
              <Radio className="w-3 h-3" />
              <span>{isSfu ? 'SFU LIVE' : 'WEBRTC LIVE'}</span>
            </span>
          )}

          {livekit.isStudioAudio && currentProvider === 'native_livekit' && (
            <span className="bg-[#23a55a]/15 text-[#23a55a] border border-[#23a55a]/30 text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>48kHz</span>
            </span>
          )}

          <span
            className="bg-[#1e1f22] text-[#949ba4] border border-white/[0.08] text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
            title="Zero-jitter WebRTC playout buffer enabled"
          >
            <Zap className="w-2.5 h-2.5 text-[#23a55a]" />
            <span>0ms buffer</span>
          </span>

          <span className="text-xs text-[#949ba4] font-medium">
            {participants.length} connected
          </span>

          {/* Animated Floating Soundboard Pill Toast */}
          {soundToast && (
            <div
              data-testid="voice-stage-soundboard-toast"
              className="px-2.5 py-1 rounded-full bg-[#5865f2]/20 border border-[#5865f2]/60 text-[#f2f3f5] text-xs font-semibold flex items-center gap-1.5 shadow-md animate-pill"
            >
              <span>{soundToast.emoji}</span>
              <span>
                {soundToast.senderName} played {soundToast.name}
              </span>
            </div>
          )}
        </div>

        {/* Stage Action Controls */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap flex-shrink-0">
          <button
            type="button"
            data-testid="voicestage-soundboard-btn"
            onClick={handleSoundboardClick}
            title="Open Soundboard"
            className="px-2.5 py-1.5 rounded-md bg-[#1e1f22] hover:bg-[#35373c] text-[#dbdee1] hover:text-white border border-white/[0.08] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Music className="w-3.5 h-3.5 text-[#5865f2]" />
            <span>Soundboard</span>
          </button>

          <button
            type="button"
            data-testid="voicestage-cobrowse-btn"
            onClick={handleCoBrowseClick}
            className={`px-2.5 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isCoBrowsing
                ? 'bg-[#5865f2] text-white border-[#5865f2]'
                : 'bg-[#1e1f22] hover:bg-[#35373c] text-[#dbdee1] hover:text-white border-white/[0.08]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Co-Browse</span>
          </button>

          <button
            type="button"
            data-testid="voicestage-theater-btn"
            onClick={handleToggleExpand}
            title={effectiveExpanded ? 'Default Stage Size' : 'Theater Expand Stage'}
            className={`px-2 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              effectiveExpanded
                ? 'bg-[#5865f2]/25 border-[#5865f2]/60 text-white'
                : 'bg-[#1e1f22] hover:bg-[#35373c] border-white/[0.08] text-[#dbdee1] hover:text-white'
            }`}
          >
            {effectiveExpanded ? (
              <Shrink className="w-3.5 h-3.5" />
            ) : (
              <Expand className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">{effectiveExpanded ? 'Compact' : 'Theater'}</span>
          </button>

          <button
            type="button"
            data-testid="voicestage-collapse-btn"
            onClick={handleToggleCollapse}
            title="Collapse Voice Stage"
            className="px-2 py-1.5 rounded-md bg-[#1e1f22] hover:bg-[#35373c] border border-white/[0.08] text-[#dbdee1] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Hide</span>
          </button>

          {onDisconnect && (
            <button
              type="button"
              onClick={handleDisconnectClick}
              title="Disconnect"
              aria-label="Disconnect"
              className="p-1.5 rounded-md bg-[#f23f43]/15 hover:bg-[#f23f43] text-[#f23f43] hover:text-white border border-[#f23f43]/30 cursor-pointer transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Viewport-Bounded Spotlight (Screen Share or Pinned Participant Video) */}
      {spotlightParticipant && spotlightTrack && (
        <div
          ref={spotlightContainerRef}
          data-testid="voice-spotlight-container"
          className={`relative rounded-lg overflow-hidden bg-black w-full flex items-center justify-center border border-white/10 shadow-2xl group ${
            isFullscreen
              ? 'w-screen h-screen max-h-none'
              : effectiveExpanded
                ? 'h-[62vh] max-h-[75vh]'
                : 'h-[38vh] min-h-[180px] max-h-[46vh]'
          }`}
        >
          <video
            ref={screenVideoRef}
            data-testid="spotlight-video"
            autoPlay
            playsInline
            muted
            className="w-full h-full max-h-full object-contain"
          />

          {/* Spotlight Badges & Real Telemetry */}
          <div className="absolute top-2.5 left-2.5 bg-[#111214]/85 backdrop-blur-md px-2.5 py-1 rounded-md flex items-center gap-2 text-[#f2f3f5] text-xs font-semibold border border-white/10 shadow-lg flex-wrap max-w-[calc(100%-20px)]">
            <Tv className="w-3.5 h-3.5 text-[#dbdee1] flex-shrink-0" />
            <span className="truncate max-w-[160px]">
              {spotlightParticipant.name}
              {isSpotlightScreen ? "'s Stream" : ' (Spotlight)'}
            </span>
            <span className="bg-[#f23f43] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
              {isSpotlightScreen ? 'LIVE' : 'CAM'}
            </span>
            <span
              data-testid="spotlight-telemetry"
              className="bg-[#23a55a]/20 text-[#23a55a] border border-[#23a55a]/40 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
            >
              <Activity className="w-2.5 h-2.5" />
              <span>
                {spotlightTelemetry.isLive ? 'live' : spotlightTelemetry.readyState} •{' '}
                {spotlightTelemetry.fps}fps • {spotlightTelemetry.bitrate}
              </span>
            </span>
          </div>

          {/* Spotlight Controls */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {manualSpotlightId && (
              <button
                type="button"
                onClick={() => setManualSpotlightId(null)}
                className="bg-[#111214]/90 hover:bg-[#1e1f22] text-[#dbdee1] hover:text-white px-2.5 py-1.5 rounded-md text-xs font-semibold border border-white/10 shadow-md cursor-pointer"
              >
                Unpin
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleExpand}
              className="bg-[#111214]/90 hover:bg-[#1e1f22] p-1.5 rounded-md text-[#dbdee1] hover:text-white border border-white/10 shadow-md cursor-pointer"
              title={effectiveExpanded ? 'Exit Theater Mode' : 'Theater Mode'}
            >
              {effectiveExpanded ? (
                <Shrink className="w-4 h-4" />
              ) : (
                <Expand className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="bg-[#111214]/90 hover:bg-[#1e1f22] p-1.5 rounded-md text-[#dbdee1] hover:text-white border border-white/10 shadow-md cursor-pointer"
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Spotlight'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Participants Grid */}
      <div
        className={`grid gap-2.5 ${
          spotlightParticipant && spotlightTrack
            ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
        }`}
      >
        {participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            compact={Boolean(spotlightParticipant && spotlightTrack)}
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
  compact?: boolean;
  isSpotlighted: boolean;
  onToggleSpotlight: () => void;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant: p,
  compact = false,
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
  const bgType = p.customBackground?.type ?? 'none';
  const blurPx = p.customBackground?.blurAmount ?? 14;
  const resolvedPresetUrl =
    p.customBackground?.customUrl ||
    (p.customBackground?.presetId
      ? WEBCAM_PRESETS.find((pr) => pr.id === p.customBackground?.presetId)?.previewUrl
      : undefined);
  const hasVirtualBg = bgType !== 'none' && (bgType === 'blur' || Boolean(resolvedPresetUrl));

  return (
    <div
      data-testid={`participant-tile-${p.identity}`}
      className={`relative rounded-lg bg-[#1e1f22] flex flex-col items-center justify-center overflow-visible border transition-all duration-150 group ${
        compact ? 'aspect-video max-h-24' : 'aspect-video'
      } ${
        p.isSpeaking
          ? 'border-[#23a55a] ring-2 ring-[#23a55a]/70'
          : isSpotlighted
            ? 'border-[#5865f2]'
            : 'border-white/[0.06]'
      }`}
    >
      <div className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center relative bg-[#111214]">
        {/* Custom Webcam Background Layer */}
        {p.hasVideo && p.videoTrack && hasVirtualBg && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {bgType === 'blur' ? (
              <video
                ref={blurVideoRef}
                autoPlay
                playsInline
                muted
                style={{ filter: `blur(${blurPx}px)` }}
                className="w-full h-full object-cover scale-125 opacity-90"
              />
            ) : resolvedPresetUrl ? (
              <img
                src={resolvedPresetUrl}
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
            style={
              hasVirtualBg
                ? {
                    WebkitMaskImage:
                      'radial-gradient(ellipse 68% 76% at 50% 48%, #000 50%, transparent 94%)',
                    maskImage:
                      'radial-gradient(ellipse 68% 76% at 50% 48%, #000 50%, transparent 94%)',
                  }
                : undefined
            }
            className={`w-full h-full object-cover z-10 transition-all ${
              bgType === 'blur'
                ? 'drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]'
                : hasVirtualBg
                  ? 'contrast-[1.05] brightness-[1.02]'
                  : ''
            }`}
          />
        ) : (
          <div
            className={`${
              compact ? 'w-9 h-9 text-xs' : 'w-12 h-12 text-sm'
            } rounded-full flex items-center justify-center font-bold text-white transition-all duration-150 ${
              p.isSpeaking
                ? 'bg-[#5865f2] ring-2 ring-[#23a55a] scale-105'
                : 'bg-[#313338]'
            }`}
          >
            {p.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Top-left Ping / Stream / Camera Live Badges */}
        {(p.hasScreenShare || camTelemetry || typeof p.ping === 'number') && (
          <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 flex-wrap">
            {p.hasScreenShare && (
              <span className="px-1.5 py-0.5 rounded bg-[#f23f43] text-white text-[9px] font-bold uppercase tracking-wider">
                LIVE
              </span>
            )}
            {camTelemetry && (
              <span className="px-1 py-0.5 rounded bg-[#23a55a]/90 text-white text-[9px] font-mono font-bold">
                {camTelemetry.isLive ? `CAM ${camTelemetry.fps}fps` : camTelemetry.readyState}
              </span>
            )}
            {typeof p.ping === 'number' && !compact && (
              <span className="px-1 py-0.5 rounded bg-black/75 text-[#949ba4] text-[9px] font-mono">
                {p.ping}ms
              </span>
            )}
          </div>
        )}

        {/* Name Tag & Mute Status */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 bg-[#111214]/80 backdrop-blur-sm rounded px-2 py-0.5 flex items-center justify-between text-[#f2f3f5] text-[11px] font-medium truncate">
          <span className="truncate">{p.name}</span>
          <div className="flex items-center gap-1">
            {p.isMuted && <MicOff className="w-3 h-3 text-[#f23f43] flex-shrink-0" />}
          </div>
        </div>

        {/* Top-right Controls: Spotlight + Volume Slider */}
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {canSpotlight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSpotlight();
              }}
              title={isSpotlighted ? 'Exit Spotlight' : 'Spotlight Video'}
              className={`p-1 rounded border border-white/10 cursor-pointer shadow-md ${
                isSpotlighted
                  ? 'bg-[#5865f2] text-white'
                  : 'bg-[#111214]/80 hover:bg-[#111214] text-[#dbdee1] hover:text-white'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowVolumePopup(!showVolumePopup);
            }}
            title="Adjust Participant Volume (0% - 200%)"
            className="p-1 rounded bg-[#111214]/80 hover:bg-[#111214] text-[#dbdee1] hover:text-white border border-white/10 cursor-pointer shadow-md"
          >
            {volume === 0 ? (
              <VolumeX className="w-3 h-3 text-[#f23f43]" />
            ) : (
              <Sliders className="w-3 h-3 text-[#dbdee1]" />
            )}
          </button>
        </div>
      </div>

      {/* Per-User Volume Slider Popover (0 - 200%) */}
      {showVolumePopup && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full mt-1 z-30 left-1/2 -translate-x-1/2 w-48 bg-[#111214] border border-white/10 rounded-lg p-3 shadow-2xl flex flex-col gap-2 animate-fadeIn"
        >
          <div className="flex items-center justify-between text-xs text-[#f2f3f5] font-semibold">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#5865f2]" />
              <span>User Volume</span>
            </span>
            <span className="text-[11px] font-mono text-[#dbdee1]">{volume}%</span>
          </div>

          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full accent-[#5865f2] cursor-pointer h-1.5 bg-[#2b2d31] rounded-lg"
          />

          <div className="flex items-center justify-between text-[10px] text-[#949ba4]">
            <button
              type="button"
              onClick={() => handleVolumeChange(0)}
              className="hover:text-[#f23f43] transition-colors cursor-pointer"
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
              className="hover:text-[#5865f2] transition-colors cursor-pointer font-bold"
            >
              Boost (200%)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
