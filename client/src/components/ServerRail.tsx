import React from 'react';
import { MessageSquare, Plus, Compass } from 'lucide-react';
import type { DiscordGuild } from '../types';

interface ServerRailProps {
  guilds: DiscordGuild[];
  activeGuildId: string | null; // null = DM / Home view
  onSelectGuild: (guildId: string | null) => void;
  unreadDMsCount?: number;
}

export const ServerRail: React.FC<ServerRailProps> = ({
  guilds,
  activeGuildId,
  onSelectGuild,
  unreadDMsCount = 0,
}) => {
  return (
    <aside className="w-[72px] h-full bg-[var(--bg-servers)] flex flex-col items-center py-3 select-none flex-shrink-0 z-20">
      {/* Home / DMs Icon */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        {/* Active Pill Indicator */}
        <div
          className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
            activeGuildId === null
              ? 'h-10'
              : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
          }`}
        />

        <button
          onClick={() => onSelectGuild(null)}
          className={`w-12 h-12 flex items-center justify-center transition-all duration-200 relative ${
            activeGuildId === null
              ? 'bg-[var(--discord-blurple)] text-white rounded-[16px]'
              : 'bg-[var(--bg-chat)] text-[var(--text-normal)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--discord-blurple)] hover:text-white'
          }`}
          title="Direct Messages"
        >
          <MessageSquare className="w-6 h-6 fill-current" />
          {unreadDMsCount > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-[var(--status-dnd)] text-white text-xs font-bold px-1.5 py-0.5 rounded-full ring-4 ring-[var(--bg-servers)]">
              {unreadDMsCount}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-8 h-[2px] bg-white/10 rounded my-1" />

      {/* Synced Servers List */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 pt-1">
        {guilds.map(guild => {
          const isActive = activeGuildId === guild.id;
          const initials = guild.name
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 3)
            .toUpperCase();

          return (
            <div key={guild.id} className="relative group flex items-center justify-center w-full">
              {/* Pill */}
              <div
                className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
                  isActive
                    ? 'h-10'
                    : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                }`}
              />

              <button
                onClick={() => onSelectGuild(guild.id)}
                className={`w-12 h-12 flex items-center justify-center font-semibold text-sm transition-all duration-200 overflow-hidden relative ${
                  isActive
                    ? 'bg-[var(--discord-blurple)] text-white rounded-[16px]'
                    : 'bg-[var(--bg-chat)] text-[var(--text-normal)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--discord-blurple)] hover:text-white'
                }`}
                title={guild.name}
              >
                {guild.iconUrl ? (
                  <img src={guild.iconUrl} alt={guild.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add a Server */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-chat)] text-[var(--status-online)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--status-online)] hover:text-white transition-all duration-200"
            title="Add a Server"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Explore Public Servers */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-chat)] text-[var(--text-normal)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--status-online)] hover:text-white transition-all duration-200"
            title="Explore Discoverable Servers"
          >
            <Compass className="w-6 h-6" />
          </button>
        </div>
      </div>
    </aside>
  );
};
