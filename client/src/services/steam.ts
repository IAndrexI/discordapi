import type { GameInvite } from '../types';

export interface SteamGamePreset {
  name: string;
  appId: string;
  icon: string;
}

export const POPULAR_STEAM_GAMES: SteamGamePreset[] = [
  { name: 'Counter-Strike 2', appId: '730', icon: '🎯' },
  { name: 'Dota 2', appId: '570', icon: '⚔️' },
  { name: 'Rust', appId: '252490', icon: '🏕️' },
  { name: 'Team Fortress 2', appId: '440', icon: '🎩' },
  { name: 'Apex Legends', appId: '1172470', icon: '🏆' },
  { name: 'Grand Theft Auto V', appId: '271590', icon: '🚗' },
  { name: 'Rocket League', appId: '252950', icon: '🚀' },
  { name: 'Terraria', appId: '105600', icon: '⛏️' },
  { name: 'Valheim', appId: '892970', icon: '🛡️' },
  { name: 'Lethal Company', appId: '1966720', icon: '📦' },
  { name: 'Palworld', appId: '1623730', icon: '🐾' },
];

class SteamIntegrationService {
  /**
   * Generates a Steam launch or lobby join URL.
   * Format: steam://joinlobby/<appId>/<lobbyId>/<steamId> or steam://run/<appId>
   */
  public createGameInvite(options: {
    gameName: string;
    steamAppId?: string;
    lobbyId?: string;
    inviterName: string;
  }): GameInvite {
    const appId = options.steamAppId || '730';
    const lobby = options.lobbyId || `${Math.floor(100000000000000000 + Math.random() * 900000000000000000)}`;
    const connectUrl = options.lobbyId
      ? `steam://joinlobby/${appId}/${options.lobbyId}`
      : `steam://run/${appId}`;

    return {
      id: `invite_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      gameName: options.gameName,
      steamAppId: appId,
      lobbyId: lobby,
      connectUrl,
      inviterName: options.inviterName,
      timestamp: Date.now(),
    };
  }

  /**
   * Formats a GameInvite object into an interactive markdown message payload for chat.
   */
  public formatInviteMessage(invite: GameInvite): string {
    return `🎮 **[STEAM GAME INVITE]** ${invite.inviterName} invited you to play **${invite.gameName}**!\nClick to join game: ${invite.connectUrl}`;
  }

  /**
   * Opens Steam directly on the user's PC via Steam URL scheme.
   */
  public launchGame(connectUrl: string) {
    window.open(connectUrl, '_blank');
  }
}

export const steamService = new SteamIntegrationService();
