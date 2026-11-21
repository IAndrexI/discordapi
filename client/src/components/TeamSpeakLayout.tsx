import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Mic,
  MicOff,
  Headphones,
  Volume2,
  VolumeX,
  Music,
  Video,
  VideoOff,
  Monitor,
  Globe,
  PhoneOff,
  Package,
  Terminal,
  Puzzle,
  Trophy,
  Settings,
  LayoutGrid,
  Hash,
  MessageSquare,
  Folder,
  FolderOpen,
  Clock,
  Plus,
  Send,
  Paperclip,
  Reply,
  Pencil,
  Trash2,
  Smile,
  Check,
  X,
  PhoneCall,
  Users,
  Activity,
  Shield,
  Sliders,
} from 'lucide-react';
import type {
  DiscordGuild,
  MatrixMessage,
  MatrixRoom,
  MatrixUser,
  VoiceParticipant,
} from '../types';
import { livekit } from '../services/livekit';
import { matrix } from '../services/matrix';
import { soundboardService } from '../services/soundboard';
import { scriptEngine } from '../services/scriptEngine';
import { VoiceStage } from './VoiceStage';
import { SharedBrowserStage } from './SharedBrowserStage';
import { ScreenSharePickerModal, type ScreenShareSelection } from './ScreenSharePickerModal';

export interface TeamSpeakLayoutProps {
  guilds: DiscordGuild[];
  activeGuildId: string | null;
  rooms: MatrixRoom[];
  activeRoomId: string | null;
  currentRoom: MatrixRoom;
  messages: MatrixMessage[];
  voiceParticipants: VoiceParticipant[];
  activeVoiceRoom: string | null;
  rtcPing: number;
  effectiveUserId: string;
  effectiveDisplayName: string;
  isGuestMode?: boolean;
  isCoBrowseOpen?: boolean;
  coBrowseInitialQuery?: string;
  zoomLevel?: number;
  onSelectGuild: (guildId: string | null) => void;
  onSelectRoom: (roomId: string) => void;
  onJoinVoice: (room: MatrixRoom) => void;
  onJoinDiscordCall?: (room: MatrixRoom) => void | Promise<void>;
  onDisconnectVoice: () => void;
  onSendMessage: (text: string, replyTo?: { id: string; sender: string; body: string }) => void;
  onMediaSent?: (message: MatrixMessage) => void;
  onSendMediaGuest?: (roomId: string, file: File) => Promise<void> | void;
  onEditMessage?: (roomId: string, messageId: string, newText: string) => void;
  onAddReaction?: (roomId: string, messageId: string, emoji: string) => void;
  onDeleteMessage?: (roomId: string, messageId: string) => void;
  onMessageInjected?: (message: MatrixMessage) => void;
  onSelectUser?: (user: MatrixUser) => void;
  onOpenSettings: (tab?: 'profile' | 'voice' | 'themes' | 'overlay' | 'plugins') => void;
  onOpenSoundboard: () => void;
  onOpenCameraPreview?: () => void;
  onToggleCoBrowse: () => void;
  onCloseCoBrowse: () => void;
  onOpenLargeFileShare?: () => void;
  onOpenScripts?: () => void;
  onOpenDiscordHub?: () => void;
  onOpenEquicord?: () => void;
  onOpenAddModal?: () => void;
  onSwitchToDiscordLayout: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
}

interface ServerEventLogEntry {
  id: string;
  timestamp: number;
  source: string;
  text: string;
  tone?: 'info' | 'voice' | 'sound' | 'warn';
}

const TS_QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂'];

function formatTsTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const TeamSpeakLayout: React.FC<TeamSpeakLayoutProps> = ({
  guilds,
  activeGuildId,
  rooms,
  activeRoomId,
  currentRoom,
  messages,
  voiceParticipants,
  activeVoiceRoom,
  rtcPing,
  effectiveUserId,
  effectiveDisplayName,
  isGuestMode = false,
  isCoBrowseOpen = false,
  coBrowseInitialQuery,
  zoomLevel = 100,
  onSelectGuild,
  onSelectRoom,
  onJoinVoice,
  onJoinDiscordCall,
  onDisconnectVoice,
  onSendMessage,
  onMediaSent,
  onSendMediaGuest,
  onEditMessage,
  onAddReaction,
  onDeleteMessage,
  onMessageInjected,
  onSelectUser,
  onOpenSettings,
  onOpenSoundboard,
  onOpenCameraPreview,
  onToggleCoBrowse,
  onCloseCoBrowse,
  onOpenLargeFileShare,
  onOpenScripts,
  onOpenDiscordHub,
  onOpenEquicord,
  onOpenAddModal,
  onSwitchToDiscordLayout,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => {
  const [isMuted, setIsMuted] = useState(() => livekit.isMuted);
  const [isDeafened, setIsDeafened] = useState(() => livekit.isDeafened);
  const [micLoopback, setMicLoopback] = useState(() => livekit.isMicLoopbackEnabled());
  const [hasVideo, setHasVideo] = useState(() => livekit.isCameraEnabled());
  const [isScreenSharing, setIsScreenSharing] = useState(() => livekit.isScreenShareEnabled());
  const [audioLevel, setAudioLevel] = useState(() => livekit.getAudioLevel());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAway, setIsAway] = useState(false);

  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showScreenPicker, setShowScreenPicker] = useState(false);

  // Lower Pane Tabs & Chat State
  const [lowerTab, setLowerTab] = useState<'channel' | 'log'>('channel');
  const [composerText, setComposerText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    sender: string;
    body: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [eventLogs, setEventLogs] = useState<ServerEventLogEntry[]>(() => [
    {
      id: `log_init_${Date.now()}`,
      timestamp: Date.now(),
      source: 'Server',
      text: `TeamSpeak Layout initialized for ${effectiveDisplayName}`,
      tone: 'info',
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevVoiceRoomRef = useRef<string | null>(activeVoiceRoom);

  const appendLog = (source: string, text: string, tone: ServerEventLogEntry['tone'] = 'info') => {
    setEventLogs((prev) => [
      ...prev.slice(-140),
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        source,
        text,
        tone,
      },
    ]);
  };

  useEffect(() => {
    const unsubVoice = livekit.subscribe((participants) => {
      const localId = livekit.getLocalIdentity();
      const local = participants.find((p) => p.identity === localId) || participants[0];
      setIsMuted(livekit.isMuted);
      setIsDeafened(livekit.isDeafened);
      setMicLoopback(livekit.isMicLoopbackEnabled());
      setHasVideo(Boolean(local?.hasVideo && local?.videoTrack));
      setIsScreenSharing(Boolean(local?.hasScreenShare && local?.screenTrack));
    });

    const unsubLevel = livekit.subscribeAudioLevel((level, speaking) => {
      setAudioLevel(level);
      setIsSpeaking(speaking);
    });

    const unsubSound = soundboardService.subscribePlayEvents((evt) => {
      appendLog('Soundboard', `${evt.emoji} ${evt.senderName} played "${evt.name}"`, 'sound');
    });

    return () => {
      unsubVoice();
      unsubLevel();
      unsubSound();
    };
  }, []);

  useEffect(() => {
    if (prevVoiceRoomRef.current === activeVoiceRoom) return;
    const prevRoom = prevVoiceRoomRef.current;
    prevVoiceRoomRef.current = activeVoiceRoom;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (activeVoiceRoom) {
        appendLog('Voice', `Joined voice channel "${activeVoiceRoom}"`, 'voice');
      } else if (prevRoom) {
        appendLog('Voice', `Disconnected from "${prevRoom}"`, 'warn');
      }
    });
    return () => {
      active = false;
    };
  }, [activeVoiceRoom]);

  useEffect(() => {
    if (lowerTab === 'channel') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, eventLogs.length, lowerTab, currentRoom.id]);

  const activeGuild = useMemo(
    () => (activeGuildId ? guilds.find((g) => g.id === activeGuildId) || null : null),
    [guilds, activeGuildId]
  );

  // Build channel groups for the TS3 Tree
  const treeGroups = useMemo(() => {
    const defaultVoiceLounge: MatrixRoom = {
      id: 'livekit_lounge',
      name: 'Voice Lounge',
      topic: 'Ultra-low latency Opus 48kHz voice channel',
      isDirect: false,
      isGroupChat: false,
      isVoice: true,
      guildId: activeGuild?.id,
      members: [],
    };

    if (!activeGuild) {
      const dms = rooms.filter((r) => r.isDirect);
      const groups = rooms.filter((r) => r.isGroupChat);
      const voiceRooms = rooms.filter((r) => r.isVoice);
      if (!voiceRooms.some((r) => r.id === 'livekit_lounge' || r.name === 'Voice Lounge')) {
        voiceRooms.unshift(defaultVoiceLounge);
      }
      return [
        { id: 'dms', label: 'Direct Messages', items: dms, isVoiceFolder: false },
        { id: 'groups', label: 'Group Chats', items: groups, isVoiceFolder: false },
        { id: 'voice', label: 'Voice Channels', items: voiceRooms, isVoiceFolder: true },
      ];
    }

    const textChannels = activeGuild.channels.filter((c) => !c.isVoice);
    const voiceChannels = activeGuild.channels.filter((c) => c.isVoice);
    if (!voiceChannels.some((c) => c.id === 'livekit_lounge' || c.name === 'Voice Lounge')) {
      voiceChannels.unshift(defaultVoiceLounge);
    }

    return [
      { id: 'text', label: 'Text Channels', items: textChannels, isVoiceFolder: false },
      { id: 'voice', label: 'Voice Channels', items: voiceChannels, isVoiceFolder: true },
    ];
  }, [activeGuild, rooms]);

  const isRoomActiveVoice = useCallback(
    (room: MatrixRoom) =>
      Boolean(
        activeVoiceRoom &&
          (activeVoiceRoom === room.name ||
            activeVoiceRoom === room.id ||
            (room.id === 'livekit_lounge' && activeVoiceRoom === 'Voice Lounge'))
      ),
    [activeVoiceRoom]
  );

  const anyListedChannelMatchesActiveVoice = useMemo(
    () => treeGroups.some((grp) => grp.items.some((ch) => isRoomActiveVoice(ch))),
    [treeGroups, isRoomActiveVoice]
  );

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return voiceParticipants.find((p) => p.identity === selectedClientId) || null;
  }, [voiceParticipants, selectedClientId]);

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleToggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);
    await livekit.setMute(next);
    appendLog('Audio', next ? 'Microphone muted' : 'Microphone unmuted', 'info');
  };

  const handleToggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    livekit.setDeafened(next);
    appendLog('Audio', next ? 'Speakers deafened' : 'Speakers undeafened', 'info');
  };

  const handleToggleAway = () => {
    const next = !isAway;
    setIsAway(next);
    if (!isGuestMode) {
      matrix.setPresence(next ? 'idle' : 'online', next ? 'Away (TS3)' : '');
    }
    appendLog('Status', next ? 'Marked as Away' : 'Returned Online', 'info');
  };

  const handleToggleMicLoopback = async () => {
    const next = !micLoopback;
    setMicLoopback(next);
    const active = await livekit.setMicLoopback(next);
    setMicLoopback(active);
    appendLog('Playback', active ? 'Mic Playback (Hear Yourself) enabled' : 'Mic Playback disabled', 'info');
  };

  const handleToggleCamera = async () => {
    const next = !hasVideo;
    const ok = await livekit.setCamera(next);
    if (ok) {
      setHasVideo(next);
      appendLog('Video', next ? 'Camera enabled' : 'Camera turned off', 'voice');
    }
  };

  const handleOpenCameraPreview = () => {
    if (onOpenCameraPreview) {
      onOpenCameraPreview();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('protutech:open-camera-preview'));
    }
  };

  const handleScreenShareButton = async () => {
    if (isScreenSharing) {
      const ok = await livekit.setScreenShare(false);
      if (ok) {
        setIsScreenSharing(false);
        appendLog('Stream', 'Screen share stopped', 'voice');
      }
      return;
    }
    setShowScreenPicker(true);
  };

  const handleStartScreenShare = async (selection: ScreenShareSelection) => {
    setShowScreenPicker(false);
    const ok = await livekit.setScreenShare(
      true,
      selection.quality,
      selection.sourceId,
      selection.includeAudio
    );
    if (ok) {
      setIsScreenSharing(true);
      appendLog('Stream', `Started screen share (${selection.quality})`, 'voice');
    }
  };

  const handleChannelClick = (channel: MatrixRoom) => {
    onSelectRoom(channel.id);
  };

  const handleChannelDoubleClick = (channel: MatrixRoom) => {
    onSelectRoom(channel.id);
    if (channel.isVoice || channel.id === 'livekit_lounge') {
      onJoinVoice(channel);
    }
  };

  const handleSendComposer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = composerText.trim();
    if (!trimmed) return;

    setComposerText('');
    const activeReply = replyTarget || undefined;
    if (replyTarget) setReplyTarget(null);

    if (trimmed.startsWith('/')) {
      const cmdRes = await scriptEngine.executeSlashCommand(
        trimmed,
        currentRoom.id,
        currentRoom.name,
        effectiveDisplayName,
        onMessageInjected
      );
      if (cmdRes.handled) {
        return;
      }
    }

    onSendMessage(trimmed, activeReply);
  };

  const handleComposerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const canMatrix =
        !isGuestMode &&
        matrix.isAuthenticated() &&
        !currentRoom.id.startsWith('guest_') &&
        !currentRoom.id.startsWith('temp_');
      if (canMatrix) {
        const sent = await matrix.sendMediaMessage(currentRoom.id, file);
        if (sent) {
          onMediaSent?.(sent);
        }
      } else if (onSendMediaGuest) {
        await onSendMediaGuest(currentRoom.id, file);
      } else {
        onSendMessage(`📎 Attachment: ${file.name}`);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInspectUser = (nameOrIdentity: string) => {
    if (!onSelectUser) return;
    const match =
      currentRoom.members.find(
        (m) =>
          m.userId === nameOrIdentity ||
          m.displayName.toLowerCase() === nameOrIdentity.toLowerCase()
      ) || {
        userId: nameOrIdentity,
        displayName: nameOrIdentity.split(':')[0].replace(/^@/, '') || nameOrIdentity,
        presence: 'online' as const,
      };
    onSelectUser(match);
  };

  return (
    <div
      data-testid="teamspeak-layout"
      className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-[var(--bg-chat)] text-[var(--text-normal)] select-none"
    >
      {/* 1. Classic TS3 Server Tabs Strip */}
      <div className="bg-[var(--bg-servers)] border-b border-[var(--border-subtle)] px-2 pt-1.5 flex items-end gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        <button
          type="button"
          onClick={() => onSelectGuild(null)}
          aria-pressed={activeGuildId === null}
          className={`px-3 py-1.5 rounded-t-md text-xs font-semibold flex items-center gap-1.5 border border-b-0 transition-colors cursor-pointer flex-shrink-0 ${
            activeGuildId === null
              ? 'bg-[var(--bg-channels)] text-[var(--text-header)] border-[var(--border-subtle)] border-t-2 border-t-[var(--discord-blurple)]'
              : 'bg-[var(--bg-card)]/60 text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] border-transparent'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
          <span>Home / DMs</span>
        </button>

        {guilds.map((guild) => {
          const isActive = activeGuildId === guild.id;
          const hasActiveCall = Boolean(
            activeVoiceRoom &&
              guild.channels.some(
                (c) => c.name === activeVoiceRoom || c.id === activeVoiceRoom
              )
          );
          return (
            <button
              key={guild.id}
              type="button"
              onClick={() => onSelectGuild(guild.id)}
              aria-pressed={isActive}
              className={`px-3 py-1.5 rounded-t-md text-xs font-semibold flex items-center gap-1.5 border border-b-0 transition-colors cursor-pointer flex-shrink-0 max-w-[180px] ${
                isActive
                  ? 'bg-[var(--bg-channels)] text-[var(--text-header)] border-[var(--border-subtle)] border-t-2 border-t-[var(--discord-blurple)]'
                  : 'bg-[var(--bg-card)]/60 text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] border-transparent'
              }`}
            >
              {guild.iconUrl ? (
                <img src={guild.iconUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
              ) : (
                <span className="w-4 h-4 rounded-sm bg-[var(--discord-blurple)]/25 text-[var(--text-header)] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {guild.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">{guild.name}</span>
              {hasActiveCall && (
                <span className="w-2 h-2 rounded-full bg-[var(--text-link)] flex-shrink-0" title="Active voice call" />
              )}
            </button>
          );
        })}

        {onOpenAddModal && (
          <button
            type="button"
            onClick={onOpenAddModal}
            aria-label="Add or Sync Server"
            className="px-2.5 py-1.5 mb-0.5 rounded text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] flex items-center gap-1 cursor-pointer flex-shrink-0"
            title="Add or Sync Server"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add / Sync</span>
          </button>
        )}
      </div>

      {/* 2. Classic TS3 Icon Toolbar */}
      <div className="bg-[var(--bg-channels)] border-b border-[var(--border-subtle)] px-2.5 py-1.5 flex items-center justify-between gap-2 flex-shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={() => void handleToggleMute()}
            aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            aria-pressed={isMuted}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
              isMuted
                ? 'bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] border-[var(--status-dnd)]/40'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
            }`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">{isMuted ? 'Muted' : 'Mic'}</span>
          </button>

          {/* Deafen Speakers */}
          <button
            type="button"
            onClick={handleToggleDeafen}
            aria-label={isDeafened ? 'Undeafen Speakers' : 'Deafen Speakers'}
            aria-pressed={isDeafened}
            title={isDeafened ? 'Undeafen Speakers' : 'Deafen Speakers'}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
              isDeafened
                ? 'bg-[var(--status-dnd)]/20 text-[var(--status-dnd)] border-[var(--status-dnd)]/40'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
            }`}
          >
            {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">{isDeafened ? 'Deafened' : 'Speakers'}</span>
          </button>

          {/* Away Toggle */}
          <button
            type="button"
            onClick={handleToggleAway}
            aria-label={isAway ? 'Clear Away Status' : 'Set Away Status'}
            aria-pressed={isAway}
            title={isAway ? 'Clear Away Status' : 'Set Away Status'}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
              isAway
                ? 'bg-[var(--status-idle)]/20 text-[var(--status-idle)] border-[var(--status-idle)]/40'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Away</span>
          </button>

          <div className="w-[1px] h-5 bg-[var(--border-subtle)] mx-1" />

          {/* Mic Playback (Hear Yourself) + Mini Live VU Meter */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded px-2 py-1">
            <button
              type="button"
              data-testid="ts3-mic-playback-btn"
              aria-label="Mic Playback"
              aria-pressed={micLoopback}
              onClick={() => void handleToggleMicLoopback()}
              title="Mic Playback (Hear Yourself)"
              className={`text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                micLoopback
                  ? 'text-[var(--status-online)]'
                  : 'text-[var(--text-normal)] hover:text-[var(--text-header)]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{micLoopback ? 'Playback ON' : 'Playback'}</span>
            </button>
            <div
              className="w-12 h-1.5 bg-[var(--bg-channels)] rounded-full overflow-hidden"
              title={`Mic Level: ${audioLevel}%`}
            >
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${audioLevel}%`,
                  backgroundColor: isSpeaking ? 'var(--text-link)' : 'var(--status-online)',
                }}
              />
            </div>
          </div>

          <button
          type="button"
          data-testid="ts6-krisp-btn"
          onClick={() => {
            const cur = livekit.getNoiseSuppressionMode();
            livekit.setNoiseSuppressionMode(cur === 'krisp' ? 'none' : 'krisp');
          }}
          title="Toggle Krisp AI Noise Suppression"
          className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors border ${
            livekit.getNoiseSuppressionMode() === 'krisp'
              ? 'bg-[var(--discord-blurple)]/20 text-[var(--accent-cyan)] border-[var(--discord-blurple)]/40'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)]'
          }`}
        >
          <span>{livekit.getNoiseSuppressionMode() === 'krisp' ? 'Krisp' : 'NS Off'}</span>
        </button>

        {/* Soundboard */}
          <button
            type="button"
            data-testid="ts3-soundboard-btn"
            aria-label="Soundboard"
            onClick={onOpenSoundboard}
            title="Open Soundboard"
            className="px-2 py-1 rounded text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Music className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
            <span className="hidden lg:inline">Soundboard</span>
          </button>

          <div className="w-[1px] h-5 bg-[var(--border-subtle)] mx-1" />

          {/* Camera, Camera Preview, Screen Share, Co-Browse, Disconnect */}
          <button
            type="button"
            aria-label={hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
            aria-pressed={hasVideo}
            onClick={() => void handleToggleCamera()}
            title={hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
              hasVideo
                ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] border-[var(--status-online)]/40'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
            }`}
          >
            {hasVideo ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">Camera</span>
          </button>

          <button
            type="button"
            data-testid="ts3-camera-preview-btn"
            aria-label="Camera Preview"
            onClick={handleOpenCameraPreview}
            title="Camera Preview & Backgrounds"
            className="px-2 py-1 rounded text-xs font-medium bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
            <span className="hidden xl:inline">Camera Preview</span>
          </button>

          <button
            type="button"
            aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            aria-pressed={isScreenSharing}
            onClick={() => void handleScreenShareButton()}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
              isScreenSharing
                ? 'bg-[var(--status-online)]/20 text-[var(--status-online)] border-[var(--status-online)]/40'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{isScreenSharing ? 'Sharing' : 'Screen'}</span>
          </button>

          <button
            type="button"
            data-testid="ts3-cobrowse-btn"
            aria-label="Co-Browse"
            aria-pressed={isCoBrowseOpen}
            onClick={onToggleCoBrowse}
            title="Co-Browse & Watch Together"
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
              isCoBrowseOpen
                ? 'bg-[var(--discord-blurple)]/25 text-[var(--text-header)] border-[var(--discord-blurple)]/50'
                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border-[var(--border-subtle)]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Co-Browse</span>
          </button>

          {activeVoiceRoom && (
            <button
              type="button"
              aria-label="Disconnect from Voice Channel"
              onClick={onDisconnectVoice}
              title="Disconnect from Voice Channel"
              className="px-2 py-1 rounded text-xs font-semibold bg-[var(--status-dnd)]/20 hover:bg-[var(--status-dnd)] text-[var(--status-dnd)] hover:text-white border border-[var(--status-dnd)]/40 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}

          <div className="w-[1px] h-5 bg-[var(--border-subtle)] mx-1" />

          {/* Tool Shortcuts */}
          {onOpenLargeFileShare && (
            <button
              type="button"
              aria-label="Large File Transfer"
              onClick={onOpenLargeFileShare}
              title="Large File Transfer"
              className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenScripts && (
            <button
              type="button"
              aria-label="Scripts & Console"
              onClick={onOpenScripts}
              title="Scripts & Console"
              className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenEquicord && (
            <button
              type="button"
              aria-label="Plugins"
              onClick={onOpenEquicord}
              title="Plugins"
              className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] cursor-pointer"
            >
              <Puzzle className="w-3.5 h-3.5" />
            </button>
          )}
          {onOpenDiscordHub && (
            <button
              type="button"
              aria-label="Hub"
              onClick={onOpenDiscordHub}
              title="Hub"
              className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Settings"
            onClick={() => onOpenSettings('voice')}
            title="Settings"
            className="p-1.5 rounded bg-[var(--bg-card)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] border border-[var(--border-subtle)] cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          data-testid="ts3-switch-discord-btn"
          aria-label="Standard"
          onClick={onSwitchToDiscordLayout}
          className="px-2.5 py-1 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer flex-shrink-0 transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Standard</span>
        </button>
      </div>

      {/* 3. Upper Split Workspace: Left TS3 Channel Tree + Right Channel/Client Info & Stage */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Pane: Classic TS3 Channel Tree */}
        <div className="w-[38%] sm:w-[40%] lg:w-[36%] min-w-[230px] max-w-[420px] h-full overflow-y-auto bg-[var(--bg-channels)] border-r border-[var(--border-subtle)] p-2 space-y-1.5">
          {/* Root Server Header Node */}
          <div className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-[var(--text-header)]">
            <span className="truncate">
              {activeGuild ? activeGuild.name : 'Protutech Virtual Server (Home)'}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
              {voiceParticipants.length > 0 ? `${voiceParticipants.length} in voice` : `${rtcPing}ms`}
            </span>
          </div>

          {/* Active External Voice Call Node (if active voice channel is not in current tree) */}
          {activeVoiceRoom && !anyListedChannelMatchesActiveVoice && (
            <div className="ml-2 pl-2 border-l border-[var(--border-subtle)] space-y-0.5">
              <div className="px-2 py-1 rounded bg-[var(--bg-item-active)] text-xs font-semibold text-[var(--text-header)] flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  <Volume2 className="w-3.5 h-3.5 text-[var(--text-link)] flex-shrink-0" />
                  <span className="truncate">{activeVoiceRoom}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-link)] flex-shrink-0">
                  Opus 48kHz
                </span>
              </div>
              <div className="ml-4 pl-2 border-l border-[var(--border-subtle)] space-y-0.5">
                {voiceParticipants.map((p) => (
                  <Ts3ClientRow
                    key={p.identity}
                    participant={p}
                    isSelected={selectedClientId === p.identity}
                    onSelect={() => setSelectedClientId(p.identity)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Expandable Channel Folders & Nested Clients */}
          {treeGroups.map((group) => {
            const isCollapsed = Boolean(collapsedFolders[group.id]);
            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleFolder(group.id)}
                  className="w-full px-1.5 py-1 rounded hover:bg-[var(--bg-item-hover)] flex items-center gap-1.5 text-xs font-bold text-[var(--text-header)] cursor-pointer"
                >
                  <span className="font-mono text-[10px] text-[var(--text-muted)] w-4 text-center">
                    {isCollapsed ? '[+]' : '[-]'}
                  </span>
                  {isCollapsed ? (
                    <Folder className="w-3.5 h-3.5 text-[var(--status-idle)] flex-shrink-0" />
                  ) : (
                    <FolderOpen className="w-3.5 h-3.5 text-[var(--status-idle)] flex-shrink-0" />
                  )}
                  <span className="truncate">{group.label}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono">
                    {group.items.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="ml-3 pl-2 border-l border-[var(--border-subtle)] space-y-0.5">
                    {group.items.length === 0 ? (
                      <div className="px-2 py-1 text-[11px] text-[var(--text-muted)] italic">
                        (empty)
                      </div>
                    ) : (
                      group.items.map((channel) => {
                        const isSelected = activeRoomId === channel.id;
                        const isVoiceChannel = Boolean(
                          channel.isVoice || group.isVoiceFolder || channel.id === 'livekit_lounge'
                        );
                        const isJoined = isRoomActiveVoice(channel);

                        return (
                          <div key={channel.id} className="space-y-0.5">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => handleChannelClick(channel)}
                              onDoubleClick={() => handleChannelDoubleClick(channel)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleChannelClick(channel);
                                }
                              }}
                              className={`group px-2 py-1 rounded flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                                isSelected || isJoined
                                  ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] font-semibold'
                                  : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
                              }`}
                              title={
                                isVoiceChannel
                                  ? 'Double-click to join voice channel'
                                  : `Open #${channel.name}`
                              }
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isVoiceChannel ? (
                                  <Volume2
                                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                                      isJoined ? 'text-[var(--text-link)]' : 'text-[var(--text-muted)]'
                                    }`}
                                  />
                                ) : channel.isDirect ? (
                                  <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                ) : (
                                  <Hash className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                )}
                                <span className="truncate">{channel.name}</span>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isVoiceChannel && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--bg-popout)] text-[var(--text-muted)]">
                                    Opus 48kHz
                                  </span>
                                )}
                                {isVoiceChannel && !isJoined && (
                                  <button
                                    type="button"
                                    aria-label={`Join ${channel.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onJoinVoice(channel);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-1.5 py-0.2 rounded bg-[var(--discord-blurple)] text-white text-[10px] font-semibold cursor-pointer transition-opacity"
                                  >
                                    Join
                                  </button>
                                )}
                                {isVoiceChannel && onJoinDiscordCall && (channel.discordChannelId || channel.isSynced) && (
                                  <button
                                    type="button"
                                    aria-label={`Bridged Call for ${channel.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void onJoinDiscordCall(channel);
                                    }}
                                    title="Bridged Call"
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded bg-[var(--status-online)]/25 text-[var(--status-online)] cursor-pointer transition-opacity"
                                  >
                                    <PhoneCall className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Nested Tree-Indented Client Rows with Iconic TS3 Blue Circle Lamp */}
                            {isJoined && voiceParticipants.length > 0 && (
                              <div className="ml-4 pl-2 border-l border-[var(--border-subtle)] space-y-0.5 py-0.5">
                                {voiceParticipants.map((p) => (
                                  <Ts3ClientRow
                                    key={p.identity}
                                    participant={p}
                                    isSelected={selectedClientId === p.identity}
                                    onSelect={() => setSelectedClientId(p.identity)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Pane: TeamSpeak Channel & Client Info Panel + Embedded Stages */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--bg-chat)] flex flex-col">
          {/* Server Ping / Packet-Loss / Codec HUD */}
          <div className="px-4 py-2 bg-[var(--bg-userpanel)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 flex-wrap text-xs flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-header)]">
                <Activity className="w-3.5 h-3.5 text-[var(--text-link)]" />
                <span>Ping: {rtcPing}ms</span>
              </span>
              <span className="text-[var(--text-muted)]">Loss: 0.00%</span>
              <span className="text-[var(--text-muted)]">Opus 48kHz</span>
              <span className="flex items-center gap-1 text-[var(--status-online)]">
                <Shield className="w-3 h-3" />
                <span>Encrypted</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(currentRoom.isVoice || currentRoom.id === 'livekit_lounge') && (
                <button
                  type="button"
                  onClick={() =>
                    isRoomActiveVoice(currentRoom) ? onDisconnectVoice() : onJoinVoice(currentRoom)
                  }
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    isRoomActiveVoice(currentRoom)
                      ? 'bg-[var(--status-dnd)] text-white'
                      : 'bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white'
                  }`}
                >
                  {isRoomActiveVoice(currentRoom) ? 'Leave Voice' : 'Join Voice'}
                </button>
              )}
            </div>
          </div>

          {/* Embedded VoiceStage when active */}
          {activeVoiceRoom && (
            <VoiceStage
              participants={voiceParticipants}
              roomName={activeVoiceRoom}
              onToggleCoBrowse={onToggleCoBrowse}
              isCoBrowsing={isCoBrowseOpen}
              onOpenSoundboard={onOpenSoundboard}
              onOpenCameraPreview={handleOpenCameraPreview}
              onDisconnect={onDisconnectVoice}
            />
          )}

          {/* Embedded SharedBrowserStage when Co-Browse active */}
          {isCoBrowseOpen && (
            <SharedBrowserStage
              isOpen={isCoBrowseOpen}
              roomName={activeVoiceRoom || currentRoom.name}
              roomId={currentRoom.id}
              initialQueryOrUrl={coBrowseInitialQuery}
              onClose={onCloseCoBrowse}
              onShareToChat={(text) => onSendMessage(text)}
            />
          )}

          {/* Channel & Selected Client Info Cards */}
          <div className="p-4 space-y-4">
            {/* Selected TS3 Client Volume & Inspector Card */}
            {selectedClient && (
              <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        selectedClient.isSpeaking
                          ? 'bg-[var(--text-link)] shadow-[0_0_8px_var(--text-link)]'
                          : 'bg-[var(--discord-blurple)]/75'
                      }`}
                    />
                    <span className="text-sm font-bold text-[var(--text-header)] truncate">
                      {selectedClient.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-popout)] text-[var(--text-muted)]">
                      {selectedClient.codec || 'Opus 48kHz'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onSelectUser && (
                      <button
                        type="button"
                        onClick={() => handleInspectUser(selectedClient.identity)}
                        className="px-2 py-1 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Profile
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Close client inspector"
                      onClick={() => setSelectedClientId(null)}
                      className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Sliders className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-[var(--text-muted)] flex-shrink-0">Client Volume</span>
                  <input
                    type="range"
                    aria-label={`Volume for ${selectedClient.name}`}
                    min={0}
                    max={200}
                    value={selectedClient.volume ?? 100}
                    onChange={(e) =>
                      livekit.setParticipantVolume(selectedClient.identity, Number(e.target.value))
                    }
                    className="flex-1 accent-[var(--discord-blurple)] cursor-pointer h-1.5"
                  />
                  <span className="font-mono text-xs text-[var(--text-header)] w-10 text-right">
                    {selectedClient.volume ?? 100}%
                  </span>
                </div>
              </div>
            )}

            {/* Channel Description & Codec Spec */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {currentRoom.isVoice ? (
                    <Volume2 className="w-4 h-4 text-[var(--text-link)] flex-shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  )}
                  <h3 className="text-sm font-bold text-[var(--text-header)] truncate">
                    {currentRoom.name}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Opus 48kHz Stereo • {rtcPing}ms
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {currentRoom.topic ||
                  `Channel "${currentRoom.name}" in ${
                    activeGuild?.name || 'Direct Messages'
                  }. Double-click any voice channel in the tree to connect.`}
              </p>
            </div>

            {/* Channel Members List */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Members ({currentRoom.members.length})</span>
                </span>
              </div>
              {currentRoom.members.length === 0 ? (
                <div className="text-xs text-[var(--text-muted)] italic">
                  No members listed in this channel yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {currentRoom.members.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => onSelectUser?.(member)}
                      className="px-2.5 py-1.5 rounded bg-[var(--bg-popout)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-left text-xs cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            member.presence === 'online'
                              ? 'bg-[var(--status-online)]'
                              : member.presence === 'idle'
                                ? 'bg-[var(--status-idle)]'
                                : member.presence === 'dnd'
                                  ? 'bg-[var(--status-dnd)]'
                                  : 'bg-[var(--status-offline)]'
                          }`}
                        />
                        <span className="truncate font-medium text-[var(--text-header)]">
                          {member.displayName}
                        </span>
                      </span>
                      {member.statusMsg && (
                        <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[110px]">
                          {member.statusMsg}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Lower Pane: Tabbed TeamSpeak Chat & Server Event Log */}
      <div className="h-[min(210px,calc(34vh/var(--app-zoom,1)))] min-h-[140px] flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-userpanel)] flex flex-col overflow-hidden">
        {/* Lower Tabs */}
        <div className="px-2 pt-1 bg-[var(--bg-servers)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLowerTab('channel')}
              aria-pressed={lowerTab === 'channel'}
              className={`px-3 py-1 rounded-t text-xs font-semibold border border-b-0 cursor-pointer transition-colors ${
                lowerTab === 'channel'
                  ? 'bg-[var(--bg-userpanel)] text-[var(--text-header)] border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-header)] border-transparent'
              }`}
            >
              &lt;Channel #{currentRoom.name}&gt;
            </button>
            <button
              type="button"
              onClick={() => setLowerTab('log')}
              aria-pressed={lowerTab === 'log'}
              className={`px-3 py-1 rounded-t text-xs font-semibold border border-b-0 cursor-pointer transition-colors flex items-center gap-1.5 ${
                lowerTab === 'log'
                  ? 'bg-[var(--bg-userpanel)] text-[var(--text-header)] border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-header)] border-transparent'
              }`}
            >
              <span>&lt;Server Event Log&gt;</span>
              <span className="text-[10px] font-mono px-1 rounded bg-[var(--bg-popout)] text-[var(--text-muted)]">
                {eventLogs.length}
              </span>
            </button>
          </div>

          {lowerTab === 'log' && (
            <button
              type="button"
              onClick={() => setEventLogs([])}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-header)] px-2 py-0.5 cursor-pointer"
            >
              Clear Log
            </button>
          )}
        </div>

        {lowerTab === 'channel' ? (
          <>
            {/* Compact TS3 Message Feed */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 text-xs select-text">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-xs">
                  No messages in #{currentRoom.name} yet. Type below to chat.
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender === effectiveUserId;
                  const isEditingThis = editingId === msg.id;
                  const reactions = msg.reactions ? Object.entries(msg.reactions) : [];

                  return (
                    <div
                      key={msg.id}
                      className="group px-1.5 py-0.5 rounded hover:bg-[var(--bg-message-hover)] flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1 leading-relaxed">
                        {msg.replyTo && (
                          <div className="text-[10px] text-[var(--text-muted)] pl-2 border-l-2 border-[var(--discord-blurple)] mb-0.5 truncate">
                            Replying to @{msg.replyTo.sender}: {msg.replyTo.body}
                          </div>
                        )}
                        <span className="font-mono text-[10px] text-[var(--text-muted)] mr-1.5">
                          [{formatTsTime(msg.timestamp)}]
                        </span>
                        <button
                          type="button"
                          onClick={() => handleInspectUser(msg.sender)}
                          className="font-bold text-[var(--text-link)] hover:underline mr-1.5 cursor-pointer"
                        >
                          &lt;{msg.senderName}&gt;
                        </button>
                        {msg.source === 'discord' && (
                          <span
                            title="External Bridge"
                            className="mr-1.5 px-1 py-0.2 rounded text-[9px] font-bold bg-[var(--discord-blurple)]/25 text-[var(--text-link)]"
                          >
                            Bridge
                          </span>
                        )}
                        {isEditingThis ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              aria-label="Edit message"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-2 py-0.5 text-xs text-[var(--text-header)] outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              aria-label="Save edit"
                              onClick={() => {
                                if (editingText.trim() && onEditMessage) {
                                  onEditMessage(currentRoom.id, msg.id, editingText.trim());
                                }
                                setEditingId(null);
                              }}
                              className="p-0.5 rounded bg-[var(--status-online)] text-white cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel edit"
                              onClick={() => setEditingId(null)}
                              className="p-0.5 rounded bg-[var(--bg-card)] text-[var(--text-muted)] cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ) : (
                          <span className="text-[var(--text-normal)] break-words whitespace-pre-wrap">
                            {msg.body}
                            {msg.isEdited && (
                              <span className="ml-1 text-[10px] text-[var(--text-muted)] italic">
                                (edited)
                              </span>
                            )}
                          </span>
                        )}

                        {msg.mediaUrl && msg.mediaType === 'image' && (
                          <div className="mt-1">
                            <img
                              src={msg.mediaUrl}
                              alt={msg.body}
                              className="max-h-24 rounded border border-[var(--border-subtle)]"
                            />
                          </div>
                        )}
                        {msg.mediaUrl && msg.mediaType !== 'image' && (
                          <a
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-[var(--text-link)] underline"
                          >
                            [Attachment]
                          </a>
                        )}

                        {reactions.length > 0 && (
                          <span className="inline-flex items-center gap-1 ml-2">
                            {reactions.map(([emoji, users]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onAddReaction?.(currentRoom.id, msg.id, emoji)}
                                className="px-1.5 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] cursor-pointer"
                              >
                                {emoji} {users.length}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 flex-shrink-0">
                        {onAddReaction && (
                          <button
                            type="button"
                            aria-label="Quick React"
                            onClick={() =>
                              onAddReaction(currentRoom.id, msg.id, TS_QUICK_REACTIONS[0])
                            }
                            title="Quick React"
                            className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                          >
                            <Smile className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Reply"
                          onClick={() =>
                            setReplyTarget({
                              id: msg.id,
                              sender: msg.senderName,
                              body: msg.body,
                            })
                          }
                          title="Reply"
                          className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        {onEditMessage && isOwn && (
                          <button
                            type="button"
                            aria-label="Edit message"
                            onClick={() => {
                              setEditingId(msg.id);
                              setEditingText(msg.body);
                            }}
                            title="Edit"
                            className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteMessage && (
                          <button
                            type="button"
                            aria-label="Delete message"
                            onClick={() => onDeleteMessage(currentRoom.id, msg.id)}
                            title="Delete"
                            className="p-1 rounded hover:bg-[var(--status-dnd)]/20 text-[var(--text-muted)] hover:text-[var(--status-dnd)] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Reply target banner */}
            {replyTarget && (
              <div className="px-3 py-1 bg-[var(--bg-popout)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] flex-shrink-0">
                <span className="truncate text-[var(--text-muted)]">
                  Replying to <b className="text-[var(--text-header)]">@{replyTarget.sender}</b>:{' '}
                  {replyTarget.body}
                </span>
                <button
                  type="button"
                  aria-label="Cancel reply"
                  onClick={() => setReplyTarget(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Compact TS3 Message Composer */}
            <form
              onSubmit={(e) => void handleSendComposer(e)}
              className="px-2.5 py-1.5 bg-[var(--bg-channels)] border-t border-[var(--border-subtle)] flex items-center gap-2 flex-shrink-0"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => void handleComposerUpload(e)}
                className="hidden"
              />
              <button
                type="button"
                aria-label="Attach File"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                title="Attach File"
                className="p-1 rounded hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                data-testid="ts3-chat-input"
                aria-label={`Message #${currentRoom.name}`}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder={`Send message to #${currentRoom.name}...`}
                className="flex-1 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded px-2.5 py-1 text-xs text-[var(--text-normal)] placeholder:text-[var(--text-muted)] outline-none"
              />
              <button
                type="submit"
                disabled={!composerText.trim()}
                aria-label="Send message"
                className="px-3 py-1 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 font-mono text-[11px] select-text">
            {eventLogs.length === 0 ? (
              <div className="text-[var(--text-muted)] italic">Server event log cleared.</div>
            ) : (
              eventLogs.map((entry) => (
                <div key={entry.id} className="leading-snug">
                  <span className="text-[var(--text-muted)] mr-1.5">
                    [{formatTsTime(entry.timestamp)}]
                  </span>
                  <span
                    className={`font-bold mr-1.5 ${
                      entry.tone === 'sound'
                        ? 'text-[var(--discord-blurple)]'
                        : entry.tone === 'voice'
                          ? 'text-[var(--text-link)]'
                          : entry.tone === 'warn'
                            ? 'text-[var(--status-idle)]'
                            : 'text-[var(--status-online)]'
                    }`}
                  >
                    &lt;{entry.source}&gt;
                  </span>
                  <span className="text-[var(--text-normal)]">{entry.text}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* 5. Bottom Status Bar */}
      <div className="h-[24px] px-3 bg-[var(--bg-servers)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)] flex-shrink-0 gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              activeVoiceRoom ? 'bg-[var(--text-link)]' : 'bg-[var(--status-online)]'
            }`}
          />
          <span className="truncate font-medium text-[var(--text-normal)]">
            Connected - {rtcPing}ms RTC
          </span>
          {activeVoiceRoom && (
            <span className="truncate hidden sm:inline">• Voice: {activeVoiceRoom}</span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={micLoopback ? 'text-[var(--status-online)] font-semibold' : ''}>
            Mic Playback: {micLoopback ? 'ON' : 'OFF'}
          </span>

          <div className="flex items-center gap-1">
            {onZoomOut && (
              <button
                type="button"
                aria-label="Zoom Out"
                onClick={onZoomOut}
                className="px-1 hover:text-[var(--text-header)] cursor-pointer"
                title="Zoom Out"
              >
                -
              </button>
            )}
            <button
              type="button"
              aria-label="Reset Zoom"
              onClick={onZoomReset}
              className="hover:text-[var(--text-header)] cursor-pointer font-mono"
              title="Reset Zoom"
            >
              Zoom {zoomLevel}%
            </button>
            {onZoomIn && (
              <button
                type="button"
                aria-label="Zoom In"
                onClick={onZoomIn}
                className="px-1 hover:text-[var(--text-header)] cursor-pointer"
                title="Zoom In"
              >
                +
              </button>
            )}
          </div>

          <span className="hidden sm:inline">{guilds.length} servers</span>
        </div>
      </div>

      <ScreenSharePickerModal
        isOpen={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onStartShare={(sel) => void handleStartScreenShare(sel)}
      />
    </div>
  );
};

interface Ts3ClientRowProps {
  participant: VoiceParticipant;
  isSelected: boolean;
  onSelect: () => void;
}

const Ts3ClientRow: React.FC<Ts3ClientRowProps> = ({
  participant: p,
  isSelected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-2 py-1 rounded flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
          : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        {/* Iconic TS3 Blue Circle Lamp */}
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
            p.isSpeaking
              ? 'bg-[var(--text-link)] shadow-[0_0_8px_var(--text-link)] scale-110'
              : 'bg-[var(--discord-blurple)]/75 border border-[var(--text-link)]/40'
          }`}
          title={p.isSpeaking ? 'Speaking' : 'Connected'}
        />
        <span className="truncate font-medium">{p.name}</span>
      </span>

      <span className="flex items-center gap-1 flex-shrink-0">
        {p.hasScreenShare && (
          <span className="px-1 py-0.2 rounded bg-[var(--status-dnd)] text-white text-[9px] font-bold">
            LIVE
          </span>
        )}
        {p.hasVideo && (
          <span className="px-1 py-0.2 rounded bg-[var(--status-online)]/25 text-[var(--status-online)] text-[9px] font-bold">
            CAM
          </span>
        )}
        {p.isMuted && <MicOff className="w-3 h-3 text-[var(--status-dnd)]" />}
        {p.isDeafened && <VolumeX className="w-3 h-3 text-[var(--status-dnd)]" />}
      </span>
    </button>
  );
};
