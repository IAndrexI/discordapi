import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Users,
  Search,
  ChevronDown,
  UserPlus,
  Radio,
} from 'lucide-react';
import type { MatrixRoom, DiscordGuild, MatrixUser } from '../types';

interface ChannelSidebarProps {
  activeGuild: DiscordGuild | null; // null = DMs / Home
  rooms: MatrixRoom[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onJoinVoice: (room: MatrixRoom) => void;
  activeVoiceRoomId: string | null;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  activeGuild,
  rooms,
  activeRoomId,
  onSelectRoom,
  onJoinVoice,
  activeVoiceRoomId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter DMs and Groupchats
  const dms = rooms.filter(r => r.isDirect);
  const groupChats = rooms.filter(r => r.isGroupChat);

  const filteredDMs = dms.filter(dm =>
    dm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroupChats = groupChats.filter(gc =>
    gc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-60 h-full bg-[var(--bg-channels)] flex flex-col select-none flex-shrink-0 border-r border-black/20">
      {/* Header */}
      <div className="h-12 border-b border-black/20 px-4 flex items-center justify-between font-semibold text-white shadow-sm hover:bg-white/[0.04] transition-colors cursor-pointer">
        <span className="truncate">
          {activeGuild ? activeGuild.name : 'Direct Messages'}
        </span>
        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
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
            <div className="space-y-0.5">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)] transition-colors text-sm font-medium">
                <Users className="w-5 h-5" />
                <span>Friends</span>
              </button>
            </div>

            {/* Group Chats Section */}
            {filteredGroupChats.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  <span>Group Chats ({filteredGroupChats.length})</span>
                </div>
                <div className="space-y-0.5">
                  {filteredGroupChats.map(gc => {
                    const isActive = activeRoomId === gc.id;
                    return (
                      <button
                        key={gc.id}
                        onClick={() => onSelectRoom(gc.id)}
                        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm transition-colors text-left group ${
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
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Messages Section */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <span>Direct Messages ({filteredDMs.length})</span>
                <UserPlus className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
              </div>

              <div className="space-y-0.5">
                {filteredDMs.map(dm => {
                  const isActive = activeRoomId === dm.id;
                  const otherUser: MatrixUser | undefined = dm.members.find(
                    m => !m.userId.includes('discordbot')
                  );
                  const presence = otherUser?.presence || 'online';

                  return (
                    <button
                      key={dm.id}
                      onClick={() => onSelectRoom(dm.id)}
                      className={`w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm transition-colors text-left group ${
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
                    </button>
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
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors text-left group ${
                  activeVoiceRoomId === 'livekit_lounge'
                    ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] font-semibold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-white'
                }`}
              >
                <Volume2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">🔊 Voice Lounge (&lt;30ms)</span>
                {activeVoiceRoomId === 'livekit_lounge' && (
                  <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-ping" />
                )}
              </button>
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
                    return (
                      <button
                        key={ch.id}
                        onClick={() => onSelectRoom(ch.id)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors text-left group ${
                          isActive
                            ? 'bg-[var(--bg-item-active)] text-white'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <Hash className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        <span className="truncate font-medium">{ch.name.replace('#', '')}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Voice Channels */}
            <div>
              <div className="flex items-center justify-between px-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 mt-4">
                <span>Voice Channels</span>
              </div>

              <div className="space-y-0.5">
                {activeGuild.channels
                  .filter(c => c.isVoice && c.id !== 'livekit_lounge')
                  .map(ch => {
                    const isVoiceActive = activeVoiceRoomId === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => onJoinVoice(ch)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors text-left group ${
                          isVoiceActive
                            ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] font-semibold'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <Volume2 className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        <span className="truncate font-medium">{ch.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
