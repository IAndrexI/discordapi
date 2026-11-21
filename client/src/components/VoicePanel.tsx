import React, { useEffect, useRef, useState } from 'react';
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
import { webcamBackground } from '../services/webcamBackground';
import { WebcamBackgroundModal } from './WebcamBackgroundModal';
import { ScreenSharePickerModal, type ScreenShareSelection } from './ScreenSharePickerModal';

type ScreenQualityOption = '720p30' | '1080p60' | '1440p60' | '4k30' | '4k60';

const STORAGE_KEY_SCREEN_QUALITY = 'protutech_screen_quality';
const VALID_SCREEN_QUALITIES: readonly ScreenQualityOption[] = [
  '720p30',
  '1080p60',
  '1440p60',
  '4k30',
  '4k60',
];

function readStoredScreenQuality(): ScreenQualityOption {
  try {
    if (typeof localStorage === 'undefined') return '1080p60';
    const saved = localStorage.getItem(STORAGE_KEY_SCREEN_QUALITY) as ScreenQualityOption | null;
    if (saved && VALID_SCREEN_QUALITIES.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return '1080p60';
}

function writeStoredScreenQuality(quality: ScreenQualityOption): void {
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

export interface VoicePanelProps {
  roomName: string;
  rtcPing: number;
  onDisconnect: () => void;
  onOpenCoBrowse?: () => void;
  isCoBrowsing?: boolean;
  onOpenSoundboard?: () => void;
  isSoundboardOpen?: boolean;
  onOpenCameraPreview?: () => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  roomName,
  rtcPing,
  onDisconnect,
  onOpenCoBrowse,
  isCoBrowsing = false,
  onOpenSoundboard,
  isSoundboardOpen = false,
  onOpenCameraPreview,
}) => {
  const [hasVideo, setHasVideo] = useState(() => livekit.isCameraEnabled());
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [activeBgName, setActiveBgName] = useState(() =>
    webcamBackground.getBackgroundDisplayName()
  );
  const [isScreenSharing, setIsScreenSharing] = useState(() => livekit.isScreenShareEnabled());
  const [isStudio, setIsStudio] = useState(livekit.isStudioAudio);
  const [isGamingMode, setIsGamingMode] = useState(livekit.isLowResourceGamingMode);
  const [micLoopback, setMicLoopback] = useState(() => livekit.isMicLoopbackEnabled());
  const [audioLevel, setAudioLevel] = useState(() => livekit.getAudioLevel());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [proxySession, setProxySession] = useState(() => voiceProxy.getSession());

  const [screenQuality, setScreenQuality] = useState<ScreenQualityOption>(() =>
    readStoredScreenQuality()
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined);
  const [includeSystemAudio, setIncludeSystemAudio] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showScreenPicker, setShowScreenPicker] = useState(false);

  const miniVideoRef = useRef<HTMLVideoElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubVoice = livekit.subscribe((participants) => {
      const localId = livekit.getLocalIdentity();
      const local = participants.find((p) => p.identity === localId) || participants[0];
      const videoActive = Boolean(local?.hasVideo && local?.videoTrack);
      setHasVideo(videoActive);
      setLocalVideoTrack(videoActive && local?.videoTrack ? local.videoTrack : null);
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

    const unsubBg = webcamBackground.subscribe((cfg) => {
      setActiveBgName(webcamBackground.getBackgroundDisplayName(cfg));
    });

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SCREEN_QUALITY) {
        setScreenQuality(readStoredScreenQuality());
      }
    };
    const onCustomQualityChange = () => {
      setScreenQuality(readStoredScreenQuality());
    };
    window.addEventListener('storage', onStorageChange);
    window.addEventListener('protutech:screen-quality-changed', onCustomQualityChange);

    return () => {
      unsubVoice();
      unsubLevel();
      unsubProxy();
      unsubBg();
      window.removeEventListener('storage', onStorageChange);
      window.removeEventListener('protutech:screen-quality-changed', onCustomQualityChange);
    };
  }, []);

  useEffect(() => {
    const el = miniVideoRef.current;
    if (!el) return;
    if (!hasVideo || !localVideoTrack) {
      el.srcObject = null;
      return;
    }
    const stream = new MediaStream([localVideoTrack]);
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [hasVideo, localVideoTrack]);

  useEffect(() => {
    if (!showSettings) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        settingsPopoverRef.current?.contains(target) ||
        settingsBtnRef.current?.contains(target)
      ) {
        return;
      }
      setShowSettings(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettings]);

  const isProxy = proxySession.status === 'connected';
  const connectionTitle = isProxy
    ? proxySession.provider === 'discord_proxy'
      ? 'Bridged Call'
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
    writeStoredScreenQuality(selection.quality);
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

  const handleOpenCameraPreview = () => {
    setShowSettings(false);
    if (onOpenCameraPreview) {
      onOpenCameraPreview();
    } else {
      setShowBackgroundModal(true);
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
    <div className="relative bg-[var(--bg-userpanel)] border-t border-b border-[var(--border-subtle)] px-2.5 py-2 flex flex-col gap-2">
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
            ref={settingsBtnRef}
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            title="Audio Quality & Stream Settings"
            aria-label="Audio Quality & Stream Settings"
            aria-expanded={showSettings}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showSettings
                ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
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

      {/* Compact Live Mini Webcam Preview Strip when Camera is Active */}
      {hasVideo && (
        <div
          data-testid="voice-mini-camera-preview"
          className="flex items-center gap-2 p-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)]"
        >
          <div className="relative w-12 h-8 rounded overflow-hidden bg-[var(--bg-popout)] border border-[var(--border-subtle)] flex-shrink-0">
            <video
              ref={miniVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-[var(--status-online)] animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <span className="font-semibold text-[var(--status-online)] truncate">
                Camera Active
              </span>
              {activeBgName !== 'None' && (
                <span className="text-[var(--text-muted)] truncate max-w-[70px]">
                  {activeBgName}
                </span>
              )}
            </div>
            <button
              type="button"
              data-testid="voice-mini-preview-btn"
              onClick={handleOpenCameraPreview}
              aria-label="Backgrounds & Preview"
              className="w-full text-left px-1.5 py-0.5 rounded bg-[var(--discord-blurple)]/20 hover:bg-[var(--discord-blurple)]/35 border border-[var(--discord-blurple)]/40 text-[10px] font-semibold text-[var(--text-header)] truncate transition-colors cursor-pointer"
            >
              Backgrounds &amp; Preview
            </button>
          </div>
        </div>
      )}

      {/* Compact Mic VU Bar & Hear Yourself (Playback) Pill */}
      <div className="flex items-center gap-1.5 bg-[var(--bg-popout)] rounded-md px-2 py-1 border border-[var(--border-subtle)]">
        <Mic
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isSpeaking ? 'text-[var(--status-online)]' : 'text-[var(--text-muted)]'
          }`}
        />
        <div
          className="flex-1 h-1.5 bg-[var(--bg-channels)] rounded-full overflow-hidden"
          title={`Microphone level: ${audioLevel}%`}
        >
          <div
            data-testid="voice-audio-level-bar"
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${audioLevel}%`,
              background:
                audioLevel > 78
                  ? 'var(--status-dnd)'
                  : audioLevel > 55
                    ? 'var(--status-idle)'
                    : 'var(--status-online)',
            }}
          />
        </div>
        <button
          type="button"
          data-testid="voice-mic-loopback-btn"
          aria-label={micLoopback ? 'Disable Mic Playback' : 'Hear Self'}
          aria-pressed={micLoopback}
          onClick={() => void handleToggleMicLoopback()}
          title="Hear Self (Mic Playback)"
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0 border ${
            micLoopback
              ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] border-[var(--status-online)]/45'
              : 'bg-[var(--bg-card)] text-[var(--text-normal)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] border-[var(--border-subtle)]'
          }`}
        >
          <Volume2 className="w-3 h-3" />
          <span>{micLoopback ? 'Playback ON' : 'Hear Self'}</span>
        </button>
      </div>

      {/* Floating Upward Voice Quality Settings Popover */}
      {showSettings && (
        <div
          ref={settingsPopoverRef}
          role="dialog"
          aria-label="Voice Settings"
          className="absolute bottom-full mb-2 left-2 right-2 z-[90] max-h-[calc(55vh/var(--app-zoom,1))] overflow-y-auto shadow-2xl p-2.5 rounded-lg bg-[var(--bg-popout)] border border-[var(--border-subtle)] space-y-2 text-xs animate-fadeIn"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[var(--text-normal)]">
              <Sparkles className="w-3 h-3 text-[var(--status-online)]" />
              <span>Studio Voice (48kHz)</span>
            </span>
            <button
              type="button"
              onClick={handleToggleStudio}
              aria-pressed={isStudio}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isStudio
                  ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] border border-[var(--status-online)]/40'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
              }`}
            >
              {isStudio ? 'Enabled' : 'Standard'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
            <span className="flex items-center gap-1.5 text-[var(--text-normal)]">
              <Zap className="w-3 h-3 text-[var(--status-idle)]" />
              <span>Gaming Mode</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const next = livekit.toggleGamingMode();
                setIsGamingMode(next);
              }}
              aria-pressed={isGamingMode}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isGamingMode
                  ? 'bg-[var(--status-idle)]/20 text-[var(--status-idle)] border border-[var(--status-idle)]/40'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
              }`}
              title="Pauses background video streams to save CPU"
            >
              {isGamingMode ? 'Low CPU' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
            <span className="text-[var(--text-normal)]">Stream Quality</span>
            <select
              aria-label="Stream Quality"
              value={screenQuality}
              onChange={async (e) => {
                const val = e.target.value as ScreenQualityOption;
                setScreenQuality(val);
                writeStoredScreenQuality(val);
                if (isScreenSharing) {
                  await livekit.setScreenShare(true, val, selectedSourceId, includeSystemAudio);
                }
              }}
              className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 text-[11px] text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
            >
              <option value="720p30">720p 30FPS</option>
              <option value="1080p60">1080p 60FPS</option>
              <option value="1440p60">1440p 60FPS</option>
              <option value="4k30">4K 30FPS</option>
              <option value="4k60">4K 60FPS</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
            <span className="flex items-center gap-1.5 text-[var(--text-normal)]">
              <ImageIcon className="w-3 h-3 text-[var(--discord-blurple)]" />
              <span>Camera Preview</span>
            </span>
            <button
              type="button"
              onClick={handleOpenCameraPreview}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--discord-blurple)]/20 text-[var(--text-header)] border border-[var(--discord-blurple)]/40 hover:bg-[var(--discord-blurple)]/35 transition-colors cursor-pointer"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {!onOpenCameraPreview && (
        <WebcamBackgroundModal
          isOpen={showBackgroundModal}
          onClose={() => setShowBackgroundModal(false)}
          onTurnOnCamera={async () => {
            const ok = await livekit.setCamera(true);
            if (ok) setHasVideo(true);
          }}
        />
      )}

      <ScreenSharePickerModal
        isOpen={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onStartShare={handleStartScreenShareFromPicker}
      />

      {/* Media Controls Grid: Video (+Preview), Screen (+Picker), Sounds, Browse */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            data-testid="voice-camera-btn"
            aria-label={hasVideo ? 'Turn Off Video' : 'Turn On Video'}
            aria-pressed={hasVideo}
            onClick={toggleVideo}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              hasVideo
                ? 'bg-[var(--status-online)] text-white hover:opacity-90'
                : 'bg-[var(--bg-card)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] border border-[var(--border-subtle)]'
            }`}
            title={hasVideo ? 'Turn Off Video' : 'Video'}
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
            aria-label="Preview"
            onClick={handleOpenCameraPreview}
            title="Preview"
            className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[var(--text-normal)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex-shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            data-testid="voice-screen-btn"
            aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            aria-pressed={isScreenSharing}
            onClick={handleQuickScreenShare}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
              isScreenSharing
                ? 'bg-[var(--status-online)] text-white hover:opacity-90'
                : 'bg-[var(--bg-card)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] border border-[var(--border-subtle)]'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Screen'}
          >
            <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{isScreenSharing ? 'Sharing' : 'Screen'}</span>
          </button>

          <button
            type="button"
            data-testid="voice-screen-picker-btn"
            aria-label="Open Screen Share Picker"
            onClick={() => setShowScreenPicker(true)}
            title="Choose Screen & Quality"
            className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[var(--text-normal)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          data-testid="voice-soundboard-btn"
          aria-label="Sounds"
          aria-pressed={isSoundboardOpen}
          onClick={handleOpenSoundboard}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer border ${
            isSoundboardOpen
              ? 'bg-[var(--discord-blurple)] text-white border-[var(--discord-blurple)]'
              : 'bg-[var(--bg-card)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
          }`}
          title="Sounds"
        >
          <Music className="w-3.5 h-3.5" />
          <span>Sounds</span>
        </button>

        <button
          type="button"
          data-testid="voice-cobrowse-btn"
          aria-label="Browse"
          aria-pressed={isCoBrowsing}
          onClick={handleOpenCoBrowse}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer border ${
            isCoBrowsing
              ? 'bg-[var(--discord-blurple)] text-white border-[var(--discord-blurple)]'
              : 'bg-[var(--bg-card)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
          }`}
          title="Browse"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Browse</span>
        </button>
      </div>
    </div>
  );
};
