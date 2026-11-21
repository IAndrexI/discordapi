import React, { useEffect, useState } from 'react';
import { Plus, Compass } from 'lucide-react';
import type { DiscordGuild, EngineMode } from '../types';
import { appIconService, DEFAULT_APP_ICON_FALLBACK } from '../services/appIcon';

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
  const [appIcon, setAppIcon] = useState(() => appIconService.getIcon());

  useEffect(() => {
    return appIconService.subscribe(setAppIcon);
  }, []);

  const visibleGuilds =
    engineMode === 'proprietary'
      ? guilds.filter(g => !isDiscordBridgedGuild(g))
      : guilds;

  return (
    <aside
      aria-label="Servers"
      className="w-[68px] h-full bg-[var(--bg-servers)] border-r border-[var(--border-subtle)] flex flex-col items-center py-3 select-none flex-shrink-0 z-20 overflow-y-auto overflow-x-hidden no-scrollbar"
    >
      {/* Home / Direct Messages Squircle */}
      <div className="relative group flex items-center justify-center w-full mb-2 flex-shrink-0">
        <div
          className={`absolute left-0 w-1 bg-[var(--accent-cyan)] rounded-r-full transition-all duration-200 ${
            activeGuildId === null
              ? 'h-8'
              : 'h-2 scale-0 group-hover:scale-100 group-hover:h-4'
          }`}
        />

        <button
          type="button"
          onClick={() => onSelectGuild(null)}
          aria-label="Direct Messages"
          aria-current={activeGuildId === null ? 'page' : undefined}
          className={`w-11 h-11 flex items-center justify-center transition-all duration-200 relative cursor-pointer overflow-hidden ${
            activeGuildId === null
              ? 'bg-[var(--discord-blurple)] text-white rounded-[14px]'
              : 'bg-[var(--bg-card)] text-[var(--text-normal)] rounded-[22px] hover:rounded-[14px] hover:bg-[var(--discord-blurple)] hover:text-white'
          }`}
          title="Direct Messages"
        >
          <img
            src={appIcon}
            alt="Protutech"
            onError={e => {
              if (e.currentTarget.src !== DEFAULT_APP_ICON_FALLBACK) {
                e.currentTarget.src = DEFAULT_APP_ICON_FALLBACK;
              }
            }}
            className="w-7 h-7 rounded-lg object-cover"
          />
          {unreadDMsCount > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-[var(--status-dnd)] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full ring-4 ring-[var(--bg-servers)] leading-none">
              {unreadDMsCount}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-8 h-[2px] bg-[var(--border-subtle)] rounded-full mb-2 flex-shrink-0" />

      {/* Server Icons List */}
      <div className="w-full flex flex-col items-center gap-2">
        {visibleGuilds.map(guild => {
          const isActive = activeGuildId === guild.id;
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
                className={`absolute left-0 w-1 bg-[var(--accent-cyan)] rounded-r-full transition-all duration-200 ${
                  isActive
                    ? 'h-8'
                    : 'h-2 scale-0 group-hover:scale-100 group-hover:h-4'
                }`}
              />

              <button
                type="button"
                onClick={() => onSelectGuild(guild.id)}
                aria-label={guild.name}
                aria-current={isActive ? 'page' : undefined}
                className={`w-11 h-11 flex items-center justify-center font-semibold text-sm transition-all duration-200 overflow-hidden cursor-pointer ${
                  isActive
                    ? 'bg-[var(--discord-blurple)] text-white rounded-[14px]'
                    : 'bg-[var(--bg-card)] text-[var(--text-normal)] rounded-[22px] hover:rounded-[14px] hover:bg-[var(--discord-blurple)] hover:text-white'
                }`}
                title={guild.name}
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
            aria-label="Add Server"
            className="w-11 h-11 flex items-center justify-center bg-[var(--bg-card)] text-[var(--status-online)] rounded-[22px] hover:rounded-[14px] hover:bg-[var(--status-online)] hover:text-white transition-all duration-200 cursor-pointer"
            title="Add Server"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Explore Servers */}
        <div className="relative group flex items-center justify-center w-full pb-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onOpenDiscordHub?.('discover')}
            aria-label="Explore Servers"
            className="w-11 h-11 flex items-center justify-center bg-[var(--bg-card)] text-[var(--status-online)] rounded-[22px] hover:rounded-[14px] hover:bg-[var(--status-online)] hover:text-white transition-all duration-200 cursor-pointer"
            title="Explore Servers"
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
