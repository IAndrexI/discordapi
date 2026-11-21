import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Volume2,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Plus,
  Globe,
  PhoneCall,
  Trophy,
  Puzzle,
  Terminal,
  Compass,
  Copy,
  Check,
  MicOff,
  HeadphoneOff,
  X,
} from 'lucide-react';
import type { MatrixRoom, DiscordGuild, MatrixUser, VoiceParticipant } from '../types';
import { voiceProxy } from '../services/voiceProxy';

export interface ChannelSidebarProps {
  activeGuild: DiscordGuild | null; // null = DMs / Home
  rooms: MatrixRoom[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onJoinVoice: (room: MatrixRoom) => void;
  onJoinDiscordCall?: (room: MatrixRoom) => void | Promise<void>;
  activeVoiceRoomId: string | null;
  onOpenAddModal?: (tab?: 'server' | 'group' | 'dm') => void;
  onOpenVoiceProxy?: () => void;
  voiceParticipants?: VoiceParticipant[];
  onOpenDiscordHub?: (tab?: 'quests' | 'friends' | 'nitro' | 'inbox' | 'discover') => void;
  onOpenEquicord?: () => void;
  onOpenScripts?: () => void;
}

const VOICE_LOUNGE_ROOM: MatrixRoom = {
  id: 'livekit_lounge',
  name: 'Voice Lounge',
  isDirect: false,
  isGroupChat: false,
  isVoice: true,
  members: [],
};

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  activeGuild,
  rooms,
  activeRoomId,
  onSelectRoom,
  onJoinVoice,
  onJoinDiscordCall,
  activeVoiceRoomId,
  onOpenAddModal,
  onOpenVoiceProxy,
  voiceParticipants = [],
  onOpenDiscordHub,
  onOpenEquicord,
  onOpenScripts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningDiscordId, setJoiningDiscordId] = useState<string | null>(null);
  const [serverMenuState, setServerMenuState] = useState<{ guildId: string | null; open: boolean }>({
    guildId: activeGuild?.id ?? null,
    open: false,
  });
  const [copiedServerId, setCopiedServerId] = useState(false);
  const [textCollapsed, setTextCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);
  const serverMenuRef = useRef<HTMLDivElement>(null);

  const currentGuildId = activeGuild?.id ?? null;
  const serverMenuOpen = serverMenuState.open && serverMenuState.guildId === currentGuildId;
  const setServerMenuOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    setServerMenuState(prev => {
      const prevOpen = prev.open && prev.guildId === currentGuildId;
      const open = typeof next === 'function' ? next(prevOpen) : next;
      return { guildId: currentGuildId, open };
    });
  };

  useEffect(() => {
    if (!serverMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(event.target as Node)) {
        setServerMenuState(prev => ({ ...prev, open: false }));
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setServerMenuState(prev => ({ ...prev, open: false }));
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [serverMenuOpen]);

  const handleQuickDiscordCall = async (e: React.MouseEvent, room: MatrixRoom) => {
    e.stopPropagation();
    setJoiningDiscordId(room.id);
    try {
      if (onJoinDiscordCall) {
        await onJoinDiscordCall(room);
      } else {
        await voiceProxy.quickJoinDiscordChannel(room);
      }
    } finally {
      setJoiningDiscordId(null);
    }
  };

  const handleCopyServerId = () => {
    if (!activeGuild) return;
    void navigator.clipboard?.writeText(activeGuild.id)?.catch(() => {});
    setCopiedServerId(true);
    window.setTimeout(() => {
      setCopiedServerId(false);
      setServerMenuOpen(false);
    }, 900);
  };

  // Filter DMs and Groupchats
  const dms = rooms.filter(r => r.isDirect);
  const groupChats = rooms.filter(r => r.isGroupChat);

  const filteredDMs = dms.filter(dm =>
    dm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroupChats = groupChats.filter(gc =>
    gc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const textChannels = activeGuild
    ? activeGuild.channels.filter(c => !c.isVoice && c.id !== 'livekit_lounge')
    : [];

  const guildVoiceChannels = activeGuild
    ? activeGuild.channels.filter(c => c.isVoice && c.id !== 'livekit_lounge')
    : [];

  const allVoiceChannels: MatrixRoom[] = activeGuild
    ? [VOICE_LOUNGE_ROOM, ...guildVoiceChannels]
    : [];

  const isChannelVoiceActive = (ch: MatrixRoom): boolean => {
    if (!activeVoiceRoomId) return false;
    if (ch.id === 'livekit_lounge') {
      return (
        activeVoiceRoomId === 'livekit_lounge' ||
        activeVoiceRoomId === 'Voice Lounge' ||
        activeVoiceRoomId === '🔊 Ultra-Low Latency Voice'
      );
    }
    return activeVoiceRoomId === ch.id || activeVoiceRoomId === ch.name;
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="w-60 flex-1 min-h-0 bg-[var(--bg-channels)] flex flex-col select-none border-r border-[var(--border-subtle)]">
      {/* Header */}
      {activeGuild ? (
        <div className="relative flex-shrink-0" ref={serverMenuRef}>
          <button
            type="button"
            onClick={() => setServerMenuOpen(prev => !prev)}
            aria-haspopup="menu"
            aria-expanded={serverMenuOpen}
            aria-label={`${activeGuild.name} server menu`}
            className="w-full h-12 border-b border-[var(--border-subtle)] px-4 flex items-center justify-between font-semibold text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] transition-colors cursor-pointer text-left"
          >
            <span className="truncate text-[15px] font-semibold tracking-tight">
              {activeGuild.name}
            </span>
            {serverMenuOpen ? (
              <X className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
            )}
          </button>

          {serverMenuOpen && (
            <div
              className="absolute top-[52px] left-2 right-2 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-lg shadow-2xl p-1.5 z-[80] max-h-[calc(100vh/var(--app-zoom,1)-100px)] overflow-y-auto text-xs text-[var(--text-normal)] animate-fadeIn"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setServerMenuOpen(false);
                  onOpenAddModal?.('server');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
              >
                <span>Add or Sync Channels</span>
                <Plus className="w-3.5 h-3.5" />
              </button>

              {onOpenScripts && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setServerMenuOpen(false);
                    onOpenScripts();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <span>Scripts &amp; Bots</span>
                  <Terminal className="w-3.5 h-3.5" />
                </button>
              )}

              {onOpenVoiceProxy && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setServerMenuOpen(false);
                    onOpenVoiceProxy();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <span>Call Bridge</span>
                  <PhoneCall className="w-3.5 h-3.5" />
                </button>
              )}

              {onOpenDiscordHub && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setServerMenuOpen(false);
                    onOpenDiscordHub('discover');
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <span>Discover Servers</span>
                  <Compass className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="h-px bg-[var(--border-subtle)] my-1" />

              <button
                type="button"
                role="menuitem"
                onClick={handleCopyServerId}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
              >
                <span>{copiedServerId ? 'Copied Server ID' : 'Copy Server ID'}</span>
                {copiedServerId ? (
                  <Check className="w-3.5 h-3.5 text-[var(--status-online)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="h-12 border-b border-[var(--border-subtle)] px-2.5 flex items-center flex-shrink-0">
          <div className="w-full bg-[var(--bg-servers)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              aria-label="Search conversations"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Scrollable List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {activeGuild === null ? (
          // DIRECT MESSAGES / HOME VIEW
          <>
            {/* Home Navigation */}
            <nav aria-label="Home navigation" className="space-y-0.5">
              <button
                type="button"
                onClick={() => onOpenDiscordHub?.('friends')}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] transition-colors text-sm font-medium cursor-pointer"
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">Friends</span>
              </button>

              {onOpenDiscordHub && (
                <button
                  type="button"
                  onClick={() => onOpenDiscordHub('quests')}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] transition-colors text-sm font-medium cursor-pointer"
                >
                  <Trophy className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">Hub &amp; Quests</span>
                </button>
              )}

              {onOpenEquicord && (
                <button
                  type="button"
                  onClick={onOpenEquicord}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] transition-colors text-sm font-medium cursor-pointer"
                >
                  <Puzzle className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">Plugins</span>
                </button>
              )}

              {onOpenVoiceProxy && (
                <button
                  type="button"
                  onClick={onOpenVoiceProxy}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] transition-colors text-sm font-medium cursor-pointer"
                >
                  <Globe className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">Call Bridge</span>
                </button>
              )}
            </nav>

            <div className="h-px bg-[var(--border-subtle)] mx-1" />

            {/* Direct Messages Section */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <span>Direct Messages</span>
                <button
                  type="button"
                  onClick={() => onOpenAddModal?.('dm')}
                  className="p-0.5 hover:text-[var(--text-header)] rounded transition-colors cursor-pointer"
                  aria-label="New Direct Message"
                  title="New Direct Message"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5">
                {filteredDMs.map(dm => {
                  const isActive = activeRoomId === dm.id;
                  const otherUser: MatrixUser | undefined = dm.members.find(
                    m => !m.userId.includes('discordbot')
                  );
                  const presence = otherUser?.presence || 'online';

                  return (
                    <div
                      key={dm.id}
                      role="button"
                      tabIndex={0}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onSelectRoom(dm.id)}
                      onKeyDown={e => handleRowKeyDown(e, () => onSelectRoom(dm.id))}
                      className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors text-left group cursor-pointer ${
                        isActive
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {dm.avatarUrl ? (
                          <img
                            src={dm.avatarUrl}
                            alt={dm.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white text-xs font-semibold">
                            {dm.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[var(--bg-channels)] ${
                            presence === 'online'
                              ? 'bg-[var(--status-online)]'
                              : presence === 'idle'
                              ? 'bg-[var(--status-idle)]'
                              : presence === 'dnd'
                              ? 'bg-[var(--status-dnd)]'
                              : 'bg-[var(--status-offline)]'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{dm.name}</div>
                        {dm.topic && (
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            {dm.topic}
                          </div>
                        )}
                      </div>

                      {(dm.isSynced || dm.syncSource === 'discord' || dm.discordChannelId) && (
                        <button
                          type="button"
                          onClick={e => handleQuickDiscordCall(e, dm)}
                          onKeyDown={e => e.stopPropagation()}
                          disabled={joiningDiscordId === dm.id}
                          aria-label={`Join bridged call with ${dm.name}`}
                          title="Join Bridged Call"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-opacity cursor-pointer flex-shrink-0"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Group Chats Section */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <span>Group Chats</span>
                <button
                  type="button"
                  onClick={() => onOpenAddModal?.('group')}
                  className="p-0.5 hover:text-[var(--text-header)] rounded transition-colors cursor-pointer"
                  aria-label="New Group Chat"
                  title="New Group Chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {filteredGroupChats.length > 0 && (
                <div className="space-y-0.5">
                  {filteredGroupChats.map(gc => {
                    const isActive = activeRoomId === gc.id;
                    return (
                      <div
                        key={gc.id}
                        role="button"
                        tabIndex={0}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => onSelectRoom(gc.id)}
                        onKeyDown={e => handleRowKeyDown(e, () => onSelectRoom(gc.id))}
                        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors text-left group cursor-pointer ${
                          isActive
                            ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs">
                          {gc.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{gc.name}</div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {gc.members.length} members
                          </div>
                        </div>
                        {(gc.isSynced || gc.syncSource === 'discord' || gc.discordChannelId) && (
                          <button
                            type="button"
                            onClick={e => handleQuickDiscordCall(e, gc)}
                            onKeyDown={e => e.stopPropagation()}
                            disabled={joiningDiscordId === gc.id}
                            aria-label={`Join bridged call in ${gc.name}`}
                            title="Join Bridged Call"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-opacity cursor-pointer flex-shrink-0"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          // GUILD CHANNELS VIEW
          <>
            {/* Text Channels Category */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1">
                <button
                  type="button"
                  aria-expanded={!textCollapsed}
                  onClick={() => setTextCollapsed(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-header)] uppercase tracking-wider cursor-pointer"
                >
                  {textCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  <span>Text Channels</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddModal?.('server')}
                  className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
                  aria-label="Add Channel"
                  title="Add Channel"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {!textCollapsed && (
                <div className="space-y-0.5">
                  {textChannels.map(ch => {
                    const isActive = activeRoomId === ch.id;
                    const isBridgedCh =
                      ch.isSynced || ch.syncSource === 'discord' || Boolean(ch.discordChannelId);
                    const cleanName = ch.name.replace(/^#/, '');
                    return (
                      <div
                        key={ch.id}
                        role="button"
                        tabIndex={0}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => onSelectRoom(ch.id)}
                        onKeyDown={e => handleRowKeyDown(e, () => onSelectRoom(ch.id))}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left group cursor-pointer ${
                          isActive
                            ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] font-medium'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Hash className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                          <span className="truncate">{cleanName}</span>
                        </div>
                        {isBridgedCh && (
                          <button
                            type="button"
                            onClick={e => handleQuickDiscordCall(e, ch)}
                            onKeyDown={e => e.stopPropagation()}
                            disabled={joiningDiscordId === ch.id}
                            aria-label={`Join bridged call for ${cleanName}`}
                            title="Join Bridged Call"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-opacity flex-shrink-0 cursor-pointer"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Voice Channels Category */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1">
                <button
                  type="button"
                  aria-expanded={!voiceCollapsed}
                  onClick={() => setVoiceCollapsed(prev => !prev)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-header)] uppercase tracking-wider cursor-pointer"
                >
                  {voiceCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  <span>Voice Channels</span>
                </button>
              </div>

              {!voiceCollapsed && (
                <div className="space-y-0.5">
                  {allVoiceChannels.map(ch => {
                    const isVoiceActive = isChannelVoiceActive(ch);
                    const isJoining = joiningDiscordId === ch.id;
                    const isLounge = ch.id === 'livekit_lounge';
                    return (
                      <div key={ch.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-current={isVoiceActive ? 'true' : undefined}
                          onClick={() => onJoinVoice(ch)}
                          onKeyDown={e => handleRowKeyDown(e, () => onJoinVoice(ch))}
                          className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left group cursor-pointer ${
                            isVoiceActive
                              ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] font-medium'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                          }`}
                          title={
                            isLounge
                              ? 'Join Voice Lounge'
                              : 'Join Voice Channel'
                          }
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Volume2
                              className={`w-4 h-4 flex-shrink-0 ${
                                isVoiceActive ? 'text-[var(--status-online)]' : 'text-[var(--text-muted)]'
                              }`}
                            />
                            <span className="truncate">{ch.name}</span>
                          </div>

                          {!isLounge && (
                            <button
                              type="button"
                              onClick={e => handleQuickDiscordCall(e, ch)}
                              onKeyDown={e => e.stopPropagation()}
                              disabled={isJoining}
                              aria-label={`Join bridged call in ${ch.name}`}
                              title="Join Bridged Call"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-opacity flex-shrink-0 cursor-pointer"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Nested Voice Participants */}
                        {isVoiceActive && voiceParticipants.length > 0 && (
                          <div className="mt-0.5 space-y-0.5 pb-1">
                            {voiceParticipants.map(participant => {
                              const initials = (participant.name || 'U')
                                .slice(0, 2)
                                .toUpperCase();
                              const isTalking = participant.isSpeaking && !participant.isMuted;

                              return (
                                <div
                                  key={participant.identity}
                                  className="pl-7 pr-2 py-1 flex items-center gap-2 rounded-md hover:bg-[var(--bg-item-hover)] text-[13px]"
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 transition-shadow ${
                                      isTalking ? 'ring-2 ring-[var(--status-online)]' : ''
                                    }`}
                                  >
                                    {initials}
                                  </div>
                                  <span
                                    className={`truncate flex-1 ${
                                      isTalking
                                        ? 'text-[var(--text-header)] font-medium'
                                        : 'text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {participant.name}
                                  </span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {participant.hasScreenShare && (
                                      <span className="px-1 py-0.2 rounded bg-[var(--status-dnd)] text-white text-[9px] font-bold uppercase leading-tight">
                                        LIVE
                                      </span>
                                    )}
                                    {participant.isMuted && (
                                      <MicOff className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                    )}
                                    {participant.isDeafened && (
                                      <HeadphoneOff className="w-3.5 h-3.5 text-[var(--status-dnd)]" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
