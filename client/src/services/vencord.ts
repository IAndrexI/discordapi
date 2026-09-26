import type { VencordPlugin, ThemeConfig } from '../types';

const STORAGE_KEY_PLUGINS = 'vencord_plugins_v1';
const STORAGE_KEY_THEME = 'vencord_theme_v1';

export const DEFAULT_PLUGINS: VencordPlugin[] = [
  {
    id: 'customSounds',
    name: 'Discord Sound Effects',
    description: 'Plays Discord join, leave, mute, and notification sounds.',
    enabled: true,
    author: 'Vencord Engine',
  },
  {
    id: 'messageLogger',
    name: 'Message Logger',
    description: 'Preserves deleted and edited messages with a visual indicator.',
    enabled: true,
    author: 'Vencord Engine',
  },
  {
    id: 'nitroBypass',
    name: 'Nitro Screen Share & Media',
    description: 'Enables 1080p 60FPS screen sharing and bypasses upload file size limits.',
    enabled: true,
    author: 'Vencord Engine',
  },
  {
    id: 'ultraLowLatency',
    name: 'Ultra-Low Latency Voice',
    description: 'Configures Opus jitter buffers for sub-40ms real-time audio with AI noise suppression.',
    enabled: true,
    author: 'Vencord Engine',
  },
];

export class VencordService {
  private plugins: Map<string, VencordPlugin> = new Map();
  private theme: ThemeConfig = { activeTheme: 'dark' };

  constructor() {
    this.loadState();
    this.applyTheme(this.theme);
  }

  private loadState() {
    try {
      const savedPlugins = localStorage.getItem(STORAGE_KEY_PLUGINS);
      if (savedPlugins) {
        const parsed: VencordPlugin[] = JSON.parse(savedPlugins);
        parsed.forEach(p => this.plugins.set(p.id, p));
      } else {
        DEFAULT_PLUGINS.forEach(p => this.plugins.set(p.id, p));
      }

      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (savedTheme) {
        this.theme = JSON.parse(savedTheme);
      }
    } catch {
      DEFAULT_PLUGINS.forEach(p => this.plugins.set(p.id, p));
    }
  }

  public getPlugins(): VencordPlugin[] {
    return Array.from(this.plugins.values());
  }

  public isPluginEnabled(id: string): boolean {
    return this.plugins.get(id)?.enabled ?? false;
  }

  public togglePlugin(id: string, enabled: boolean) {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.enabled = enabled;
      this.plugins.set(id, { ...plugin });
      localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(Array.from(this.plugins.values())));
    }
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
      'theme-solarized'
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
