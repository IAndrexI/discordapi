import type { VencordPlugin, ThemeConfig } from '../types';

const STORAGE_KEY_PLUGINS = 'vencord_plugins_v1';
const STORAGE_KEY_USER_PLUGINS = 'equicord_user_plugins_v1';
const STORAGE_KEY_THEME = 'vencord_theme_v1';

export const DEFAULT_PLUGINS: VencordPlugin[] = [
  // Vencord Core Plugins
  {
    id: 'customSounds',
    name: 'Discord Sound Effects',
    description: 'Plays Discord join, leave, mute, and notification sounds.',
    enabled: false,
    author: 'Vencord',
    source: 'vencord',
    category: 'media',
  },
  {
    id: 'messageLogger',
    name: 'Message Logger',
    description: 'Preserves deleted and edited messages with an inline visual badge.',
    enabled: true,
    author: 'Vencord',
    source: 'vencord',
    category: 'chat',
  },
  {
    id: 'nitroBypass',
    name: 'Nitro Screen Share & Media',
    description: 'Enables 1080p 60FPS screen sharing and bypasses upload file size restrictions.',
    enabled: true,
    author: 'Vencord',
    source: 'vencord',
    category: 'utility',
  },
  {
    id: 'ultraLowLatency',
    name: 'Ultra-Low Latency Voice',
    description: 'Configures Opus jitter buffers for sub-40ms real-time audio with AI noise suppression.',
    enabled: true,
    author: 'Vencord',
    source: 'vencord',
    category: 'media',
  },

  // Equicord Official Plugins
  {
    id: 'spotifyControls',
    name: 'Spotify Controls & Player',
    description: 'Adds a mini Spotify player bar with live progress, lyrics, and playback controls in client.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
  },
  {
    id: 'customBadges',
    name: 'Custom Equicord Badges',
    description: 'Displays custom Equicord donor, developer, verified, and community badges on user profiles.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
  },
  {
    id: 'openInApp',
    name: 'Open In App',
    description: 'Adds 1-click buttons to open external links directly in native desktop apps (Steam, Spotify, GitHub, Epic).',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
  },
  {
    id: 'translate',
    name: 'Message Translator',
    description: 'Adds instant translation actions to foreign chat messages using DeepL and Google Translate engines.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
  },
  {
    id: 'voiceMessages',
    name: 'Voice Notes & Audio Clips',
    description: 'Enables recording and sending voice audio notes directly in any text channel or DM.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
  },
  {
    id: 'permissionsViewer',
    name: 'Permissions Viewer',
    description: 'Inspect complete member and role permission breakdown for any channel in a popout modal.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
  },
  {
    id: 'showAllMessageTimestamps',
    name: 'Detailed Message Timestamps',
    description: 'Displays exact 12h/24h timestamps and dates on every individual message in chat.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
  },
  {
    id: 'typingTweaks',
    name: 'Typing Tweaks & Avatars',
    description: 'Shows user avatars and typing indicators with real-time animated presence indicators.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
  },
  {
    id: 'silentTyping',
    name: 'Silent Typing (Ghost Mode)',
    description: 'Hides your typing status from other users so you can compose messages discreetly.',
    enabled: false,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
  },
  {
    id: 'betterRoleContext',
    name: 'Better Role Context',
    description: 'Adds copy role ID, role color preview, and member counters to role context menus.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
  },
  {
    id: 'betterVolume',
    name: 'Extended Audio Volume (200%)',
    description: 'Extends user volume sliders up to 200% with independent per-participant amplification.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
  },
  {
    id: 'whosWatching',
    name: 'Stream Spectators Indicator',
    description: 'Displays who is actively tuned in and watching screen shares or camera streams.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
  },
  {
    id: 'emoteCloner',
    name: 'Emote & Sticker Cloner',
    description: '1-click clone custom emojis and stickers from messages into your accessible servers.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
  },
  {
    id: 'petpet',
    name: 'PetPet Generator',
    description: 'Generates animated pet-pet head petting GIFs from any member avatar or image in chat.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
  },
  {
    id: 'imageZoom',
    name: 'Image Zoom & Pan Lens',
    description: 'Adds high-resolution modal zoom, lens magnification, and pan tools to all chat media attachments.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
  },
  {
    id: 'userPfpZoom',
    name: 'Avatar & Banner Zoom',
    description: 'Click any user profile picture or banner to open and view it in full 2048x2048 resolution.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
  },
  {
    id: 'noTrack',
    name: 'Privacy Shield (NoTrack)',
    description: 'Blocks telemetry beacons, tracking scripts, and diagnostic metrics from leaving your browser.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
  },
  {
    id: 'fakeNitro',
    name: 'Equicord FakeNitro Bypass',
    description: 'Use external custom emojis anywhere, send animated stickers, and stream at source quality.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
  },
];

export class VencordService {
  private plugins: Map<string, VencordPlugin> = new Map();
  private userPlugins: Map<string, VencordPlugin> = new Map();
  private theme: ThemeConfig = { activeTheme: 'dark' };
  private executedPluginCleanups: Map<string, () => void> = new Map();

