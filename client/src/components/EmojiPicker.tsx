import React, { useMemo, useState } from 'react';
import { Search, Clock } from 'lucide-react';
import {
  ALL_EMOJIS,
  EMOJI_CATEGORIES,
  SKIN_TONES,
  getFrequentEmojis,
  recordEmojiUse,
  searchEmojis,
  type EmojiCategory,
  type EmojiItem,
} from '../data/emojis';

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  ariaLabel?: string;
  className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelect,
  onClose,
  ariaLabel = 'Emoji Picker',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<EmojiCategory | 'frequent'>('frequent');
  const [skinToneIdx, setSkinToneIdx] = useState(0);
  const [showTones, setShowTones] = useState(false);
  const [hovered, setHovered] = useState<EmojiItem | null>(null);
  const [frequent, setFrequent] = useState<string[]>(() => getFrequentEmojis());

  const applyTone = (item: EmojiItem): string => {
    const mod = SKIN_TONES[skinToneIdx]?.mod || '';
    if (!mod || !item.supportsSkinTone) return item.emoji;
    return `${item.emoji}${mod}`;
  };

  const handlePick = (emoji: string) => {
    recordEmojiUse(emoji);
    setFrequent(getFrequentEmojis());
    onSelect(emoji);
  };

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    return searchEmojis(query, 96);
  }, [query]);

  const categoryEmojis = useMemo(() => {
    if (activeCategory === 'frequent') return [];
    return ALL_EMOJIS.filter(e => e.category === activeCategory);
  }, [activeCategory]);

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      data-testid="emoji-picker-dialog"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose?.();
        }
      }}
      className={`w-[320px] max-w-[calc(100vw/var(--app-zoom,1)-24px)] max-h-[calc(58vh/var(--app-zoom,1))] bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-xl shadow-2xl flex flex-col overflow-hidden select-none animate-fadeIn ${className}`}
    >
      {/* Search + Skin Tone Header */}
      <div className="p-2 border-b border-[var(--border-subtle)] flex items-center gap-1.5 flex-shrink-0">
        <div className="flex-1 flex items-center gap-1.5 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus-within:border-[var(--accent-cyan)] rounded-md px-2 py-1">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search emojis..."
            aria-label="Search emojis"
            data-testid="emoji-picker-search"
            autoFocus
            className="w-full bg-transparent border-none outline-none text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTones(v => !v)}
            aria-label="Select skin tone"
            title="Skin Tone"
            className="w-7 h-7 rounded-md bg-[var(--bg-message-input)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-sm cursor-pointer"
          >
            {SKIN_TONES[skinToneIdx].preview}
          </button>
          {showTones && (
            <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-1 flex items-center gap-0.5">
              {SKIN_TONES.map((t, idx) => (
                <button
                  key={t.label}
                  type="button"
                  title={t.label}
                  onClick={() => {
                    setSkinToneIdx(idx);
                    setShowTones(false);
                  }}
                  className={`w-7 h-7 rounded flex items-center justify-center text-sm cursor-pointer hover:bg-[var(--bg-item-hover)] ${
                    skinToneIdx === idx ? 'bg-[var(--discord-blurple)]/25' : ''
                  }`}
                >
                  {t.preview}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      {!searchResults && (
        <div className="px-1.5 py-1 border-b border-[var(--border-subtle)] flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveCategory('frequent')}
            title="Frequently Used"
            aria-label="Frequently Used"
            className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
              activeCategory === 'frequent'
                ? 'bg-[var(--discord-blurple)]/25 text-[var(--accent-cyan)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {EMOJI_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              title={cat.id}
              aria-label={cat.id}
              className={`w-7 h-7 rounded flex items-center justify-center text-sm flex-shrink-0 cursor-pointer transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[var(--discord-blurple)]/25'
                  : 'hover:bg-[var(--bg-item-hover)] opacity-80 hover:opacity-100'
              }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2.5">
        {searchResults ? (
          searchResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No emojis match "{query}".
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 px-1">
                Search Results ({searchResults.length})
              </div>
              <div className="grid grid-cols-8 gap-1">
                {searchResults.map(item => {
                  const char = applyTone(item);
                  return (
                    <button
                      key={`${item.name}-${char}`}
                      type="button"
                      onClick={() => handlePick(char)}
                      onMouseEnter={() => setHovered(item)}
                      aria-label={`:${item.name}:`}
                      className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-110"
                    >
                      {char}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : activeCategory === 'frequent' ? (
          <>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 px-1">
                Frequently Used
              </div>
              <div className="grid grid-cols-8 gap-1">
                {frequent.map(emoji => (
                  <button
                    key={`freq-${emoji}`}
                    type="button"
                    onClick={() => handlePick(emoji)}
                    aria-label={`Emoji ${emoji}`}
                    className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 px-1">
                Smileys &amp; Emotion
              </div>
              <div className="grid grid-cols-8 gap-1">
                {ALL_EMOJIS.filter(e => e.category === 'Smileys & Emotion')
                  .slice(0, 48)
                  .map(item => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handlePick(item.emoji)}
                      onMouseEnter={() => setHovered(item)}
                      aria-label={`:${item.name}:`}
                      className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-110"
                    >
                      {item.emoji}
                    </button>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 px-1">
              {activeCategory}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {categoryEmojis.map(item => {
                const char = applyTone(item);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handlePick(char)}
                    onMouseEnter={() => setHovered(item)}
                    aria-label={`:${item.name}:`}
                    className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-110"
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Hover Shortcode Preview Footer */}
      <div className="px-2.5 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-channels)] flex items-center justify-between text-xs flex-shrink-0">
        {hovered ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{applyTone(hovered)}</span>
            <span className="font-mono text-[11px] text-[var(--text-header)] truncate">
              :{hovered.name}:
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">
            {ALL_EMOJIS.length} emojis • Tip: type <code className="text-[var(--accent-cyan)]">:fire</code> in chat
          </span>
        )}
      </div>
    </div>
  );
};
