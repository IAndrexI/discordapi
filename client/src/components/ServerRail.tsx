import React from 'react';
import {
  MessageSquare,
  Plus,
  Compass,
  Trophy,
  Puzzle,
  Home,
  Globe,
} from 'lucide-react';
import type { DiscordGuild, EngineMode } from '../types';

interface ServerRailProps {
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
  onOpenEquicord,
}) => {
  const visibleGuilds =
    engineMode === 'proprietary'
      ? guilds.filter(g => !isDiscordBridgedGuild(g))
      : guilds;

  return (
    <aside className="w-[72px] h-full bg-[var(--bg-servers)] flex flex-col items-center py-3 select-none flex-shrink-0 z-20 border-r border-black/20">
      {/* Home / DMs Icon */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        <div
          className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
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
          <MessageSquare className="w-6 h-6 fill-current" />
          {unreadDMsCount > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-[var(--status-dnd)] text-white text-xs font-bold px-1.5 py-0.5 rounded-full ring-4 ring-[var(--bg-servers)]">
              {unreadDMsCount}
            </span>
          )}
        </button>
      </div>

      {/* Top Shortcut Icons: Discord Hub (Quests & Friends) + Equicord */}
      {(onOpenDiscordHub || onOpenEquicord) && (
        <div className="flex flex-col items-center gap-2 w-full mb-1.5">
          {onOpenDiscordHub && (
            <button
              type="button"
              onClick={() => onOpenDiscordHub('quests')}
              data-testid="rail-discord-hub-btn"
              title="Discord Hub (Quests, Friends & Nitro)"
              className="w-11 h-11 flex items-center justify-center rounded-[20px] hover:rounded-[14px] bg-gradient-to-br from-amber-500/20 to-[#5865F2]/25 hover:from-amber-500 hover:to-[#5865F2] text-amber-300 hover:text-white border border-amber-500/30 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <Trophy className="w-5 h-5" />
            </button>
          )}
          {onOpenEquicord && (
            <button
              type="button"
              onClick={onOpenEquicord}
              data-testid="rail-equicord-btn"
              title="Equicord Plugins & Mod Manager"
              className="w-11 h-11 flex items-center justify-center rounded-[20px] hover:rounded-[14px] bg-gradient-to-br from-purple-500/20 to-cyan-500/20 hover:from-purple-600 hover:to-cyan-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <Puzzle className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="w-8 h-[2px] bg-white/10 rounded my-1" />

      {/* Servers List (Distinguishing Proprietary vs Discord Bridged) */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2.5 pt-1">
        {visibleGuilds.map(guild => {
          const isActive = activeGuildId === guild.id;
          const isDiscord = isDiscordBridgedGuild(guild);
          const initials = guild.name
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 3)
            .toUpperCase();

          return (
            <div key={guild.id} className="relative group flex items-center justify-center w-full">
              {/* Active Pill */}
              <div
                className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
                  isActive
                    ? 'h-10'
                    : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
                }`}
              />

              <button
                type="button"
                onClick={() => onSelectGuild(guild.id)}
                className={`w-12 h-12 flex items-center justify-center font-semibold text-sm transition-all duration-200 overflow-visible relative cursor-pointer ${
                  isActive
                    ? isDiscord
                      ? 'bg-[#5865F2] text-white rounded-[16px] ring-2 ring-indigo-300/60'
                      : 'bg-emerald-600 text-white rounded-[16px] ring-2 ring-cyan-300/60'
                    : isDiscord
                    ? 'bg-[var(--bg-chat)] text-indigo-200 rounded-[24px] hover:rounded-[16px] hover:bg-[#5865F2] hover:text-white border border-[#5865F2]/35'
                    : 'bg-[var(--bg-chat)] text-emerald-200 rounded-[24px] hover:rounded-[16px] hover:bg-emerald-600 hover:text-white border border-emerald-500/35'
                }`}
                title={`${guild.name} — ${
                  isDiscord ? 'Discord Bridged Server' : 'Self-Hosted Proprietary Server'
                }`}
              >
                <div className="w-full h-full rounded-[inherit] overflow-hidden flex items-center justify-center">
                  {guild.iconUrl ? (
                    <img src={guild.iconUrl} alt={guild.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                {/* Server Kind Badge */}
                {isDiscord ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#5865F2] text-white rounded-full border-2 border-[var(--bg-servers)] flex items-center justify-center shadow-sm"
                    title="Discord Bridged Server"
                  >
                    <Globe className="w-2.5 h-2.5" />
                  </span>
                ) : (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 text-white rounded-full border-2 border-[var(--bg-servers)] flex items-center justify-center shadow-sm"
                    title="Proprietary Self-Hosted Server"
                  >
                    <Home className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add a Server */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            type="button"
            onClick={() => onOpenAddModal?.()}
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-chat)] text-[var(--status-online)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--status-online)] hover:text-white transition-all duration-200 shadow-md cursor-pointer"
            title="Add or Sync Server"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Explore Discoverable Servers */}
        <div className="relative group flex items-center justify-center w-full pb-2">
          <button
            type="button"
            onClick={() => onOpenDiscordHub?.('discover')}
            className="w-12 h-12 flex items-center justify-center bg-[var(--bg-chat)] text-[var(--text-normal)] rounded-[24px] hover:rounded-[16px] hover:bg-[var(--status-online)] hover:text-white transition-all duration-200 cursor-pointer"
            title="Discover Self-Hosted & Discord Servers"
          >
            <Compass className="w-6 h-6" />
          </button>
        </div>
      </div>
    </aside>
  );
};