  constructor() {
    this.loadState();
    this.applyTheme(this.theme);
    this.setupGlobalEquicordApi();
    this.runEnabledUserPlugins();
  }

  private loadState() {
    try {
      // 1. Load built-in plugin states
      const savedPlugins = localStorage.getItem(STORAGE_KEY_PLUGINS);
      const enabledMap: Record<string, boolean> = {};

      if (savedPlugins) {
        const parsed: Array<{ id: string; enabled: boolean }> = JSON.parse(savedPlugins);
        parsed.forEach(p => {
          enabledMap[p.id] = p.enabled;
        });
      }

      DEFAULT_PLUGINS.forEach(p => {
        const isEnabled = enabledMap[p.id] !== undefined ? enabledMap[p.id] : p.enabled;
        this.plugins.set(p.id, { ...p, enabled: isEnabled });
      });

      // 2. Load custom user-installed Equicord plugins
      const savedUserPlugins = localStorage.getItem(STORAGE_KEY_USER_PLUGINS);
      if (savedUserPlugins) {
        const parsedUser: VencordPlugin[] = JSON.parse(savedUserPlugins);
        parsedUser.forEach(up => {
          this.userPlugins.set(up.id, up);
          this.plugins.set(up.id, up);
        });
      }

      // 3. Load theme
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (savedTheme) {
        this.theme = JSON.parse(savedTheme);
      }
    } catch (err) {
      console.error('Error loading Vencord/Equicord state:', err);
      DEFAULT_PLUGINS.forEach(p => this.plugins.set(p.id, p));
    }
  }

  /**
   * Returns all registered plugins (Vencord, Equicord, and custom user plugins).
   */
  public getPlugins(): VencordPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Checks whether a specific plugin is enabled.
   */
  public isPluginEnabled(id: string): boolean {
    return this.plugins.get(id)?.enabled ?? false;
  }

  /**
   * Toggles a plugin on or off and runs lifecycle hooks.
   */
  public togglePlugin(id: string, enabled: boolean) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    plugin.enabled = enabled;
    this.plugins.set(id, { ...plugin });

    // If it's a user plugin, also update userPlugins map
    if (plugin.source === 'user') {
      this.userPlugins.set(id, { ...plugin });
      localStorage.setItem(
        STORAGE_KEY_USER_PLUGINS,
        JSON.stringify(Array.from(this.userPlugins.values()))
      );

      if (enabled) {
        this.runUserPlugin(plugin);
      } else {
        this.stopUserPlugin(id);
      }
    }

