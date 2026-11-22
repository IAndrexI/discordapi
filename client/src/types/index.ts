export interface MatrixUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  presence?: 'online' | 'idle' | 'dnd' | 'offline';
  statusMsg?: string;
  currentRoomId?: string;
  currentRoomName?: string;
  currentRoomType?: 'server' | 'group' | 'dm';
  activity?: string;
  // Discord Identity & Stats
  discordId?: string;
  discordJoinDate?: number; // timestamp account created
  serverJoinDate?: number; // timestamp joined current server
  voiceTimeMinutes?: number; // total tracked time spent in voice calls
  currentGame?: {
    name: string;
    appId?: string; // Steam App ID if applicable
    lobbyId?: string;
    connectUrl?: string; // steam://joinlobby/...
  };
  pronouns?: string;
  bio?: string;
  bannerColor?: string;
  bannerUrl?: string;
  accentColor?: string;
  avatarDecoration?: 'none' | 'cyber_ring' | 'neon_pulse' | 'plasma_aura' | 'discord_crown';
  badges?: string[];
  isDiscordBridged?: boolean;
  hasProtutechApp?: boolean;
}

export interface GameInvite {
  id: string;
  gameName: string;
  steamAppId?: string;
  lobbyId?: string;
  connectUrl: string; // e.g. steam://joinlobby/730/...
  inviterName: string;
  timestamp: number;
}

export interface MinecraftServerConfig {
  id: string;
  name: string;
  host: string;
  rconPort: number;
  rconPassword?: string;
  status?: 'online' | 'offline';
  playerCount?: number;
  maxPlayers?: number;
}

export interface MinecraftLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
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
  source?: 'discord' | 'app';
  largeFile?: LargeFileTransfer;
  webhookMeta?: {
    username?: string;
    avatarUrl?: string;
    bridge?: 'minecraft' | 'discord' | 'script' | 'webhook';
    serverName?: string;
  };
  poll?: {
    question: string;
    options: Array<{ id: string; text: string; votes: string[] }>;
    allowMultiple?: boolean;
  };
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
  isSynced?: boolean;
  syncSource?: 'discord' | 'matrix';
  serverKind?: 'proprietary' | 'discord' | 'hybrid';
  discordChannelId?: string;
  discordGuildId?: string;
  unreadCount?: number;
  lastMessageTimestamp?: number;
  members: MatrixUser[];
  // Discord-like channel settings
  bitrate?: number; // Voice bitrate in kbps (8 - 384)
  userLimit?: number; // Max voice members (0 = unlimited, 1 - 99)
  isAfkChannel?: boolean; // Sleep / AFK channel (auto-mutes & routes idle users)
  rtcRegion?: string; // 'auto' | 'us-west' | 'us-east' | 'eu-central' | 'ap-southeast'
  videoQualityMode?: 'auto' | '720p';
  slowmodeSeconds?: number; // Text channel rate limit per user (0 = off)
  nsfw?: boolean; // 18+ age-restricted channel gate
  isPrivate?: boolean; // Locked/private channel indicator
  autoArchiveDurationMinutes?: 60 | 1440 | 4320 | 10080;
}

export interface DiscordGuild {
  id: string;
  name: string;
  iconUrl?: string;
  channels: MatrixRoom[];
  hasVoice?: boolean;
  isAlwaysSynced?: boolean;
  bridgedChannelCount?: number;
  serverKind?: 'proprietary' | 'discord' | 'hybrid';
  isProprietary?: boolean;
  // Discord-like server settings
  afkChannelId?: string | null;
  afkTimeoutSeconds?: number; // 60 | 300 | 900 | 1800 | 3600 (0 = off)
  systemChannelId?: string | null;
  verificationLevel?: 'none' | 'low' | 'medium' | 'high';
  defaultNotifications?: 'all' | 'mentions';
}

export interface DiscordAvailableGuild {
  id: string;
  name: string;
  avatar?: string | null;
  avatar_url?: string | null;
  bridged: boolean;
}

export interface DiscordAvailableChannel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'category';
  type_id: number;
  category_id?: string | null;
  category_name?: string | null;
  is_bridged: boolean;
  mxid?: string | null;
}

export interface DiscordAvailableDM {
  id: string;
  name: string;
  type: 'dm' | 'group';
  type_id: number;
  other_user_id?: string | null;
  is_bridged: boolean;
  mxid?: string | null;
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
  volume?: number; // 0 to 200 (default 100)
  customBackground?: WebcamBackgroundConfig;
  ping?: number;
  codec?: string;
}

export interface WebcamBackgroundConfig {
  type: 'none' | 'blur' | 'preset' | 'custom';
  presetId?: string; // e.g. 'cyberpunk_city', 'synthwave_grid', 'gaming_room', 'anime_room', 'studio_dark', 'aurora'
  customUrl?: string; // user-uploaded custom background image URL or base64
  blurAmount?: number; // px blur if type === 'blur'
}

