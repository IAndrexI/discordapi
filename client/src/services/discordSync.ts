import type {
  DiscordAvailableChannel,
  DiscordAvailableDM,
  DiscordAvailableGuild,
  DiscordQuest,
  DiscordSyncedSettings,
} from '../types';
import {
  getDiscordToken,
  getEngineMode,
  getServerBaseUrl,
  setDiscordToken,
  setEngineMode,
  type EngineMode,
} from './matrix';

export {
  getDiscordToken,
  getEngineMode,
  getServerBaseUrl,
  setDiscordToken,
  setEngineMode,
  type EngineMode,
};

const FALLBACK_LOCAL_SERVER = 'http://127.0.0.1:4175';

async function fetchDiscordEndpoint(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = getServerBaseUrl();
  const token = getDiscordToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('X-Discord-Token')) {
    headers.set('X-Discord-Token', token);
  }

  const reqInit: RequestInit = {
    ...init,
    headers,
  };

  try {
    const res = await fetch(`${baseUrl}${path}`, reqInit);
    if (
      (res.status === 502 || res.status === 503 || res.status === 504) &&
      baseUrl !== FALLBACK_LOCAL_SERVER
    ) {
      return await fetch(`${FALLBACK_LOCAL_SERVER}${path}`, reqInit);
    }
    return res;
  } catch (err) {
    if (baseUrl !== FALLBACK_LOCAL_SERVER) {
      try {
        return await fetch(`${FALLBACK_LOCAL_SERVER}${path}`, reqInit);
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

export class DiscordSyncService {
  public get baseUrl(): string {
    return getServerBaseUrl();
  }

  /**
   * Fetches all indexed Discord guilds available from the hybrid proxy or local bridge.
   */
  public async fetchAvailableGuilds(): Promise<DiscordAvailableGuild[]> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/guilds');
      if (!res.ok) return [];
      const data = (await res.json()) as { guilds?: DiscordAvailableGuild[] };
      return data.guilds || [];
    } catch (err) {
      console.error('Failed to fetch available Discord guilds:', err);
      return [];
    }
  }

  /**
   * Fetches all text, voice, and category channels belonging to a specific Discord guild.
   */
  public async fetchGuildChannels(guildId: string): Promise<DiscordAvailableChannel[]> {
    try {
      const res = await fetchDiscordEndpoint(
        `/api/discord/channels?guild_id=${encodeURIComponent(guildId)}`
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { channels?: DiscordAvailableChannel[] };
      return data.channels || [];
    } catch (err) {
      console.error('Failed to fetch Discord guild channels:', err);
      return [];
    }
  }

  /**
   * Fetches all direct messages and group DMs indexed by the bridge.
   */
  public async fetchAvailableDMs(): Promise<DiscordAvailableDM[]> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/dms');
      if (!res.ok) return [];
      const data = (await res.json()) as { dms?: DiscordAvailableDM[] };
      return data.dms || [];
    } catch (err) {
      console.error('Failed to fetch available Discord DMs:', err);
      return [];
    }
  }

  /**
   * Bridges an entire server (full clone, continuous sync) or selective channels within a guild.
   */
  public async syncServer(
    guildId: string,
    entire: boolean = true,
    channelIds: string[] = []
  ): Promise<{ status: string; bridged_items?: string[]; error?: string }> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: entire ? 'server' : 'channels',
          guild_id: guildId,
          entire,
          channel_ids: channelIds,
        }),
      });
      return (await res.json()) as { status: string; bridged_items?: string[]; error?: string };
    } catch (err) {
      return { status: 'error', error: String(err) };
    }
  }

  /**
   * Bridges specific channels within a server.
   */
  public async syncSpecificChannels(
    guildId: string,
    channelIds: string[]
  ): Promise<{ status: string; bridged_items?: string[]; error?: string }> {
    return this.syncServer(guildId, false, channelIds);
  }

  /**
   * Bridges an individual DM or Group DM.
   */
  public async syncDMOrGroup(
    targetId: string,
    type: 'dm' | 'group'
  ): Promise<{ status: string; bridged_items?: string[]; error?: string }> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          target_id: targetId,
          channel_ids: [targetId],
        }),
      });
      return (await res.json()) as { status: string; bridged_items?: string[]; error?: string };
    } catch (err) {
      return { status: 'error', error: String(err) };
    }
  }

  /**
   * Creates a native local room (e.g. fresh local Group Chat or DM).
   */
  public async createLocalRoom(payload: {
    name: string;
    topic?: string;
    is_direct?: boolean;
    is_group?: boolean;
    invites?: string[];
  }): Promise<{ status: string; room_id?: string; error?: string }> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/create-local-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return (await res.json()) as { status: string; room_id?: string; error?: string };
    } catch (err) {
      return { status: 'error', error: String(err) };
    }
  }

  public async fetchQuests(): Promise<DiscordQuest[]> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/quests');
      if (!res.ok) return [];
      const data = (await res.json()) as { quests?: DiscordQuest[] };
      return data.quests || [];
    } catch {
      return [];
    }
  }

  public async updateQuestProgress(payload: {
    questId: string;
    progress?: number;
    increment?: number;
    accept?: boolean;
    autoComplete?: boolean;
    claim?: boolean;
  }): Promise<{ status: string; quest?: DiscordQuest; quests?: DiscordQuest[] }> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/quests/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return (await res.json()) as {
        status: string;
        quest?: DiscordQuest;
        quests?: DiscordQuest[];
      };
    } catch {
      return { status: 'error' };
    }
  }

  public async fetchSettings(): Promise<{
    settings?: Partial<DiscordSyncedSettings>;
    syncedAt?: number;
    discordForwarded?: boolean;
  }> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/settings');
      if (!res.ok) return {};
      return (await res.json()) as {
        settings?: Partial<DiscordSyncedSettings>;
        syncedAt?: number;
        discordForwarded?: boolean;
      };
    } catch {
      return {};
    }
  }

  public async patchSettings(partial: Partial<DiscordSyncedSettings>): Promise<{
    settings?: Partial<DiscordSyncedSettings>;
    syncedAt?: number;
    discordForwarded?: boolean;
  }> {
    try {
      const res = await fetchDiscordEndpoint('/api/discord/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) return {};
      return (await res.json()) as {
        settings?: Partial<DiscordSyncedSettings>;
        syncedAt?: number;
        discordForwarded?: boolean;
      };
    } catch {
      return {};
    }
  }
}

export const discordSync = new DiscordSyncService();
