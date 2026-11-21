import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Hash,
  Search,
  Bell,
  BellOff,
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
  MoreVertical,
} from 'lucide-react';
import type { MatrixMessage, MatrixRoom } from '../types';
import { matrix } from '../services/matrix';
import { vencord } from '../services/vencord';
import { scriptEngine } from '../services/scriptEngine';
import { discordSettingsSync } from '../services/discordSettingsSync';
import {
  fileTransferService,
  formatBytes,
  parseLargeFileFromMessage,
} from '../services/fileTransfer';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '🚀'];
const BAR_QUICK_EMOJIS = ['👍', '❤️', '😂'];
const INPUT_EMOJIS = ['🚀', '🔥', '❤️', '👍', '😂', '🎮', '⚡', '👀'];

interface ReplyTarget {
  id: string;
  sender: string;
  body: string;
}

export interface ChatAreaProps {
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
  isCompactMode: boolean;
  currentUserId?: string;
  onReply: (target: ReplyTarget) => void;
  onDeleteMessage?: (roomId: string, messageId: string) => void;
  onEditMessage?: (roomId: string, messageId: string, newText: string) => void;
  onAddReaction?: (roomId: string, messageId: string, emoji: string) => void;
}

const MessageRow = React.memo<MessageRowProps>(
  ({
    msg,
    roomId,
    isSameSender,
    isOwnMessage,
    isLoggerEnabled,
    isCompactMode,
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
    const isWebhookBridge =
      msg.webhookMeta?.bridge === 'webhook' || msg.webhookMeta?.bridge === 'script';

    const renderSourceBadges = (compact = false) => (
      <>
        {msg.source === 'discord' && (
          <span
            className={`px-1 py-0.2 rounded-[3px] text-[10px] font-semibold uppercase tracking-wide bg-[#5865f2] text-white leading-tight ${
              compact ? 'mr-1' : ''
            }`}
            title="Bridged from Discord"
          >
            Discord
          </span>
        )}
        {isMinecraftBridge && (
          <span
            className={`px-1 py-0.2 rounded-[3px] text-[10px] font-semibold uppercase tracking-wide bg-[#23a55a]/20 text-[#23a55a] leading-tight inline-flex items-center gap-0.5 ${
              compact ? 'mr-1' : ''
            }`}
            title="Bridged from Minecraft Server"
          >
            <Pickaxe className="w-2.5 h-2.5" />
            <span>MC</span>
          </span>
        )}
        {isWebhookBridge && (
          <span
            className={`px-1 py-0.2 rounded-[3px] text-[10px] font-semibold uppercase tracking-wide bg-[#f0b232]/20 text-[#f0b232] leading-tight inline-flex items-center gap-0.5 ${
              compact ? 'mr-1' : ''
            }`}
            title="Script / Webhook Integration"
          >
            <Terminal className="w-2.5 h-2.5" />
            <span>Script</span>
          </span>
        )}
      </>
    );

    const renderRichBody = () => {
      if (isEditing) {
        return (
          <div className="my-1 space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                autoFocus
                className="flex-1 bg-[var(--bg-message-input)] border border-[var(--discord-blurple)] rounded px-3 py-1.5 text-sm text-[var(--text-header)] outline-none"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                className="p-1.5 rounded bg-[#23a55a] hover:bg-[#1e8e4c] text-white cursor-pointer"
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
                className="p-1.5 rounded bg-[var(--bg-item-hover)] hover:bg-[var(--bg-item-active)] text-[var(--text-normal)] cursor-pointer"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              escape to cancel • enter to save
            </div>
          </div>
        );
      }

      if (msg.body.includes('[STEAM GAME INVITE]')) {
        const match = msg.body.match(/steam:\/\/[\w\d/._-]+/);
        const url = match ? match[0] : null;
        return (
          <div className="p-3 my-1 rounded-r-md bg-[var(--bg-channels)] border border-[var(--border-subtle)] border-l-4 border-l-[var(--discord-blurple)] max-w-md flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-[var(--discord-blurple)] flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-header)]">
                  Steam Game Invitation
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {msg.senderName} wants to play
                </div>
              </div>
            </div>
            <div className="text-xs text-[var(--text-normal)] whitespace-pre-wrap">
              {msg.body.replace('[STEAM GAME INVITE]', '').trim()}
            </div>
            {url && (
              <div>
                <button
                  type="button"
                  onClick={() => window.open(url, '_blank')}
                  className="px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-medium text-xs cursor-pointer transition-colors"
                >
                  Join in Steam
                </button>
              </div>
            )}
          </div>
        );
      }

      if (largeFile) {
        return (
          <div
            data-testid="large-file-attachment-card"
            className="my-1.5 p-3 rounded-md bg-[var(--bg-channels)] border border-[var(--border-subtle)] border-l-4 border-l-[var(--discord-blurple)] max-w-md flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded bg-[var(--bg-servers)] flex items-center justify-center text-[var(--discord-blurple)] flex-shrink-0">
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-header)] truncate">
                  {largeFile.fileName}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 flex-wrap">
                  <span>{formatBytes(largeFile.fileSize)}</span>
                  <span>•</span>
                  <span className="uppercase">
                    {largeFile.mode === 'p2p' ? 'P2P Direct' : 'Chunked Stream'}
                  </span>
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
              className="px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-medium text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        );
      }

      if (isCompactMode) {
        return (
          <span className="text-[var(--text-normal)] text-[14px] leading-[1.375rem] break-words select-text whitespace-pre-wrap">
            {msg.body}
            {msg.isEdited && (
              <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">(edited)</span>
            )}
            {msg.isDeleted && isLoggerEnabled && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] text-[10px] font-semibold px-1 rounded">
                <Trash2 className="w-2.5 h-2.5" />
                DELETED
              </span>
            )}
          </span>
        );
      }

      return (
        <div className="text-[var(--text-normal)] text-[15px] leading-[1.375rem] break-words select-text whitespace-pre-wrap">
          {msg.body}
          {isSameSender && !msg.replyTo && msg.isEdited && (
            <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">(edited)</span>
          )}
          {isSameSender && !msg.replyTo && msg.isDeleted && isLoggerEnabled && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] text-[10px] font-semibold px-1 rounded">
              <Trash2 className="w-2.5 h-2.5" />
              DELETED
            </span>
          )}
        </div>
      );
    };

    const renderAttachmentsAndReactions = () => (
      <>
        {msg.mediaType === 'video' && msg.mediaUrl && (
          <div className="mt-1.5 max-w-lg rounded-md overflow-hidden border border-[var(--border-subtle)] bg-black">
            <video
              src={msg.mediaUrl}
              controls
              playsInline
              className="w-full max-h-[360px] object-contain"
            />
          </div>
        )}

        {msg.mediaType === 'image' && msg.mediaUrl && (
          <div className="mt-1.5 max-w-md rounded-md overflow-hidden border border-[var(--border-subtle)] inline-block">
            <img
              src={msg.mediaUrl}
              alt={msg.body || 'Attachment'}
              onClick={() => window.open(msg.mediaUrl, '_blank')}
              className="max-h-[320px] rounded object-cover cursor-pointer hover:opacity-95"
            />
          </div>
        )}

        {msg.mediaType === 'audio' && msg.mediaUrl && (
          <div className="mt-1.5 max-w-md rounded-md bg-[var(--bg-channels)] border border-[var(--border-subtle)] p-2.5 flex items-center gap-2.5">
            <Music className="w-4 h-4 text-[var(--discord-blurple)] flex-shrink-0" />
            <audio src={msg.mediaUrl} controls className="w-full h-8" />
          </div>
        )}

        {msg.mediaType === 'file' && msg.mediaUrl && (
          <div className="mt-1.5 inline-flex items-center gap-2.5 bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded-md p-3 text-sm">
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

        {reactionEntries.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mt-1.5">
            {reactionEntries.map(([emoji, users]) => {
              const hasReacted = currentUserId ? users.includes(currentUserId) : false;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onAddReaction?.(roomId, msg.id, emoji)}
                  className={`px-1.5 py-0.5 rounded-[6px] text-xs font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                    hasReacted
                      ? 'bg-[#5865f2]/20 border-[#5865f2] text-[var(--text-header)]'
                      : 'bg-[var(--bg-channels)] border-[var(--border-subtle)] text-[var(--text-normal)] hover:border-white/20'
                  }`}
                  title={`${users.length} reaction${users.length > 1 ? 's' : ''}`}
                >
                  <span>{emoji}</span>
                  <span className="text-[11px] tabular-nums">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </>
    );

    const renderHoverActions = () => (
      <div
        className={`absolute right-3 -top-3.5 transition-opacity flex items-center bg-[var(--bg-chat)] border border-[#1e1f22] rounded-[4px] shadow-md p-0.5 z-20 ${
          showReactionPicker
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        }`}
      >
        {onAddReaction && (
          <>
            {BAR_QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onAddReaction(roomId, msg.id, emoji)}
                title={`React with ${emoji}`}
                className="w-7 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                {emoji}
              </button>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactionPicker(p => !p)}
                title="Add Reaction"
                className="w-7 h-7 hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] rounded flex items-center justify-center transition-colors cursor-pointer"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showReactionPicker && (
                <div className="absolute right-0 bottom-full mb-1 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-md p-1 shadow-xl flex items-center gap-0.5 z-30">
                  {QUICK_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onAddReaction(roomId, msg.id, emoji);
                        setShowReactionPicker(false);
                      }}
                      className="w-7 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-sm cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
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
          className="w-7 h-7 hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] rounded flex items-center justify-center transition-colors cursor-pointer"
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
            title="Edit"
            className="w-7 h-7 hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

        {onDeleteMessage && (
          <button
            type="button"
            onClick={() => onDeleteMessage(roomId, msg.id)}
            title="Delete"
            className="w-7 h-7 hover:bg-[#f23f43]/20 text-[var(--text-muted)] hover:text-[#f23f43] rounded flex items-center justify-center transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );

    if (isCompactMode) {
      return (
        <div className="group relative px-4 -mx-4 py-0.5 mt-0.5 hover:bg-[var(--bg-message-hover)] transition-colors">
          {msg.replyTo && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-0.5 pl-12">
              <CornerUpRight className="w-3 h-3 text-[var(--discord-blurple)] flex-shrink-0" />
              <span className="font-medium text-[var(--text-normal)] truncate max-w-[140px]">
                @{msg.replyTo.sender}
              </span>
              <span className="truncate opacity-80">{msg.replyTo.body}</span>
            </div>
          )}

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="w-11 flex-shrink-0 text-[10px] text-[var(--text-muted)] tabular-nums select-none text-right pr-1">
              {formatTimestamp(msg.timestamp)}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-[var(--text-header)] text-[14px] hover:underline cursor-pointer mr-1.5">
                {msg.senderName}
              </span>
              {renderSourceBadges(true)}
              {renderRichBody()}
              {renderAttachmentsAndReactions()}
            </div>
          </div>

          {renderHoverActions()}
        </div>
      );
    }

    return (
      <div
        className={`group relative flex gap-4 px-4 -mx-4 py-0.5 hover:bg-[var(--bg-message-hover)] transition-colors ${
          isSameSender && !msg.replyTo ? 'mt-0.5' : 'mt-[17px]'
        }`}
      >
        {/* Left Gutter: Avatar or Hover Timestamp */}
        {!isSameSender || msg.replyTo ? (
          msg.avatarUrl && !avatarError ? (
            <img
              src={msg.avatarUrl}
              alt={msg.senderName}
              onError={() => setFailedAvatarUrl(msg.avatarUrl || null)}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 bg-[var(--bg-servers)]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 mt-0.5">
              {(msg.senderName || 'U').slice(0, 2).toUpperCase()}
            </div>
          )
        ) : (
          <div className="w-10 flex-shrink-0 text-[10px] text-right text-[var(--text-muted)] opacity-0 group-hover:opacity-100 select-none pt-1 tabular-nums">
            {formatTimestamp(msg.timestamp)}
          </div>
        )}

        {/* Main Message Body */}
        <div className="flex-1 min-w-0">
          {msg.replyTo && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
              <CornerUpRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
              <span className="font-medium text-[var(--text-normal)] truncate max-w-[160px]">
                @{msg.replyTo.sender}
              </span>
              <span className="truncate opacity-80">{msg.replyTo.body}</span>
            </div>
          )}

          {(!isSameSender || msg.replyTo) && (
            <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
              <span className="font-medium text-[var(--text-header)] text-[15px] hover:underline cursor-pointer">
                {msg.senderName}
              </span>
              {renderSourceBadges(false)}
              <span className="text-[11px] text-[var(--text-muted)] font-normal tabular-nums">
                {formatTimestamp(msg.timestamp)}
              </span>
              {msg.isEdited && (
                <span className="text-[10px] text-[var(--text-muted)]">(edited)</span>
              )}
              {msg.isDeleted && isLoggerEnabled && (
                <span className="bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] text-[10px] font-semibold px-1 rounded flex items-center gap-0.5">
                  <Trash2 className="w-2.5 h-2.5" />
                  DELETED
                </span>
              )}
            </div>
          )}

          {renderRichBody()}
          {renderAttachmentsAndReactions()}
        </div>

        {renderHoverActions()}
      </div>
    );
  }
);

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

const ChatInputBar = React.memo<ChatInputBarProps>(
  ({
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
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const plusMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (replyingTo) {
        textareaRef.current?.focus();
      }
    }, [replyingTo]);

    useEffect(() => {
      if (!showPlusMenu) return;
      const onPointerDown = (e: MouseEvent) => {
        if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
          setShowPlusMenu(false);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowPlusMenu(false);
      };
      window.addEventListener('mousedown', onPointerDown);
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('keydown', onKey);
      };
    }, [showPlusMenu]);

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
        void submitCurrentMessage();
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
            const mxcUrl = await matrix.uploadMedia(file);
            if (mxcUrl) {
              const httpUrl = matrix.mxcToHttp(mxcUrl);
              onSendMessage(`${file.name} - ${httpUrl}`);
            }
          }
        } else if (onSendMediaGuest) {
          await onSendMediaGuest(room.id, file);
        } else {
          onSendMessage(
            `📎 Attachment: ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`
          );
        }
      } catch (err) {
        console.error('File upload failed:', err);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    const handleInjectCommand = () => {
      setShowPlusMenu(false);
      setInputText(prev => (prev.startsWith('/') ? prev : `/${prev}`));
      textareaRef.current?.focus();
    };

    return (
      <div className="px-4 pb-5 pt-1 flex-shrink-0">
        {replyingTo && (
          <div className="bg-[var(--bg-channels)] border border-[var(--border-subtle)] border-b-0 rounded-t-lg px-3.5 py-1.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
              <span className="text-[var(--text-muted)]">Replying to</span>
              <span className="font-semibold text-[var(--text-header)] truncate max-w-[140px]">
                @{replyingTo.sender}
              </span>
              <span className="text-[var(--text-muted)] truncate max-w-xs opacity-80">
                "{replyingTo.body}"
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="text-[var(--text-muted)] hover:text-[var(--text-header)] p-0.5 rounded hover:bg-[var(--bg-item-hover)] cursor-pointer"
              title="Cancel Reply"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          className={`bg-[var(--bg-message-input)] px-3.5 py-2 flex items-center gap-2.5 relative ${
            replyingTo ? 'rounded-b-lg border border-[var(--border-subtle)] border-t-0' : 'rounded-lg'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* + Upload / Actions Popover */}
          <div className="relative flex-shrink-0" ref={plusMenuRef}>
            <button
              type="button"
              onClick={() => setShowPlusMenu(prev => !prev)}
              disabled={isUploading}
              className="text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
              title={isUploading ? 'Uploading attachment...' : 'Upload File, Share Large File or Inject Command'}
            >
              <PlusCircle className={`w-5 h-5 ${isUploading ? 'animate-spin text-[var(--discord-blurple)]' : ''}`} />
            </button>

            {showPlusMenu && (
              <div
                className="absolute left-0 bottom-full mb-2.5 w-52 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-md shadow-2xl p-1.5 z-30 text-xs text-[var(--text-normal)]"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowPlusMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>

                {onOpenLargeFileShare && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowPlusMenu(false);
                      onOpenLargeFileShare();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Share Large File</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleInjectCommand}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Inject Command</span>
                </button>
              </div>
            )}
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${room.name}`}
            className="bg-transparent border-none outline-none flex-1 min-w-0 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] resize-none max-h-36 py-1 text-sm"
          />

          {/* Emoji Picker Button */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEmojiTray(v => !v)}
              className="text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex items-center justify-center"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmojiTray && (
              <div className="absolute right-0 bottom-full mb-2 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-md p-1.5 shadow-2xl flex items-center gap-1 z-30">
                {INPUT_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText(prev => prev + emoji);
                      setShowEmojiTray(false);
                      textareaRef.current?.focus();
                    }}
                    className="w-7 h-7 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-base cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Large File Button */}
          {onOpenLargeFileShare && (
            <button
              type="button"
              onClick={onOpenLargeFileShare}
              className="text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex-shrink-0"
              title="Large File Share"
            >
              <Package className="w-5 h-5" />
            </button>
          )}

          {/* Send Message Button */}
          <button
            type="button"
            onClick={() => void submitCurrentMessage()}
            disabled={!inputText.trim()}
            className={`p-1.5 rounded transition-colors cursor-pointer flex-shrink-0 ${
              inputText.trim()
                ? 'bg-[var(--discord-blurple)] text-white hover:bg-[var(--discord-blurple-hover)]'
                : 'text-[var(--text-muted)] opacity-50 cursor-not-allowed'
            }`}
            title="Send Message (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
);

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
  const [isCompactMode, setIsCompactMode] = useState<boolean>(
    () => discordSettingsSync.getSettings().messageDisplayCompact
  );
  const [isChannelMuted, setIsChannelMuted] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return discordSettingsSync.subscribe(settings => {
      setIsCompactMode(settings.messageDisplayCompact);
    });
  }, []);

  useEffect(() => {
    if (!showToolsMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowToolsMenu(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [showToolsMenu]);

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
      {/* 1:1 Discord 48px Channel Header */}
      <div className="h-12 border-b border-[var(--border-subtle)] px-3 sm:px-4 flex items-center justify-between gap-2 select-none flex-shrink-0 z-10 bg-[var(--bg-chat)]">
        {/* Left: # + Channel Name + Topic */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Hash className="w-5 h-5 text-[#80848e] flex-shrink-0" />
          <span className="font-semibold text-[var(--text-header)] text-[15px] truncate">
            {room.name}
          </span>
          {room.topic && (
            <>
              <div className="w-[1px] h-5 bg-[var(--border-subtle)] mx-1 flex-shrink-0 hidden sm:block" />
              <span className="text-xs text-[var(--text-muted)] truncate min-w-0 hidden sm:block">
                {room.topic}
              </span>
            </>
          )}
        </div>

        {/* Right: Uniform Discord Icon Buttons & Sleek Search */}
        <div className="flex items-center gap-0.5 text-[var(--text-muted)] flex-shrink-0">
          {/* Voice Call */}
          <button
            type="button"
            onClick={() => onJoinVoice(room)}
            className={`w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center transition-colors cursor-pointer ${
              isVoiceActive
                ? 'text-[#23a55a]'
                : 'hover:text-[var(--text-header)]'
            }`}
            title="Start or Join Voice Call"
          >
            <PhoneCall className="w-[18px] h-[18px]" />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsChannelMuted(m => !m)}
            className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer"
            title={isChannelMuted ? 'Unmute Channel Notifications' : 'Mute Channel Notifications'}
          >
            {isChannelMuted ? (
              <BellOff className="w-[18px] h-[18px]" />
            ) : (
              <Bell className="w-[18px] h-[18px]" />
            )}
          </button>

          {/* Pinned Messages */}
          <button
            type="button"
            className="hidden sm:flex w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] items-center justify-center transition-colors cursor-pointer"
            title="Pinned Messages"
          >
            <Pin className="w-[18px] h-[18px]" />
          </button>

          {/* Member List Toggle */}
          <button
            type="button"
            onClick={onToggleMemberList}
            className={`w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center transition-colors cursor-pointer ${
              showMemberList ? 'text-[var(--text-header)]' : 'hover:text-[var(--text-header)]'
            }`}
            title="Toggle Member List"
          >
            <Users className="w-[18px] h-[18px]" />
          </button>

          {/* Large File Share (Clean Icon Button, Always Accessible) */}
          {onOpenLargeFileShare && (
            <button
              type="button"
              onClick={onOpenLargeFileShare}
              data-testid="chat-large-file-btn"
              className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer"
              title="Share Large File (Chunked Stream / P2P)"
            >
              <Package className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Co-Browse & Search (Clean Icon Button, Always Accessible) */}
          {onOpenCoBrowse && (
            <button
              type="button"
              onClick={onOpenCoBrowse}
              data-testid="chat-cobrowse-btn"
              className="w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer"
              title="Co-Browse & Built-In Search"
            >
              <Globe className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Channel Tools Popover (Activities, Scripts, Sync Channel) */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setShowToolsMenu(prev => !prev)}
              className={`w-8 h-8 rounded hover:bg-[var(--bg-item-hover)] flex items-center justify-center transition-colors cursor-pointer ${
                showToolsMenu ? 'text-[var(--text-header)] bg-[var(--bg-item-hover)]' : 'hover:text-[var(--text-header)]'
              }`}
              title="Channel Tools (Activities, Scripts, Sync)"
            >
              <MoreVertical className="w-[18px] h-[18px]" />
            </button>

            {showToolsMenu && (
              <div
                className="absolute right-0 top-9 w-52 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-md shadow-2xl p-1.5 z-40 text-xs text-[var(--text-normal)]"
                role="menu"
              >
                {onOpenLargeFileShare && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenLargeFileShare();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Large File Share</span>
                  </button>
                )}

                {onOpenCoBrowse && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenCoBrowse();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Co-Browse &amp; Search</span>
                  </button>
                )}

                {onOpenActivity && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenActivity();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Activities</span>
                  </button>
                )}

                {onOpenScripts && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenScripts();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Scripts &amp; MC Bridge</span>
                  </button>
                )}

                <div className="h-px bg-[var(--border-subtle)] my-1" />

                {room.isSynced ? (
                  <div className="px-2.5 py-1.5 text-[11px] text-[#23a55a] flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>Channel Synced</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenSyncLater?.(room);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--discord-blurple)] hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Sync Channel</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sleek 144px Search Input */}
          <div className="ml-1 bg-[var(--bg-servers)] rounded px-2 py-1 flex items-center gap-1.5 text-xs text-[var(--text-normal)] w-28 sm:w-36 focus-within:w-44 transition-all duration-200">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="bg-transparent border-none outline-none w-full min-w-0 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-channels)] flex items-center justify-center mb-4 text-[var(--text-header)]">
              <Hash className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-header)] mb-1">
              {searchQuery ? 'No matching messages' : `Welcome to #${room.name}!`}
            </h3>
            <p className="text-sm max-w-sm">
              {searchQuery
                ? `No messages matched "${searchQuery}".`
                : `This is the start of the #${room.name} channel.`}
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
              (Boolean(isGuestMode) && msg.sender === '@guest:chat.protutech.vip');

            return (
              <MessageRow
                key={msg.id || `${msg.timestamp}_${index}`}
                msg={msg}
                roomId={room.id}
                isSameSender={isSameSender}
                isOwnMessage={isOwnMessage}
                isLoggerEnabled={isLoggerEnabled}
                isCompactMode={isCompactMode}
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

      {/* Isolated Message Input Bar */}
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
