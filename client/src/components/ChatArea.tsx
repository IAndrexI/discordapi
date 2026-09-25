import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import type { MatrixMessage, MatrixRoom } from '../types';
import { matrix } from '../services/matrix';
import { vencord } from '../services/vencord';

interface ChatAreaProps {
  room: MatrixRoom;
  messages: MatrixMessage[];
  onSendMessage: (text: string) => void;
  onJoinVoice: (room: MatrixRoom) => void;
  isVoiceActive: boolean;
  onToggleMemberList: () => void;
  showMemberList: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  room,
  messages,
  onSendMessage,
  onJoinVoice,
  isVoiceActive,
  onToggleMemberList,
  showMemberList,
}) => {
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim()) {
        onSendMessage(inputText.trim());
        setInputText('');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const mxcUrl = await matrix.uploadMedia(file);
      if (mxcUrl) {
        const httpUrl = matrix.mxcToHttp(mxcUrl);
        await onSendMessage(`${file.name} - ${httpUrl}`);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4 text-[var(--text-muted)]">
          {/* Start Voice Call */}
          <button
            onClick={() => onJoinVoice(room)}
            className={`hover:text-white transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
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
              placeholder="Search"
              className="bg-transparent border-none outline-none w-full text-[var(--text-normal)] placeholder:text-[var(--text-muted)]"
            />
            <Search className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Messages Scroll Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-servers)] flex items-center justify-center mb-4 text-[var(--discord-blurple)]">
              <Hash className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Welcome to #{room.name}!</h3>
            <p className="text-sm max-w-sm">
              This is the start of the #{room.name} channel. Send a message to start chatting.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const isSameSender = prevMsg && prevMsg.sender === msg.sender && msg.timestamp - prevMsg.timestamp < 300000;
            const isLoggerEnabled = vencord.isPluginEnabled('messageLogger');

            return (
              <div
                key={msg.id || index}
                className={`group flex gap-4 px-2 -mx-2 py-0.5 rounded hover:bg-[var(--bg-message-hover)] transition-colors ${
                  isSameSender ? 'mt-0.5' : 'mt-4'
                }`}
              >
                {!isSameSender ? (
                  <div className="w-10 h-10 rounded-full bg-[var(--discord-blurple)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">
                    {msg.senderName.slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-10 flex-shrink-0 text-[10px] text-right text-[var(--text-muted)] opacity-0 group-hover:opacity-100 select-none pt-1">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {!isSameSender && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
                        {msg.senderName}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                      {msg.isDeleted && isLoggerEnabled && (
                        <span className="bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] text-[10px] font-bold px-1 rounded flex items-center gap-0.5">
                          <Trash2 className="w-2.5 h-2.5" />
                          DELETED
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="text-[var(--text-normal)] text-[14px] leading-relaxed break-words select-text">
                    {msg.body}
                  </div>

                  {/* Inline Video Player */}
                  {msg.mediaType === 'video' && msg.mediaUrl && (
                    <div className="mt-2 max-w-lg rounded-lg overflow-hidden border border-white/10 bg-black">
                      <video
                        src={msg.mediaUrl}
                        controls
                        className="w-full max-h-[360px] object-contain"
                      />
                    </div>
                  )}

                  {/* Inline Image Attachment */}
                  {msg.mediaType === 'image' && msg.mediaUrl && (
                    <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-white/10">
                      <img
                        src={msg.mediaUrl}
                        alt="Attachment"
                        className="max-h-[320px] rounded object-cover cursor-pointer hover:opacity-95"
                      />
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
                        Download Attachment
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <div className="px-4 pb-6 flex-shrink-0">
        <div className="bg-[var(--bg-message-input)] rounded-lg px-4 py-2.5 flex items-center gap-3 shadow-inner">
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-[var(--text-muted)] hover:text-white transition-colors"
            title="Upload File or Video (Nitro Bypass Unlimited Size)"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          {/* Text Area */}
          <textarea
            rows={1}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${room.name}`}
            className="bg-transparent border-none outline-none flex-1 text-[var(--text-normal)] placeholder:text-[var(--text-muted)] resize-none max-h-36 py-1 text-sm"
          />

          {/* Emoji & Action Buttons */}
          <button
            onClick={() => setInputText(prev => prev + ' 🚀')}
            className="text-[var(--text-muted)] hover:text-white transition-colors"
            title="Add Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
