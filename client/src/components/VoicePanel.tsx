import React, { useEffect, useState } from 'react';
import {
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Signal,
  Zap,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Mic,
  Volume2,
  Globe,
  SlidersHorizontal,
  Music,
  ChevronDown,
} from 'lucide-react';
import { livekit } from '../services/livekit';
import { voiceProxy } from '../services/voiceProxy';
import { WebcamBackgroundModal } from './WebcamBackgroundModal';
import { ScreenSharePickerModal, type ScreenShareSelection } from './ScreenSharePickerModal';

type ScreenQualityOption = '720p30' | '1080p60' | '1440p60' | '4k30' | '4k60';

export interface VoicePanelProps {
  roomName: string;
  rtcPing: number;
  onDisconnect: () => void;
  onOpenCoBrowse?: () => void;
  isCoBrowsing?: boolean;
  onOpenSoundboard?: () => void;
  isSoundboardOpen?: boolean;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  roomName,
  rtcPing,
  onDisconnect,
  onOpenCoBrowse,
  isCoBrowsing = false,
  onOpenSoundboard,
  isSoundboardOpen = false,
}) => {
  const [hasVideo, setHasVideo] = useState(() => livekit.isCameraEnabled());
  const [isScreenSharing, setIsScreenSharing] = useState(() => livekit.isScreenShareEnabled());
  const [isStudio, setIsStudio] = useState(livekit.isStudioAudio);
  const [isGamingMode, setIsGamingMode] = useState(livekit.isLowResourceGamingMode);
  const [micLoopback, setMicLoopback] = useState(() => livekit.isMicLoopbackEnabled());
  const [audioLevel, setAudioLevel] = useState(() => livekit.getAudioLevel());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [proxySession, setProxySession] = useState(() => voiceProxy.getSession());

  const [screenQuality, setScreenQuality] = useState<ScreenQualityOption>('1080p60');
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined);
  const [includeSystemAudio, setIncludeSystemAudio] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showScreenPicker, setShowScreenPicker] = useState(false);

  useEffect(() => {
    const unsubVoice = livekit.subscribe((participants) => {
      const localId = livekit.getLocalIdentity();
      const local = participants.find((p) => p.identity === localId) || participants[0];
      setHasVideo(Boolean(local?.hasVideo && local?.videoTrack));
      setIsScreenSharing(Boolean(local?.hasScreenShare && local?.screenTrack));
      setIsStudio(livekit.isStudioAudio);
      setIsGamingMode(livekit.isLowResourceGamingMode);
      setMicLoopback(livekit.isMicLoopbackEnabled());
    });

    const unsubLevel = livekit.subscribeAudioLevel((level, speaking) => {
      setAudioLevel(level);
      setIsSpeaking(speaking);
    });

    const unsubProxy = voiceProxy.subscribe((session) => {
      setProxySession(session);
    });

    return () => {
      unsubVoice();
      unsubLevel();
      unsubProxy();
    };
  }, []);

  const isProxy = proxySession.status === 'connected';
  const connectionTitle = isProxy
    ? proxySession.provider === 'discord_proxy'
      ? 'Discord Call'
      : 'Stoat Call'
    : 'Voice Connected';

  const toggleVideo = async () => {
    const next = !hasVideo;
    const ok = await livekit.setCamera(next);
    if (ok) {
      setHasVideo(next);
    }
  };

  const handleQuickScreenShare = async () => {
    const next = !isScreenSharing;
    const ok = await livekit.setScreenShare(
      next,
      screenQuality,
      selectedSourceId,
      includeSystemAudio
    );
    if (ok) {
      setIsScreenSharing(next);
    }
  };

  const handleStartScreenShareFromPicker = async (selection: ScreenShareSelection) => {
    setShowScreenPicker(false);
    setScreenQuality(selection.quality);
    setSelectedSourceId(selection.sourceId);
    setIncludeSystemAudio(selection.includeAudio);

    const ok = await livekit.setScreenShare(
      true,
      selection.quality,
      selection.sourceId,
      selection.includeAudio
    );
    if (ok) {
      setIsScreenSharing(true);
    }
  };

  const handleToggleStudio = () => {
    const next = livekit.toggleStudioAudio();
    setIsStudio(next);
  };

  const handleToggleMicLoopback = async () => {
    const next = !micLoopback;
    setMicLoopback(next);
    const active = await livekit.setMicLoopback(next);
    setMicLoopback(active);
  };

  const handleOpenCoBrowse = () => {
    if (onOpenCoBrowse) {
      onOpenCoBrowse();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protutech:open-cobrowse'));
    }
  };

  const handleOpenSoundboard = () => {
    if (onOpenSoundboard) {
      onOpenSoundboard();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protutech:open-soundboard'));
    }
  };

  return (
    <div className="bg-[var(--bg-userpanel)] border-t border-b border-black/25 px-2.5 py-2 flex flex-col gap-2">
      {/* Voice Status & Latency Header */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Signal className="w-4 h-4 text-[var(--status-online)] flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-[var(--status-online)] leading-tight truncate">
              {connectionTitle}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate leading-tight">
              {roomName} • {rtcPing}ms
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            title="Audio Quality & Stream Settings"
            aria-label="Audio Quality & Stream Settings"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showSettings
                ? 'bg-[var(--bg-item-active)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onDisconnect}
            title="Disconnect"
            aria-label="Disconnect from Voice"
            className="w-7 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--status-dnd)] transition-colors cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Mic VU Bar & Hear Yourself (Playback) Pill */}
      <div className="flex items-center gap-1.5 bg-black/25 rounded-md px-2 py-1 border border-white/[0.06]">
        <Mic
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isSpeaking ? 'text-[var(--status-online)]' : 'text-[var(--text-muted)]'
          }`}
        />
        <div
          className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden"
          title={`Microphone level: ${audioLevel}%`}
        >
          <div
            data-testid="voice-audio-level-bar"
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${audioLevel}%`,
              background:
                audioLevel > 78
                  ? '#f23f43'
                  : audioLevel > 55
                    ? '#f0b232'
                    : '#23a55a',
            }}
          />
        </div>
        <button
          type="button"
          data-testid="voice-mic-loopback-btn"
          aria-label={micLoopback ? 'Disable Mic Playback' : 'Enable Mic Playback (Hear Yourself)'}
          onClick={() => void handleToggleMicLoopback()}
          title="Hear Yourself (Real-time Mic Playback)"
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0 border ${
            micLoopback
              ? 'bg-[#23a55a]/20 text-[#23a55a] border-[#23a55a]/45'
              : 'bg-white/[0.07] text-[var(--text-normal)] hover:text-white hover:bg-white/[0.12] border-transparent'
          }`}
        >
          <Volume2 className="w-3 h-3" />
          <span>{micLoopback ? 'Playback ON' : 'Hear Self'}</span>
        </button>
      </div>

      {/* Compact Voice Quality Settings Drawer */}
      {showSettings && (
        <div className="p-2.5 rounded-md bg-[#111214] border border-white/[0.08] space-y-2 text-xs animate-fadeIn">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[var(--text-normal)]">
              <Sparkles className="w-3 h-3 text-[#23a55a]" />
              <span>Studio Voice (48kHz)</span>
            </span>
            <button
              type="button"
              onClick={handleToggleStudio}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isStudio
                  ? 'bg-[#23a55a]/20 text-[#23a55a] border border-[#23a55a]/40'
                  : 'bg-white/10 text-[var(--text-muted)]'
              }`}
            >
              {isStudio ? 'Enabled' : 'Standard'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.06]">
            <span className="flex items-center gap-1.5 text-[var(--text-normal)]">
              <Zap className="w-3 h-3 text-[#f0b232]" />
              <span>Gaming Mode</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const next = livekit.toggleGamingMode();
                setIsGamingMode(next);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isGamingMode
                  ? 'bg-[#f0b232]/20 text-[#f0b232] border border-[#f0b232]/40'
                  : 'bg-white/10 text-[var(--text-muted)]'
              }`}
              title="Pauses background incoming video streams to save CPU while gaming"
            >
              {isGamingMode ? 'Low CPU' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.06]">
            <span className="text-[var(--text-normal)]">Stream Quality</span>
            <select
              value={screenQuality}
              onChange={async (e) => {
                const val = e.target.value as ScreenQualityOption;
                setScreenQuality(val);
                if (isScreenSharing) {
                  await livekit.setScreenShare(true, val, selectedSourceId, includeSystemAudio);
                }
              }}
              className="bg-[#1e1f22] border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-[#f2f3f5] outline-none"
            >
              <option value="720p30">720p 30FPS</option>
              <option value="1080p60">1080p 60FPS</option>
              <option value="1440p60">1440p 60FPS</option>
              <option value="4k30">4K 30FPS</option>
              <option value="4k60">4K 60FPS</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.06]">
            <span className="flex items-center gap-1.5 text-[var(--text-normal)]">
              <ImageIcon className="w-3 h-3 text-[#5865f2]" />
              <span>Camera Background</span>
            </span>
            <button
              type="button"
              onClick={() => setShowBackgroundModal(true)}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#5865f2]/20 text-[#dbdee1] border border-[#5865f2]/40 hover:bg-[#5865f2]/35 transition-colors cursor-pointer"
            >
              Configure
            </button>
          </div>
        </div>
      )}

      <WebcamBackgroundModal
        isOpen={showBackgroundModal}
        onClose={() => setShowBackgroundModal(false)}
        onTurnOnCamera={async () => {
          const ok = await livekit.setCamera(true);
          if (ok) setHasVideo(true);
        }}
      />

      <ScreenSharePickerModal
        isOpen={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onStartShare={handleStartScreenShareFromPicker}
      />

      {/* Uniform Discord Media Buttons Grid: Video (+Preview), Screen (+Picker), Soundboard, Co-Browse */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            data-testid="voice-camera-btn"
            aria-label={hasVideo ? 'Turn Off Video' : 'Turn On Video'}
            onClick={toggleVideo}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              hasVideo
                ? 'bg-[#23a55a] text-white hover:bg-[#1f9350]'
                : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.12] hover:text-white'
            }`}
            title={hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {hasVideo ? (
              <Video className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <VideoOff className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="truncate">Video</span>
          </button>

          <button
            type="button"
            data-testid="voice-camera-preview-btn"
            aria-label="Camera Preview and Virtual Backgrounds"
            onClick={() => setShowBackgroundModal(true)}
            title="Camera Preview & Virtual Backgrounds"
            className="p-1.5 rounded bg-white/[0.06] hover:bg-white/[0.14] text-[var(--text-normal)] hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            data-testid="voice-screen-btn"
            aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            onClick={handleQuickScreenShare}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              isScreenSharing
                ? 'bg-[#23a55a] text-white hover:bg-[#1f9350]'
                : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.12] hover:text-white'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{isScreenSharing ? 'Sharing' : 'Screen'}</span>
          </button>

          <button
            type="button"
            data-testid="voice-screen-picker-btn"
            aria-label="Open Screen Share Picker"
            onClick={() => setShowScreenPicker(true)}
            title="Choose Screen / Window & Stream Quality"
            className="p-1.5 rounded bg-white/[0.06] hover:bg-white/[0.14] text-[var(--text-normal)] hover:text-white transition-colors cursor-pointer flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          data-testid="voice-soundboard-btn"
          aria-label="Open Soundboard"
          onClick={handleOpenSoundboard}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
            isSoundboardOpen
              ? 'bg-[#5865f2] text-white'
              : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.12] hover:text-white'
          }`}
          title="Open Soundboard"
        >
          <Music className="w-3.5 h-3.5" />
          <span>Soundboard</span>
        </button>

        <button
          type="button"
          data-testid="voice-cobrowse-btn"
          aria-label="Open Co-Browse and Search Together"
          onClick={handleOpenCoBrowse}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
            isCoBrowsing
              ? 'bg-[#5865f2] text-white'
              : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.12] hover:text-white'
          }`}
          title="Co-Browse & Watch Together"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Co-Browse</span>
        </button>
      </div>
    </div>
  );
};
