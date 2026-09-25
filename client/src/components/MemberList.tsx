import React from 'react';
import type { MatrixUser } from '../types';

interface MemberListProps {
  members: MatrixUser[];
}

export const MemberList: React.FC<MemberListProps> = ({ members }) => {
  const onlineMembers = members.filter(m => m.presence !== 'offline');
  const offlineMembers = members.filter(m => m.presence === 'offline');

  return (
    <aside className="w-60 h-full bg-[var(--bg-channels)] flex flex-col py-4 px-3 select-none flex-shrink-0 border-l border-black/20 overflow-y-auto">
      {/* Online Section */}
      <div className="mb-4">
        <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-1">
          Online — {onlineMembers.length}
        </h3>
        <div className="space-y-0.5">
          {onlineMembers.map(user => (
            <MemberItem key={user.userId} user={user} />
          ))}
        </div>
      </div>

      {/* Offline Section */}
      {offlineMembers.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-1">
            Offline — {offlineMembers.length}
          </h3>
          <div className="space-y-0.5">
            {offlineMembers.map(user => (
              <MemberItem key={user.userId} user={user} isOffline />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

const MemberItem: React.FC<{ user: MatrixUser; isOffline?: boolean }> = ({ user, isOffline }) => {
  const isBot = user.userId.includes('bot') || user.userId.includes('discordbot');

  return (
    <div className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--bg-item-hover)] cursor-pointer group transition-colors">
      <div className="relative flex-shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className={`w-8 h-8 rounded-full object-cover ${isOffline ? 'opacity-60' : ''}`}
          />
        ) : (
          <div
            className={`w-8 h-8 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-bold text-xs ${
              isOffline ? 'opacity-60' : ''
            }`}
          >
            {user.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}

        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg-channels)] ${
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

      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`text-sm font-medium truncate ${
            isOffline ? 'text-[var(--text-muted)]' : 'text-[var(--text-normal)] group-hover:text-white'
          }`}
        >
          {user.displayName}
        </span>
        {isBot && (
          <span className="bg-[var(--discord-blurple)] text-white text-[9px] font-bold px-1 rounded uppercase">
            BOT
          </span>
        )}
      </div>
    </div>
  );
};
