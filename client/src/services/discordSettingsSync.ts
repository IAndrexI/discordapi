import { userProfileService, type UserProfileCustomizations } from './userProfile';

export type DiscordPresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';
export type DiscordBaseTheme = 'dark' | 'light' | 'midnight';
export type NoiseSuppressionMode = 'krisp' | 'standard' | 'none';
export type SyncDirection = 'app_to_discord' | 'discord_to_app' | null;

export interface SyncedDiscordSettings {
  syncEnabled: boolean;
  discordTokenConnected: boolean;
  status: DiscordPresenceStatus;
  customStatusText: string;
  customStatusEmoji: string;
  displayName: string;
  pronouns: string;
  bio: string;
  accentColor: string;
  bannerColor: string;
  theme: DiscordBaseTheme;
  messageDisplayCompact: boolean;
  developerMode: boolean;
  animateEmoji: boolean;
  gifAutoPlay: boolean;
  noiseSuppression: NoiseSuppressionMode;
  echoCancellation: boolean;
  automaticGainControl: boolean;
  inputVolume: number;
  outputVolume: number;
  dmSpamFilter: boolean;
  allowDmsFromServerMembers: boolean;
  lastSyncedAt: number | null;
  lastSyncDirection: SyncDirection;
  lastSyncLog: string;
}

const STORAGE_KEY = 'protutech_discord_settings_sync_v1';
const DISCORD_TOKEN_KEY = 'protutech_discord_token';

const VALID_STATUSES: ReadonlyArray<DiscordPresenceStatus> = ['online', 'idle', 'dnd', 'invisible'];
const VALID_THEMES: ReadonlyArray<DiscordBaseTheme> = ['dark', 'light', 'midnight'];
const VALID_NOISE_MODES: ReadonlyArray<NoiseSuppressionMode> = ['krisp', 'standard', 'none'];

const PROFILE_SYNC_KEYS: ReadonlyArray<keyof SyncedDiscordSettings> = [
  'status',
  'customStatusText',
  'customStatusEmoji',
  'displayName',
  'pronouns',
  'bio',
  'accentColor',
  'bannerColor',
];

function resolveBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:4175';
  const proto = window.location.protocol;
  return proto === 'file:' || proto === 'tauri:' ? 'http://127.0.0.1:4175' : '';
}

