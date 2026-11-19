import type {
  DiscordGuild,
  EngineMode,
  MatrixMessage,
  MatrixRoom,
  MatrixUser,
} from '../types';
import { vencord } from './vencord';

export type { EngineMode };

const FALLBACK_LOCAL_SERVER = 'http://127.0.0.1:4175';
const REMOTE_LEGACY_URL = 'https://chat.protutech.vip';

const ENGINE_MODE_KEY = 'protutech_engine_mode';
const DISCORD_TOKEN_KEY = 'protutech_discord_token';
const CUSTOM_SERVER_URL_KEY = 'protutech_custom_server_url';
const ROOMS_CACHE_KEY = 'protutech_rooms_cache_v2';
const MSGS_CACHE_KEY = 'protutech_msgs_cache_v2';

const MAX_CACHED_MSGS_PER_ROOM = 80;
const MAX_CACHED_ROOMS_MSGS = 45;
const STATE_FETCH_BATCH_SIZE = 12;

interface MemberProfile {
  displayName: string;
  avatarUrl?: string;
  isDiscordBridged?: boolean;
}

interface RoomsCachePayload {
  rooms: MatrixRoom[];
  guilds: DiscordGuild[];
  updatedAt?: number;
}

export function getEngineMode(): EngineMode {
  if (typeof localStorage === 'undefined') return 'hybrid';
  try {
    const raw = (localStorage.getItem(ENGINE_MODE_KEY) || '').trim();
    if (raw === 'proprietary' || raw === 'discord_proxy' || raw === 'hybrid') {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'hybrid';
}

export function setEngineMode(mode: EngineMode): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ENGINE_MODE_KEY, mode);
    } catch {
      // Ignore storage write errors
    }
  }
  matrix.reconnectRealtime();
}

