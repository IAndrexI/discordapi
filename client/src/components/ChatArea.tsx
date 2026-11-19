import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Hash,
  Search,
  Bell,
  Pin,
  Users,
  PlusCircle,
  Smile,
  PhoneCall,
  FileText,
  Trash2,
  Link as LinkIcon,
  Gamepad2,
  Send,
  Paperclip,
  Reply,
  Pencil,
  Check,
  X,
  CornerUpRight,
  Music,
  Package,
  Globe,
  Download,
  FileArchive,
  Pickaxe,
  Terminal,
} from 'lucide-react';
import type { MatrixMessage, MatrixRoom } from '../types';
import { matrix } from '../services/matrix';
import { vencord } from '../services/vencord';
import { scriptEngine } from '../services/scriptEngine';
import {
  fileTransferService,
  formatBytes,
  parseLargeFileFromMessage,
} from '../services/fileTransfer';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '🚀'];
const INPUT_EMOJIS = ['🚀', '🔥', '❤️', '👍', '😂', '🎮', '⚡', '👀'];

interface ReplyTarget {
  id: string;
  sender: string;
  body: string;
}

interface ChatAreaProps {
  room: MatrixRoom;
  messages: MatrixMessage[];
  onSendMessage: (text: string, replyTo?: ReplyTarget) => void;
  onMediaSent?: (message: MatrixMessage) => void;
  onSendMediaGuest?: (roomId: string, file: File) => Promise<void> | void;
  onEditMessage?: (roomId: string, messageId: string, newText: string) => void;
  onAddReaction?: (roomId: string, messageId: string, emoji: string) => void;
  onJoinVoice: (room: MatrixRoom) => void;
  isVoiceActive: boolean;
  onToggleMemberList: () => void;
  showMemberList: boolean;
  onOpenSyncLater?: (room: MatrixRoom) => void;
  onDeleteMessage?: (roomId: string, messageId: string) => void;
  onOpenActivity?: () => void;
  onOpenLargeFileShare?: () => void;
  onOpenCoBrowse?: () => void;
  onOpenScripts?: () => void;
  onMessageInjected?: (message: MatrixMessage) => void;
  currentUserId?: string;
  currentUserName?: string;
  isGuestMode?: boolean;
}

const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface MessageRowProps {
  msg: MatrixMessage;
  roomId: string;
  isSameSender: boolean;
  isOwnMessage: boolean;
  isLoggerEnabled: boolean;
  currentUserId?: string;
  onReply: (target: ReplyTarget) => void;
  onDeleteMessage?: (roomId: string, messageId: string) => void;
  onEditMessage?: (roomId: string, messageId: string, newText: string) => void;
  onAddReaction?: (roomId: string, messageId: string, emoji: string) => void;
}

