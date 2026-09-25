import React, { useState } from 'react';
import {
  Video,
  Monitor,
  PhoneOff,
  Radio,
  Zap,
} from 'lucide-react';
import { livekit } from '../services/livekit';

interface VoicePanelProps {
  roomName: string;
  rtcPing: number;
  onDisconnect: () => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  roomName,
  rtcPing,
  onDisconnect,
}) => {
  const [hasVideo, setHasVideo] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleVideo = async () => {
    const next = !hasVideo;
    setHasVideo(next);
    await livekit.setCamera(next);
  };

  const toggleScreen = async () => {
    const next = !isScreenSharing;
    const ok = await livekit.setScreenShare(next);
    if (ok) {
      setIsScreenSharing(next);
    }
  };

  return (
    <div className="bg-[var(--bg-userpanel)] border-b border-black/20 p-2.5 flex flex-col gap-2">
      {/* Voice Status & Latency */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[var(--status-online)] animate-pulse" />
          <div>
            <div className="text-[12px] font-bold text-[var(--status-online)] leading-tight flex items-center gap-1.5">
              <span>Voice Connected</span>
              <span className="bg-[var(--status-online)]/20 px-1 py-0.2 rounded text-[10px] font-mono flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                {rtcPing}ms RTC
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]">
              {roomName}
            </div>
          </div>
        </div>

        {/* Disconnect Button */}
        <button
          onClick={onDisconnect}
          title="Disconnect from Voice"
          className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--status-dnd)] transition-colors"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>

      {/* Media Action Buttons */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          onClick={toggleVideo}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-colors ${
            hasVideo
              ? 'bg-[var(--status-online)] text-white'
              : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.1]'
          }`}
          title="Turn On Camera"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Camera</span>
        </button>

        <button
          onClick={toggleScreen}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-semibold transition-colors ${
            isScreenSharing
              ? 'bg-[var(--discord-blurple)] text-white shadow-lg'
              : 'bg-white/[0.06] text-[var(--text-normal)] hover:bg-white/[0.1]'
          }`}
          title="Share Your Screen (1080p 60FPS)"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>{isScreenSharing ? 'Streaming' : 'Share'}</span>
        </button>
      </div>
    </div>
  );
};