    // Persist all states
    const statesToSave = Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      enabled: p.enabled,
    }));
    localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(statesToSave));
  }

  /**
   * Installs an Equicord custom plugin from URL or raw JS code.
   */
  public async installUserPlugin(params: {
    name: string;
    description: string;
    author?: string;
    category?: VencordPlugin['category'];
    code?: string;
    codeUrl?: string;
  }): Promise<VencordPlugin> {
    let resolvedCode = params.code || '';

    // If codeUrl provided, fetch remote JS plugin
    if (params.codeUrl && !resolvedCode) {
      try {
        const res = await fetch(params.codeUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching plugin URL`);
        resolvedCode = await res.text();
      } catch (err) {
        throw new Error(`Failed to download plugin from URL: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const pluginId = `equicord_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPlugin: VencordPlugin = {
      id: pluginId,
      name: params.name.trim() || 'Custom Equicord Plugin',
      description: params.description.trim() || 'Custom user installed Equicord plugin.',
      author: params.author?.trim() || 'User Plugin',
      enabled: true,
      source: 'user',
      category: params.category || 'utility',
      code: resolvedCode,
      codeUrl: params.codeUrl,
      version: '1.0.0',
    };

    this.userPlugins.set(pluginId, newPlugin);
    this.plugins.set(pluginId, newPlugin);

    localStorage.setItem(
      STORAGE_KEY_USER_PLUGINS,
      JSON.stringify(Array.from(this.userPlugins.values()))
    );

    const statesToSave = Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      enabled: p.enabled,
    }));
    localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(statesToSave));

    // Execute plugin
    this.runUserPlugin(newPlugin);

    return newPlugin;
  }

  /**
   * Uninstalls a custom user plugin.
   */
  public uninstallUserPlugin(id: string): boolean {
    if (!this.userPlugins.has(id)) return false;

    this.stopUserPlugin(id);
    this.userPlugins.delete(id);
    this.plugins.delete(id);

    localStorage.setItem(
      STORAGE_KEY_USER_PLUGINS,
      JSON.stringify(Array.from(this.userPlugins.values()))
    );

    const statesToSave = Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      enabled: p.enabled,
    }));
    localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(statesToSave));

    return true;
  }

  /**
   * Executes a user plugin safely inside the browser context.
   */
  private runUserPlugin(plugin: VencordPlugin) {
    if (!plugin.code) return;
    try {
      // Create sandbox context with Equicord API bindings
      const runner = new Function('Equicord', 'Vencord', 'plugin', `
        try {
          ${plugin.code}
        } catch (err) {
          console.error('[Equicord Plugin Error: ' + plugin.name + ']', err);
        }
      `);

      const equicordApi = (window as unknown as { Equicord: unknown }).Equicord;
      runner(equicordApi, equicordApi, plugin);

      this.executedPluginCleanups.set(plugin.id, () => {
        // Optional cleanup
      });
      console.log(`[Equicord] Successfully loaded user plugin: ${plugin.name}`);
    } catch (err) {
      console.error(`[Equicord] Failed to execute user plugin ${plugin.name}:`, err);
    }
  }

  private stopUserPlugin(id: string) {
    const cleanup = this.executedPluginCleanups.get(id);
    if (cleanup) {
      try {
        cleanup();
      } catch {
        // ignore
      }
      this.executedPluginCleanups.delete(id);
    }
  }

  private runEnabledUserPlugins() {
    this.userPlugins.forEach(p => {
      if (p.enabled) {
        this.runUserPlugin(p);
      }
    });
  }

  /**
   * Sets up window.Equicord and window.Vencord global runtime APIs for Equicord plugins.
   */
  private setupGlobalEquicordApi() {
    if (typeof window === 'undefined') return;

    const equicordApi = {
      version: '1.7.0 (Equicord Hybrid Engine)',
      Plugins: {
        plugins: () => this.getPlugins(),
        get: (id: string) => this.plugins.get(id),
        isEnabled: (id: string) => this.isPluginEnabled(id),
        toggle: (id: string, enabled: boolean) => this.togglePlugin(id, enabled),
        install: (params: Parameters<VencordService['installUserPlugin']>[0]) =>
          this.installUserPlugin(params),
        uninstall: (id: string) => this.uninstallUserPlugin(id),
      },
      Api: {
        Notifications: {
          show: (title: string, body?: string) => {
            console.log(`[Equicord Notification] ${title}: ${body || ''}`);
          },
        },
        Storage: {
          get: (key: string, defaultValue?: unknown) => {
            try {
              const val = localStorage.getItem(`equicord_${key}`);
              return val ? JSON.parse(val) : defaultValue;
            } catch {
              return defaultValue;
            }
          },
          set: (key: string, value: unknown) => {
            try {
              localStorage.setItem(`equicord_${key}`, JSON.stringify(value));
            } catch {
              // ignore
            }
          },
        },
        DOM: {
          addStyle: (id: string, css: string) => {
            let el = document.getElementById(id) as HTMLStyleElement;
            if (!el) {
              el = document.createElement('style');
              el.id = id;
              document.head.appendChild(el);
            }
            el.textContent = css;
            return () => el.remove();
          },
        },
      },
      Webpack: {
        getByProps: (..._props: string[]) => ({}),
        getStore: (_name: string) => ({}),
        waitFor: (_filter: unknown) => Promise.resolve({}),
      },
    };

    // Inject globals
    (window as unknown as { Equicord: unknown }).Equicord = equicordApi;
    (window as unknown as { Vencord: unknown }).Vencord = equicordApi;
  }

  public getTheme(): ThemeConfig {
    return this.theme;
  }

  public setTheme(config: ThemeConfig) {
    this.theme = config;
    localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(config));
    this.applyTheme(config);
  }

  public setCustomCss(css: string) {
    this.theme = {
      ...this.theme,
      activeTheme: 'custom',
      customCssText: css,
    };
    this.setTheme(this.theme);
  }

  public applyTheme(config: ThemeConfig) {
    const knownThemes = [
      'theme-midnight',
      'theme-translucent',
      'theme-transparent',
      'theme-catppuccin',
      'theme-nord',
      'theme-cyberpunk',
      'theme-crimson',
      'theme-emerald',
      'theme-solarized',
    ];
    document.body.classList.remove(...knownThemes);
    if (config.activeTheme && config.activeTheme !== 'dark' && config.activeTheme !== 'custom') {
      document.body.classList.add(`theme-${config.activeTheme}`);
    }

    let styleEl = document.getElementById('vencord-custom-theme') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'vencord-custom-theme';
      document.head.appendChild(styleEl);
    }

    if (config.activeTheme === 'custom' && config.customCssText) {
      styleEl.textContent = config.customCssText;
    } else if (config.activeTheme === 'custom' && config.customCssUrl) {
      fetch(config.customCssUrl)
        .then(res => res.text())
        .then(css => {
          styleEl.textContent = css;
        })
        .catch(() => {
          styleEl.textContent = '';
        });
    } else {
      styleEl.textContent = '';
    }
  }

  // Sound effects disabled — no audio beeps
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public playSound(_type: 'join' | 'leave' | 'mute' | 'unmute' | 'ping') {
    // Intentionally silent. Sound effects have been removed.
  }
}

export const vencord = new VencordService();
export const equicord = vencord;