const MessageRow = React.memo<MessageRowProps>(({
  msg,
  roomId,
  isSameSender,
  isOwnMessage,
  isLoggerEnabled,
  currentUserId,
  onReply,
  onDeleteMessage,
  onEditMessage,
  onAddReaction,
}) => {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.body);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const avatarError = Boolean(msg.avatarUrl && failedAvatarUrl === msg.avatarUrl);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== msg.body && onEditMessage) {
      onEditMessage(roomId, msg.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditText(msg.body);
      setIsEditing(false);
    }
  };

  const reactionEntries = msg.reactions
    ? Object.entries(msg.reactions).filter(([, users]) => Array.isArray(users) && users.length > 0)
    : [];
  const largeFile = parseLargeFileFromMessage(msg);
  const isMinecraftBridge = msg.webhookMeta?.bridge === 'minecraft';
  const isWebhookBridge = msg.webhookMeta?.bridge === 'webhook' || msg.webhookMeta?.bridge === 'script';

  return (
    <div
      className={`group relative flex gap-4 px-2 -mx-2 py-0.5 rounded hover:bg-[var(--bg-message-hover)] transition-colors ${
        isSameSender && !msg.replyTo ? 'mt-0.5' : 'mt-4'
      }`}
    >
      {/* Left Gutter: Avatar or Hover Timestamp */}
      {!isSameSender || msg.replyTo ? (
        msg.avatarUrl && !avatarError ? (
          <img
            src={msg.avatarUrl}
            alt={msg.senderName}
            onError={() => setFailedAvatarUrl(msg.avatarUrl || null)}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 border border-white/10 bg-[var(--bg-servers)]"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">
            {(msg.senderName || 'U').slice(0, 2).toUpperCase()}
          </div>
        )
      ) : (
        <div className="w-10 flex-shrink-0 text-[10px] text-right text-[var(--text-muted)] opacity-0 group-hover:opacity-100 select-none pt-1">
          {formatTimestamp(msg.timestamp)}
        </div>
      )}

      {/* Main Message Body */}
      <div className="flex-1 min-w-0">
        {/* Reply Reference Banner */}
        {msg.replyTo && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1 pl-1 border-l-2 border-[#5865F2]/60">
            <CornerUpRight className="w-3 h-3 text-[#5865F2] flex-shrink-0" />
            <span className="font-semibold text-gray-300 truncate max-w-[140px]">
              @{msg.replyTo.sender}
            </span>
            <span className="truncate opacity-80">{msg.replyTo.body}</span>
          </div>
        )}

        {/* Sender Header */}
        {(!isSameSender || msg.replyTo) && (
          <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
              {msg.senderName}
            </span>

            {msg.source === 'discord' && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-[#5865F2]/25 text-indigo-300 border border-[#5865F2]/40 leading-none"
                title="Bridged from Discord"
              >
                Discord
              </span>
            )}

            {isMinecraftBridge && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 leading-none inline-flex items-center gap-1"
                title="Bridged from Minecraft Server"
              >
                <Pickaxe className="w-2.5 h-2.5" />
                <span>Minecraft</span>
              </span>
            )}

            {isWebhookBridge && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 leading-none inline-flex items-center gap-1"
                title="Script / Webhook Integration"
              >
                <Terminal className="w-2.5 h-2.5" />
                <span>Script</span>
              </span>
            )}

            <span className="text-[11px] text-[var(--text-muted)] font-medium">
              {formatTimestamp(msg.timestamp)}
            </span>

            {msg.isEdited && (
              <span className="text-[10px] text-[var(--text-muted)] italic">(edited)</span>
            )}

            {msg.isDeleted && isLoggerEnabled && (
              <span className="bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] text-[10px] font-bold px-1 rounded flex items-center gap-0.5">
                <Trash2 className="w-2.5 h-2.5" />
                DELETED
              </span>
            )}
          </div>
        )}

        {/* Message Content or Inline Edit */}
        {isEditing ? (
          <div className="my-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                autoFocus
                className="flex-1 bg-[var(--bg-message-input)] border border-cyan-500/50 rounded px-3 py-1.5 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                title="Save edit (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText(msg.body);
                  setIsEditing(false);
                }}
                className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              escape to cancel • enter to save
            </div>
          </div>
        ) : msg.body.includes('[STEAM GAME INVITE]') ? (
          <div className="p-3 my-1 rounded-xl bg-gradient-to-r from-blue-950/60 to-slate-900/80 border border-cyan-500/30 max-w-md shadow-lg flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎮</span>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Steam Game Invitation</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    Lobby Ready
                  </span>
                </div>
                <div className="text-[11px] text-gray-300">
                  {msg.senderName} wants to play right now
                </div>
              </div>
            </div>

            <div className="text-xs text-cyan-200 font-medium whitespace-pre-wrap">
              {msg.body.replace('[STEAM GAME INVITE]', '').trim()}
            </div>

            <div className="pt-1 flex items-center gap-2">
              {(() => {
                const match = msg.body.match(/steam:\/\/[\w\d/._-]+/);
                const url = match ? match[0] : null;
                if (!url) return null;
                return (
                  <button
                    onClick={() => window.open(url, '_blank')}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <span>Launch &amp; Join in Steam</span>
                  </button>
                );
              })()}
            </div>
          </div>
        ) : largeFile ? (
          <div
            data-testid="large-file-attachment-card"
            className="my-1.5 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 via-slate-900/85 to-slate-950/90 border border-cyan-500/35 max-w-md shadow-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 flex-shrink-0">
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{largeFile.fileName}</div>
                <div className="text-[11px] text-cyan-300/90 font-mono flex items-center gap-1.5 flex-wrap">
                  <span>{formatBytes(largeFile.fileSize)}</span>
                  <span>•</span>
                  <span className="uppercase">{largeFile.mode === 'p2p' ? 'P2P Direct' : 'Chunked Stream'}</span>
                  {largeFile.speedMBps > 0 && (
                    <>
                      <span>•</span>
                      <span>{largeFile.speedMBps} MB/s</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <a
              href={fileTransferService.getDownloadHref(largeFile)}
              download={largeFile.fileName}
              target="_blank"
              rel="noreferrer"
              data-testid="large-file-download-link"
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 flex-shrink-0 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        ) : (
          <div className="text-[var(--text-normal)] text-[14px] leading-relaxed break-words select-text whitespace-pre-wrap">
            {msg.body}
            {isSameSender && !msg.replyTo && msg.isEdited && (
              <span className="ml-1.5 text-[10px] text-[var(--text-muted)] italic">(edited)</span>
            )}
            {isSameSender && !msg.replyTo && msg.isDeleted && isLoggerEnabled && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] text-[10px] font-bold px-1 rounded">
                <Trash2 className="w-2.5 h-2.5" />
                DELETED
              </span>
            )}
          </div>
        )}

        {/* Inline Video Player */}
        {msg.mediaType === 'video' && msg.mediaUrl && (
          <div className="mt-2 max-w-lg rounded-lg overflow-hidden border border-white/10 bg-black">
            <video
              src={msg.mediaUrl}
              controls
              playsInline
              className="w-full max-h-[360px] object-contain"
            />
          </div>
        )}

        {/* Inline Image Attachment */}
        {msg.mediaType === 'image' && msg.mediaUrl && (
          <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-white/10 inline-block">
            <img
              src={msg.mediaUrl}
              alt={msg.body || 'Attachment'}
              onClick={() => window.open(msg.mediaUrl, '_blank')}
              className="max-h-[320px] rounded object-cover cursor-pointer hover:opacity-95"
            />
          </div>
        )}

        {/* Inline Audio Attachment */}
        {msg.mediaType === 'audio' && msg.mediaUrl && (
          <div className="mt-2 max-w-md rounded-lg bg-[var(--bg-userpanel)] border border-white/10 p-2.5 flex items-center gap-2.5">
            <Music className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <audio src={msg.mediaUrl} controls className="w-full h-8" />
          </div>
        )}

        {/* Generic File Attachment */}
        {msg.mediaType === 'file' && msg.mediaUrl && (
          <div className="mt-2 inline-flex items-center gap-2 bg-[var(--bg-userpanel)] border border-white/10 rounded p-3 text-sm">
            <FileText className="w-6 h-6 text-[var(--discord-blurple)]" />
            <a
              href={msg.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-link)] hover:underline truncate max-w-xs"
            >
              {msg.body || 'Download Attachment'}
            </a>
          </div>
        )}

        {/* Emoji Reactions */}
        {reactionEntries.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
            {reactionEntries.map(([emoji, users]) => {
              const hasReacted = currentUserId ? users.includes(currentUserId) : false;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onAddReaction?.(roomId, msg.id, emoji)}
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                    hasReacted
                      ? 'bg-[#5865F2]/25 border-[#5865F2]/60 text-white'
                      : 'bg-white/[0.05] border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                  title={`${users.length} reaction${users.length > 1 ? 's' : ''}`}
                >
                  <span>{emoji}</span>
                  <span className="text-[11px] font-mono">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating message hover action bar */}
      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-[var(--bg-userpanel)] border border-white/10 rounded-md shadow-lg px-1 py-0.5 self-start -mt-2 z-10 relative">
        {onAddReaction && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionPicker(p => !p)}
              title="Add Reaction"
              className="p-1 hover:bg-white/10 text-[var(--text-muted)] hover:text-amber-300 rounded transition-colors cursor-pointer"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showReactionPicker && (
              <div className="absolute right-0 bottom-full mb-1 bg-[var(--bg-popout)] border border-white/15 rounded-lg p-1 shadow-xl flex items-center gap-1 z-30">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onAddReaction(roomId, msg.id, emoji);
                      setShowReactionPicker(false);
                    }}
                    className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-sm cursor-pointer transition-transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            onReply({
              id: msg.id,
              sender: msg.senderName || msg.sender,
              body: msg.body,
            })
          }
          title="Reply"
          className="p-1 hover:bg-white/10 text-[var(--text-muted)] hover:text-cyan-300 rounded transition-colors cursor-pointer"
        >
          <Reply className="w-4 h-4" />
        </button>

        {onEditMessage && isOwnMessage && (
          <button
            type="button"
            onClick={() => {
              setEditText(msg.body);
              setIsEditing(true);
            }}
            title="Edit message"
            className="p-1 hover:bg-white/10 text-[var(--text-muted)] hover:text-white rounded transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

        {onDeleteMessage && (
          <button
            type="button"
            onClick={() => onDeleteMessage(roomId, msg.id)}
            title="Delete message"
            className="p-1 hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});

MessageRow.displayName = 'MessageRow';

interface ChatInputBarProps {
  room: MatrixRoom;
  replyingTo: ReplyTarget | null;
  onCancelReply: () => void;
  onSendMessage: (text: string, replyTo?: ReplyTarget) => void;
  onMediaSent?: (message: MatrixMessage) => void;
  onSendMediaGuest?: (roomId: string, file: File) => Promise<void> | void;
  onOpenLargeFileShare?: () => void;
  onMessageInjected?: (message: MatrixMessage) => void;
  currentUserName?: string;
  isGuestMode?: boolean;
}

const ChatInputBar = React.memo<ChatInputBarProps>(({
  room,
  replyingTo,
  onCancelReply,
  onSendMessage,
  onMediaSent,
  onSendMediaGuest,
  onOpenLargeFileShare,
  onMessageInjected,
  currentUserName,
  isGuestMode,
}) => {
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  const submitCurrentMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    setInputText('');
    const activeReply = replyingTo || undefined;
    if (replyingTo) onCancelReply();

    if (trimmed.startsWith('/')) {
      const cmdResult = await scriptEngine.executeSlashCommand(
        trimmed,
        room.id,
        room.name,
        currentUserName || 'andrex',
        onMessageInjected
      );
      if (cmdResult.handled) {
        return;
      }
    }

    const vencordExt = vencord as unknown as {
      executeMessageSendHooks?: (text: string) => string;
    };
    const finalBody =
      typeof vencordExt.executeMessageSendHooks === 'function'
        ? vencordExt.executeMessageSendHooks(trimmed)
        : trimmed;

    onSendMessage(finalBody, activeReply);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitCurrentMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const canUseMatrixMedia =
        !isGuestMode &&
        matrix.isAuthenticated() &&
        !room.id.startsWith('guest_') &&
        !room.id.startsWith('temp_');

      if (canUseMatrixMedia) {
        const sent = await matrix.sendMediaMessage(room.id, file);
        if (sent) {
          onMediaSent?.(sent);
        } else {
          // Fallback to legacy uploadMedia if sendMediaMessage returned null
          const mxcUrl = await matrix.uploadMedia(file);
          if (mxcUrl) {
            const httpUrl = matrix.mxcToHttp(mxcUrl);
            onSendMessage(`${file.name} - ${httpUrl}`);
          }
        }
      } else if (onSendMediaGuest) {
        await onSendMediaGuest(room.id, file);
      } else {
        onSendMessage(`📎 Attachment: ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="px-4 pb-5 flex-shrink-0">
      {/* Reply Banner */}
      {replyingTo && (
        <div className="bg-[var(--bg-userpanel)] border border-white/10 border-b-0 rounded-t-lg px-3.5 py-2 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-[var(--text-muted)]">Replying to</span>
            <span className="font-bold text-white truncate max-w-[140px]">@{replyingTo.sender}</span>
            <span className="text-[var(--text-muted)] truncate max-w-xs opacity-75">
              "{replyingTo.body}"
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 cursor-pointer"
            title="Cancel Reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        className={`bg-[var(--bg-message-input)] px-4 py-2.5 flex items-center gap-3 shadow-inner relative ${
          replyingTo ? 'rounded-b-lg border border-white/10 border-t-0' : 'rounded-lg'
        }`}
      >
        {/* File Upload Button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          title={isUploading ? 'Uploading attachment...' : 'Upload Image, Video, Audio, or File'}
        >
          <PlusCircle className={`w-5 h-5 ${isUploading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${room.name}`}
          className="bg-transparent border-none outline-none flex-1 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] resize-none max-h-36 py-1 text-sm"
        />

        {/* Emoji Picker Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiTray(v => !v)}
            className="text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Add Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmojiTray && (
            <div className="absolute right-0 bottom-full mb-2 bg-[var(--bg-popout)] border border-white/15 rounded-xl p-1.5 shadow-2xl flex items-center gap-1 z-30">
              {INPUT_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setInputText(prev => prev + emoji);
                    setShowEmojiTray(false);
                    textareaRef.current?.focus();
                  }}
                  className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-base cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Large File Transfer Action */}
        {onOpenLargeFileShare && (
          <button
            type="button"
            onClick={onOpenLargeFileShare}
            className="text-[var(--text-muted)] hover:text-cyan-300 transition-colors cursor-pointer"
            title="Zero-Size-Cap Large File Share (Chunked Stream / P2P)"
          >
            <Package className="w-5 h-5" />
          </button>
        )}

        {/* Dedicated File Sharing action */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[var(--text-muted)] hover:text-cyan-400 transition-colors cursor-pointer relative group"
          title="Attach Media / File to Discord & Matrix"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Send Message Button */}
        <button
          type="button"
          onClick={submitCurrentMessage}
          disabled={!inputText.trim()}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            inputText.trim()
              ? 'bg-[var(--discord-blurple)] text-white hover:bg-[var(--discord-blurple-hover)] shadow-md'
              : 'text-[var(--text-muted)] opacity-50 cursor-not-allowed'
          }`}
          title="Send Message (or press Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';

export const ChatArea: React.FC<ChatAreaProps> = ({
  room,
  messages,
  onSendMessage,
  onMediaSent,
  onSendMediaGuest,
  onEditMessage,
  onAddReaction,
  onJoinVoice,
  isVoiceActive,
  onToggleMemberList,
  showMemberList,
  onOpenSyncLater,
  onDeleteMessage,
  onOpenActivity,
  onOpenLargeFileShare,
  onOpenCoBrowse,
  onOpenScripts,
  onMessageInjected,
  currentUserId,
  currentUserName,
  isGuestMode,
}) => {
  const [searchState, setSearchState] = useState<{ roomId: string; query: string }>({
    roomId: room.id,
    query: '',
  });
  const [replyState, setReplyState] = useState<{ roomId: string; target: ReplyTarget } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const searchQuery = searchState.roomId === room.id ? searchState.query : '';
  const replyingTo = replyState?.roomId === room.id ? replyState.target : null;

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchState({ roomId: room.id, query });
    },
    [room.id]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, room.id, scrollToBottom]);

  const handleReply = useCallback(
    (target: ReplyTarget) => {
      setReplyState({ roomId: room.id, target });
    },
    [room.id]
  );

  const handleCancelReply = useCallback(() => {
    setReplyState(null);
  }, []);

  const isLoggerEnabled = vencord.isPluginEnabled('messageLogger');
  const effectiveUserId = currentUserId || matrix.getUserId() || '@guest:chat.protutech.vip';

  const displayedMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      m =>
        m.body.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  return (
    <div className="flex-1 h-full bg-[var(--bg-chat)] flex flex-col min-w-0 select-text overflow-hidden">
      {/* Top Channel Header */}
      <div className="h-12 border-b border-black/20 px-4 flex items-center justify-between select-none shadow-sm flex-shrink-0 z-10 bg-[var(--bg-chat)]">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-6 h-6 text-[var(--text-muted)] flex-shrink-0" />
          <span className="font-bold text-white text-sm truncate">{room.name}</span>
          {room.topic && (
            <>
              <div className="w-[1px] h-4 bg-white/10 mx-1 flex-shrink-0" />
              <span className="text-xs text-[var(--text-muted)] truncate max-w-md">
                {room.topic}
              </span>
            </>
          )}

          {/* Sync Status Badge or Later-Sync Action */}
          {room.isSynced ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Synced</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onOpenSyncLater?.(room)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/35 text-cyan-300 border border-cyan-400/30 flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0 cursor-pointer"
              title="Synchronize this conversation"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Sync Channel</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-[var(--text-muted)] flex-shrink-0">
          {/* Zero-Size-Cap Large File Share */}
          {onOpenLargeFileShare && (
            <button
              type="button"
              onClick={onOpenLargeFileShare}
              data-testid="chat-large-file-btn"
              className="hover:text-cyan-200 hover:bg-cyan-500/20 text-cyan-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-cyan-500/30 cursor-pointer shadow-sm"
              title="Share Any Size File (Chunked Server Stream or P2P)"
            >
              <Package className="w-3.5 h-3.5 text-cyan-400" />
              <span>📦 Large File</span>
            </button>
          )}

          {/* Co-Browse & Built-in Search Engine */}
          {onOpenCoBrowse && (
            <button
              type="button"
              onClick={onOpenCoBrowse}
              data-testid="chat-cobrowse-btn"
              className="hover:text-sky-200 hover:bg-sky-500/20 text-sky-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-sky-500/30 cursor-pointer shadow-sm"
              title="Open Built-In Search Engine & Synchronized Co-Browser"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>🌐 Co-Browse / Search</span>
            </button>
          )}

          {/* Scripts & MC Bridge */}
          {onOpenScripts && (
            <button
              type="button"
              onClick={onOpenScripts}
              className="hover:text-emerald-200 hover:bg-emerald-500/20 text-emerald-300 transition-colors hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-500/30 cursor-pointer shadow-sm"
              title="Scripts, Slash Commands & Minecraft Chat Bridge"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scripts</span>
            </button>
          )}

          {/* Mini-Games, YouTube & Shared Web Activities */}
          {onOpenActivity && (
            <button
              onClick={onOpenActivity}
              className="hover:text-purple-300 hover:bg-purple-500/15 text-purple-400 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-purple-500/30 cursor-pointer shadow-sm"
              title="Start an Activity (Mini Games, Watch YouTube, or Browse Web Together)"
            >
              <Gamepad2 className="w-4 h-4 text-purple-400" />
              <span className="hidden lg:inline">Activities</span>
            </button>
          )}

          {/* Start Voice Call */}
          <button
            onClick={() => onJoinVoice(room)}
            className={`hover:text-white transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
              isVoiceActive ? 'bg-[var(--status-online)]/20 text-[var(--status-online)]' : 'hover:bg-white/10'
            }`}
            title="Start or Join Voice Call"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Voice</span>
          </button>

          <Bell className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
          <Pin className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
          <button
            onClick={onToggleMemberList}
            className={`cursor-pointer transition-colors ${
              showMemberList ? 'text-white' : 'hover:text-white'
            }`}
            title="Toggle Member List"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Search bar */}
          <div className="bg-[var(--bg-userpanel)] rounded px-2 py-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)] w-36 focus-within:w-56 transition-all duration-200">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="bg-transparent border-none outline-none w-full text-[var(--text-normal)] placeholder:text-[var(--text-muted)]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-servers)] flex items-center justify-center mb-4 text-[var(--discord-blurple)]">
              <Hash className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              {searchQuery ? 'No matching messages' : `Welcome to #${room.name}!`}
            </h3>
            <p className="text-sm max-w-sm">
              {searchQuery
                ? `No messages matched "${searchQuery}".`
                : `This is the start of the #${room.name} channel. Send a message to start chatting.`}
            </p>
          </div>
        ) : (
          displayedMessages.map((msg, index) => {
            const prevMsg = displayedMessages[index - 1];
            const isSameSender = Boolean(
              prevMsg &&
                prevMsg.sender === msg.sender &&
                msg.timestamp - prevMsg.timestamp < 300000
            );
            const isOwnMessage =
              msg.sender === effectiveUserId ||
              (!!isGuestMode && msg.sender === '@guest:chat.protutech.vip');

            return (
              <MessageRow
                key={msg.id || `${msg.timestamp}_${index}`}
                msg={msg}
                roomId={room.id}
                isSameSender={isSameSender}
                isOwnMessage={isOwnMessage}
                isLoggerEnabled={isLoggerEnabled}
                currentUserId={effectiveUserId}
                onReply={handleReply}
                onDeleteMessage={onDeleteMessage}
                onEditMessage={onEditMessage}
                onAddReaction={onAddReaction}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Isolated Message Input Bar (local typing state prevents history re-renders) */}
      <ChatInputBar
        room={room}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
        onSendMessage={onSendMessage}
        onMediaSent={onMediaSent}
        onSendMediaGuest={onSendMediaGuest}
        onOpenLargeFileShare={onOpenLargeFileShare}
        onMessageInjected={onMessageInjected}
        currentUserName={currentUserName}
        isGuestMode={isGuestMode}
      />
    </div>
  );
};
