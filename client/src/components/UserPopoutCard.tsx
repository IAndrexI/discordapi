import React, { useState } from 'react';
import { X, Shield, StickyNote } from 'lucide-react';
import type { MatrixUser } from '../types';

export interface UserPopoutCardProps {
  user: MatrixUser | null;
  onClose: () => void;
}

const NOTES_STORAGE_KEY = 'protutech_user_notes_v1';

function readNote(userId: string): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return '';
    const map = JSON.parse(raw) as Record<string, string>;
    return map[userId] || '';
  } catch {
    return '';
  }
}

function saveNote(userId: string, note: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[userId] = note;
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export const UserPopoutCard: React.FC<UserPopoutCardProps> = ({ user, onClose }) => {
  const [note, setNote] = useState(() => (user ? readNote(user.userId) : ''));

  if (!user) return null;

  const displayName = user.displayName || user.userId;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} Profile`}
        data-testid="user-popout-card"
        className="w-full max-w-xs bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden animate-fadeIn"
      >
        {/* Banner */}
        <div className="h-16 bg-gradient-to-r from-[#0284c7] to-[#7f00ff] relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile Popout"
            className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-4 pb-4">
          <div className="-mt-8 mb-2 relative inline-block">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-servers)] border-4 border-[var(--bg-card)] flex items-center justify-center text-lg font-bold text-[var(--text-header)] overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span
              className={`w-4 h-4 rounded-full border-2 border-[var(--bg-card)] absolute bottom-0 right-0 ${
                user.presence === 'online'
                  ? 'bg-[var(--status-online)]'
                  : user.presence === 'idle'
                    ? 'bg-[var(--status-idle)]'
                    : user.presence === 'dnd'
                      ? 'bg-[var(--status-dnd)]'
                      : 'bg-[var(--text-muted)]'
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-bold text-[var(--text-header)] truncate">{displayName}</h3>
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)] truncate">{user.userId}</div>

          {user.statusMsg && (
            <div className="mt-2 text-xs text-[var(--text-normal)] bg-[var(--bg-channels)] px-2.5 py-1.5 rounded border border-[var(--border-subtle)]">
              {user.statusMsg}
            </div>
          )}

          {/* Badges */}
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--accent-cyan)]">
            <Shield className="w-3.5 h-3.5" />
            <span>Protutech Member</span>
          </div>

          {/* Persistent Note (BetterNotes) */}
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <label
              htmlFor="user-popout-note"
              className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1 mb-1"
            >
              <StickyNote className="w-3 h-3" />
              <span>Note</span>
            </label>
            <textarea
              id="user-popout-note"
              rows={2}
              value={note}
              onChange={e => {
                setNote(e.target.value);
                saveNote(user.userId, e.target.value);
              }}
              placeholder="Click to add a private note..."
              className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--accent-cyan)] rounded px-2 py-1 text-xs text-[var(--text-header)] outline-none resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
