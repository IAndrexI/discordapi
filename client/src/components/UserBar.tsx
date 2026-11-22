import React, { useEffect, useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Settings,
  Terminal,
  Layers,
  UserCog,
  Crown,
  Check,
  X,
  Ear,
  Music,
  Camera,
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
  onOpenSoundboard?: () => void;
  isSoundboardOpen?: boolean;
  onOpenCameraPreview?: () => void;
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
  onOpenSoundboard,
  isSoundboardOpen = false,
  onOpenCameraPreview,
}) => {
  const [isMuted, setIsMuted] = useState(livekit.isMuted);
  const [isDeafened, setIsDeafened] = useState(livekit.isDeafened);
  const [isLoopback, setIsLoopback] = useState(() => livekit.isMicLoopbackEnabled());
  const [profile, setProfile] = useState<UserProfileCustomizations>(() =>
    userProfileService.getProfile()
  );
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() =>
    overlayService.getConfig()
  );
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [customStatusEmoji, setCustomStatusEmoji] = useState<string>(() => {
    try {
      return localStorage.getItem('protutech_custom_status_emoji') || '⚡';
    } catch {
      return '⚡';
    }
  });
  const updateStatusEmoji = (emoji: string) => {
    setCustomStatusEmoji(emoji);
    try {
      localStorage.setItem('protutech_custom_status_emoji', emoji);
    } catch {
      // Ignore
    }
  };
  const [statusDraft, setStatusDraft] = useState(profile.customStatus);
  const [statusEmoji, setStatusEmoji] = useState(profile.customStatusEmoji || '⚡');
  const popoverRef = useRef<HTMLDivElement>(null);

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
      setIsLoopback(livekit.isMicLoopbackEnabled());
    });
    const unsubAudio = livekit.subscribeAudioLevel(() => {
      setIsLoopback(livekit.isMicLoopbackEnabled());
    });
    return () => {
      unsubProfile();
      unsubOverlay();
      unsubVoice();
      unsubAudio();
    };
  }, []);

  useEffect(() => {
    if (!showStatusPicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowStatusPicker(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowStatusPicker(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showStatusPicker]);

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

  const toggleMicLoopback = async () => {
    const next = !isLoopback;
    setIsLoopback(next);
    await livekit.setMicLoopback(next);
    setIsLoopback(livekit.isMicLoopbackEnabled());
  };

  const handleCameraPreviewClick = () => {
    if (onOpenCameraPreview) {
      onOpenCameraPreview();
    } else {
      window.dispatchEvent(new CustomEvent('protutech:open-camera-preview'));
    }
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
    ? 'Busy'
    : presence === 'offline'
    ? 'Invisible'
    : presence;

  return (
    <div
      ref={popoverRef}
      className="h-[52px] w-full bg-[var(--bg-userpanel)] px-1.5 flex items-center justify-between select-none relative gap-1 flex-shrink-0 border-t border-[var(--border-subtle)]"
    >
      {/* Status & Custom Profile Popover */}
      {showStatusPicker && (
        <div
          role="dialog"
          aria-label="Status"
          className="fixed bottom-[60px] left-[80px] w-64 max-w-[calc(100vw/var(--app-zoom,1)-24px)] max-h-[calc(100vh/var(--app-zoom,1)-96px)] overflow-y-auto bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-lg shadow-2xl p-2.5 z-[9999] space-y-2 text-[var(--text-normal)]"
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Status
            </span>
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  setShowStatusPicker(false);
                  onOpenProfile();
                }}
                aria-label="Edit Profile"
                className="text-[11px] font-semibold text-[var(--text-link)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserCog className="w-3 h-3" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {(
              [
                {
                  id: 'online',
                  label: 'Online',
                  color: 'bg-[var(--status-online)]',
                },
                {
                  id: 'idle',
                  label: 'Idle',
                  color: 'bg-[var(--status-idle)]',
                },
                {
                  id: 'dnd',
                  label: 'Busy',
                  color: 'bg-[var(--status-dnd)]',
                },
                {
                  id: 'offline',
                  label: 'Invisible',
                  color: 'bg-[var(--status-offline)]',
                },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleStatusChange(opt.id)}
                aria-label={opt.label}
                aria-pressed={presence === opt.id}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] transition-colors text-left cursor-pointer ${
                  presence === opt.id ? 'bg-[var(--bg-item-active)]' : ''
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${opt.color} flex-shrink-0`} />
                <span className="font-semibold flex-1">{opt.label}</span>
                {presence === opt.id && (
                  <Check className="w-3.5 h-3.5 text-[var(--discord-blurple)] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Custom Status Emoji Picker (Preset Strip + Custom Input) */}
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              <span>Status Emoji</span>
              <span className="text-sm">{customStatusEmoji}</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap px-1">
              {['⚡', '🎮', '🎵', '💤', '🔥', '🧊', '🚀', 'o7', '¯\\_(ツ)_/¯'].map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => updateStatusEmoji(em)}
                  className={`px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${
                    customStatusEmoji === em
                      ? 'bg-[var(--discord-blurple)] text-white'
                      : 'bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customStatusEmoji}
              onChange={e => updateStatusEmoji(e.target.value)}
              placeholder="Any emoji or ASCII..."
              aria-label="Custom status emoji"
              className="w-full rounded bg-[var(--bg-channels)] border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-header)] focus:border-[var(--discord-blurple)] focus:outline-none"
            />
          </div>

          {/* Custom Status Input */}
          <form
            onSubmit={handleSaveCustomStatus}
            className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5"
          >
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              Custom Status
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCycleEmoji}
                aria-label="Change status emoji"
                title="Change Emoji"
                className="w-7 h-7 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--discord-blurple)] flex items-center justify-center text-sm cursor-pointer flex-shrink-0"
              >
                {statusEmoji}
              </button>
              <input
                type="text"
                value={statusDraft}
                onChange={e => setStatusDraft(e.target.value)}
                aria-label="Custom status text"
                placeholder="Set status..."
                maxLength={64}
                className="flex-1 min-w-0 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded px-2 py-1 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none"
              />
              {statusDraft && (
                <button
                  type="button"
                  onClick={handleClearCustomStatus}
                  aria-label="Clear custom status"
                  title="Clear"
                  className="w-6 h-7 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center cursor-pointer flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Save custom status"
                title="Save"
                className="w-7 h-7 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white flex items-center justify-center cursor-pointer flex-shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Quick Utilities */}
          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleOverlayToggle}
              aria-label="Toggle Overlay"
              aria-pressed={overlayConfig.enabled}
              className="flex-1 px-2 py-1 rounded text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] flex items-center justify-center gap-1 cursor-pointer"
              title="Toggle Overlay"
            >
              <Layers className="w-3 h-3" />
              <span>Overlay: {overlayConfig.enabled ? 'On' : 'Off'}</span>
            </button>
            {onOpenMinecraftConsole && (
              <button
                type="button"
                onClick={() => {
                  setShowStatusPicker(false);
                  onOpenMinecraftConsole();
                }}
                aria-label="Open Minecraft Console"
                className="flex-1 px-2 py-1 rounded text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] flex items-center justify-center gap-1 cursor-pointer"
                title="MC Console"
              >
                <Terminal className="w-3 h-3" />
                <span>MC Console</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* User Info (Left) */}
      <button
        type="button"
        onClick={() => setShowStatusPicker(prev => !prev)}
        aria-label="Account status"
        aria-expanded={showStatusPicker}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 p-1 rounded hover:bg-[var(--bg-item-hover)] cursor-pointer flex-1 min-w-0 transition-colors text-left"
        title="Status"
      >
        <div className="relative flex-shrink-0">
          <div className={`rounded-full ${decorationClass}`}>
            {effectiveAvatar ? (
              <img
                src={effectiveAvatar}
                alt={username}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-bold text-[11px]">
                {username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {profile.avatarDecoration === 'discord_crown' && (
            <Crown className="w-3 h-3 text-[var(--status-idle)] absolute -top-1.5 -right-0.5" />
          )}
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${getStatusColor(
              presence
            )} ring-2 ring-[var(--bg-userpanel)]`}
          />
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[12px] font-semibold text-[var(--text-header)] truncate">
              {username}
            </span>
            {isLoopback && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)] animate-pulse flex-shrink-0"
                title="Mic Playback Active"
              />
            )}
          </div>
          <span className="text-[10px] text-[var(--text-muted)] truncate capitalize">
            {statusSubtitle}
          </span>
        </div>
      </button>

      {/* Uniform Action Buttons (Right) */}
      <div className="flex items-center gap-0.5 text-[var(--text-muted)] flex-shrink-0">
        {/* Mute */}
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          aria-pressed={isMuted}
          title={isMuted ? 'Unmute' : 'Mute'}
          className={`w-6 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center transition-colors cursor-pointer ${
            isMuted ? 'text-[var(--status-dnd)]' : 'hover:text-[var(--text-header)]'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        {/* Deafen */}
        <button
          type="button"
          onClick={toggleDeafen}
          aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
          aria-pressed={isDeafened}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          className={`w-6 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center transition-colors cursor-pointer ${
            isDeafened ? 'text-[var(--status-dnd)]' : 'hover:text-[var(--text-header)]'
          }`}
        >
          {isDeafened ? (
            <HeadphoneOff className="w-3.5 h-3.5" />
          ) : (
            <Headphones className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Mic Playback / Hear Yourself */}
        <button
          type="button"
          onClick={() => void toggleMicLoopback()}
          data-testid="userbar-loopback-btn"
          aria-label="Mic Playback"
          aria-pressed={isLoopback}
          title="Mic Playback"
          className={`w-6 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
            isLoopback
              ? 'text-[var(--status-online)] bg-[var(--status-online)]/15 hover:bg-[var(--status-online)]/25'
              : 'hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
          }`}
        >
          <Ear className="w-3.5 h-3.5" />
        </button>

        {/* Camera Preview & Backgrounds */}
        <button
          type="button"
          onClick={handleCameraPreviewClick}
          data-testid="userbar-camera-preview-btn"
          aria-label="Camera Preview"
          title="Camera Preview & Backgrounds"
          className="w-6 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center hover:text-[var(--text-header)] transition-colors cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        {/* Soundboard */}
        <button
          type="button"
          onClick={() => onOpenSoundboard?.()}
          data-testid="userbar-soundboard-btn"
          aria-label="Soundboard"
          aria-expanded={isSoundboardOpen}
          aria-pressed={isSoundboardOpen}
          title="Soundboard"
          className={`w-6 h-7 rounded flex items-center justify-center transition-colors cursor-pointer ${
            isSoundboardOpen
              ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
              : 'hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
        </button>

        {/* User Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="w-6 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center hover:text-[var(--text-header)] transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