export function getDiscordToken(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return (localStorage.getItem(DISCORD_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setDiscordToken(token: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = token.trim();
    if (trimmed) {
      localStorage.setItem(DISCORD_TOKEN_KEY, trimmed);
    } else {
      localStorage.removeItem(DISCORD_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getCustomServerUrl(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return (localStorage.getItem(CUSTOM_SERVER_URL_KEY) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setCustomServerUrl(url: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean) {
      localStorage.setItem(CUSTOM_SERVER_URL_KEY, clean);
    } else {
      localStorage.removeItem(CUSTOM_SERVER_URL_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') {
    return FALLBACK_LOCAL_SERVER;
  }

  const electronUrl = (
    window as unknown as { electronAPI?: { selfHostedServerUrl?: string } }
  ).electronAPI?.selfHostedServerUrl;

  const { protocol, hostname } = window.location;
  if (protocol === 'file:' || protocol === 'tauri:' || !hostname) {
    const customUrl = getCustomServerUrl();
    if (customUrl) {
      return customUrl;
    }
    return electronUrl || FALLBACK_LOCAL_SERVER;
  }

  const customUrl = getCustomServerUrl();
  if (customUrl) {
    return customUrl;
  }

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    protocol === 'http:' ||
    protocol === 'https:'
  ) {
    return '';
  }

  return FALLBACK_LOCAL_SERVER;
}

function isDiscordPuppetId(userId: string): boolean {
  return /^@_?discord_/i.test(userId) || /^@discordbot:/i.test(userId);
}

function fallbackDisplayName(userId: string): string {
  const localpart = userId.split(':')[0].replace(/^@/, '');
  if (localpart.startsWith('_discord_')) {
    return localpart.replace(/^_discord_/, 'Discord User ');
  }
  if (localpart.startsWith('discord_')) {
    return localpart.replace(/^discord_/, 'Discord User ');
  }
  return localpart || 'User';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripReplyFallback(
  body: string,
  formattedBody?: string
): {
  cleanBody: string;
  fallbackSender?: string;
  fallbackBody?: string;
} {
  let cleanBody = body || '';
  let fallbackSender: string | undefined;
  let fallbackBody: string | undefined;

  if (cleanBody.startsWith('> ')) {
    const splitIdx = cleanBody.indexOf('\n\n');
    if (splitIdx !== -1) {
      const quoteBlock = cleanBody.slice(0, splitIdx);
      const quoteLines = quoteBlock.split('\n').map((line) => line.replace(/^>\s?/, ''));
      const firstLine = quoteLines[0] || '';
      const senderMatch = firstLine.match(/^<([^>]+)>\s*(.*)$/);
      if (senderMatch) {
        fallbackSender = senderMatch[1].split(':')[0].replace(/^@/, '');
        const restLines = [senderMatch[2], ...quoteLines.slice(1)].filter(Boolean);
        fallbackBody = restLines.join('\n').trim();
      } else {
        fallbackBody = quoteLines.join('\n').trim();
      }
      cleanBody = cleanBody.slice(splitIdx + 2);
    }
  }

  if (!cleanBody && formattedBody) {
    cleanBody = formattedBody
      .replace(/<mx-reply>[\s\S]*?<\/mx-reply>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  return { cleanBody, fallbackSender, fallbackBody };
}

function inferMediaType(
  msgType: string | undefined,
  mimeType?: string,
  fileName?: string
): 'image' | 'video' | 'audio' | 'file' {
  if (msgType === 'm.image') return 'image';
  if (msgType === 'm.video') return 'video';
  if (msgType === 'm.audio') return 'audio';
  if (msgType === 'm.file') return 'file';

  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';

  const name = (fileName || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(name)) return 'image';
  if (/\.(mp4|webm|mov|mkv|avi)$/.test(name)) return 'video';
  if (/\.(mp3|ogg|wav|flac|opus|m4a|aac)$/.test(name)) return 'audio';

  return 'file';
}

function buildFallbackSeedRooms(mode: EngineMode): {
  rooms: MatrixRoom[];
  guilds: DiscordGuild[];
} {
  const hqRoom: MatrixRoom = {
    id: '!proto_general:local.protutech',
    name: 'general',
    topic: 'Protutech HQ — Self-Hosted Workspace',
    isDirect: false,
    isGroupChat: false,
    isVoice: false,
    guildId: 'guild_protutech_hq',
    guildName: 'Protutech HQ',
    isSynced: false,
    syncSource: 'matrix',
    serverKind: 'proprietary',
    members: [],
    unreadCount: 0,
  };
  const hqVoice: MatrixRoom = {
    id: '!proto_voice:local.protutech',
    name: '🔊 Protutech Voice Lounge',
    topic: 'Ultra-Low Latency Voice, Camera & Screen Share',
    isDirect: false,
    isGroupChat: false,
    isVoice: true,
    guildId: 'guild_protutech_hq',
    guildName: 'Protutech HQ',
    isSynced: false,
    syncSource: 'matrix',
    serverKind: 'proprietary',
    members: [],
    unreadCount: 0,
  };
  const hqGuild: DiscordGuild = {
    id: 'guild_protutech_hq',
    name: 'Protutech HQ',
    channels: [hqRoom, hqVoice],
    hasVoice: true,
    isAlwaysSynced: false,
    isProprietary: true,
    serverKind: 'proprietary',
  };

  if (mode === 'proprietary') {
    return { rooms: [hqRoom, hqVoice], guilds: [hqGuild] };
  }

  const dcRoom: MatrixRoom = {
    id: '!disc_general:local.protutech',
    name: 'discord-general',
    topic: 'Hybrid Bridged Discord Lounge',
    isDirect: false,
    isGroupChat: false,
    isVoice: false,
    guildId: 'guild_discord_bridged',
    guildName: 'Discord Bridged Lounge',
    isSynced: true,
    syncSource: 'discord',
    serverKind: 'discord',
    members: [],
    unreadCount: 0,
  };
  const dcGuild: DiscordGuild = {
    id: 'guild_discord_bridged',
    name: 'Discord Bridged Lounge',
    channels: [dcRoom],
    hasVoice: true,
    isAlwaysSynced: true,
    serverKind: 'discord',
  };

  return { rooms: [hqRoom, hqVoice, dcRoom], guilds: [hqGuild, dcGuild] };
}

export class MatrixClientService {
  private accessToken: string | null = null;
  private userId: string | null = null;
  private syncToken: string | null = null;
  private syncRunning: boolean = false;
  private eventSource: EventSource | null = null;
  private eventSourceBaseUrl: string | null = null;
  private roomsRefreshTimer: number | null = null;

  private messageListeners: Set<(roomId: string, message: MatrixMessage) => void> = new Set();
  private redactionListeners: Set<(roomId: string, eventId: string) => void> = new Set();
  private presenceListeners: Set<
    (userId: string, presence: 'online' | 'idle' | 'dnd' | 'offline') => void
  > = new Set();
  private editListeners: Set<(roomId: string, eventId: string, newBody: string) => void> =
    new Set();
  private reactionListeners: Set<
    (roomId: string, eventId: string, emoji: string, sender: string) => void
  > = new Set();
  private roomsUpdatedListeners: Set<
    (data: { rooms: MatrixRoom[]; guilds: DiscordGuild[] }) => void
  > = new Set();

  private roomsCache: Map<string, MatrixRoom> = new Map();
  private guildsCache: Map<string, DiscordGuild> = new Map();
  private messagesCache: Map<string, MatrixMessage[]> = new Map();
  private roomMembersCache: Map<string, Map<string, MemberProfile>> = new Map();
  private seenEventIds: Set<string> = new Set();
  private reactionTargetIndex: Map<
    string,
    { roomId: string; targetEventId: string; emoji: string; sender: string }
  > = new Map();

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.accessToken = localStorage.getItem('matrix_access_token');
      this.userId = localStorage.getItem('matrix_user_id');
      this.hydrateFromStorage();
      if (this.accessToken && this.userId) {
        this.connectEventStream();
      }
    }
  }

  public getEngineMode(): EngineMode {
    return getEngineMode();
  }

  public setEngineMode(mode: EngineMode): void {
    setEngineMode(mode);
  }

  public getServerBaseUrl(): string {
    return getServerBaseUrl();
  }

  public getDiscordToken(): string {
    return getDiscordToken();
  }

  public setDiscordToken(token: string): void {
    setDiscordToken(token);
  }

  public getCustomServerUrl(): string {
    return getCustomServerUrl();
  }

  public setCustomServerUrl(url: string): void {
    setCustomServerUrl(url);
    this.reconnectRealtime();
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public isAuthenticated(): boolean {
    return !!(this.accessToken && this.userId);
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public reconnectRealtime(): void {
    this.disconnectEventStream();
    if (this.isAuthenticated()) {
      this.connectEventStream();
    }
  }

  private async fetchApi(path: string, init: RequestInit = {}): Promise<Response> {
    const primaryBase = this.getServerBaseUrl();
    const token = getDiscordToken();
    const headers = new Headers(init.headers || {});
    if (this.accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }
    if (token && !headers.has('X-Discord-Token')) {
      headers.set('X-Discord-Token', token);
    }

    const requestInit: RequestInit = {
      ...init,
      headers,
    };

    try {
      const primaryRes = await fetch(`${primaryBase}${path}`, requestInit);
      if (
        (primaryRes.status === 502 || primaryRes.status === 503 || primaryRes.status === 504) &&
        primaryBase !== FALLBACK_LOCAL_SERVER
      ) {
        return await fetch(`${FALLBACK_LOCAL_SERVER}${path}`, requestInit);
      }
      return primaryRes;
    } catch (err) {
      if (primaryBase !== FALLBACK_LOCAL_SERVER) {
        try {
          return await fetch(`${FALLBACK_LOCAL_SERVER}${path}`, requestInit);
        } catch {
          throw err;
        }
      }
      throw err;
    }
  }

  private hydrateFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const rawRooms = localStorage.getItem(ROOMS_CACHE_KEY);
      if (rawRooms) {
        const parsed = JSON.parse(rawRooms) as RoomsCachePayload;
        if (Array.isArray(parsed.rooms)) {
          parsed.rooms.forEach((room) => {
            this.roomsCache.set(room.id, room);
            if (Array.isArray(room.members)) {
              const memberMap = this.getOrCreateMemberMap(room.id);
              room.members.forEach((m) => {
                memberMap.set(m.userId, {
                  displayName: m.displayName || fallbackDisplayName(m.userId),
                  avatarUrl: m.avatarUrl,
                  isDiscordBridged: m.isDiscordBridged ?? isDiscordPuppetId(m.userId),
                });
              });
            }
          });
        }
        if (Array.isArray(parsed.guilds)) {
          parsed.guilds.forEach((guild) => {
            this.guildsCache.set(guild.id, guild);
          });
        }
      }
    } catch {
      // Ignore corrupt rooms cache
    }

    try {
      const rawMsgs = localStorage.getItem(MSGS_CACHE_KEY);
      if (rawMsgs) {
        const parsed = JSON.parse(rawMsgs) as Record<string, MatrixMessage[]>;
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([roomId, list]) => {
            if (Array.isArray(list)) {
              this.messagesCache.set(roomId, list);
              list.forEach((m) => {
                if (m.id) this.seenEventIds.add(m.id);
              });
            }
          });
        }
      }
    } catch {
      // Ignore corrupt messages cache
    }
  }

  private persistRoomsCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload: RoomsCachePayload = {
        rooms: Array.from(this.roomsCache.values()),
        guilds: Array.from(this.guildsCache.values()),
        updatedAt: Date.now(),
      };
      localStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }

  private persistMessagesCache(): void {
    if (typeof localStorage === 'undefined') return;
    const serialize = (maxRooms: number, maxPerRoom: number) => {
      const entries = Array.from(this.messagesCache.entries()).slice(-maxRooms);
      const out: Record<string, MatrixMessage[]> = {};
      entries.forEach(([roomId, msgs]) => {
        out[roomId] = msgs.slice(-maxPerRoom);
      });
      return JSON.stringify(out);
    };

    try {
      localStorage.setItem(
        MSGS_CACHE_KEY,
        serialize(MAX_CACHED_ROOMS_MSGS, MAX_CACHED_MSGS_PER_ROOM)
      );
    } catch {
      try {
        localStorage.setItem(MSGS_CACHE_KEY, serialize(12, 25));
      } catch {
        // Ignore persistent quota overflow
      }
    }
  }

  private getOrCreateMemberMap(roomId: string): Map<string, MemberProfile> {
    let map = this.roomMembersCache.get(roomId);
    if (!map) {
      map = new Map<string, MemberProfile>();
      this.roomMembersCache.set(roomId, map);
    }
    return map;
  }

  private updateMemberFromEvent(roomId: string, ev: Record<string, unknown>): void {
    if (ev.type !== 'm.room.member') return;
    const userId = (ev.state_key as string) || (ev.sender as string) || '';
    if (!userId) return;
    const content = (ev.content as Record<string, unknown>) || {};
    const displayName = (content.displayname as string) || undefined;
    const avatarUrl = this.mxcToHttp(content.avatar_url as string | undefined);
    const map = this.getOrCreateMemberMap(roomId);
    const prev = map.get(userId);
    map.set(userId, {
      displayName: displayName || prev?.displayName || fallbackDisplayName(userId),
      avatarUrl: avatarUrl || prev?.avatarUrl,
      isDiscordBridged: isDiscordPuppetId(userId),
    });

    const cachedRoom = this.roomsCache.get(roomId);
    if (cachedRoom && content.membership === 'join') {
      const existingIdx = cachedRoom.members.findIndex((m) => m.userId === userId);
      const memberObj: MatrixUser = {
        userId,
        displayName: displayName || prev?.displayName || fallbackDisplayName(userId),
        avatarUrl: avatarUrl || prev?.avatarUrl,
        presence: 'online',
        isDiscordBridged: isDiscordPuppetId(userId),
      };
      if (existingIdx >= 0) {
        cachedRoom.members[existingIdx] = { ...cachedRoom.members[existingIdx], ...memberObj };
      } else {
        cachedRoom.members.push(memberObj);
      }
    }
  }

  private resolveSenderProfile(roomId: string, sender: string): MemberProfile {
    const memberMap = this.roomMembersCache.get(roomId);
    const cached = memberMap?.get(sender);
    if (cached) return cached;

    const roomMember = this.roomsCache.get(roomId)?.members.find((m) => m.userId === sender);
    if (roomMember) {
      return {
        displayName: roomMember.displayName || fallbackDisplayName(sender),
        avatarUrl: roomMember.avatarUrl,
        isDiscordBridged: roomMember.isDiscordBridged ?? isDiscordPuppetId(sender),
      };
    }

    return {
      displayName: fallbackDisplayName(sender),
      isDiscordBridged: isDiscordPuppetId(sender),
    };
  }

  private markEventSeen(eventId?: string): void {
    if (!eventId) return;
    if (this.seenEventIds.size > 5000) {
      const iterator = this.seenEventIds.values();
      for (let i = 0; i < 1500; i += 1) {
        const next = iterator.next();
        if (next.done) break;
        this.seenEventIds.delete(next.value);
      }
    }
    this.seenEventIds.add(eventId);
  }

  private upsertCachedMessage(roomId: string, message: MatrixMessage): void {
    const existing = this.messagesCache.get(roomId) || [];
    const idx = existing.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...message };
    } else {
      existing.push(message);
    }
    if (existing.length > MAX_CACHED_MSGS_PER_ROOM) {
      this.messagesCache.set(roomId, existing.slice(-MAX_CACHED_MSGS_PER_ROOM));
    } else {
      this.messagesCache.set(roomId, existing);
    }
  }

  private normalizeIncomingMessage(raw: MatrixMessage): MatrixMessage {
    return {
      ...raw,
      avatarUrl: raw.avatarUrl ? this.mxcToHttp(raw.avatarUrl) : raw.avatarUrl,
      mediaUrl: raw.mediaUrl ? this.mxcToHttp(raw.mediaUrl) : raw.mediaUrl,
      source: raw.source || (isDiscordPuppetId(raw.sender) ? 'discord' : 'app'),
    };
  }

  public getCachedGuilds(): DiscordGuild[] {
    return Array.from(this.guildsCache.values());
  }

  public getCachedRooms(): { rooms: MatrixRoom[]; guilds: DiscordGuild[] } {
    return {
      rooms: Array.from(this.roomsCache.values()),
      guilds: Array.from(this.guildsCache.values()),
    };
  }

  public getCachedMessages(roomId: string): MatrixMessage[] {
    return [...(this.messagesCache.get(roomId) || [])];
  }

  public injectLocalMessage(
    roomId: string,
    msg: Partial<MatrixMessage> & { body: string }
  ): MatrixMessage {
    const currentUser = this.userId || '@andrex:local.protutech';
    const profile = this.resolveSenderProfile(roomId, msg.sender || currentUser);
    const id = msg.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const alreadySeen = this.seenEventIds.has(id);

    const normalized: MatrixMessage = this.normalizeIncomingMessage({
      id,
      roomId,
      sender: msg.sender || currentUser,
      senderName: msg.senderName || profile.displayName,
      avatarUrl: msg.avatarUrl || profile.avatarUrl,
      body: msg.body,
      formattedBody: msg.formattedBody,
      timestamp: msg.timestamp || Date.now(),
      isDeleted: msg.isDeleted,
      isEdited: msg.isEdited,
      mediaUrl: msg.mediaUrl,
      mediaType: msg.mediaType,
      replyTo: msg.replyTo,
      reactions: msg.reactions,
      source: msg.source || 'app',
      largeFile: msg.largeFile,
      webhookMeta: msg.webhookMeta,
    });

    this.markEventSeen(normalized.id);
    this.upsertCachedMessage(roomId, normalized);
    this.persistMessagesCache();

    if (!alreadySeen) {
      this.messageListeners.forEach((cb) => cb(roomId, normalized));
    }
    return normalized;
  }

  public async login(username: string, password: string): Promise<boolean> {
    const cleanUser = (username || 'andrex').trim().replace(/^@/, '').split(':')[0] || 'andrex';
    const mode = this.getEngineMode();

    const saveSession = (userId: string, accessToken: string) => {
      this.userId = userId;
      this.accessToken = accessToken;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('matrix_user_id', userId);
        localStorage.setItem('matrix_access_token', accessToken);
      }
      this.connectEventStream();
    };

    try {
      const res = await this.fetchApi('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          user: cleanUser,
          password: password || 'local',
          mode,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { user_id?: string; access_token?: string };
        if (data.user_id && data.access_token) {
          saveSession(data.user_id, data.access_token);
          return true;
        }
      }

      // Fallback to Matrix v3 login endpoint
      const matrixRes = await this.fetchApi('/_matrix/client/v3/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: cleanUser },
          user: cleanUser,
          password: password || 'local',
          mode,
        }),
      });

      if (matrixRes.ok) {
        const data = (await matrixRes.json()) as { user_id?: string; access_token?: string };
        if (data.user_id && data.access_token) {
          saveSession(data.user_id, data.access_token);
          return true;
        }
      }

      // If remote returned 502 or server was unavailable in local/hybrid mode, succeed cleanly offline
      if (mode !== 'discord_proxy' || matrixRes.status === 502 || res.status === 502) {
        saveSession(`@${cleanUser}:local.protutech`, `syt_local_${cleanUser}_${Date.now()}`);
        return true;
      }

      return false;
    } catch {
      // Seamless local fallback if backend is unreachable (e.g. remote 502 / offline)
      saveSession(`@${cleanUser}:local.protutech`, `syt_local_${cleanUser}_${Date.now()}`);
      return true;
    }
  }

  public logout(): void {
    this.accessToken = null;
    this.userId = null;
    this.syncToken = null;
    this.syncRunning = false;
    this.disconnectEventStream();
    this.roomsCache.clear();
    this.guildsCache.clear();
    this.messagesCache.clear();
    this.roomMembersCache.clear();
    this.seenEventIds.clear();
    this.reactionTargetIndex.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('matrix_access_token');
      localStorage.removeItem('matrix_user_id');
      localStorage.removeItem(ROOMS_CACHE_KEY);
      localStorage.removeItem(MSGS_CACHE_KEY);
    }
  }

  public mxcToHttp(mxcUrl?: string): string | undefined {
    if (!mxcUrl) return undefined;
    if (mxcUrl.startsWith('mxc://')) {
      const mediaPath = mxcUrl.replace('mxc://', '');
      const base = this.getServerBaseUrl();
      if (base) return `${base}/_matrix/media/v3/download/${mediaPath}`;
      return `/_matrix/media/v3/download/${mediaPath}`;
    }
    if (mxcUrl.startsWith('/api/') || mxcUrl.startsWith('/_matrix/')) {
      const base = this.getServerBaseUrl();
      return base ? `${base}${mxcUrl}` : mxcUrl;
    }
    if (mxcUrl.startsWith(`${REMOTE_LEGACY_URL}/_matrix/`)) {
      const rel = mxcUrl.slice(REMOTE_LEGACY_URL.length);
      const base = this.getServerBaseUrl();
      return base ? `${base}${rel}` : rel;
    }
    return mxcUrl;
  }

  public onMessage(cb: (roomId: string, message: MatrixMessage) => void): () => void {
    this.messageListeners.add(cb);
    return () => {
      this.messageListeners.delete(cb);
    };
  }

  public onRedaction(cb: (roomId: string, eventId: string) => void): () => void {
    this.redactionListeners.add(cb);
    return () => {
      this.redactionListeners.delete(cb);
    };
  }

  public onPresence(
    cb: (userId: string, presence: 'online' | 'idle' | 'dnd' | 'offline') => void
  ): () => void {
    this.presenceListeners.add(cb);
    return () => {
      this.presenceListeners.delete(cb);
    };
  }

  public onEdit(cb: (roomId: string, eventId: string, newBody: string) => void): () => void {
    this.editListeners.add(cb);
    return () => {
      this.editListeners.delete(cb);
    };
  }

  public onReaction(
    cb: (roomId: string, eventId: string, emoji: string, sender: string) => void
  ): () => void {
    this.reactionListeners.add(cb);
    return () => {
      this.reactionListeners.delete(cb);
    };
  }

  public onRoomsUpdated(
    cb: (data: { rooms: MatrixRoom[]; guilds: DiscordGuild[] }) => void
  ): () => void {
    this.roomsUpdatedListeners.add(cb);
    return () => {
      this.roomsUpdatedListeners.delete(cb);
    };
  }

  private applyRoomsAndGuildsToCache(
    rawRooms: MatrixRoom[],
    rawGuilds: DiscordGuild[],
    mode: EngineMode
  ): { rooms: MatrixRoom[]; guilds: DiscordGuild[] } {
    const rooms =
      mode === 'proprietary'
        ? rawRooms.filter((r) => r.syncSource !== 'discord' || r.isDirect)
        : rawRooms;

    const guilds = (
      mode === 'proprietary'
        ? rawGuilds.filter((g) => g.serverKind !== 'discord' && !g.isAlwaysSynced)
        : rawGuilds
    ).map((g) => ({
      ...g,
      channels:
        Array.isArray(g.channels) && g.channels.length > 0
          ? g.channels
          : rooms.filter((r) => r.guildId === g.id),
    }));

    const nextRoomsCache = new Map<string, MatrixRoom>();
    rooms.forEach((room) => {
      nextRoomsCache.set(room.id, room);
      const memberMap = this.getOrCreateMemberMap(room.id);
      (room.members || []).forEach((m) => {
        memberMap.set(m.userId, {
          displayName: m.displayName || fallbackDisplayName(m.userId),
          avatarUrl: m.avatarUrl ? this.mxcToHttp(m.avatarUrl) : undefined,
          isDiscordBridged: m.isDiscordBridged ?? isDiscordPuppetId(m.userId),
        });
      });
    });

    const nextGuildsCache = new Map<string, DiscordGuild>();
    guilds.forEach((g) => nextGuildsCache.set(g.id, g));

    this.roomsCache = nextRoomsCache;
    this.guildsCache = nextGuildsCache;
    this.persistRoomsCache();

    return { rooms, guilds };
  }

  public async loadInitialRooms(): Promise<{ rooms: MatrixRoom[]; guilds: DiscordGuild[] }> {
    if (!this.accessToken) return { rooms: [], guilds: [] };

    const mode = this.getEngineMode();
    this.connectEventStream();

    try {
      const bootRes = await this.fetchApi(`/api/bootstrap?mode=${encodeURIComponent(mode)}`);
      if (bootRes.ok) {
        const bootData = (await bootRes.json()) as {
          rooms?: MatrixRoom[];
          guilds?: DiscordGuild[];
        };
        if (Array.isArray(bootData.rooms) && Array.isArray(bootData.guilds)) {
          return this.applyRoomsAndGuildsToCache(bootData.rooms, bootData.guilds, mode);
        }
      }
    } catch {
      // Fall back to Matrix joined_rooms or local seed
    }

    // Matrix fallback for pure Synapse / remote Matrix servers
    try {
      const [joinedRes, directRes] = await Promise.all([
        this.fetchApi('/_matrix/client/v3/joined_rooms'),
        this.fetchApi(
          `/_matrix/client/v3/user/${encodeURIComponent(this.userId!)}/account_data/m.direct`
        ).catch(() => null),
      ]);

      if (!joinedRes.ok) {
        const cached = this.getCachedRooms();
        if (cached.rooms.length > 0) return cached;
        const seed = buildFallbackSeedRooms(mode);
        return this.applyRoomsAndGuildsToCache(seed.rooms, seed.guilds, mode);
      }

      const { joined_rooms } = (await joinedRes.json()) as { joined_rooms: string[] };
      let directMap: Record<string, string[]> = {};
      if (directRes && directRes.ok) {
        directMap = (await directRes.json()) as Record<string, string[]>;
      }
      const directRoomSet = new Set(Object.values(directMap).flat());

      const rooms: MatrixRoom[] = [];
      const guildsMap: Map<string, DiscordGuild> = new Map();

      const fetchRoomEntry = async (
        roomId: string
      ): Promise<{
        isSpace: boolean;
        guild?: DiscordGuild;
        room?: MatrixRoom;
      } | null> => {
        try {
          const stateRes = await this.fetchApi(
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state`
          );
          if (!stateRes.ok) return null;
          const events: Array<{
            type: string;
            content?: Record<string, unknown>;
            state_key?: string;
          }> = await stateRes.json();

          let name = 'Unnamed Channel';
          let topic = '';
          let avatarUrl: string | undefined;
          const members: MatrixUser[] = [];
          const memberMap = this.getOrCreateMemberMap(roomId);

          let parentSpaceId: string | undefined;
          let isSpace = false;
          let discordChannelId: string | undefined;
          let discordGuildId: string | undefined;
          let hasDiscordBridgeEvent = false;

          events.forEach((ev) => {
            if (ev.type === 'm.room.name') {
              name = (ev.content?.name as string) || name;
            } else if (ev.type === 'm.room.topic') {
              topic = (ev.content?.topic as string) || '';
            } else if (ev.type === 'm.room.avatar') {
              avatarUrl = this.mxcToHttp(ev.content?.url as string);
            } else if (
              ev.type === 'm.room.create' &&
              (ev.content as Record<string, unknown>)?.type === 'm.space'
            ) {
              isSpace = true;
            } else if (ev.type === 'm.space.parent' && ev.state_key) {
              parentSpaceId = ev.state_key;
            } else if (ev.type === 'm.room.member') {
              const uId = ev.state_key || '';
              if (!uId) return;
              const dName = (ev.content?.displayname as string) || fallbackDisplayName(uId);
              const avUrl = this.mxcToHttp(ev.content?.avatar_url as string);
              const bridged = isDiscordPuppetId(uId);

              memberMap.set(uId, {
                displayName: dName,
                avatarUrl: avUrl,
                isDiscordBridged: bridged,
              });

              if (ev.content?.membership === 'join') {
                members.push({
                  userId: uId,
                  displayName: dName,
                  avatarUrl: avUrl,
                  presence: 'online',
                  isDiscordBridged: bridged,
                });
              }
            } else if (ev.type === 'm.bridge' || ev.type === 'uk.half-shot.bridge') {
              const protocol = ev.content?.protocol as { id?: string } | undefined;
              const channel = ev.content?.channel as { id?: string } | undefined;
              const network = ev.content?.network as { id?: string } | undefined;
              if (protocol?.id === 'discord' || String(ev.state_key || '').includes('discord')) {
                hasDiscordBridgeEvent = true;
                if (channel?.id) discordChannelId = String(channel.id);
                if (network?.id) discordGuildId = String(network.id);
              }
            }
          });

          const isSynced =
            hasDiscordBridgeEvent ||
            members.some((m) => m.userId.includes('discordbot') || m.userId.includes('discord_'));
          const isDirect = !isSpace && (directRoomSet.has(roomId) || members.length <= 2);
          const isGroupChat =
            !isSpace && !isDirect && !name.startsWith('#') && members.length > 2 && members.length < 30;
          const isVoice =
            name.toLowerCase().includes('voice') ||
            name.toLowerCase().includes('call') ||
            name.toLowerCase().includes('stage');

          if (isSpace) {
            return {
              isSpace: true,
              guild: {
                id: roomId,
                name,
                iconUrl: avatarUrl,
                channels: [],
                hasVoice: true,
                isAlwaysSynced: isSynced,
                serverKind: isSynced ? 'discord' : 'proprietary',
              },
            };
          }

          return {
            isSpace: false,
            room: {
              id: roomId,
              name,
              topic,
              avatarUrl,
              isDirect,
              isGroupChat,
              isVoice,
              isSynced,
              syncSource: isSynced ? 'discord' : 'matrix',
              serverKind: isSynced ? 'discord' : 'proprietary',
              guildId: parentSpaceId,
              discordChannelId,
              discordGuildId,
              members,
              unreadCount: 0,
            },
          };
        } catch {
          return null;
        }
      };

      for (let i = 0; i < joined_rooms.length; i += STATE_FETCH_BATCH_SIZE) {
        const batch = joined_rooms.slice(i, i + STATE_FETCH_BATCH_SIZE);
        const results = await Promise.all(batch.map((rId) => fetchRoomEntry(rId)));
        results.forEach((res) => {
          if (!res) return;
          if (res.isSpace && res.guild) {
            guildsMap.set(res.guild.id, res.guild);
          } else if (res.room) {
            rooms.push(res.room);
          }
        });
      }

      rooms.forEach((room) => {
        if (room.guildId && guildsMap.has(room.guildId)) {
          const parentGuild = guildsMap.get(room.guildId)!;
          room.guildName = parentGuild.name;
          parentGuild.channels.push(room);
        }
      });

      this.startSync();
      return this.applyRoomsAndGuildsToCache(rooms, Array.from(guildsMap.values()), mode);
    } catch {
      const cached = this.getCachedRooms();
      if (cached.rooms.length > 0) return cached;
      const seed = buildFallbackSeedRooms(mode);
      return this.applyRoomsAndGuildsToCache(seed.rooms, seed.guilds, mode);
    }
  }

  public async createGuild(
    name: string,
    options?: { isDiscord?: boolean; iconUrl?: string }
  ): Promise<{ guild: DiscordGuild; rooms: MatrixRoom[] } | null> {
    if (!this.accessToken) return null;
    try {
      const res = await this.fetchApi('/api/guilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          iconUrl: options?.iconUrl,
          serverKind: options?.isDiscord ? 'discord' : 'proprietary',
          isAlwaysSynced: Boolean(options?.isDiscord),
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { guild?: DiscordGuild; rooms?: MatrixRoom[] };
      if (data.guild) {
        this.guildsCache.set(data.guild.id, data.guild);
        (data.rooms || []).forEach((r) => this.roomsCache.set(r.id, r));
        this.persistRoomsCache();
        return { guild: data.guild, rooms: data.rooms || [] };
      }
      return null;
    } catch {
      return null;
    }
  }

  public async createNativeRoom(options: {
    name: string;
    topic?: string;
    isDirect?: boolean;
    isGroupChat?: boolean;
    isVoice?: boolean;
    guildId?: string;
    invites?: string[];
  }): Promise<MatrixRoom | null> {
    if (!this.accessToken) return null;
    try {
      const res = await this.fetchApi('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: options.name,
          topic: options.topic || '',
          isDirect: Boolean(options.isDirect),
          isGroupChat: Boolean(options.isGroupChat),
          isVoice: Boolean(options.isVoice),
          guildId: options.guildId,
          invites: options.invites || [],
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { room?: MatrixRoom };
        if (data.room) {
          this.roomsCache.set(data.room.id, data.room);
          if (data.room.guildId && this.guildsCache.has(data.room.guildId)) {
            const g = this.guildsCache.get(data.room.guildId)!;
            g.channels = [...g.channels, data.room];
          }
          this.persistRoomsCache();
          return data.room;
        }
      }

      const fallbackRes = await this.fetchApi('/_matrix/client/v3/createRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: options.name,
          topic: options.topic || '',
          preset: options.isDirect ? 'trusted_private_chat' : 'private_chat',
          is_direct: options.isDirect || false,
          is_group: options.isGroupChat || false,
          invite: options.invites || [],
        }),
      });
      if (!fallbackRes.ok) return null;
      const data = (await fallbackRes.json()) as { room_id: string; room?: MatrixRoom };
      const newRoom: MatrixRoom = data.room || {
        id: data.room_id,
        name: options.name,
        topic: options.topic,
        isDirect: !!options.isDirect,
        isGroupChat: !!options.isGroupChat,
        isVoice: !!options.isVoice,
        syncSource: 'matrix',
        serverKind: 'proprietary',
        members: [],
        unreadCount: 0,
      };
      this.roomsCache.set(newRoom.id, newRoom);
      this.persistRoomsCache();
      return newRoom;
    } catch (err) {
      console.error('Error creating native room:', err);
      return null;
    }
  }

  private parseMessageEvent(
    roomId: string,
    ev: Record<string, unknown>,
    lookupMessage?: (eventId: string) => MatrixMessage | undefined
  ): {
    kind: 'message' | 'edit' | 'reaction' | 'redaction' | 'ignore';
    message?: MatrixMessage;
    targetEventId?: string;
    newBody?: string;
    newFormattedBody?: string;
    emoji?: string;
    sender?: string;
  } {
    const eventType = ev.type as string;
    const eventId = (ev.event_id as string) || '';
    const sender = (ev.sender as string) || '';
    const content = (ev.content as Record<string, unknown>) || {};
    const timestamp = (ev.origin_server_ts as number) || Date.now();

    if (eventType === 'm.room.member') {
      this.updateMemberFromEvent(roomId, ev);
      return { kind: 'ignore' };
    }

    if (eventType === 'm.room.redaction') {
      const targetEventId = (ev.redacts as string) || (content.redacts as string) || undefined;
      return { kind: 'redaction', targetEventId };
    }

    if (eventType === 'm.reaction') {
      const relatesTo = content['m.relates_to'] as
        | { rel_type?: string; event_id?: string; key?: string }
        | undefined;
      if (relatesTo?.rel_type === 'm.annotation' && relatesTo.event_id && relatesTo.key) {
        if (eventId) {
          this.reactionTargetIndex.set(eventId, {
            roomId,
            targetEventId: relatesTo.event_id,
            emoji: relatesTo.key,
            sender,
          });
        }
        return {
          kind: 'reaction',
          targetEventId: relatesTo.event_id,
          emoji: relatesTo.key,
          sender,
        };
      }
      return { kind: 'ignore' };
    }

    if (eventType !== 'm.room.message') {
      return { kind: 'ignore' };
    }

    const relatesTo = content['m.relates_to'] as Record<string, unknown> | undefined;
    if (relatesTo?.rel_type === 'm.replace' && typeof relatesTo.event_id === 'string') {
      const newContent = (content['m.new_content'] as Record<string, unknown>) || content;
      const rawBody = (newContent.body as string) || (content.body as string) || '';
      const cleanBody = newContent.body !== undefined ? rawBody : rawBody.replace(/^\*\s?/, '');
      return {
        kind: 'edit',
        targetEventId: relatesTo.event_id,
        newBody: cleanBody,
        newFormattedBody: newContent.formatted_body as string | undefined,
      };
    }

    const profile = this.resolveSenderProfile(roomId, sender);
    const source: 'discord' | 'app' =
      profile.isDiscordBridged || isDiscordPuppetId(sender) ? 'discord' : 'app';

    const msgType = content.msgtype as string | undefined;
    const info = (content.info as Record<string, unknown>) || {};
    const fileObj = content.file as { url?: string } | undefined;
    const rawMxc = (content.url as string | undefined) || fileObj?.url;

    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'video' | 'audio' | 'file' | undefined;
    if (rawMxc) {
      mediaUrl = this.mxcToHttp(rawMxc);
      mediaType = inferMediaType(
        msgType,
        info.mimetype as string | undefined,
        (content.filename as string | undefined) || (content.body as string | undefined)
      );
    }

    let body = (content.body as string) || '';
    const formattedBody = content.formatted_body as string | undefined;
    let replyTo: MatrixMessage['replyTo'] | undefined;

    const inReplyTo = relatesTo?.['m.in_reply_to'] as { event_id?: string } | undefined;
    if (inReplyTo?.event_id) {
      const { cleanBody, fallbackSender, fallbackBody } = stripReplyFallback(body, formattedBody);
      body = cleanBody;
      const original = lookupMessage?.(inReplyTo.event_id);
      replyTo = {
        id: inReplyTo.event_id,
        sender: original?.senderName || fallbackSender || 'Unknown User',
        body: original?.body || fallbackBody || 'Original message',
      };
    }

    const unsigned = ev.unsigned as Record<string, unknown> | undefined;
    const isDeleted = Boolean(unsigned?.redacted_because);
    if (isDeleted && !body) {
      body = '[Message deleted]';
    }

    return {
      kind: 'message',
      message: {
        id: eventId,
        roomId,
        sender,
        senderName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        body,
        formattedBody,
        timestamp,
        isDeleted,
        mediaUrl,
        mediaType,
        replyTo,
        source,
      },
    };
  }

  public async fetchMessages(roomId: string, limit = 50): Promise<MatrixMessage[]> {
    if (roomId === 'livekit_lounge') {
      return [
        {
          id: 'welcome_voice',
          roomId,
          sender: '@system:local.protutech',
          senderName: 'LiveKit Voice Engine',
          body: 'Welcome to the Ultra-Low Latency Voice Channel. Tap Connect Voice to start speaking or streaming at 1080p 60FPS.',
          timestamp: Date.now() - 3600000,
          source: 'app',
        },
      ];
    }

    if (!this.accessToken) return this.getCachedMessages(roomId);

    try {
      const apiRes = await this.fetchApi(
        `/api/rooms/${encodeURIComponent(roomId)}/messages?limit=${limit}`
      );
      if (apiRes.ok) {
        const data = (await apiRes.json()) as { messages?: MatrixMessage[] };
        if (Array.isArray(data.messages)) {
          const normalized = data.messages.map((m) => this.normalizeIncomingMessage(m));
          normalized.forEach((m) => this.markEventSeen(m.id));
          this.messagesCache.set(roomId, normalized.slice(-MAX_CACHED_MSGS_PER_ROOM));
          this.persistMessagesCache();
          return normalized;
        }
      }
    } catch {
      // Fallback to Matrix endpoint below
    }

    try {
      const res = await this.fetchApi(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`
      );
      if (!res.ok) return this.getCachedMessages(roomId);

      const data = await res.json();
      if (Array.isArray(data.state)) {
        data.state.forEach((ev: Record<string, unknown>) => {
          this.updateMemberFromEvent(roomId, ev);
        });
      }

      const chronological = ((data.chunk || []) as Array<Record<string, unknown>>).slice().reverse();
      chronological.forEach((ev) => {
        if (ev.type === 'm.room.member') {
          this.updateMemberFromEvent(roomId, ev);
        }
      });

      const messages: MatrixMessage[] = [];
      const msgById = new Map<string, MatrixMessage>();
      const cachedForRoom = this.messagesCache.get(roomId) || [];
      cachedForRoom.forEach((m) => msgById.set(m.id, m));

      chronological.forEach((ev) => {
        if (ev.event_id) {
          this.markEventSeen(ev.event_id as string);
        }
        const parsed = this.parseMessageEvent(roomId, ev, (id) => msgById.get(id));

        if (parsed.kind === 'message' && parsed.message) {
          msgById.set(parsed.message.id, parsed.message);
          messages.push(parsed.message);
        } else if (parsed.kind === 'edit' && parsed.targetEventId && parsed.newBody !== undefined) {
          const target = msgById.get(parsed.targetEventId);
          if (target) {
            target.body = parsed.newBody;
            if (parsed.newFormattedBody !== undefined) {
              target.formattedBody = parsed.newFormattedBody;
            }
            target.isEdited = true;
          }
        } else if (
          parsed.kind === 'reaction' &&
          parsed.targetEventId &&
          parsed.emoji &&
          parsed.sender
        ) {
          const target = msgById.get(parsed.targetEventId);
          if (target) {
            if (!target.reactions) target.reactions = {};
            const list = target.reactions[parsed.emoji] || [];
            if (!list.includes(parsed.sender)) {
              target.reactions[parsed.emoji] = [...list, parsed.sender];
            }
          }
        } else if (parsed.kind === 'redaction' && parsed.targetEventId) {
          const rx = this.reactionTargetIndex.get(parsed.targetEventId);
          if (rx) {
            const target = msgById.get(rx.targetEventId);
            if (target?.reactions?.[rx.emoji]) {
              target.reactions[rx.emoji] = target.reactions[rx.emoji].filter(
                (u) => u !== rx.sender
              );
              if (target.reactions[rx.emoji].length === 0) {
                delete target.reactions[rx.emoji];
              }
            }
          } else {
            const target = msgById.get(parsed.targetEventId);
            if (target) {
              target.isDeleted = true;
            }
          }
        }
      });

      this.messagesCache.set(roomId, messages.slice(-MAX_CACHED_MSGS_PER_ROOM));
      this.persistMessagesCache();
      return messages;
    } catch {
      return this.getCachedMessages(roomId);
    }
  }

  public async sendMessage(roomId: string, text: string): Promise<MatrixMessage | null> {
    if (!this.accessToken || !this.userId) return null;

    const clientId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const profile = this.resolveSenderProfile(roomId, this.userId);

    try {
      const res = await this.fetchApi(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          body: text,
          sender: this.userId,
          senderName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          source: 'app',
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { message?: MatrixMessage; event_id?: string };
        const msg = this.normalizeIncomingMessage(
          data.message || {
            id: data.event_id || clientId,
            roomId,
            sender: this.userId,
            senderName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            body: text,
            timestamp: Date.now(),
            source: 'app',
          }
        );
        const alreadySeen = this.seenEventIds.has(msg.id);
        this.markEventSeen(msg.id);
        this.upsertCachedMessage(roomId, msg);
        this.persistMessagesCache();
        if (!alreadySeen) {
          this.messageListeners.forEach((cb) => cb(roomId, msg));
        }
        return msg;
      }

      // Fallback Matrix v3 send
      const matrixRes = await this.fetchApi(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${clientId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgtype: 'm.text', body: text }),
        }
      );

      if (!matrixRes.ok) {
        return this.injectLocalMessage(roomId, { id: clientId, body: text, source: 'app' });
      }
      const mData = (await matrixRes.json()) as { event_id: string };
      return this.injectLocalMessage(roomId, {
        id: mData.event_id || clientId,
        body: text,
        source: 'app',
      });
    } catch {
      return this.injectLocalMessage(roomId, { id: clientId, body: text, source: 'app' });
    }
  }

  public async sendMediaMessage(roomId: string, file: File): Promise<MatrixMessage | null> {
    if (!this.accessToken || !this.userId) return null;

    const mxcUrl = await this.uploadMedia(file);
    const mediaType = inferMediaType(undefined, file.type, file.name);
    const httpUrl = mxcUrl ? this.mxcToHttp(mxcUrl) : URL.createObjectURL(file);
    const clientId = `m_media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const profile = this.resolveSenderProfile(roomId, this.userId);

    try {
      const res = await this.fetchApi(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          body: file.name,
          sender: this.userId,
          senderName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          mediaUrl: httpUrl,
          mediaType,
          source: 'app',
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { message?: MatrixMessage; event_id?: string };
        const msg = this.normalizeIncomingMessage(
          data.message || {
            id: data.event_id || clientId,
            roomId,
            sender: this.userId,
            senderName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            body: file.name,
            timestamp: Date.now(),
            mediaUrl: httpUrl,
            mediaType,
            source: 'app',
          }
        );
        const alreadySeen = this.seenEventIds.has(msg.id);
        this.markEventSeen(msg.id);
        this.upsertCachedMessage(roomId, msg);
        this.persistMessagesCache();
        if (!alreadySeen) {
          this.messageListeners.forEach((cb) => cb(roomId, msg));
        }
        return msg;
      }
    } catch {
      // Fallback below
    }

    return this.injectLocalMessage(roomId, {
      id: clientId,
      body: file.name,
      mediaUrl: httpUrl,
      mediaType,
      source: 'app',
    });
  }

  public async sendReplyMessage(
    roomId: string,
    text: string,
    replyTo: { id: string; sender: string; body: string }
  ): Promise<MatrixMessage | null> {
    if (!this.accessToken || !this.userId) return null;

    const clientId = `m_reply_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const profile = this.resolveSenderProfile(roomId, this.userId);
    const formattedBody = `<mx-reply><blockquote><a href="https://matrix.to/#/${encodeURIComponent(
      roomId
    )}/${encodeURIComponent(replyTo.id)}">In reply to</a> <a href="https://matrix.to/#/${encodeURIComponent(
      replyTo.sender
    )}">${escapeHtml(replyTo.sender)}</a><br>${escapeHtml(
      replyTo.body
    )}</blockquote></mx-reply>${escapeHtml(text)}`;

    try {
      const res = await this.fetchApi(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          body: text,
          formattedBody,
          replyTo,
          sender: this.userId,
          senderName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          source: 'app',
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { message?: MatrixMessage; event_id?: string };
        const msg = this.normalizeIncomingMessage(
          data.message || {
            id: data.event_id || clientId,
            roomId,
            sender: this.userId,
            senderName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            body: text,
            formattedBody,
            timestamp: Date.now(),
            replyTo,
            source: 'app',
          }
        );
        const alreadySeen = this.seenEventIds.has(msg.id);
        this.markEventSeen(msg.id);
        this.upsertCachedMessage(roomId, msg);
        this.persistMessagesCache();
        if (!alreadySeen) {
          this.messageListeners.forEach((cb) => cb(roomId, msg));
        }
        return msg;
      }
    } catch {
      // Fallback below
    }

    return this.injectLocalMessage(roomId, {
      id: clientId,
      body: text,
      formattedBody,
      replyTo,
      source: 'app',
    });
  }

  public async editMessage(roomId: string, eventId: string, newText: string): Promise<boolean> {
    if (!this.accessToken || !this.userId) return false;

    const applyLocalEdit = () => {
      const list = this.messagesCache.get(roomId);
      if (list) {
        const target = list.find((m) => m.id === eventId);
        if (target) {
          target.body = newText;
          target.isEdited = true;
          this.persistMessagesCache();
        }
      }
      this.editListeners.forEach((cb) => cb(roomId, eventId, newText));
    };

    try {
      const res = await this.fetchApi(
        `/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(eventId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: newText }),
        }
      );
      if (res.ok) {
        applyLocalEdit();
        return true;
      }

      const txnId = `m_edit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const mRes = await this.fetchApi(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'm.text',
            body: `* ${newText}`,
            'm.new_content': { msgtype: 'm.text', body: newText },
            'm.relates_to': { rel_type: 'm.replace', event_id: eventId },
          }),
        }
      );
      if (!mRes.ok) return false;
      applyLocalEdit();
      return true;
    } catch {
      applyLocalEdit();
      return true;
    }
  }

  public async sendReaction(roomId: string, eventId: string, emoji: string): Promise<boolean> {
    if (!this.accessToken || !this.userId) return false;

    const applyLocalReaction = () => {
      const list = this.messagesCache.get(roomId);
      if (list) {
        const target = list.find((m) => m.id === eventId);
        if (target) {
          if (!target.reactions) target.reactions = {};
          const existing = target.reactions[emoji] || [];
          if (!existing.includes(this.userId!)) {
            target.reactions[emoji] = [...existing, this.userId!];
            this.persistMessagesCache();
          }
        }
      }
      this.reactionListeners.forEach((cb) => cb(roomId, eventId, emoji, this.userId!));
    };

    try {
      const res = await this.fetchApi(`/api/rooms/${encodeURIComponent(roomId)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: eventId,
          eventId,
          emoji,
          sender: this.userId,
        }),
      });
      if (res.ok) {
        applyLocalReaction();
        return true;
      }

      const txnId = `m_react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const mRes = await this.fetchApi(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.reaction/${txnId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key: emoji },
          }),
        }
      );
      if (!mRes.ok) return false;
      applyLocalReaction();
      return true;
    } catch {
      applyLocalReaction();
      return true;
    }
  }

  public async redactMessage(
    roomId: string,
    eventId: string,
    reason = 'Deleted by user'
  ): Promise<boolean> {
    if (!this.accessToken) return false;

    const applyLocalRedaction = () => {
      const list = this.messagesCache.get(roomId);
      if (list) {
        this.messagesCache.set(
          roomId,
          list.filter((m) => m.id !== eventId)
        );
        this.persistMessagesCache();
      }
      this.redactionListeners.forEach((cb) => cb(roomId, eventId));
    };

    try {
      const res = await this.fetchApi(
        `/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
        }
      );
      if (res.ok) {
        applyLocalRedaction();
        return true;
      }

      const txnId = `m_redact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const mRes = await this.fetchApi(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(
          eventId
        )}/${txnId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );
      if (!mRes.ok) return false;
      applyLocalRedaction();
      return true;
    } catch {
      applyLocalRedaction();
      return true;
    }
  }

  public async uploadMedia(file: File): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const res = await this.fetchApi(
        `/_matrix/media/v3/upload?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { content_uri?: string };
      return data.content_uri || null;
    } catch {
      return null;
    }
  }

  public async updateUserProfile(displayName?: string, avatarUrl?: string): Promise<boolean> {
    if (!this.accessToken || !this.userId) return false;

    let anyUpdated = false;
    let allSucceeded = true;

    try {
      if (displayName !== undefined) {
        const res = await this.fetchApi(
          `/_matrix/client/v3/profile/${encodeURIComponent(this.userId)}/displayname`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayname: displayName }),
          }
        );
        anyUpdated = true;
        if (!res.ok) allSucceeded = false;
      }

      let resolvedMxcAvatar = avatarUrl;
      if (avatarUrl !== undefined && avatarUrl.startsWith('data:')) {
        try {
          const blobRes = await fetch(avatarUrl);
          const blob = await blobRes.blob();
          const avatarFile = new File([blob], 'avatar.png', {
            type: blob.type || 'image/png',
          });
          const uploaded = await this.uploadMedia(avatarFile);
          if (uploaded) resolvedMxcAvatar = uploaded;
        } catch {
          // Proceed with original value
        }
      }

      if (resolvedMxcAvatar !== undefined && resolvedMxcAvatar.startsWith('mxc://')) {
        const res = await this.fetchApi(
          `/_matrix/client/v3/profile/${encodeURIComponent(this.userId)}/avatar_url`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_url: resolvedMxcAvatar }),
          }
        );
        anyUpdated = true;
        if (!res.ok) allSucceeded = false;
      }

      const httpAvatar = this.mxcToHttp(resolvedMxcAvatar);
      this.roomMembersCache.forEach((memberMap) => {
        const existing = memberMap.get(this.userId!);
        if (existing) {
          memberMap.set(this.userId!, {
            displayName: displayName ?? existing.displayName,
            avatarUrl: httpAvatar ?? existing.avatarUrl,
            isDiscordBridged: existing.isDiscordBridged,
          });
        }
      });

      this.roomsCache.forEach((room) => {
        const m = room.members.find((member) => member.userId === this.userId);
        if (m) {
          if (displayName !== undefined) m.displayName = displayName;
          if (httpAvatar !== undefined) m.avatarUrl = httpAvatar;
        }
      });
      this.persistRoomsCache();

      return anyUpdated ? allSucceeded : true;
    } catch {
      return false;
    }
  }

  public async setPresence(
    presence: 'online' | 'idle' | 'dnd' | 'offline',
    statusMsg?: string
  ): Promise<boolean> {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('protutech_user_presence', presence);
      if (statusMsg !== undefined) {
        localStorage.setItem('protutech_user_status_msg', statusMsg);
      }
    }

    if (!this.accessToken || !this.userId) return false;
    try {
      const res = await this.fetchApi(
        `/_matrix/client/v3/presence/${encodeURIComponent(this.userId)}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presence: presence === 'dnd' ? 'online' : presence,
            status_msg: statusMsg || (presence === 'dnd' ? 'Do Not Disturb' : ''),
          }),
        }
      );
      this.presenceListeners.forEach((cb) => cb(this.userId!, presence));
      return res.ok;
    } catch {
      this.presenceListeners.forEach((cb) => cb(this.userId!, presence));
      return false;
    }
  }

  public getSavedPresence(): 'online' | 'idle' | 'dnd' | 'offline' {
    if (typeof localStorage === 'undefined') return 'online';
    return (
      (localStorage.getItem('protutech_user_presence') as
        | 'online'
        | 'idle'
        | 'dnd'
        | 'offline') || 'online'
    );
  }

  public getSavedStatusMsg(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('protutech_user_status_msg') || '';
  }

  private disconnectEventStream(): void {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // Ignore close error
      }
      this.eventSource = null;
      this.eventSourceBaseUrl = null;
    }
    if (this.roomsRefreshTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.roomsRefreshTimer);
      this.roomsRefreshTimer = null;
    }
  }

  private connectEventStream(): void {
    if (typeof EventSource === 'undefined' || !this.accessToken) return;
    const base = this.getServerBaseUrl();
    if (this.eventSource && this.eventSourceBaseUrl === base) return;

    this.disconnectEventStream();
    try {
      const es = new EventSource(`${base}/api/events`);
      this.eventSource = es;
      this.eventSourceBaseUrl = base;

      es.addEventListener('message', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent<string>).data) as {
            roomId?: string;
            message?: MatrixMessage;
          };
          if (!payload.roomId || !payload.message) return;
          const msg = this.normalizeIncomingMessage(payload.message);
          if (msg.id && this.seenEventIds.has(msg.id)) return;
          if (msg.id) this.markEventSeen(msg.id);
          if (msg.sender !== this.userId) {
            vencord.playSound('ping');
          }
          this.upsertCachedMessage(payload.roomId, msg);
          this.persistMessagesCache();
          this.messageListeners.forEach((cb) => cb(payload.roomId!, msg));
        } catch {
          // Ignore malformed SSE message
        }
      });

      es.addEventListener('edit', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent<string>).data) as {
            roomId?: string;
            eventId?: string;
            body?: string;
          };
          if (!payload.roomId || !payload.eventId || payload.body === undefined) return;
          const list = this.messagesCache.get(payload.roomId);
          if (list) {
            const target = list.find((m) => m.id === payload.eventId);
            if (target) {
              target.body = payload.body;
              target.isEdited = true;
              this.persistMessagesCache();
            }
          }
          this.editListeners.forEach((cb) =>
            cb(payload.roomId!, payload.eventId!, payload.body!)
          );
        } catch {
          // Ignore malformed SSE edit
        }
      });

      es.addEventListener('reaction', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent<string>).data) as {
            roomId?: string;
            eventId?: string;
            emoji?: string;
            sender?: string;
          };
          if (!payload.roomId || !payload.eventId || !payload.emoji || !payload.sender) return;
          const list = this.messagesCache.get(payload.roomId);
          if (list) {
            const target = list.find((m) => m.id === payload.eventId);
            if (target) {
              if (!target.reactions) target.reactions = {};
              const listUsers = target.reactions[payload.emoji] || [];
              if (!listUsers.includes(payload.sender)) {
                target.reactions[payload.emoji] = [...listUsers, payload.sender];
                this.persistMessagesCache();
              }
            }
          }
          this.reactionListeners.forEach((cb) =>
            cb(payload.roomId!, payload.eventId!, payload.emoji!, payload.sender!)
          );
        } catch {
          // Ignore malformed SSE reaction
        }
      });

      es.addEventListener('redaction', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent<string>).data) as {
            roomId?: string;
            eventId?: string;
          };
          if (!payload.roomId || !payload.eventId) return;
          const list = this.messagesCache.get(payload.roomId);
          if (list) {
            this.messagesCache.set(
              payload.roomId,
              list.filter((m) => m.id !== payload.eventId)
            );
            this.persistMessagesCache();
          }
          this.redactionListeners.forEach((cb) => cb(payload.roomId!, payload.eventId!));
        } catch {
          // Ignore malformed SSE redaction
        }
      });

      es.addEventListener('presence', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent<string>).data) as {
            userId?: string;
            presence?: 'online' | 'idle' | 'dnd' | 'offline';
          };
          if (!payload.userId || !payload.presence) return;
          this.presenceListeners.forEach((cb) => cb(payload.userId!, payload.presence!));
        } catch {
          // Ignore malformed SSE presence
        }
      });

      es.addEventListener('rooms_updated', () => {
        if (typeof window === 'undefined') return;
        if (this.roomsRefreshTimer !== null) {
          window.clearTimeout(this.roomsRefreshTimer);
        }
        this.roomsRefreshTimer = window.setTimeout(() => {
          this.roomsRefreshTimer = null;
          void this.loadInitialRooms().then((data) => {
            this.roomsUpdatedListeners.forEach((cb) => cb(data));
          });
        }, 120);
      });
    } catch {
      // Ignore EventSource init failures in restricted runtimes
    }
  }

  private async startSync(): Promise<void> {
    if (this.syncRunning || !this.accessToken) return;
    this.syncRunning = true;

    while (this.syncRunning && this.accessToken) {
      try {
        const isInitialSync = !this.syncToken;
        const base = this.getServerBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : FALLBACK_LOCAL_SERVER);
        const url = new URL(`${base}/_matrix/client/v3/sync`);
        url.searchParams.set('timeout', '25000');
        if (this.syncToken) {
          url.searchParams.set('since', this.syncToken);
        }

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        const syncData = await res.json();
        this.syncToken = syncData.next_batch;

        const presenceEvents = syncData.presence?.events || [];
        presenceEvents.forEach((pev: Record<string, unknown>) => {
          if (pev.type === 'm.presence') {
            const sender = (pev.sender as string) || '';
            const pContent = (pev.content as Record<string, unknown>) || {};
            const presence =
              (pContent.presence as 'online' | 'idle' | 'dnd' | 'offline') || 'offline';
            if (sender) {
              this.presenceListeners.forEach((cb) => cb(sender, presence));
            }
          }
        });

        const joinedRooms = syncData.rooms?.join || {};
        let cacheChanged = false;

        for (const [rId, rData] of Object.entries(joinedRooms)) {
          const roomPayload = rData as {
            state?: { events?: Array<Record<string, unknown>> };
            timeline?: { events?: Array<Record<string, unknown>> };
          };

          (roomPayload.state?.events || []).forEach((ev) => {
            this.updateMemberFromEvent(rId, ev);
          });

          const timelineEvents = roomPayload.timeline?.events || [];
          timelineEvents.forEach((ev) => {
            if (ev.type === 'm.room.member') {
              this.updateMemberFromEvent(rId, ev);
            }
          });

          const roomMessages = this.messagesCache.get(rId) || [];
          const findCachedMessage = (eventId: string) =>
            roomMessages.find((m) => m.id === eventId);

          timelineEvents.forEach((ev) => {
            const eventId = ev.event_id as string | undefined;
            if (eventId && this.seenEventIds.has(eventId)) {
              return;
            }
            if (eventId) {
              this.markEventSeen(eventId);
            }

            const parsed = this.parseMessageEvent(rId, ev, findCachedMessage);

            if (parsed.kind === 'message' && parsed.message) {
              const msg = parsed.message;
              if (!isInitialSync && msg.sender !== this.userId) {
                vencord.playSound('ping');
              }
              this.upsertCachedMessage(rId, msg);
              cacheChanged = true;
              this.messageListeners.forEach((cb) => cb(rId, msg));
            } else if (
              parsed.kind === 'edit' &&
              parsed.targetEventId &&
              parsed.newBody !== undefined
            ) {
              const target = findCachedMessage(parsed.targetEventId);
              if (target) {
                target.body = parsed.newBody;
                if (parsed.newFormattedBody !== undefined) {
                  target.formattedBody = parsed.newFormattedBody;
                }
                target.isEdited = true;
                cacheChanged = true;
              }
              this.editListeners.forEach((cb) =>
                cb(rId, parsed.targetEventId!, parsed.newBody!)
              );
            } else if (
              parsed.kind === 'reaction' &&
              parsed.targetEventId &&
              parsed.emoji &&
              parsed.sender
            ) {
              const target = findCachedMessage(parsed.targetEventId);
              if (target) {
                if (!target.reactions) target.reactions = {};
                const list = target.reactions[parsed.emoji] || [];
                if (!list.includes(parsed.sender)) {
                  target.reactions[parsed.emoji] = [...list, parsed.sender];
                  cacheChanged = true;
                }
              }
              this.reactionListeners.forEach((cb) =>
                cb(rId, parsed.targetEventId!, parsed.emoji!, parsed.sender!)
              );
            } else if (parsed.kind === 'redaction' && parsed.targetEventId) {
              const rx = this.reactionTargetIndex.get(parsed.targetEventId);
              if (rx) {
                const target = findCachedMessage(rx.targetEventId);
                if (target?.reactions?.[rx.emoji]) {
                  target.reactions[rx.emoji] = target.reactions[rx.emoji].filter(
                    (u) => u !== rx.sender
                  );
                  if (target.reactions[rx.emoji].length === 0) {
                    delete target.reactions[rx.emoji];
                  }
                  cacheChanged = true;
                }
              } else {
                const list = this.messagesCache.get(rId);
                if (list) {
                  this.messagesCache.set(
                    rId,
                    list.filter((m) => m.id !== parsed.targetEventId)
                  );
                  cacheChanged = true;
                }
                this.redactionListeners.forEach((cb) => cb(rId, parsed.targetEventId!));
              }
            }
          });
        }

        if (cacheChanged) {
          this.persistMessagesCache();
        }
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}

export const matrix = new MatrixClientService();
