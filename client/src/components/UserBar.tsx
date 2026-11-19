import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Settings,
  Terminal,
  Layers,
  UserCog,
  Crown,
  Check,
  X,
} from 'lucide-react';
import { livekit } from '../services/livekit';
import {
  userProfileService,
  type UserProfileCustomizations,
} from '../services/userProfile';
import { overlayService, type OverlayConfig } from '../services/overlay';

export interface UserBarProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  onOpenSettings: () => void;
  onOpenMinecraftConsole?: () => void;
  onOpenProfile?: () => void;
  onToggleOverlay?: () => void;
}

const STATUS_EMOJIS = ['⚡', '🎮', '🎧', '💻', '🔥', '🚀', '☕', '🌙'];

export const UserBar: React.FC<UserBarProps> = ({
  userId,
  displayName,
  avatarUrl,
  onOpenSettings,
  onOpenMinecraftConsole,
  onOpenProfile,
  onToggleOverlay,
}) => {
  const [isMuted, setIsMuted] = useState(livekit.isMuted);
  const [isDeafened, setIsDeafened] = useState(livekit.isDeafened);
  const [profile, setProfile] = useState<UserProfileCustomizations>(() =>
    userProfileService.getProfile()
  );
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() =>
    overlayService.getConfig()
  );
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusDraft, setStatusDraft] = useState(profile.customStatus);
  const [statusEmoji, setStatusEmoji] = useState(profile.customStatusEmoji || '⚡');

  useEffect(() => {
    const unsubProfile = userProfileService.subscribe(next => {
      setProfile(next);
      setStatusDraft(next.customStatus);
      setStatusEmoji(next.customStatusEmoji || '⚡');
    });
    const unsubOverlay = overlayService.subscribe(nextCfg => {
      setOverlayConfig(nextCfg);
    });
    const unsubVoice = livekit.subscribe(() => {
      setIsMuted(livekit.isMuted);
      setIsDeafened(livekit.isDeafened);
    });
    return () => {
      unsubProfile();
      unsubOverlay();
      unsubVoice();
    };
  }, []);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    void livekit.setMute(next);
  };

  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    if (next && !isMuted) {
      setIsMuted(true);
      void livekit.setMute(true);
    }
    livekit.setDeafened(next);
  };

  const handleStatusChange = (newStatus: 'online' | 'idle' | 'dnd' | 'offline') => {
    userProfileService.updateProfile({ presence: newStatus });
    setShowStatusPicker(false);
  };

  const handleSaveCustomStatus = (e: React.FormEvent) => {
    e.preventDefault();
    userProfileService.updateProfile({
      customStatus: statusDraft.trim(),
      customStatusEmoji: statusEmoji,
    });
    setShowStatusPicker(false);
  };

  const handleClearCustomStatus = () => {
    setStatusDraft('');
    userProfileService.updateProfile({ customStatus: '' });
  };

  const handleCycleEmoji = () => {
    const idx = STATUS_EMOJIS.indexOf(statusEmoji);
    setStatusEmoji(STATUS_EMOJIS[(idx + 1) % STATUS_EMOJIS.length]);
  };

  const handleOverlayToggle = () => {
    if (onToggleOverlay) {
      onToggleOverlay();
    } else {
      overlayService.toggleEnabled();
    }
  };

  const username =
    profile.displayName.trim() || displayName || userId.split(':')[0].replace('@', '');
  const effectiveAvatar = profile.avatarUrl.trim() || avatarUrl;
  const presence = profile.presence;
  const decorationClass = userProfileService.getDecorationClass(profile.avatarDecoration);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-[var(--status-online)]';
      case 'idle':
        return 'bg-[var(--status-idle)]';
      case 'dnd':
        return 'bg-[var(--status-dnd)]';
      case 'offline':
      default:
        return 'bg-[var(--status-offline)]';
    }
  };

  const statusSubtitle = profile.customStatus.trim()
    ? `${profile.customStatusEmoji ? `${profile.customStatusEmoji} ` : ''}${profile.customStatus.trim()}`
    : presence === 'dnd'
    ? 'Do Not Disturb'
    : presence === 'offline'
    ? 'Invisible'
    : presence;

  return (
    <div className="h-[52px] bg-[var(--bg-userpanel)] px-2 flex items-center justify-between select-none relative gap-1">
      {/* Status & Custom Profile Popover */}
      {showStatusPicker && (
        <div className="absolute bottom-[58px] left-2 w-64 bg-[var(--bg-popout)] border border-white/10 rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Set Presence
            </span>
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  setShowStatusPicker(false);
                  onOpenProfile();
                }}
                className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <UserCog className="w-3 h-3" />
                <span>Customize Profile</span>
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {(
              [
                {
                  id: 'online',
                  label: 'Online',
                  desc: 'Active and available',
                  color: 'bg-[var(--status-online)]',
                },
                {
                  id: 'idle',
                  label: 'Idle',
                  desc: 'Away from keyboard',
                  color: 'bg-[var(--status-idle)]',
                },
                {
                  id: 'dnd',
                  label: 'Do Not Disturb',
                  desc: 'Mutes notifications',
                  color: 'bg-[var(--status-dnd)]',
                },
                {
                  id: 'offline',
                  label: 'Invisible',
                  desc: 'Appear offline to others',
                  color: 'bg-[var(--status-offline)]',
                },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleStatusChange(opt.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-white/10 transition-colors text-left cursor-pointer ${
                  presence === opt.id ? 'bg-white/10' : ''
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${opt.color} flex-shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Custom Status Input */}
          <form
            onSubmit={handleSaveCustomStatus}
            className="pt-2 border-t border-white/10 space-y-1.5"
          >
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              Custom Status
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCycleEmoji}
                title="Change Status Emoji"
                className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 hover:border-cyan-400/50 flex items-center justify-center text-sm cursor-pointer flex-shrink-0"
              >
                {statusEmoji}
              </button>
              <input
                type="text"
                value={statusDraft}
                onChange={e => setStatusDraft(e.target.value)}
                placeholder="What's on your mind?"
                maxLength={64}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 focus:border-cyan-400 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-500 outline-none"
              />
              {statusDraft && (
                <button
                  type="button"
                  onClick={handleClearCustomStatus}
                  title="Clear Custom Status"
                  className="w-6 h-7 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="submit"
                title="Save Custom Status"
                className="w-7 h-7 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center cursor-pointer flex-shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Info (Left) with status selector */}
      <div
        onClick={() => setShowStatusPicker(!showStatusPicker)}
        className="flex items-center gap-2 p-1 -ml-1 rounded hover:bg-white/[0.08] cursor-pointer flex-1 min-w-0 transition-colors"
        title="Click to change status or custom message"
      >
        <div className="relative flex-shrink-0">
          <div className={`rounded-full ${decorationClass}`}>
            {effectiveAvatar ? (
              <img
                src={effectiveAvatar}
                alt={username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-bold text-xs">
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {profile.avatarDecoration === 'discord_crown' && (
            <Crown className="w-3 h-3 text-amber-400 absolute -top-1.5 -right-0.5 drop-shadow" />
          )}
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${getStatusColor(
              presence
            )} ring-2 ring-[var(--bg-userpanel)]`}
          />
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[13px] font-semibold text-white truncate">{username}</span>
          <span className="text-[11px] text-[var(--text-muted)] truncate">{statusSubtitle}</span>
        </div>
      </div>

      {/* Action Buttons (Right) */}
      <div className="flex items-center text-[var(--text-muted)] flex-shrink-0">
        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer ${
            isMuted ? 'text-[var(--status-dnd)]' : 'hover:text-[var(--text-normal)]'
          }`}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Deafen Button */}
        <button
          type="button"
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          className={`w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer ${
            isDeafened ? 'text-[var(--status-dnd)]' : 'hover:text-[var(--text-normal)]'
          }`}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* Optional In-Game Overlay Quick Toggle */}
        <button
          type="button"
          onClick={handleOverlayToggle}
          title={
            overlayConfig.enabled
              ? `Disable In-Game Overlay (${overlayConfig.hotkey})`
              : `Enable Optional In-Game Overlay (${overlayConfig.hotkey})`
          }
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
            overlayConfig.enabled
              ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_8px_rgba(0,242,254,0.3)]'
              : 'hover:bg-white/10 hover:text-[var(--text-normal)]'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Minecraft RCON Console Trigger */}
        {onOpenMinecraftConsole && (
          <button
            type="button"
            onClick={onOpenMinecraftConsole}
            title="Minecraft Server Console & Logs"
            className="w-7 h-7 rounded hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Terminal className="w-4 h-4" />
          </button>
        )}

        {/* User Settings Gear */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="User Settings & Vencord"
          className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center hover:text-[var(--text-normal)] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
