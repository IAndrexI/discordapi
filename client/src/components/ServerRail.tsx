import React from 'react';
import { MessageSquare, Plus, Compass } from 'lucide-react';
import type { DiscordGuild, EngineMode } from '../types';

export interface ServerRailProps {
  guilds: DiscordGuild[];
  activeGuildId: string | null; // null = DM / Home view
  onSelectGuild: (guildId: string | null) => void;
  onOpenAddModal?: () => void;
  unreadDMsCount?: number;
  engineMode?: EngineMode;
  onOpenDiscordHub?: (tab?: 'quests' | 'friends' | 'nitro' | 'inbox' | 'discover') => void;
  onOpenEquicord?: () => void;
}

function isDiscordBridgedGuild(guild: DiscordGuild): boolean {
  if (guild.serverKind === 'proprietary' || guild.isProprietary) return false;
  if (guild.serverKind === 'discord') return true;
  if (guild.isAlwaysSynced) return true;
  const lower = `${guild.id} ${guild.name}`.toLowerCase();
  return lower.includes('discord') || lower.includes('bridged');
}

export const ServerRail: React.FC<ServerRailProps> = ({
  guilds,
  activeGuildId,
  onSelectGuild,
  onOpenAddModal,
  unreadDMsCount = 0,
  engineMode = 'hybrid',
  onOpenDiscordHub,
}) => {
  const visibleGuilds =
    engineMode === 'proprietary'
      ? guilds.filter(g => !isDiscordBridgedGuild(g))
      : guilds;

  return (
    <aside className="w-[72px] h-full bg-[var(--bg-servers)] flex flex-col items-center py-3 select-none flex-shrink-0 z-20 overflow-y-auto overflow-x-hidden no-scrollbar">
      {/* Home / Direct Messages Squircle */}
      <div className="relative group flex items-center justify-center w-full mb-2 flex-shrink-0">
        <div
          className={`absolute left-0 w-1 bg-[var(--text-header)] rounded-r-full transition-all duration-200 ${
            activeGuildId === null
              ? 'h-10'
              : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
          }`}
        />

        <button
          type="button"
          onClick={() => onSelectGuild(null)}
          className={`w-12 h-12 flex items-center justify-center transition-all duration-200 relative cursor-pointer ${
            activeGuildId === null
              ? 'bg-[var(--discord-blurple)] text-white rounded-[16px]'
              : 'bg-[var(--bg-chat)] text-[var(--text-normal)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--discord-blurple)] hover:text-white'
          }`}
          title="Direct Messages"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadDMsCount > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-[var(--status-dnd)] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full ring-4 ring-[var(--bg-servers)] leading-none">
              {unreadDMsCount}
            </span>
          )}
        </button>
      </div>

      {/* Discord Divider */}
      <div className="w-8 h-[2px] bg-[#35363c] rounded-full mb-2 flex-shrink-0" />

      {/* Server Icons List */}
      <div className="w-full flex flex-col items-center gap-2">
        {visibleGuilds.map(guild => {
          const isActive = activeGuildId === guild.id;
          const isDiscord = isDiscordBridgedGuild(guild);
          const initials = guild.name
            .split(' ')
            .filter(Boolean)
            .map(w => w[0])
            .join('')
            .slice(0, 3)
            .toUpperCase();

          return (
            <div
              key={guild.id}
              className="relative group flex items-center justify-center w-full flex-shrink-0"
            >
              {/* Left Active / Hover Pill */}
              <div
                className={`absolute left-0 w-1 bg-[var(--text-header)] rounded-r-full transition-all duration-200 ${
                  isActive
                    ? 'h-10'
                    : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                }`}
              />

              <button
                type="button"
                onClick={() => onSelectGuild(guild.id)}
                className={`w-12 h-12 flex items-center justify-center font-semibold text-sm transition-all duration-200 overflow-hidden cursor-pointer ${
                  isActive
                    ? 'bg-[var(--discord-blurple)] text-white rounded-[16px]'
                    : 'bg-[var(--bg-chat)] text-[var(--text-normal)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--discord-blurple)] hover:text-white'
                }`}
                title={`${guild.name} (${isDiscord ? 'Discord Bridged' : 'Proprietary'})`}
              >
                {guild.iconUrl ? (
                  <img
                    src={guild.iconUrl}
                    alt={guild.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials || 'S'}</span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add a Server */}
        <div className="relative group flex items-center justify-center w-full flex-shrink-0">
          <button
            type="button"
            onClick={() => onOpenAddModal?.()}
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-chat)] text-[#23a55a] rounded-[24px] hover:rounded-[16px] hover:bg-[#23a55a] hover:text-white transition-all duration-200 cursor-pointer"
            title="Add or Sync Server"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Explore Discoverable Servers */}
        <div className="relative group flex items-center justify-center w-full pb-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onOpenDiscordHub?.('discover')}
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-chat)] text-[#23a55a] rounded-[24px] hover:rounded-[16px] hover:bg-[#23a55a] hover:text-white transition-all duration-200 cursor-pointer"
            title="Explore Discoverable Servers"
          >
            <Compass className="w-6 h-6" />
          </button>
        </div>
      </div>
    </aside>
  );
};
