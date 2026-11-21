import React, { useState } from 'react';
import { X, MessageSquare, Send } from 'lucide-react';
import type { MatrixMessage } from '../types';

export interface ThreadReply {
  id: string;
  senderName: string;
  body: string;
  timestamp: number;
}

export interface ThreadDrawerProps {
  parentMessage: MatrixMessage | null;
  replies: ThreadReply[];
  onClose: () => void;
  onSendReply: (parentId: string, body: string) => void;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  parentMessage,
  replies,
  onClose,
  onSendReply,
}) => {
  const [draft, setDraft] = useState('');

  if (!parentMessage) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    onSendReply(parentMessage.id, clean);
    setDraft('');
  };

  return (
    <aside
      role="dialog"
      aria-label="Thread"
      data-testid="thread-drawer"
      className="w-80 max-w-full h-full bg-[var(--bg-channels)] border-l border-[var(--border-subtle)] flex flex-col flex-shrink-0 animate-fadeIn z-20"
    >
      <div className="h-12 px-3 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-[var(--accent-cyan)] flex-shrink-0" />
          <span className="text-sm font-bold text-[var(--text-header)] truncate">Thread</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Thread"
          className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent Message */}
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/50">
        <div className="text-xs font-semibold text-[var(--text-header)] mb-1">
          {parentMessage.senderName}
        </div>
        <div className="text-xs text-[var(--text-normal)] line-clamp-4 whitespace-pre-wrap">
          {parentMessage.body}
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {replies.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">
            No thread replies yet. Start the conversation below!
          </div>
        ) : (
          replies.map(r => (
            <div key={r.id} className="space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-[var(--text-header)]">
                  {r.senderName}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-xs text-[var(--text-normal)] whitespace-pre-wrap break-words">
                {r.body}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply Composer */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-[var(--border-subtle)] flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Reply in thread..."
          aria-label="Reply in thread"
          data-testid="thread-reply-input"
          className="flex-1 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--accent-cyan)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-header)] outline-none"
        />
        <button
          type="submit"
          aria-label="Send thread reply"
          className="p-1.5 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
