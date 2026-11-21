import React, { useMemo, useState } from 'react';
import { Hash, Volume2, MessageSquare, Search, Compass, X } from 'lucide-react';
import type { DiscordGuild, MatrixRoom } from '../types';

export interface QuickSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  guilds: DiscordGuild[];
  rooms: MatrixRoom[];
  onSelectGuild: (guildId: string | null) => void;
  onSelectRoom: (roomId: string) => void;
  onJoinVoice?: (room: MatrixRoom) => void;
}

interface SwitcherItem {
  id: string;
  label: string;
  sublabel: string;
  kind: 'channel' | 'voice' | 'dm' | 'guild';
  guildId?: string | null;
  room?: MatrixRoom;
}

export const QuickSwitcherModal: React.FC<QuickSwitcherModalProps> = ({
  isOpen,
  onClose,
  guilds,
  rooms,
  onSelectGuild,
  onSelectRoom,
  onJoinVoice,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleClose = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  const items = useMemo<SwitcherItem[]>(() => {
    const list: SwitcherItem[] = [];
    for (const r of rooms) {
      list.push({
        id: `room-${r.id}`,
        label: r.name,
        sublabel: r.isDirect ? 'Direct Message' : r.guildName || 'Channel',
        kind: r.isVoice ? 'voice' : r.isDirect ? 'dm' : 'channel',
        guildId: r.guildId || null,
        room: r,
      });
    }
    for (const g of guilds) {
      list.push({
        id: `guild-${g.id}`,
        label: g.name,
        sublabel: 'Server',
        kind: 'guild',
        guildId: g.id,
      });
    }
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 12);
    return list
      .filter(
        it =>
          it.label.toLowerCase().includes(q) ||
          it.sublabel.toLowerCase().includes(q)
      )
      .slice(0, 14);
  }, [guilds, rooms, query]);

  if (!isOpen) return null;

  const activateItem = (item: SwitcherItem) => {
    if (item.kind === 'guild') {
      onSelectGuild(item.guildId || null);
    } else if (item.room) {
      if (item.room.guildId) onSelectGuild(item.room.guildId);
      else if (item.room.isDirect) onSelectGuild(null);
      if (item.room.isVoice && onJoinVoice) {
        onJoinVoice(item.room);
      } else {
        onSelectRoom(item.room.id);
      }
    }
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-3"
      onClick={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick Switcher"
        data-testid="quick-switcher-modal"
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => (items.length ? (i + 1) % items.length : 0));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => (items.length ? (i - 1 + items.length) % items.length : 0));
          } else if (e.key === 'Enter' && items[selectedIndex]) {
            e.preventDefault();
            activateItem(items[selectedIndex]);
          }
        }}
        className="w-full max-w-lg max-h-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn"
      >
        <div className="p-3 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--bg-channels)]">
          <Search className="w-4 h-4 text-[var(--accent-cyan)] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Where would you like to go? (channels, DMs, servers...)"
            aria-label="Quick Switcher search"
            data-testid="quick-switcher-input"
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Quick Switcher"
            className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No matching channels, DMs, or servers found.
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => activateItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--discord-blurple)] text-white'
                      : 'text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.kind === 'voice' ? (
                      <Volume2 className="w-4 h-4 flex-shrink-0" />
                    ) : item.kind === 'dm' ? (
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    ) : item.kind === 'guild' ? (
                      <Compass className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Hash className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </div>
                  <span
                    className={`text-[11px] flex-shrink-0 ml-2 ${
                      active ? 'text-white/80' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {item.sublabel}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-channels)] text-[10px] text-[var(--text-muted)] flex items-center justify-between">
          <span>PROTIP: Press ↑↓ to navigate, Enter to jump</span>
          <span className="font-mono">Ctrl + K</span>
        </div>
      </div>
    </div>
  );
};
