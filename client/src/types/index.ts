export interface MatrixUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  presence?: 'online' | 'idle' | 'dnd' | 'offline';
  statusMsg?: string;
}

export interface MatrixMessage {
  id: string;
  roomId: string;
  sender: string;
  senderName: string;
  avatarUrl?: string;
  body: string;
  timestamp: number;
  formattedBody?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  replyTo?: {
    id: string;
    sender: string;
    body: string;
  };
  reactions?: Record<string, string[]>; // emoji -> [userIds]
}

export interface MatrixRoom {
  id: string;
  name: string;
  topic?: string;
  avatarUrl?: string;
  isDirect: boolean;
  isGroupChat: boolean;
  isVoice?: boolean;
  guildId?: string;
  guildName?: string;
  unreadCount?: number;
  lastMessageTimestamp?: number;
  members: MatrixUser[];
}

export interface DiscordGuild {
  id: string;
  name: string;
  iconUrl?: string;
  channels: MatrixRoom[];
  hasVoice?: boolean;
}

export interface VoiceParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  hasScreenShare: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  screenTrack?: MediaStreamTrack;
}

export interface VencordPlugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  author: string;
}

export interface ThemeConfig {
  activeTheme: 'dark' | 'midnight' | 'translucent' | 'transparent' | 'catppuccin' | 'nord' | 'cyberpunk' | 'crimson' | 'emerald' | 'solarized' | 'custom';
  customCssUrl?: string;
  customCssText?: string;
}
