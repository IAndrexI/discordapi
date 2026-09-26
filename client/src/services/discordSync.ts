import type {
  DiscordAvailableGuild,
  DiscordAvailableChannel,
  DiscordAvailableDM,
} from '../types';

const BASE_URL = ''; // Relative to origin, proxied through Caddy /api/*

export class DiscordSyncService {
  /**
   * Fetches all indexed Discord guilds available from the bridge.
   */
  public async fetchAvailableGuilds(): Promise<DiscordAvailableGuild[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/discord/guilds`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.guilds || []) as DiscordAvailableGuild[];
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
      const res = await fetch(`${BASE_URL}/api/discord/channels?guild_id=${encodeURIComponent(guildId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.channels || []) as DiscordAvailableChannel[];
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
      const res = await fetch(`${BASE_URL}/api/discord/dms`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.dms || []) as DiscordAvailableDM[];
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
      const res = await fetch(`${BASE_URL}/api/discord/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: entire ? 'server' : 'channels',
          guild_id: guildId,
          entire,
          channel_ids: channelIds,
        }),
      });
      const data = await res.json();
      return data;
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
      const res = await fetch(`${BASE_URL}/api/discord/bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          target_id: targetId,
          channel_ids: [targetId],
        }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { status: 'error', error: String(err) };
    }
  }

  /**
   * Creates a native local Matrix room (e.g. fresh local Group Chat or DM).
   */
  public async createLocalRoom(payload: {
    name: string;
    topic?: string;
    is_direct?: boolean;
    is_group?: boolean;
    invites?: string[];
  }): Promise<{ status: string; room_id?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/api/discord/create-local-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { status: 'error', error: String(err) };
    }
  }
}

export const discordSync = new DiscordSyncService();