export interface VencordPlugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  author: string;
  source?: 'vencord' | 'equicord' | 'betterdiscord' | 'replugged' | 'user';
  category?: 'chat' | 'media' | 'ui' | 'privacy' | 'utility';
  codeUrl?: string;
  code?: string;
  version?: string;
  hasSettings?: boolean;
  tags?: string[];
  isCatalog?: boolean;
}

export interface ThemeConfig {
  activeTheme:
    | 'dark'
    | 'revolt'
    | 'classic-dark'
    | 'light'
    | 'midnight'
    | 'translucent'
    | 'transparent'
    | 'catppuccin'
    | 'nord'
    | 'cyberpunk'
    | 'crimson'
    | 'emerald'
    | 'solarized'
    | 'teamspeak'
    | 'custom';
  layoutFormat?: 'discord' | 'teamspeak';
  customCssUrl?: string;
  customCssText?: string;
}

export interface SoundboardClip {
  id: string;
  name: string;
  emoji: string;
  category: 'builtin' | 'custom';
  volume: number; // 0-200
  favorite?: boolean;
  hotkey?: string;
  durationMs?: number;
  createdAt?: number;
}

export interface SoundboardPlayEvent {
  id: string;
  clipId: string;
  name: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

export type VoiceGatewayProvider = 'native_livekit' | 'discord_proxy' | 'stoat_hosted';

export interface VoiceProxyConfig {
  enabled: boolean;
  activeProvider: VoiceGatewayProvider;
  disclaimerAccepted: boolean;
  disclaimerAcceptedTimestamp?: number;
  discord: {
    token: string;
    guildId: string;
    channelId: string;
    proxyRelayUrl: string;
    bitrate: number;
    autoMuteOnJoin: boolean;
  };
  stoat: {
    serverUrl: string;
    roomId: string;
    token: string;
    transport: 'webrtc' | 'mediasoup';
  };
}

export interface VoiceProxySession {
  provider: VoiceGatewayProvider;
  status: 'disconnected' | 'connecting' | 'authenticating' | 'handshaking' | 'connected' | 'error';
  targetName: string;
  ping: number;
  error?: string;
  connectedAt?: number;
  participants: VoiceParticipant[];
}

export type EngineMode = 'hybrid' | 'proprietary' | 'discord_proxy';

export interface ScriptPlugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: 'onMessage' | 'onCommand' | 'webhook' | 'minecraft' | 'manual';
  code: string;
  author?: string;
  builtin?: boolean;
  commandPrefix?: string;
  lastRunAt?: number;
  lastOutput?: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  channelId: string;
  channelName?: string;
  token: string;
  url: string;
  bridgeType: 'discord' | 'minecraft' | 'custom';
  enabled: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
}

export interface LargeFileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  mode: 'chunked' | 'p2p';
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  speedMBps: number;
  uploadedBytes: number;
  totalChunks: number;
  completedChunks: number;
  chunkSize: number;
  downloadUrl: string;
  sha256?: string;
  p2pManifest?: {
    peerId: string;
    magnetUri?: string;
    iceServers?: string[];
    createdAt: number;
  };
  createdAt: number;
  error?: string;
}

export interface DiscordQuest {
  id: string;
  title: string;
  gameName: string;
  description: string;
  category: 'stream' | 'play' | 'orbs' | 'decoration';
  progress: number;
  target: number;
  accepted: boolean;
  completed: boolean;
  claimed: boolean;
  rewardName: string;
  rewardDecoration?: 'cyber_ring' | 'neon_pulse' | 'plasma_aura' | 'discord_crown';
  rewardBadge?: string;
  expiresAt?: string;
}

export interface DiscordSyncedSettings {
  syncEnabled: boolean;
  discordTokenConnected: boolean;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  customStatusText: string;
  customStatusEmoji: string;
  displayName: string;
  pronouns: string;
  bio: string;
  accentColor: string;
  bannerColor: string;
  theme: 'dark' | 'light' | 'midnight';
  messageDisplayCompact: boolean;
  developerMode: boolean;
  animateEmoji: boolean;
  gifAutoPlay: boolean;
  noiseSuppression: 'krisp' | 'standard' | 'none';
  echoCancellation: boolean;
  automaticGainControl: boolean;
  inputVolume: number;
  outputVolume: number;
  dmSpamFilter: boolean;
  allowDmsFromServerMembers: boolean;
  lastSyncedAt: number | null;
  lastSyncDirection: 'app_to_discord' | 'discord_to_app' | null;
  lastSyncLog: string;
}

export interface UserAccountInfo {
  userId: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  hasPassword: boolean;
  passwordUpdatedAt: number | null;
  emailDelivery: 'smtp' | 'outbox';
}


