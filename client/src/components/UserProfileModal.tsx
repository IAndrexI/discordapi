import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Gamepad2,
  Send,
  Shield,
  X,
  Sparkles,
  Crown,
  Edit3,
  Globe,
} from 'lucide-react';
import type { MatrixUser } from '../types';
import { steamService, POPULAR_STEAM_GAMES } from '../services/steam';
import { matrix } from '../services/matrix';
import {
  userProfileService,
  type UserProfileCustomizations,
} from '../services/userProfile';

export interface UserProfileModalProps {
  user: MatrixUser | null;
  onClose: () => void;
  onSendGameInvite?: (inviteMsg: string) => void;
  isOwnProfile?: boolean;
  onOpenProfileCustomization?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  onClose,
  onSendGameInvite,
  isOwnProfile,
  onOpenProfileCustomization,
}) => {
  const [selectedGame, setSelectedGame] = useState(POPULAR_STEAM_GAMES[0].name);
  const [customLobby, setCustomLobby] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [ownProfile, setOwnProfile] = useState<UserProfileCustomizations>(() =>
    userProfileService.getProfile()
  );
  const [fallbackNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const unsub = userProfileService.subscribe(setOwnProfile);
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user, onClose]);

  if (!user) return null;

  const isSelf = Boolean(isOwnProfile || (matrix.getUserId() && user.userId === matrix.getUserId()));
  const extUser = user as MatrixUser &
    Partial<UserProfileCustomizations> & { isDiscordBridged?: boolean };

  const displayName = (isSelf && ownProfile.displayName.trim()) || extUser.displayName;
  const avatarUrl = (isSelf && ownProfile.avatarUrl.trim()) || extUser.avatarUrl;
  const presence = (isSelf ? ownProfile.presence : extUser.presence) || 'online';
  const pronouns = (isSelf && ownProfile.pronouns.trim()) || extUser.pronouns || '';
  const bio = (isSelf && ownProfile.bio.trim()) || extUser.bio || '';
  const customStatus = (isSelf && ownProfile.customStatus.trim()) || extUser.statusMsg || '';
  const customStatusEmoji = isSelf
    ? ownProfile.customStatusEmoji
    : extUser.customStatusEmoji || '';
  const bannerColor = (isSelf && ownProfile.bannerColor) || extUser.bannerColor || '';
  const bannerUrl = (isSelf && ownProfile.bannerUrl.trim()) || extUser.bannerUrl || '';
  const accentColor = (isSelf && ownProfile.accentColor) || extUser.accentColor || '';
  const avatarDecoration =
    (isSelf ? ownProfile.avatarDecoration : extUser.avatarDecoration) || 'none';
  const badges =
    (isSelf && ownProfile.badges.length > 0 ? ownProfile.badges : extUser.badges) || [];
  const isDiscordBridged = Boolean(
    extUser.isDiscordBridged ||
      user.userId.includes('_discord_') ||
      user.userId.includes('discord_')
  );

  const decorationClass = userProfileService.getDecorationClass(avatarDecoration);

  // Discord account creation calculation or seed
  const discordCreated = user.discordJoinDate
    ? new Date(user.discordJoinDate)
    : new Date(fallbackNow - 1000 * 60 * 60 * 24 * 365 * 2.5);

  // Server join date
  const serverJoined = user.serverJoinDate
    ? new Date(user.serverJoinDate)
    : new Date(fallbackNow - 1000 * 60 * 60 * 24 * 180);

  // Time in voice calls
  const voiceMinutes = user.voiceTimeMinutes ?? 1420;
  const voiceHours = (voiceMinutes / 60).toFixed(1);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const gamePreset =
      POPULAR_STEAM_GAMES.find(g => g.name === selectedGame) || POPULAR_STEAM_GAMES[0];
    const invite = steamService.createGameInvite({
      gameName: gamePreset.name,
      steamAppId: gamePreset.appId,
      lobbyId: customLobby.trim() || undefined,
      inviterName: 'You',
    });

    const msg = steamService.formatInviteMessage(invite);
    if (onSendGameInvite) {
      onSendGameInvite(msg);
    }
    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} profile`}
        className="w-[min(28rem,100%)] max-w-full max-h-full bg-[var(--bg-chat)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] flex flex-col overflow-hidden relative"
        style={accentColor ? { borderColor: `${accentColor}55` } : undefined}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Profile"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Banner */}
          <div
            className={`h-24 sm:h-28 relative overflow-hidden ${
              !bannerUrl && !bannerColor ? 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600' : ''
            }`}
            style={
              !bannerUrl && bannerColor
                ? { background: `linear-gradient(135deg, ${bannerColor}, #1e1b4b)` }
                : undefined
            }
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Profile Banner"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

            {isSelf && onOpenProfileCustomization && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfileCustomization();
                }}
                className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/55 hover:bg-black/80 text-white text-[11px] font-semibold border border-white/15 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3 h-3 text-cyan-300" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {/* Profile Avatar & Presence */}
          <div className="px-5 pb-5 relative">
            <div className="flex items-end justify-between -mt-12 mb-3 gap-2">
              <div className="relative flex-shrink-0">
                <div className={`rounded-full p-0.5 ${decorationClass}`}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-20 h-20 rounded-full border-4 border-[var(--bg-chat)] object-cover shadow-xl"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-4 border-[var(--bg-chat)] bg-[var(--discord-blurple)] flex items-center justify-center text-white font-extrabold text-2xl shadow-xl">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {avatarDecoration === 'discord_crown' && (
                  <span
                    title="Crown Badge"
                    className="absolute -top-2 -right-1 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg border-2 border-[var(--bg-chat)]"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </span>
                )}

                <span
                  className={`absolute bottom-1 right-1 w-5 h-5 rounded-full ring-4 ring-[var(--bg-chat)] ${
                    presence === 'idle'
                      ? 'bg-[var(--status-idle)]'
                      : presence === 'dnd'
                      ? 'bg-[var(--status-dnd)]'
                      : presence === 'offline'
                      ? 'bg-[var(--status-offline)]'
                      : 'bg-[var(--status-online)]'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2">
                {isDiscordBridged && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--discord-blurple)]/20 text-[var(--text-link)] border border-[var(--discord-blurple)]/40 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>Bridged</span>
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-[var(--text-link)] border border-cyan-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Verified</span>
                </span>
                {badges.map(badge => (
                  <span
                    key={badge}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-userpanel)] text-[var(--text-normal)] border border-[var(--border-subtle)]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* User Name, Pronouns & Tag */}
            <div className="mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[var(--text-header)] leading-tight">{displayName}</h2>
                {pronouns && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-normal)]">
                    {pronouns}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono">{user.userId}</div>
            </div>

            {/* Custom Status Pill */}
            {customStatus && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] text-xs text-[var(--text-normal)] flex items-center gap-2">
                {customStatusEmoji && <span className="text-sm">{customStatusEmoji}</span>}
                <span className="truncate">{customStatus}</span>
              </div>
            )}

            {/* Bio / About Me */}
            {bio && (
              <div className="mb-3 p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  About Me
                </div>
                <p className="text-xs text-[var(--text-normal)] whitespace-pre-wrap leading-relaxed">{bio}</p>
              </div>
            )}

            {/* Membership Info & Stats Card */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3 mb-4">
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Member Details
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[var(--text-link)]" />
                    <span>Member Since</span>
                  </div>
                  <div className="font-semibold text-[var(--text-header)]">{formatDate(discordCreated)}</div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-400" />
                    <span>Joined Server</span>
                  </div>
                  <div className="font-semibold text-[var(--text-header)]">{formatDate(serverJoined)}</div>
                </div>
              </div>

              {/* Voice Calls Tracked Time */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--status-online)]" />
                  <span>Voice Activity</span>
                </span>
                <span className="font-bold text-[var(--status-online)] font-mono">
                  {voiceHours}h in calls
                </span>
              </div>

              {/* Current Shared Location */}
              {user.currentRoomName && (
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Channel</span>
                  <span className="font-semibold text-[var(--text-link)]">#{user.currentRoomName}</span>
                </div>
              )}
            </div>

            {/* Steam Game Invite Section */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-channels)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-header)]">
                  <Gamepad2 className="w-4 h-4 text-[var(--text-link)]" />
                  <span>Steam Game Invite</span>
                </div>
                <span className="text-[10px] text-[var(--text-link)] font-semibold">1-Click Launch</span>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                      Game
                    </label>
                    <select
                      value={selectedGame}
                      onChange={e => setSelectedGame(e.target.value)}
                      className="w-full bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                    >
                      {POPULAR_STEAM_GAMES.map(g => (
                        <option key={g.appId} value={g.name}>
                          {g.icon} {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                      Lobby ID
                    </label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={customLobby}
                      onChange={e => setCustomLobby(e.target.value)}
                      className="w-full bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={inviteSuccess}
                    className="flex-1 py-2 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {inviteSuccess ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Invite Sent!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Invite {displayName}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
