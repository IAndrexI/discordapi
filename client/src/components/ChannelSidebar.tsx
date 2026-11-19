import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Users,
  Search,
  ChevronDown,
  UserPlus,
  Radio,
  Plus,
  Globe,
  PhoneCall,
} from 'lucide-react';
import type { MatrixRoom, DiscordGuild, MatrixUser } from '../types';
import { voiceProxy } from '../services/voiceProxy';

interface ChannelSidebarProps {
  activeGuild: DiscordGuild | null; // null = DMs / Home
  rooms: MatrixRoom[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onJoinVoice: (room: MatrixRoom) => void;
  onJoinDiscordCall?: (room: MatrixRoom) => void | Promise<void>;
  activeVoiceRoomId: string | null;
  onOpenAddModal?: (tab?: 'server' | 'group' | 'dm') => void;
  onOpenVoiceProxy?: () => void;
}

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningDiscordId, setJoiningDiscordId] = useState<string | null>(null);

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

  // Filter DMs and Groupchats
  const dms = rooms.filter(r => r.isDirect);
  const groupChats = rooms.filter(r => r.isGroupChat);

  const filteredDMs = dms.filter(dm =>
    dm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroupChats = groupChats.filter(gc =>
    gc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeChannel =
    activeGuild?.channels.find(c => c.id === activeRoomId) ||
    rooms.find(r => r.id === activeRoomId) ||
    null;

  return (
    <div className="w-60 h-full bg-[var(--bg-channels)] flex flex-col select-none flex-shrink-0 border-r border-black/20">
      {/* Header */}
      <div
        onClick={() => {
          if (activeGuild) onOpenAddModal?.('server');
        }}
        className="h-12 border-b border-black/20 px-4 flex items-center justify-between font-semibold text-white shadow-sm hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        <div className="truncate flex items-center gap-2">
          <span className="truncate">
            {activeGuild ? activeGuild.name : 'Direct Messages'}
          </span>
          {activeGuild?.isAlwaysSynced && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
              Always Synced
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {activeGuild === null ? (
          // DIRECT MESSAGES VIEW
          <>
            {/* Search Input */}
            <div className="px-1 mb-2">
              <div className="bg-[var(--bg-userpanel)] rounded px-2.5 py-1.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Search className="w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Find or start a conversation"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-[var(--text-normal)] placeholder:text-[var(--text-muted)]"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)] transition-colors text-sm font-medium">
                <Users className="w-5 h-5" />
                <span>Friends</span>
              </button>
              {onOpenVoiceProxy && (
                <button
                  type="button"
                  onClick={onOpenVoiceProxy}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 hover:text-white transition-all text-xs font-semibold cursor-pointer group"
                  title="Connect via Discord Call Proxy or Stoat WebRTC SFU (Optional)"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Globe className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="truncate">Call Proxies (Discord / Stoat)</span>
                  </div>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/25 text-amber-300 font-bold uppercase tracking-wider">
                    Tool
                  </span>
                </button>
              )}
            </div>

            {/* Group Chats Section */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <span>Group Chats ({filteredGroupChats.length})</span>
                <button
                  type="button"
                  onClick={() => onOpenAddModal?.('group')}
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Create or Sync Group Chat"
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
                        onClick={() => onSelectRoom(gc.id)}
                        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm transition-colors text-left group cursor-pointer ${
                          isActive
                            ? 'bg-[var(--bg-item-active)] text-white'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--discord-blurple)]/30 border border-[var(--discord-blurple)]/50 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                          {gc.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 truncate">
                          <div className="truncate font-medium text-[var(--text-normal)]">
                            {gc.name}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {gc.members.length} members
                          </div>
                        </div>
                        {(gc.isSynced || gc.syncSource === 'discord' || gc.discordChannelId) && (
                          <button
                            type="button"
                            onClick={e => handleQuickDiscordCall(e, gc)}
                            title="Join Discord Call (1-Click)"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded bg-[#5865F2]/25 hover:bg-[#5865F2] text-indigo-300 hover:text-white transition-all cursor-pointer"
                          >
                            <PhoneCall className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Direct Messages Section */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <span>Direct Messages ({filteredDMs.length})</span>
                <button
                  type="button"
                  onClick={() => onOpenAddModal?.('dm')}
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Start or Sync Direct Message"
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
                      onClick={() => onSelectRoom(dm.id)}
                      className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm transition-colors text-left group cursor-pointer ${
                        isActive
                          ? 'bg-[var(--bg-item-active)] text-white'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                      }`}
                    >
                      {/* Avatar with Status Dot */}
                      <div className="relative flex-shrink-0">
                        {dm.avatarUrl ? (
                          <img
                            src={dm.avatarUrl}
                            alt={dm.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-semibold">
                            {dm.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-[var(--bg-channels)] ${
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

                      <div className="flex-1 truncate">
                        <div className="truncate font-medium text-[var(--text-normal)]">
                          {dm.name}
                        </div>
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
                          title="Join Discord Call (1-Click)"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded bg-[#5865F2]/25 hover:bg-[#5865F2] text-indigo-300 hover:text-white transition-all cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          // GUILD CHANNELS VIEW
          <>
            {/* Dedicated Low Latency Voice Channel */}
            <div className="mb-3">
              <div className="flex items-center px-2 text-[11px] font-bold text-[var(--status-online)] uppercase tracking-wider mb-1 gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>Ultra-Low Latency SFU</span>
              </div>
              <button
                onClick={() =>
                  onJoinVoice({
                    id: 'livekit_lounge',
                    name: '🔊 Ultra-Low Latency Voice',
                    isDirect: false,
                    isGroupChat: false,
                    isVoice: true,
                    members: [],
                  })
                }
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors text-left group cursor-pointer ${
                  activeVoiceRoomId === 'livekit_lounge' ||
                  activeVoiceRoomId === '🔊 Ultra-Low Latency Voice'
                    ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-white'
                }`}
              >
                <Volume2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">🔊 Voice Lounge (&lt;30ms)</span>
                {(activeVoiceRoomId === 'livekit_lounge' ||
                  activeVoiceRoomId === '🔊 Ultra-Low Latency Voice') && (
                  <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-ping" />
                )}
              </button>

              {/* 1-Click Join Discord Call action for active Discord/voice channel */}
              {activeChannel && (
                <button
                  type="button"
                  onClick={e => handleQuickDiscordCall(e, activeChannel)}
                  disabled={joiningDiscordId === activeChannel.id}
                  className="w-full mt-1.5 flex items-center justify-between px-2.5 py-1.5 rounded border border-[#5865F2]/35 bg-[#5865F2]/15 hover:bg-[#5865F2]/30 text-indigo-200 hover:text-white transition-all text-xs font-semibold cursor-pointer group"
                  title={`1-Click Join Discord Call in #${activeChannel.name}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <PhoneCall className="w-3.5 h-3.5 text-[#7289da] flex-shrink-0" />
                    <span className="truncate text-[11px]">
                      {joiningDiscordId === activeChannel.id ? 'Joining Call...' : 'Join Discord Call'}
                    </span>
                  </div>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-[#5865F2]/30 text-indigo-200 font-bold uppercase tracking-wider">
                    1-Click
                  </span>
                </button>
              )}

              {/* Optional Voice Gateways & External Call Proxies */}
              {onOpenVoiceProxy && (
                <button
                  type="button"
                  onClick={onOpenVoiceProxy}
                  className="w-full mt-1.5 flex items-center justify-between px-2.5 py-1.5 rounded border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 hover:text-white transition-all text-xs font-medium cursor-pointer group"
                  title="Connect via Discord Call Proxy or Stoat WebRTC SFU (Optional)"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Globe className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
                    <span className="truncate text-[11px]">External Call Proxy</span>
                  </div>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">
                    Optional
                  </span>
                </button>
              )}
            </div>

            {/* Text Channels */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <span>Text Channels ({activeGuild.channels.filter(c => !c.isVoice).length})</span>
              </div>

              <div className="space-y-0.5">
                {activeGuild.channels
                  .filter(c => !c.isVoice && c.id !== 'livekit_lounge')
                  .map(ch => {
                    const isActive = activeRoomId === ch.id;
                    const isDiscordCh = ch.isSynced || ch.syncSource === 'discord' || !!ch.discordChannelId;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => onSelectRoom(ch.id)}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors text-left group cursor-pointer ${
                          isActive
                            ? 'bg-[var(--bg-item-active)] text-white'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Hash className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                          <span className="truncate font-medium">{ch.name.replace('#', '')}</span>
                        </div>
                        {isDiscordCh && (
                          <button
                            type="button"
                            onClick={e => handleQuickDiscordCall(e, ch)}
                            title="Join Discord Call (1-Click)"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded bg-[#5865F2]/25 hover:bg-[#5865F2] text-indigo-300 hover:text-white transition-all flex-shrink-0 cursor-pointer"
                          >
                            <PhoneCall className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Voice Channels */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 mt-4">
                <span>Voice Channels</span>
              </div>

              <div className="space-y-1">
                {activeGuild.channels
                  .filter(c => c.isVoice && c.id !== 'livekit_lounge')
                  .map(ch => {
                    const isVoiceActive =
                      activeVoiceRoomId === ch.id || activeVoiceRoomId === ch.name;
                    const isJoining = joiningDiscordId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => onJoinVoice(ch)}
                        className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded text-sm transition-colors text-left group cursor-pointer ${
                          isVoiceActive
                            ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] font-semibold'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                        title="Click to join SFU voice, or click Discord Call button"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Volume2 className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                          <span className="truncate font-medium">{ch.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={e => handleQuickDiscordCall(e, ch)}
                          disabled={isJoining}
                          title="Join Discord Call (1-Click)"
                          className="px-1.5 py-0.5 rounded bg-[#5865F2]/25 hover:bg-[#5865F2] text-indigo-200 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer border border-[#5865F2]/40"
                        >
                          <PhoneCall className="w-2.5 h-2.5" />
                          <span>{isJoining ? '...' : 'Discord'}</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quick Action to Sync More Channels */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenAddModal?.('server')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-cyan-500/30 text-xs font-semibold text-cyan-400 hover:text-white hover:bg-cyan-500/10 hover:border-cyan-400/60 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add or Sync Channels</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
