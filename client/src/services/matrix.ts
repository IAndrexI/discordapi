import type { MatrixMessage, MatrixRoom, MatrixUser, DiscordGuild } from '../types';
import { vencord } from './vencord';

const BASE_URL = 'https://chat.protutech.vip';

export class MatrixClientService {
  private accessToken: string | null = null;
  private userId: string | null = null;
  private syncToken: string | null = null;
  private syncRunning: boolean = false;
  private messageListeners: Set<(roomId: string, message: MatrixMessage) => void> = new Set();
  private presenceListeners: Set<(userId: string, presence: 'online' | 'idle' | 'dnd' | 'offline') => void> = new Set();
  private roomsCache: Map<string, MatrixRoom> = new Map();

  public getCachedGuilds(): DiscordGuild[] {
    return [];
  }

  constructor() {
    this.accessToken = localStorage.getItem('matrix_access_token');
    this.userId = localStorage.getItem('matrix_user_id');
  }

  public isAuthenticated(): boolean {
    return !!(this.accessToken && this.userId);
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: username },
          password,
        }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.accessToken = data.access_token;
      this.userId = data.user_id;
      localStorage.setItem('matrix_access_token', data.access_token);
      localStorage.setItem('matrix_user_id', data.user_id);

      this.startSync();
      return true;
    } catch {
      return false;
    }
  }

  public logout() {
    this.accessToken = null;
    this.userId = null;
    this.syncRunning = false;
    localStorage.removeItem('matrix_access_token');
    localStorage.removeItem('matrix_user_id');
  }

  public mxcToHttp(mxcUrl?: string): string | undefined {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return mxcUrl;
    const path = mxcUrl.replace('mxc://', '');
    return `${BASE_URL}/_matrix/media/v3/download/${path}`;
  }

  public onMessage(cb: (roomId: string, message: MatrixMessage) => void) {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  public onPresence(cb: (userId: string, presence: 'online' | 'idle' | 'dnd' | 'offline') => void) {
    this.presenceListeners.add(cb);
    return () => this.presenceListeners.delete(cb);
  }

  public async loadInitialRooms(): Promise<{ rooms: MatrixRoom[]; guilds: DiscordGuild[] }> {
    if (!this.accessToken) return { rooms: [], guilds: [] };

    try {
      // 1. Fetch joined rooms
      const joinedRes = await fetch(`${BASE_URL}/_matrix/client/v3/joined_rooms`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!joinedRes.ok) return { rooms: [], guilds: [] };
      const { joined_rooms } = await joinedRes.json();

      // 2. Fetch direct chat mapping
      const directRes = await fetch(`${BASE_URL}/_matrix/client/v3/user/${encodeURIComponent(this.userId!)}/account_data/m.direct`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }).catch(() => null);
      let directMap: Record<string, string[]> = {};
      if (directRes && directRes.ok) {
        directMap = await directRes.json();
      }
      const directRoomSet = new Set(Object.values(directMap).flat());

      const rooms: MatrixRoom[] = [];

      for (const roomId of joined_rooms) {
        try {
          const stateRes = await fetch(`${BASE_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state`, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
          });
          if (!stateRes.ok) continue;
          const events: Array<{ type: string; content?: Record<string, unknown>; state_key?: string }> = await stateRes.json();

          let name = 'Unnamed Channel';
          let topic = '';
          let avatarUrl: string | undefined;
          const members: MatrixUser[] = [];

          events.forEach(ev => {
            if (ev.type === 'm.room.name') {
              name = (ev.content?.name as string) || name;
            } else if (ev.type === 'm.room.topic') {
              topic = (ev.content?.topic as string) || '';
            } else if (ev.type === 'm.room.avatar') {
              avatarUrl = this.mxcToHttp(ev.content?.url as string);
            } else if (ev.type === 'm.room.member' && ev.content?.membership === 'join') {
              const uId = ev.state_key || '';
              members.push({
                userId: uId,
                displayName: (ev.content.displayname as string) || uId.split(':')[0].replace('@', ''),
                avatarUrl: this.mxcToHttp(ev.content.avatar_url as string),
                presence: 'online',
              });
            }
          });

          const isDirect = directRoomSet.has(roomId) || members.length <= 2;
          const isGroupChat = !isDirect && !name.startsWith('#') && members.length > 2 && members.length < 30;
          const isVoice = name.toLowerCase().includes('voice') || name.toLowerCase().includes('call') || name.toLowerCase().includes('general');

          const roomObj: MatrixRoom = {
            id: roomId,
            name,
            topic,
            avatarUrl,
            isDirect,
            isGroupChat,
            isVoice,
            members,
            unreadCount: 0,
          };

          rooms.push(roomObj);
          this.roomsCache.set(roomId, roomObj);
        } catch {
          // ignore single room state error
        }
      }

      this.startSync();

      // No synced server groups — return rooms only, guilds list is empty
      return { rooms, guilds: [] };
    } catch {
      return { rooms: [], guilds: [] };
    }
  }

  public async fetchMessages(roomId: string, limit = 50): Promise<MatrixMessage[]> {
    if (roomId === 'livekit_lounge') {
      return [
        {
          id: 'welcome_voice',
          roomId,
          sender: '@system:chat.protutech.vip',
          senderName: 'LiveKit Voice Engine',
          body: 'Welcome to the Ultra-Low Latency Voice Channel. Tap Connect Voice to start speaking or streaming at 1080p 60FPS.',
          timestamp: Date.now() - 3600000,
        },
      ];
    }

    if (!this.accessToken) return [];

    try {
      const res = await fetch(`${BASE_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=${limit}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!res.ok) return [];

      const data = await res.json();
      const messages: MatrixMessage[] = [];

      (data.chunk || []).reverse().forEach((ev: Record<string, unknown>) => {
        if (ev.type === 'm.room.message') {
          const content = ev.content as Record<string, unknown>;
          const msgType = content?.msgtype as string;
          let mediaUrl: string | undefined;
          let mediaType: 'image' | 'video' | 'audio' | 'file' | undefined;

          if (content?.url) {
            mediaUrl = this.mxcToHttp(content.url as string);
            if (msgType === 'm.image') mediaType = 'image';
            else if (msgType === 'm.video') mediaType = 'video';
            else if (msgType === 'm.audio') mediaType = 'audio';
            else mediaType = 'file';
          }

          messages.push({
            id: ev.event_id as string,
            roomId,
            sender: ev.sender as string,
            senderName: (ev.sender as string).split(':')[0].replace('@', ''),
            body: (content?.body as string) || '',
            formattedBody: content?.formatted_body as string,
            timestamp: (ev.origin_server_ts as number) || Date.now(),
            mediaUrl,
            mediaType,
          });
        }
      });

      return messages;
    } catch {
      return [];
    }
  }

  public async sendMessage(roomId: string, text: string): Promise<MatrixMessage | null> {
    if (!this.accessToken || !this.userId) return null;

    const txnId = `m${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      const res = await fetch(`${BASE_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: text,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();

      const newMsg: MatrixMessage = {
        id: data.event_id,
        roomId,
        sender: this.userId,
        senderName: this.userId.split(':')[0].replace('@', ''),
        body: text,
        timestamp: Date.now(),
      };

      this.messageListeners.forEach(cb => cb(roomId, newMsg));
      return newMsg;
    } catch {
      return null;
    }
  }

  public async uploadMedia(file: File): Promise<string | null> {
    if (!this.accessToken) return null;

    try {
      const res = await fetch(`${BASE_URL}/_matrix/media/v3/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.content_uri; // mxc://...
    } catch {
      return null;
    }
  }

  private async startSync() {
    if (this.syncRunning || !this.accessToken) return;
    this.syncRunning = true;

    while (this.syncRunning && this.accessToken) {
      try {
        const url = new URL(`${BASE_URL}/_matrix/client/v3/sync`);
        url.searchParams.set('timeout', '30000');
        if (this.syncToken) {
          url.searchParams.set('since', this.syncToken);
        }

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        if (!res.ok) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const syncData = await res.json();
        this.syncToken = syncData.next_batch;

        // Process incoming room events
        const joinedRooms = syncData.rooms?.join || {};
        for (const [rId, rData] of Object.entries(joinedRooms)) {
          const events = ((rData as { timeline?: { events?: unknown[] } }).timeline?.events || []) as Array<Record<string, unknown>>;
          events.forEach(ev => {
            if (ev.type === 'm.room.message') {
              const content = ev.content as Record<string, unknown>;
              const msg: MatrixMessage = {
                id: ev.event_id as string,
                roomId: rId,
                sender: ev.sender as string,
                senderName: (ev.sender as string).split(':')[0].replace('@', ''),
                body: (content?.body as string) || '',
                timestamp: (ev.origin_server_ts as number) || Date.now(),
              };

              if (msg.sender !== this.userId) {
                vencord.playSound('ping');
              }

              this.messageListeners.forEach(cb => cb(rId, msg));
            }
          });
        }
      } catch {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

export const matrix = new MatrixClientService();
