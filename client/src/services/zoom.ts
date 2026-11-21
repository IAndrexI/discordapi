import { desktopBridge } from './desktopBridge';

export const ZOOM_STEPS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200] as const;

const STORAGE_KEY_ZOOM = 'protutech_zoom_percent';
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;

export type ZoomListener = (zoomPercent: number) => void;

function clampZoomPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 100;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(raw)));
}

function loadPersistedZoom(): number {
  if (typeof localStorage === 'undefined') return 100;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ZOOM);
    if (!raw) return 100;
    return clampZoomPercent(Number(raw));
  } catch {
    return 100;
  }
}

function persistZoom(percent: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ZOOM, String(percent));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function supportsCssZoom(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    try {
      if (CSS.supports('zoom', '1.1')) return true;
    } catch {
      // Fallback below
    }
  }
  return 'zoom' in document.documentElement.style;
}

class ZoomService {
  private zoomPercent: number = 100;
  private listeners: Set<ZoomListener> = new Set();

  constructor() {
    this.zoomPercent = loadPersistedZoom();
    this.applyDomZoom(this.zoomPercent);

    if (typeof window !== 'undefined' && desktopBridge.getRuntimeKind() === 'electron') {
      if (this.zoomPercent !== 100) {
        desktopBridge.setZoomFactor(this.zoomPercent / 100);
      }
      desktopBridge.onZoomChanged((factor: number) => {
        const nextPercent = clampZoomPercent(Math.round(factor * 100));
        if (nextPercent === this.zoomPercent) return;
        this.zoomPercent = nextPercent;
        persistZoom(nextPercent);
        this.applyDomZoom(nextPercent);
        this.notify();
      });
    }
  }

  private applyDomZoom(percent: number): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const factor = percent / 100;

    if (desktopBridge.getRuntimeKind() === 'electron') {
      // Native webContents.setZoomFactor handles zoom in Electron; keep CSS zoom clear
      root.style.zoom = '';
      root.style.fontSize = '';
      root.style.setProperty('--app-zoom', '1');
      return;
    }

    root.style.setProperty('--app-zoom', String(factor));
    if (supportsCssZoom()) {
      root.style.zoom = String(factor);
      root.style.fontSize = '';
    } else {
      root.style.zoom = '';
      root.style.fontSize = `${Math.round(16 * factor * 100) / 100}px`;
    }
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.zoomPercent);
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  public getZoom(): number {
    return this.zoomPercent;
  }

  public setZoom(percent: number): number {
    const next = clampZoomPercent(percent);
    const changed = next !== this.zoomPercent;
    this.zoomPercent = next;
    persistZoom(next);
    this.applyDomZoom(next);

    if (desktopBridge.getRuntimeKind() === 'electron') {
      desktopBridge.setZoomFactor(next / 100);
    }

    if (changed) {
      this.notify();
    }
    return next;
  }

  public zoomIn(): number {
    const nextStep =
      ZOOM_STEPS.find((step) => step > this.zoomPercent) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
    return this.setZoom(nextStep);
  }

  public zoomOut(): number {
    let prevStep: number = ZOOM_STEPS[0];
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
      if (ZOOM_STEPS[i] < this.zoomPercent) {
        prevStep = ZOOM_STEPS[i];
        break;
      }
    }
    return this.setZoom(prevStep);
  }

  public resetZoom(): number {
    return this.setZoom(100);
  }

  public subscribe(cb: ZoomListener): () => void {
    this.listeners.add(cb);
    cb(this.zoomPercent);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const zoomService = new ZoomService();
