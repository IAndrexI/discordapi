import { matrix } from './matrix';

export type AvatarDecorationId =
  | 'none'
  | 'cyber_ring'
  | 'neon_pulse'
  | 'plasma_aura'
  | 'discord_crown';

export interface UserProfileCustomizations {
  displayName: string;
  username: string;
  pronouns: string;
  bio: string;
  customStatus: string;
  customStatusEmoji: string;
  presence: 'online' | 'idle' | 'dnd' | 'offline';
  avatarUrl: string;
  bannerColor: string;
  bannerUrl: string;
  accentColor: string;
  avatarDecoration: AvatarDecorationId;
  badges: string[];
}

export const AVATAR_DECORATIONS: Array<{
  id: AvatarDecorationId;
  name: string;
  cssClass: string;
  previewColor: string;
}> = [
  {
    id: 'none',
    name: 'None',
    cssClass: '',
    previewColor: '#64748b',
  },
  {
    id: 'cyber_ring',
    name: 'Cyber Ring',
    cssClass: 'ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.7)]',
    previewColor: '#00f2fe',
  },
  {
    id: 'neon_pulse',
    name: 'Neon Pulse',
    cssClass: 'ring-2 ring-fuchsia-400 shadow-[0_0_14px_rgba(232,121,249,0.75)] animate-pulse',
    previewColor: '#e879f9',
  },
  {
    id: 'plasma_aura',
    name: 'Plasma Aura',
    cssClass: 'ring-2 ring-indigo-400 shadow-[0_0_16px_rgba(129,140,248,0.8)]',
    previewColor: '#818cf8',
  },
  {
    id: 'discord_crown',
    name: 'Discord Crown',
    cssClass: 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.8)]',
    previewColor: '#fbbf24',
  },
];

const STORAGE_KEY = 'protutech_user_profile_v1';

const VALID_PRESENCES: ReadonlyArray<UserProfileCustomizations['presence']> = [
  'online',
  'idle',
  'dnd',
  'offline',
];

function createDefaultProfile(): UserProfileCustomizations {
  let savedPresence: UserProfileCustomizations['presence'] = 'online';
  let savedStatus = '';
  let defaultUsername = '';

  try {
    const rawPresence = matrix.getSavedPresence?.() ?? localStorage.getItem('protutech_user_presence');
    if (rawPresence && VALID_PRESENCES.includes(rawPresence as UserProfileCustomizations['presence'])) {
      savedPresence = rawPresence as UserProfileCustomizations['presence'];
    }
    savedStatus = matrix.getSavedStatusMsg?.() ?? localStorage.getItem('protutech_user_status_msg') ?? '';
    const userId = matrix.getUserId?.();
    if (userId) {
      defaultUsername = userId.split(':')[0].replace(/^@/, '');
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }

  return {
    displayName: '',
    username: defaultUsername,
    pronouns: '',
    bio: '',
    customStatus: savedStatus,
    customStatusEmoji: '⚡',
    presence: savedPresence,
    avatarUrl: '',
    bannerColor: '#0e7490',
    bannerUrl: '',
    accentColor: '#00f2fe',
    avatarDecoration: 'none',
    badges: ['Protutech Member', 'Low-Latency Voice'],
  };
}

class UserProfileService {
  private profile: UserProfileCustomizations;
  private listeners: Set<(profile: UserProfileCustomizations) => void> = new Set();

  constructor() {
    this.profile = this.loadProfile();
  }

  private loadProfile(): UserProfileCustomizations {
    const defaults = createDefaultProfile();
    if (typeof localStorage === 'undefined') return defaults;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserProfileCustomizations>;
        const decorationValid = AVATAR_DECORATIONS.some(d => d.id === parsed.avatarDecoration);
        const presenceValid = parsed.presence && VALID_PRESENCES.includes(parsed.presence);

        return {
          ...defaults,
          ...parsed,
          presence: presenceValid ? parsed.presence! : defaults.presence,
          avatarDecoration: decorationValid ? parsed.avatarDecoration! : defaults.avatarDecoration,
          badges: Array.isArray(parsed.badges) ? parsed.badges : defaults.badges,
        };
      }
    } catch (err) {
      console.warn('[UserProfile] Failed to parse saved profile:', err);
    }

    return defaults;
  }

  private saveProfile() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      localStorage.setItem('protutech_user_presence', this.profile.presence);
      localStorage.setItem('protutech_user_status_msg', this.getFormattedStatusText());
    } catch (err) {
      console.warn('[UserProfile] Failed to persist profile:', err);
    }
  }

  private getFormattedStatusText(): string {
    const text = this.profile.customStatus.trim();
    if (!text) return '';
    const emoji = this.profile.customStatusEmoji.trim();
    return emoji ? `${emoji} ${text}` : text;
  }

  public getProfile(): UserProfileCustomizations {
    return {
      ...this.profile,
      badges: [...this.profile.badges],
    };
  }

  public getDecorationClass(id?: AvatarDecorationId): string {
    const targetId = id ?? this.profile.avatarDecoration;
    const found = AVATAR_DECORATIONS.find(d => d.id === targetId);
    return found?.cssClass || '';
  }

  public updateProfile(partial: Partial<UserProfileCustomizations>): UserProfileCustomizations {
    const prev = this.profile;
    this.profile = {
      ...prev,
      ...partial,
      badges: Array.isArray(partial.badges) ? [...partial.badges] : [...prev.badges],
    };

    this.saveProfile();

    const presenceChanged = partial.presence !== undefined && partial.presence !== prev.presence;
    const statusChanged =
      (partial.customStatus !== undefined && partial.customStatus !== prev.customStatus) ||
      (partial.customStatusEmoji !== undefined && partial.customStatusEmoji !== prev.customStatusEmoji);

    if (presenceChanged || statusChanged) {
      const statusMsg = this.getFormattedStatusText();
      void Promise.resolve(matrix.setPresence(this.profile.presence, statusMsg || undefined)).catch(() => {
        // Ignore network errors when offline or in guest mode
      });
    }

    const displayNameChanged =
      partial.displayName !== undefined && partial.displayName !== prev.displayName;
    const avatarUrlChanged =
      partial.avatarUrl !== undefined && partial.avatarUrl !== prev.avatarUrl;

    if (displayNameChanged || avatarUrlChanged) {
      const matrixWithProfile = matrix as unknown as {
        updateUserProfile?: (displayName?: string, avatarUrl?: string) => Promise<boolean>;
      };
      if (typeof matrixWithProfile.updateUserProfile === 'function') {
        void Promise.resolve(
          matrixWithProfile.updateUserProfile(
            displayNameChanged ? this.profile.displayName : undefined,
            avatarUrlChanged ? this.profile.avatarUrl : undefined
          )
        ).catch(() => {
          // Ignore network errors when offline or in guest mode
        });
      }
    }

    const snapshot = this.getProfile();
    this.listeners.forEach(cb => cb(snapshot));
    return snapshot;
  }

  public subscribe(cb: (profile: UserProfileCustomizations) => void): () => void {
    this.listeners.add(cb);
    cb(this.getProfile());
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const userProfileService = new UserProfileService();
