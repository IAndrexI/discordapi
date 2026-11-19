import type { WebcamBackgroundConfig } from '../types';

const STORAGE_KEY_BG = 'protutech_webcam_background_v1';

export interface WebcamPreset {
  id: string;
  name: string;
  previewUrl: string;
  category: 'cyberpunk' | 'gaming' | 'ambient' | 'nature' | 'studio';
}

export const WEBCAM_PRESETS: WebcamPreset[] = [
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Skyline',
    previewUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1280&q=80',
    category: 'cyberpunk',
  },
  {
    id: 'gaming_battlestation',
    name: 'RGB Battlestation Room',
    previewUrl: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=1280&q=80',
    category: 'gaming',
  },
  {
    id: 'synthwave_sunset',
    name: 'Synthwave 80s Sunset',
    previewUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1280&q=80',
    category: 'cyberpunk',
  },
  {
    id: 'studio_minimal_dark',
    name: 'Dark Studio Office',
    previewUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
    category: 'studio',
  },
  {
    id: 'aurora_borealis',
    name: 'Northern Lights Aurora',
    previewUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1280&q=80',
    category: 'nature',
  },
  {
    id: 'anime_cafe',
    name: 'Cozy Loft Cafe',
    previewUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1280&q=80',
    category: 'ambient',
  },
];

class WebcamBackgroundService {
  private currentConfig: WebcamBackgroundConfig = {
    type: 'none',
  };
  private listeners: Set<(config: WebcamBackgroundConfig) => void> = new Set();
  private customUploads: string[] = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BG);
      if (saved) {
        this.currentConfig = JSON.parse(saved);
      }
      const savedUploads = localStorage.getItem('protutech_webcam_user_uploads');
      if (savedUploads) {
        this.customUploads = JSON.parse(savedUploads);
      }
    } catch {
      this.currentConfig = { type: 'none' };
    }
  }

  public subscribe(cb: (config: WebcamBackgroundConfig) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentConfig);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.currentConfig));
  }

  public getConfig(): WebcamBackgroundConfig {
    return this.currentConfig;
  }

  public setConfig(config: WebcamBackgroundConfig) {
    this.currentConfig = config;
    localStorage.setItem(STORAGE_KEY_BG, JSON.stringify(config));
    this.notify();
  }

  public setBlur(amount = 12) {
    this.setConfig({
      type: 'blur',
      blurAmount: amount,
    });
  }

  public setPreset(presetId: string) {
    const preset = WEBCAM_PRESETS.find(p => p.id === presetId);
    this.setConfig({
      type: 'preset',
      presetId,
      customUrl: preset?.previewUrl,
    });
  }

  public setCustomImage(urlOrBase64: string) {
    if (!this.customUploads.includes(urlOrBase64)) {
      this.customUploads.unshift(urlOrBase64);
      if (this.customUploads.length > 8) this.customUploads.pop();
      localStorage.setItem('protutech_webcam_user_uploads', JSON.stringify(this.customUploads));
    }
    this.setConfig({
      type: 'custom',
      customUrl: urlOrBase64,
    });
  }

  public removeBackground() {
    this.setConfig({ type: 'none' });
  }

  public getCustomUploads(): string[] {
    return this.customUploads;
  }
}

export const webcamBackground = new WebcamBackgroundService();
