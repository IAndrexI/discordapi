import React from 'react';
import type { MatrixUser } from '../types';

export interface MemberListProps {
  members: MatrixUser[];
  onSelectUser?: (user: MatrixUser) => void;
}

export const MemberList: React.FC<MemberListProps> = ({ members, onSelectUser }) => {
  const onlineMembers = members.filter(m => m.presence !== 'offline');
  const offlineMembers = members.filter(m => m.presence === 'offline');

  return (
    <aside className="hidden lg:flex w-60 h-full bg-[var(--bg-channels)] flex-col py-4 px-2 select-none flex-shrink-0 border-l border-[var(--border-subtle)] overflow-y-auto">
      {/* Online Section */}
      <div className="mb-4">
        <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-1">
          Online — {onlineMembers.length}
        </h3>
        <div className="space-y-0.5">
          {onlineMembers.map(user => (
            <MemberItem key={user.userId} user={user} onSelect={() => onSelectUser?.(user)} />
          ))}
        </div>
      </div>

      {/* Offline Section */}
      {offlineMembers.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-1">
            Offline — {offlineMembers.length}
          </h3>
          <div className="space-y-0.5">
            {offlineMembers.map(user => (
              <MemberItem
                key={user.userId}
                user={user}
                isOffline
                onSelect={() => onSelectUser?.(user)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

const MemberItem: React.FC<{ user: MatrixUser; isOffline?: boolean; onSelect?: () => void }> = ({
  user,
  isOffline,
  onSelect,
}) => {
  const isBot = user.userId.includes('bot') || user.userId.includes('discordbot');

  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--bg-item-hover)] cursor-pointer group transition-colors"
    >
      <div className="relative flex-shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className={`w-8 h-8 rounded-full object-cover ${isOffline ? 'opacity-50' : ''}`}
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-semibold text-xs ${
              isOffline ? 'opacity-50' : ''
            }`}
          >
            {user.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}

        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-[3px] ring-[var(--bg-channels)] ${
            isOffline
              ? 'bg-[var(--status-offline)]'
              : user.presence === 'idle'
              ? 'bg-[var(--status-idle)]'
              : user.presence === 'dnd'
              ? 'bg-[var(--status-dnd)]'
              : 'bg-[var(--status-online)]'
          }`}
        />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-sm font-medium truncate ${
              isOffline
                ? 'text-[var(--text-muted)]'
                : 'text-[var(--text-normal)] group-hover:text-[var(--text-header)]'
            }`}
          >
            {user.displayName}
          </span>
          {isBot && (
            <span className="bg-[#5865f2] text-white text-[10px] font-semibold px-1 py-0.2 rounded-[3px] uppercase leading-tight flex-shrink-0">
              APP
            </span>
          )}
        </div>

        {/* Mutual Channel or Group Chat Presence Indicator */}
        {user.currentRoomName && !isOffline && (
          <div className="flex items-center gap-1 text-[11px] text-[#23a55a] font-medium truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-[#23a55a] flex-shrink-0" />
            <span className="truncate">in #{user.currentRoomName}</span>
          </div>
        )}

        {/* Custom Activity or Status */}
        {user.statusMsg && (
          <div className="text-[11px] text-[var(--text-muted)] truncate">
            {user.statusMsg}
          </div>
        )}
      </div>
    </div>
  );
};