function readStoredDiscordToken(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return (localStorage.getItem(DISCORD_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
}

function mapPresenceToDiscordStatus(
  presence: UserProfileCustomizations['presence']
): DiscordPresenceStatus {
  return presence === 'offline' ? 'invisible' : presence;
}

function mapDiscordStatusToPresence(
  status: DiscordPresenceStatus
): UserProfileCustomizations['presence'] {
  return status === 'invisible' ? 'offline' : status;
}

function createDefaultSettings(): SyncedDiscordSettings {
  const profile = userProfileService.getProfile();
  const hasToken = Boolean(readStoredDiscordToken());

  return {
    syncEnabled: true,
    discordTokenConnected: hasToken,
    status: mapPresenceToDiscordStatus(profile.presence),
    customStatusText: profile.customStatus || '',
    customStatusEmoji: profile.customStatusEmoji || '⚡',
    displayName: profile.displayName || '',
    pronouns: profile.pronouns || '',
    bio: profile.bio || '',
    accentColor: profile.accentColor || '#00f2fe',
    bannerColor: profile.bannerColor || '#0e7490',
    theme: 'dark',
    messageDisplayCompact: false,
    developerMode: true,
    animateEmoji: true,
    gifAutoPlay: true,
    noiseSuppression: 'krisp',
    echoCancellation: true,
    automaticGainControl: true,
    inputVolume: 100,
    outputVolume: 100,
    dmSpamFilter: true,
    allowDmsFromServerMembers: true,
    lastSyncedAt: null,
    lastSyncDirection: null,
    lastSyncLog: hasToken
      ? 'Discord token detected — bidirectional sync armed'
      : 'Hybrid sync armed (ready for App ↔ Discord updates)',
  };
}

function sanitizeIncomingSettings(
  raw: Partial<SyncedDiscordSettings> | Record<string, unknown>,
  fallback: SyncedDiscordSettings
): Partial<SyncedDiscordSettings> {
  const clean: Partial<SyncedDiscordSettings> = {};
  const src = raw as Record<string, unknown>;

  if (typeof src.syncEnabled === 'boolean') clean.syncEnabled = src.syncEnabled;
  if (typeof src.status === 'string' && VALID_STATUSES.includes(src.status as DiscordPresenceStatus)) {
    clean.status = src.status as DiscordPresenceStatus;
  }
  if (typeof src.customStatusText === 'string') clean.customStatusText = src.customStatusText;
  if (typeof src.customStatusEmoji === 'string') clean.customStatusEmoji = src.customStatusEmoji;
  if (typeof src.displayName === 'string') clean.displayName = src.displayName;
  if (typeof src.pronouns === 'string') clean.pronouns = src.pronouns;
  if (typeof src.bio === 'string') clean.bio = src.bio;
  if (typeof src.accentColor === 'string') clean.accentColor = src.accentColor;
  if (typeof src.bannerColor === 'string') clean.bannerColor = src.bannerColor;
  if (typeof src.theme === 'string' && VALID_THEMES.includes(src.theme as DiscordBaseTheme)) {
    clean.theme = src.theme as DiscordBaseTheme;
  }
  if (typeof src.messageDisplayCompact === 'boolean') {
    clean.messageDisplayCompact = src.messageDisplayCompact;
  }
  if (typeof src.developerMode === 'boolean') clean.developerMode = src.developerMode;
  if (typeof src.animateEmoji === 'boolean') clean.animateEmoji = src.animateEmoji;
  if (typeof src.gifAutoPlay === 'boolean') clean.gifAutoPlay = src.gifAutoPlay;
  if (
    typeof src.noiseSuppression === 'string' &&
    VALID_NOISE_MODES.includes(src.noiseSuppression as NoiseSuppressionMode)
  ) {
    clean.noiseSuppression = src.noiseSuppression as NoiseSuppressionMode;
  }
  if (typeof src.echoCancellation === 'boolean') clean.echoCancellation = src.echoCancellation;
  if (typeof src.automaticGainControl === 'boolean') {
    clean.automaticGainControl = src.automaticGainControl;
  }
  if (typeof src.inputVolume === 'number' && Number.isFinite(src.inputVolume)) {
    clean.inputVolume = Math.max(0, Math.min(200, Math.round(src.inputVolume)));
  }
  if (typeof src.outputVolume === 'number' && Number.isFinite(src.outputVolume)) {
    clean.outputVolume = Math.max(0, Math.min(200, Math.round(src.outputVolume)));
  }
  if (typeof src.dmSpamFilter === 'boolean') clean.dmSpamFilter = src.dmSpamFilter;
  if (typeof src.allowDmsFromServerMembers === 'boolean') {
    clean.allowDmsFromServerMembers = src.allowDmsFromServerMembers;
  }
  if (typeof src.lastSyncedAt === 'number' || src.lastSyncedAt === null) {
    clean.lastSyncedAt = src.lastSyncedAt ?? fallback.lastSyncedAt;
  }
  if (
    src.lastSyncDirection === 'app_to_discord' ||
    src.lastSyncDirection === 'discord_to_app' ||
    src.lastSyncDirection === null
  ) {
    clean.lastSyncDirection = src.lastSyncDirection;
  }
  if (typeof src.lastSyncLog === 'string') clean.lastSyncLog = src.lastSyncLog;

  return clean;
}

class DiscordSettingsSyncService {
  private settings: SyncedDiscordSettings;
  private listeners: Set<(settings: SyncedDiscordSettings) => void> = new Set();
  private isMirroringProfile = false;
  private initialized = false;

  constructor() {
    this.settings = this.loadLocalSettings();
    this.applyDomFlags(this.settings);
    this.initialized = true;

    // Mirror external profile updates (e.g. UserBar or DiscordHubModal) back into synced settings
    userProfileService.subscribe((profile) => {
      if (!this.initialized || this.isMirroringProfile) return;
      const mappedStatus = mapPresenceToDiscordStatus(profile.presence);
      const diff: Partial<SyncedDiscordSettings> = {};

      if (profile.displayName !== this.settings.displayName) diff.displayName = profile.displayName;
      if (profile.pronouns !== this.settings.pronouns) diff.pronouns = profile.pronouns;
      if (profile.bio !== this.settings.bio) diff.bio = profile.bio;
      if (profile.accentColor !== this.settings.accentColor) diff.accentColor = profile.accentColor;
      if (profile.bannerColor !== this.settings.bannerColor) diff.bannerColor = profile.bannerColor;
      if (profile.customStatus !== this.settings.customStatusText) {
        diff.customStatusText = profile.customStatus;
      }
      if (profile.customStatusEmoji !== this.settings.customStatusEmoji) {
        diff.customStatusEmoji = profile.customStatusEmoji;
      }
      if (mappedStatus !== this.settings.status) diff.status = mappedStatus;

      if (Object.keys(diff).length > 0) {
        void this.applyLocalAndOptionallySync(diff, { skipProfileMirror: true });
      }
    });
  }

  private loadLocalSettings(): SyncedDiscordSettings {
    const defaults = createDefaultSettings();
    if (typeof localStorage === 'undefined') return defaults;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved) as Partial<SyncedDiscordSettings>;
      const sanitized = sanitizeIncomingSettings(parsed, defaults);
      return {
        ...defaults,
        ...sanitized,
        discordTokenConnected: Boolean(readStoredDiscordToken()),
      };
    } catch {
      return defaults;
    }
  }

  private persistLocalSettings() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      console.warn('[discordSettingsSync] Failed to persist local settings:', err);
    }
  }

  private applyDomFlags(settings: SyncedDiscordSettings) {
    if (typeof document === 'undefined') return;
    try {
      document.body.dataset.compactMode = settings.messageDisplayCompact ? 'true' : 'false';
      document.body.dataset.developerMode = settings.developerMode ? 'true' : 'false';
      document.body.dataset.discordTheme = settings.theme;
      document.body.dataset.animateEmoji = settings.animateEmoji ? 'true' : 'false';
    } catch {
      // Ignore DOM attribute issues in non-browser contexts
    }
  }

  private mirrorToUserProfile(settings: SyncedDiscordSettings) {
    const current = userProfileService.getProfile();
    const desiredPresence = mapDiscordStatusToPresence(settings.status);
    const patch: Partial<UserProfileCustomizations> = {};

    if (settings.displayName !== current.displayName) patch.displayName = settings.displayName;
    if (settings.pronouns !== current.pronouns) patch.pronouns = settings.pronouns;
    if (settings.bio !== current.bio) patch.bio = settings.bio;
    if (settings.accentColor !== current.accentColor) patch.accentColor = settings.accentColor;
    if (settings.bannerColor !== current.bannerColor) patch.bannerColor = settings.bannerColor;
    if (settings.customStatusText !== current.customStatus) {
      patch.customStatus = settings.customStatusText;
    }
    if (settings.customStatusEmoji !== current.customStatusEmoji) {
      patch.customStatusEmoji = settings.customStatusEmoji;
    }
    if (desiredPresence !== current.presence) patch.presence = desiredPresence;

    if (Object.keys(patch).length === 0) return;

    this.isMirroringProfile = true;
    try {
      userProfileService.updateProfile(patch);
    } finally {
      this.isMirroringProfile = false;
    }
  }

  private notify() {
    const snapshot = this.getSettings();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  public getSettings(): SyncedDiscordSettings {
    const hasToken = Boolean(readStoredDiscordToken());
    if (this.settings.discordTokenConnected !== hasToken) {
      this.settings = { ...this.settings, discordTokenConnected: hasToken };
    }
    return { ...this.settings };
  }

  public getDiscordToken(): string {
    return readStoredDiscordToken();
  }

  public setDiscordToken(token: string): SyncedDiscordSettings {
    const trimmed = token.trim();
    if (typeof localStorage !== 'undefined') {
      if (trimmed) {
        localStorage.setItem(DISCORD_TOKEN_KEY, trimmed);
      } else {
        localStorage.removeItem(DISCORD_TOKEN_KEY);
      }
    }
    this.settings = {
      ...this.settings,
      discordTokenConnected: Boolean(trimmed),
      lastSyncLog: trimmed
        ? 'Discord token saved — live Discord API forwarding active'
        : 'Discord token cleared — using local hybrid sync',
    };
    this.persistLocalSettings();
    this.notify();
    return this.getSettings();
  }

  public subscribe(cb: (settings: SyncedDiscordSettings) => void): () => void {
    this.listeners.add(cb);
    cb(this.getSettings());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public async updateSetting<K extends keyof SyncedDiscordSettings>(
    key: K,
    value: SyncedDiscordSettings[K]
  ): Promise<SyncedDiscordSettings> {
    return this.updateMultiple({ [key]: value } as Partial<SyncedDiscordSettings>);
  }

  public async updateMultiple(
    partial: Partial<SyncedDiscordSettings>,
    options?: { forceSync?: boolean }
  ): Promise<SyncedDiscordSettings> {
    return this.applyLocalAndOptionallySync(partial, {
      forceSync: options?.forceSync,
      skipProfileMirror: false,
    });
  }

  private async applyLocalAndOptionallySync(
    partial: Partial<SyncedDiscordSettings>,
    options: { forceSync?: boolean; skipProfileMirror?: boolean }
  ): Promise<SyncedDiscordSettings> {
    const token = readStoredDiscordToken();
    const sanitized = sanitizeIncomingSettings(partial, this.settings);
    const changedKeys = Object.keys(sanitized) as Array<keyof SyncedDiscordSettings>;

    this.settings = {
      ...this.settings,
      ...sanitized,
      discordTokenConnected: Boolean(token),
    };

    this.applyDomFlags(this.settings);
    this.persistLocalSettings();

    const touchedProfile = changedKeys.some((k) => PROFILE_SYNC_KEYS.includes(k));
    if (touchedProfile && !options.skipProfileMirror) {
      this.mirrorToUserProfile(this.settings);
    }

    this.notify();

    const onlyToggledSyncOff =
      changedKeys.length === 1 && changedKeys[0] === 'syncEnabled' && !this.settings.syncEnabled;

    if ((!this.settings.syncEnabled && !options.forceSync) || onlyToggledSyncOff) {
      if (onlyToggledSyncOff) {
        this.settings = {
          ...this.settings,
          lastSyncLog: 'Bidirectional Discord sync paused (changes kept locally)',
        };
        this.persistLocalSettings();
        this.notify();
      }
      return this.getSettings();
    }

    return this.dispatchPatchToServer(changedKeys);
  }

  private async dispatchPatchToServer(
    changedKeys: Array<keyof SyncedDiscordSettings>
  ): Promise<SyncedDiscordSettings> {
    const baseUrl = resolveBaseUrl();
    const token = readStoredDiscordToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['X-Discord-Token'] = token;
    }

    const payload: Record<string, unknown> = {};
    const keysToSend: Array<keyof SyncedDiscordSettings> =
      changedKeys.length > 0
        ? changedKeys
        : [
            'syncEnabled',
            'status',
            'customStatusText',
            'customStatusEmoji',
            'displayName',
            'pronouns',
            'bio',
            'accentColor',
            'bannerColor',
            'theme',
            'messageDisplayCompact',
            'developerMode',
            'animateEmoji',
            'gifAutoPlay',
            'noiseSuppression',
            'echoCancellation',
            'automaticGainControl',
            'inputVolume',
            'outputVolume',
            'dmSpamFilter',
            'allowDmsFromServerMembers',
          ];

    for (const k of keysToSend) {
      if (k === 'lastSyncedAt' || k === 'lastSyncDirection' || k === 'lastSyncLog') continue;
      payload[k] = this.settings[k];
    }

    try {
      const res = await fetch(`${baseUrl}/api/discord/settings`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        settings?: Partial<SyncedDiscordSettings>;
        syncedAt?: number;
        discordForwarded?: boolean;
      };

      const returnedSettings = data.settings
        ? sanitizeIncomingSettings(data.settings, this.settings)
        : {};
      const syncedAt = typeof data.syncedAt === 'number' ? data.syncedAt : Date.now();
      const summaryField =
        changedKeys.length === 1
          ? String(changedKeys[0])
          : `${keysToSend.length} settings`;

      this.settings = {
        ...this.settings,
        ...returnedSettings,
        discordTokenConnected: Boolean(token),
        lastSyncedAt: syncedAt,
        lastSyncDirection: 'app_to_discord',
        lastSyncLog: data.discordForwarded
          ? `Pushed ${summaryField} → Discord API & hybrid server ✓`
          : `Synced ${summaryField} → Discord hybrid state ✓`,
      };

      this.applyDomFlags(this.settings);
      this.persistLocalSettings();
      this.notify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.settings = {
        ...this.settings,
        discordTokenConnected: Boolean(token),
        lastSyncedAt: Date.now(),
        lastSyncDirection: 'app_to_discord',
        lastSyncLog: `Saved locally (server sync fallback: ${msg})`,
      };
      this.persistLocalSettings();
      this.notify();
    }

    return this.getSettings();
  }

  public async pushAllToDiscord(): Promise<SyncedDiscordSettings> {
    return this.dispatchPatchToServer([]);
  }

  public async pullFromDiscord(): Promise<SyncedDiscordSettings> {
    const baseUrl = resolveBaseUrl();
    const token = readStoredDiscordToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Discord-Token'] = token;
    }

    try {
      const res = await fetch(`${baseUrl}/api/discord/settings`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as
        | { settings?: Partial<SyncedDiscordSettings>; syncedAt?: number; source?: string }
        | Partial<SyncedDiscordSettings>;

      const rawSettings =
        data && typeof data === 'object' && 'settings' in data && data.settings
          ? data.settings
          : (data as Partial<SyncedDiscordSettings>);

      const sanitized = sanitizeIncomingSettings(rawSettings, this.settings);
      const syncedAt =
        data && typeof data === 'object' && 'syncedAt' in data && typeof data.syncedAt === 'number'
          ? data.syncedAt
          : Date.now();

      this.settings = {
        ...this.settings,
        ...sanitized,
        discordTokenConnected: Boolean(token),
        lastSyncedAt: syncedAt,
        lastSyncDirection: 'discord_to_app',
        lastSyncLog: token
          ? 'Pulled live settings from Discord API & hybrid bridge ✓'
          : 'Pulled latest settings from Discord hybrid bridge ✓',
      };

      this.applyDomFlags(this.settings);
      this.mirrorToUserProfile(this.settings);
      this.persistLocalSettings();
      this.notify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.settings = {
        ...this.settings,
        discordTokenConnected: Boolean(token),
        lastSyncLog: `Pull failed (${msg}) — keeping local state`,
      };
      this.persistLocalSettings();
      this.notify();
    }

    return this.getSettings();
  }
}

export const discordSettingsSync = new DiscordSettingsSyncService();
