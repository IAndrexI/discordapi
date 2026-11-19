export interface OverlayConfig {
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;
  compactMode: boolean;
  showOnlySpeaking: boolean;
  showChatToasts: boolean;
  showTelemetry: boolean;
  isInteractive: boolean;
  hotkey: string;
}

export interface OverlayToast {
  id: string;
  roomId: string;
  roomName: string;
  senderName: string;
  body: string;
  source: 'discord' | 'app';
  timestamp: number;
}

export type OverlayToastInput = Omit<OverlayToast, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: number;
};

const STORAGE_KEY = 'protutech_overlay_config_v1';
const TOAST_TTL_MS = 6000;
const MAX_TOASTS = 5;

const DEFAULT_CONFIG: OverlayConfig = {
  enabled: false,
  position: 'top-left',
  opacity: 0.92,
  compactMode: false,
  showOnlySpeaking: false,
  showChatToasts: true,
  showTelemetry: true,
  isInteractive: true,
  hotkey: 'Ctrl+Shift+O',
};

const VALID_POSITIONS: ReadonlyArray<OverlayConfig['position']> = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

class OverlayService {
  private config: OverlayConfig;
  private toasts: OverlayToast[] = [];
  private toastTimers: Map<string, number> = new Map();
  private listeners: Set<(config: OverlayConfig, toasts: OverlayToast[]) => void> = new Set();

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): OverlayConfig {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<OverlayConfig>;
        const positionValid = parsed.position && VALID_POSITIONS.includes(parsed.position);
        const opacity =
          typeof parsed.opacity === 'number' && !Number.isNaN(parsed.opacity)
            ? Math.max(0.25, Math.min(1, parsed.opacity))
            : DEFAULT_CONFIG.opacity;

        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          position: positionValid ? parsed.position! : DEFAULT_CONFIG.position,
          opacity,
        };
      }
    } catch (err) {
      console.warn('[Overlay] Failed to parse saved config:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (err) {
      console.warn('[Overlay] Failed to save config:', err);
    }
  }

  private notify() {
    const cfg = this.getConfig();
    const list = this.getToasts();
    this.listeners.forEach(cb => cb(cfg, list));
  }

  public getConfig(): OverlayConfig {
    return { ...this.config };
  }

  public getToasts(): OverlayToast[] {
    return this.toasts.map(t => ({ ...t }));
  }

  public updateConfig(partial: Partial<OverlayConfig>): OverlayConfig {
    const nextOpacity =
      typeof partial.opacity === 'number' && !Number.isNaN(partial.opacity)
        ? Math.max(0.25, Math.min(1, partial.opacity))
        : this.config.opacity;

    this.config = {
      ...this.config,
      ...partial,
      opacity: nextOpacity,
    };

    this.saveConfig();
    this.notify();
    return this.getConfig();
  }

  public toggleEnabled(): boolean {
    const next = !this.config.enabled;
    this.updateConfig({ enabled: next });
    return next;
  }

  public toggleInteractive(): boolean {
    const next = !this.config.isInteractive;
    this.updateConfig({ isInteractive: next });
    return next;
  }

  public pushToast(toast: OverlayToastInput): OverlayToast {
    const item: OverlayToast = {
      id: toast.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomId: toast.roomId,
      roomName: toast.roomName,
      senderName: toast.senderName,
      body: toast.body,
      source: toast.source,
      timestamp: toast.timestamp || Date.now(),
    };

    const existingTimer = this.toastTimers.get(item.id);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      this.toastTimers.delete(item.id);
    }

    this.toasts = [item, ...this.toasts.filter(t => t.id !== item.id)].slice(0, MAX_TOASTS);

    if (typeof window !== 'undefined') {
      const timerId = window.setTimeout(() => {
        this.dismissToast(item.id);
      }, TOAST_TTL_MS);
      this.toastTimers.set(item.id, timerId);
    }

    this.notify();
    return { ...item };
  }

  public dismissToast(id: string): void {
    const existingTimer = this.toastTimers.get(id);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      this.toastTimers.delete(id);
    }

    const beforeLen = this.toasts.length;
    this.toasts = this.toasts.filter(t => t.id !== id);
    if (this.toasts.length !== beforeLen) {
      this.notify();
    }
  }

  public clearToasts(): void {
    this.toastTimers.forEach(timerId => clearTimeout(timerId));
    this.toastTimers.clear();
    if (this.toasts.length > 0) {
      this.toasts = [];
      this.notify();
    }
  }

  public subscribe(cb: (config: OverlayConfig, toasts: OverlayToast[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getConfig(), this.getToasts());
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const overlayService = new OverlayService();
