import React, { useEffect, useState } from 'react';
import {
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Radio,
  Zap,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Mic,
  Volume2,
  Globe,
  SlidersHorizontal,
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
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  roomName,
  rtcPing,
  onDisconnect,
  onOpenCoBrowse,
  isCoBrowsing = false,
}) => {
  const [hasVideo, setHasVideo] = useState(() => livekit.isCameraEnabled());
  const [isScreenSharing, setIsScreenSharing] = useState(() => livekit.isScreenShareEnabled());
  const [isStudio, setIsStudio] = useState(livekit.isStudioAudio);
  const [isGamingMode, setIsGamingMode] = useState(livekit.isLowResourceGamingMode);
  const [micLoopback, setMicLoopback] = useState(() => livekit.isMicLoopbackEnabled());
  const [audioLevel, setAudioLevel] = useState(() => livekit.getAudioLevel());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [engineKind, setEngineKind] = useState(() => livekit.getEngineKind());
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
      setEngineKind(livekit.getEngineKind());
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
  const providerBadge = isProxy
    ? proxySession.provider === 'discord_proxy'
      ? { label: 'DISCORD PROXY', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
      : { label: 'STOAT HOSTED', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' }
    : engineKind === 'sfu'
      ? { label: 'SFU LIVE', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
      : { label: 'WEBRTC LIVE', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };

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

  const handleToggleMicLoopback = () => {
    const next = !micLoopback;
    livekit.setMicLoopback(next);
    setMicLoopback(next);
  };

  const handleOpenCoBrowse = () => {
    if (onOpenCoBrowse) {
      onOpenCoBrowse();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protutech:open-cobrowse'));
    }
  };

  return (
    <div className="bg-[var(--bg-userpanel)] border-b border-black/20 p-2.5 flex flex-col gap-2">
      {/* Voice Status & Latency */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-4 h-4 text-[var(--status-online)] animate-pulse flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-[var(--status-online)] leading-tight flex items-center gap-1.5 flex-wrap">
              <span>
                {isProxy
                  ? proxySession.provider === 'discord_proxy'
                    ? 'Discord Call'
                    : 'Stoat Call'
                  : 'Voice Connected'}
              </span>
              <span className={`px-1 py-0.2 rounded text-[9px] font-bold border ${providerBadge.bg}`}>
                {providerBadge.label}
              </span>
              <span className="bg-[var(--status-online)]/20 px-1 py-0.2 rounded text-[10px] font-mono flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                {rtcPing}ms RTC
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[155px]">
              {roomName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Quick Voice Settings */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            title="Audio Quality & Screenshare Settings"
            aria-label="Audio Quality & Screenshare Settings"
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showSettings
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Disconnect Button */}
          <button
            type="button"
            onClick={onDisconnect}
            title="Disconnect from Voice"
            aria-label="Disconnect from Voice"
            className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--status-dnd)] transition-colors cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Mic Audio Level Meter & Loopback Toggle */}
      <div className="flex items-center gap-2 bg-black/25 rounded-lg px-2 py-1 border border-white/5">
        <Mic
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isSpeaking ? 'text-emerald-400' : 'text-gray-400'
          }`}
        />
        <div
          className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden"
          title={`Microphone level: ${audioLevel}%`}
        >
          <div
            data-testid="voice-audio-level-bar"
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${audioLevel}%`,
              background:
                audioLevel > 75
                  ? 'linear-gradient(90deg, #10b981 0%, #eab308 75%, #ef4444 100%)'
                  : 'linear-gradient(90deg, #10b981 0%, #22d3ee 100%)',
            }}
          />
        </div>
        <button
          type="button"
          data-testid="voice-mic-loopback-btn"
          aria-label={micLoopback ? 'Disable Mic Test Loopback' : 'Enable Mic Test Loopback'}
          onClick={handleToggleMicLoopback}
          title="Hear your own microphone in real-time (Mic Test / Loopback)"
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0 ${
            micLoopback
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
              : 'bg-white/10 text-gray-300 hover:text-white hover:bg-white/15'
          }`}
        >
          <Volume2 className="w-3 h-3" />
          <span>{micLoopback ? 'Loopback ON' : 'Mic Test'}</span>
        </button>
      </div>

      {/* Voice Quality Settings Drawer */}
      {showSettings && (
        <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/20 space-y-2 text-xs animate-fadeIn">
          {/* Studio Audio (TeamSpeak Low-Latency / 48kHz Stereo) */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-gray-300">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Studio Voice (48kHz)</span>
            </span>
            <button
              type="button"
              onClick={handleToggleStudio}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isStudio
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/10 text-gray-400'
              }`}
            >
              {isStudio ? 'Enabled' : 'Standard'}
            </button>
          </div>

          {/* Low-Resource Gaming Mode (Zero Video / Minimal CPU while in game) */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="flex items-center gap-1 text-gray-300">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Gaming Mode (Low CPU)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const next = livekit.toggleGamingMode();
                setIsGamingMode(next);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isGamingMode
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/10 text-gray-400'
              }`}
              title="Pauses background incoming video streams to save CPU for maximum FPS while gaming"
            >
              {isGamingMode ? 'Optimized (<0.5%)' : 'Off'}
            </button>
          </div>

          {/* Screenshare Resolution */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-gray-300">Stream Quality</span>
            <select
              value={screenQuality}
              onChange={async (e) => {
                const val = e.target.value as ScreenQualityOption;
                setScreenQuality(val);
                if (isScreenSharing) {
                  await livekit.setScreenShare(true, val, selectedSourceId, includeSystemAudio);
                }
              }}
              className="bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-cyan-300 outline-none"
            >
              <option value="720p30">720p 30FPS</option>
              <option value="1080p60">1080p 60FPS (Nitro)</option>
              <option value="1440p60">1440p 60FPS</option>
              <option value="4k30">4K 30FPS (Studio)</option>
              <option value="4k60">4K 60FPS (Ultra)</option>
            </select>
          </div>

          {/* Camera Backgrounds */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="flex items-center gap-1 text-gray-300">
              <ImageIcon className="w-3 h-3 text-purple-400" />
              <span>Camera Background</span>
            </span>
            <button
              type="button"
              onClick={() => setShowBackgroundModal(true)}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-colors cursor-pointer"
            >
              Configure...
            </button>
          </div>
        </div>
      )}

      {/* Webcam Background Modal */}
      <WebcamBackgroundModal
        isOpen={showBackgroundModal}
        onClose={() => setShowBackgroundModal(false)}
      />

      {/* Screen Share Source & Quality Picker Modal */}
      <ScreenSharePickerModal
        isOpen={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onStartShare={handleStartScreenShareFromPicker}
      />

      {/* Media Action Buttons: Camera + 1-Click Go Live (+ Picker) + Co-Browse / Search */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          data-testid="voice-camera-btn"
          aria-label={hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
          onClick={toggleVideo}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
            hasVideo
              ? 'bg-[var(--status-online)] text-white shadow-md'
              : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.1]'
          }`}
          title={hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {hasVideo ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          <span>{hasVideo ? 'Cam On' : 'Camera'}</span>
        </button>

        <div className="flex-1 flex items-center gap-1">
          <button
            type="button"
            data-testid="voice-screen-btn"
            aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            onClick={handleQuickScreenShare}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
              isScreenSharing
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg animate-pulse'
                : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.1]'
            }`}
            title="1-Click Share Screen (1080p60)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{isScreenSharing ? 'Stop Stream' : 'Go Live'}</span>
          </button>

          <button
            type="button"
            data-testid="voice-screen-picker-btn"
            aria-label="Open Screen Share Source & Quality Picker"
            onClick={() => setShowScreenPicker(true)}
            title="Choose Screen / Window & Stream Quality"
            className="p-1.5 rounded bg-white/[0.06] hover:bg-white/[0.14] text-cyan-300 transition-colors cursor-pointer flex-shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Co-Browse / Search Together Button */}
      <button
        type="button"
        data-testid="voice-cobrowse-btn"
        aria-label="Open Co-Browse and Search Together"
        onClick={handleOpenCoBrowse}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
          isCoBrowsing
            ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-sm'
            : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border-indigo-500/30'
        }`}
        title="Search the web, Wikipedia, or watch videos together in this call"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-300" />
        <span>{isCoBrowsing ? 'Co-Browse Active' : 'Co-Browse / Search'}</span>
      </button>
    </div>
  );
};
