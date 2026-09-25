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
  private audioContext: AudioContext | null = null;

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

  public applyTheme(config: ThemeConfig) {
    document.body.classList.remove('theme-midnight', 'theme-catppuccin');
    if (config.activeTheme === 'midnight') {
      document.body.classList.add('theme-midnight');
    } else if (config.activeTheme === 'catppuccin') {
      document.body.classList.add('theme-catppuccin');
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

  // Discord sound effects generation using Web Audio API synthesis
  public playSound(type: 'join' | 'leave' | 'mute' | 'unmute' | 'ping') {
    if (!this.isPluginEnabled('customSounds')) return;

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      if (type === 'join') {
        // Discord high dual-tone join chord
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'leave') {
        // Discord falling tone
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'mute') {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'unmute') {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(450, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'ping') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1000, now + 0.06);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch {
      // Audio playback safety
    }
  }
}

export const vencord = new VencordService();
