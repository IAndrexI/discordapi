export interface MusicAppConfig {
  id: string;
  name: string;
  url: string;
  color: string;
  connected: boolean;
  showOnProfile: boolean;
  isCustom?: boolean;
  nowPlaying?: string;
}

const MUSIC_APPS_KEY = 'protutech_music_apps_v1';

const DEFAULT_MUSIC_APPS: MusicAppConfig[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    url: 'https://open.spotify.com',
    color: '#1DB954',
    connected: false,
    showOnProfile: true,
  },
  {
    id: 'youtube_music',
    name: 'YouTube Music',
    url: 'https://music.youtube.com',
    color: '#FF0000',
    connected: false,
    showOnProfile: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    color: '#EF4444',
    connected: false,
    showOnProfile: false,
  },
  {
    id: 'apple_music',
    name: 'Apple Music',
    url: 'https://music.apple.com',
    color: '#FA243C',
    connected: false,
    showOnProfile: true,
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    url: 'https://soundcloud.com',
    color: '#FF5500',
    connected: false,
    showOnProfile: true,
  },
  {
    id: 'tidal',
    name: 'Tidal',
    url: 'https://listen.tidal.com',
    color: '#00FFFF',
    connected: false,
    showOnProfile: true,
  },
  {
    id: 'soulsync',
    name: 'SoulSync (Custom)',
    url: 'http://localhost:3000',
    color: '#8B5CF6',
    connected: false,
    showOnProfile: true,
    isCustom: true,
  },
];

class MusicAppsService {
  private apps: MusicAppConfig[] = this.load();
  private listeners = new Set<() => void>();

  private load(): MusicAppConfig[] {
    try {
      const raw = localStorage.getItem(MUSIC_APPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MusicAppConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return [...DEFAULT_MUSIC_APPS];
  }

  private save() {
    try {
      localStorage.setItem(MUSIC_APPS_KEY, JSON.stringify(this.apps));
    } catch {
      // Ignore
    }
    this.listeners.forEach(fn => fn());
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public getApps(): MusicAppConfig[] {
    return [...this.apps];
  }

  public toggleConnect(id: string) {
    this.apps = this.apps.map(a => (a.id === id ? { ...a, connected: !a.connected } : a));
    this.save();
  }

  public toggleProfileStatus(id: string) {
    this.apps = this.apps.map(a => (a.id === id ? { ...a, showOnProfile: !a.showOnProfile } : a));
    this.save();
  }

  public addCustomApp(name: string, url: string) {
    const cleanUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `http://${url.trim()}`;
    const app: MusicAppConfig = {
      id: `custom_${Date.now()}`,
      name: name.trim() || 'Custom Music App',
      url: cleanUrl,
      color: '#6366f1',
      connected: true,
      showOnProfile: true,
      isCustom: true,
    };
    this.apps = [...this.apps, app];
    this.save();
    return app;
  }

  public removeApp(id: string) {
    this.apps = this.apps.filter(a => a.id !== id);
    this.save();
  }
}

export const musicAppsService = new MusicAppsService();
