import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Settings,
} from 'lucide-react';
import { livekit } from '../services/livekit';

interface UserBarProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  onOpenSettings: () => void;
}

export const UserBar: React.FC<UserBarProps> = ({
  userId,
  displayName,
  avatarUrl,
  onOpenSettings,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    livekit.setMute(next);
  };

  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    if (next && !isMuted) {
      setIsMuted(true);
      livekit.setMute(true);
    }
  };

  const username = displayName || userId.split(':')[0].replace('@', '');
  const handle = userId.split(':')[0].replace('@', '');

  return (
    <div className="h-[52px] bg-[var(--bg-userpanel)] px-2 flex items-center justify-between select-none">
      {/* User Info (Left) */}
      <div className="flex items-center gap-2 p-1 -ml-1 rounded hover:bg-white/[0.08] cursor-pointer flex-1 min-w-0 transition-colors">
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-bold text-xs">
              {username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--status-online)] ring-2 ring-[var(--bg-userpanel)]" />
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[13px] font-semibold text-white truncate">{username}</span>
          <span className="text-[11px] text-[var(--text-muted)] truncate">@{handle}</span>
        </div>
      </div>

      {/* Action Buttons (Right) */}
      <div className="flex items-center text-[var(--text-muted)]">
        {/* Mute Button */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center transition-colors ${
            isMuted ? 'text-[var(--status-dnd)]' : 'hover:text-[var(--text-normal)]'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Deafen Button */}
        <button
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          className={`w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center transition-colors ${
            isDeafened ? 'text-[var(--status-dnd)]' : 'hover:text-[var(--text-normal)]'
          }`}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* User Settings Gear */}
        <button
          onClick={onOpenSettings}
          title="User Settings & Vencord"
          className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center hover:text-[var(--text-normal)] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
