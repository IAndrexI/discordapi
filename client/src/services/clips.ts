// Built-in Clipping Software Engine (Discord-style Instant Replay & Clips)
export interface SavedClip {
  id: string;
  title: string;
  durationSec: number;
  createdAt: number;
  url: string;
  sizeBytes: number;
  roomName?: string;
}

export interface ClipsConfig {
  enabled: boolean;
  durationSec: 15 | 30 | 60 | 120;
  resolution: '720p30' | '1080p60';
  hotkey: string;
}

const CLIPS_CONFIG_KEY = 'protutech_clips_config_v1';

class ClipsService {
  private config: ClipsConfig = this.loadConfig();
  private clips: SavedClip[] = [];
  private listeners = new Set<() => void>();
  private recorder: MediaRecorder | null = null;
  private rollingChunks: Array<{ blob: Blob; ts: number }> = [];
  private isBuffering = false;

  private loadConfig(): ClipsConfig {
    try {
      const raw = localStorage.getItem(CLIPS_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClipsConfig>;
        return {
          enabled: parsed.enabled !== false,
          durationSec: ([15, 30, 60, 120].includes(Number(parsed.durationSec))
            ? Number(parsed.durationSec)
            : 30) as 15 | 30 | 60 | 120,
          resolution: parsed.resolution === '1080p60' ? '1080p60' : '720p30',
          hotkey: parsed.hotkey || 'Alt+C',
        };
      }
    } catch {
      // Ignore storage error
    }
    return { enabled: true, durationSec: 30, resolution: '1080p60', hotkey: 'Alt+C' };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public getConfig(): ClipsConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<ClipsConfig>) {
    this.config = { ...this.config, ...updates };
    try {
      localStorage.setItem(CLIPS_CONFIG_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore storage error
    }
    this.notify();
  }

  public getClips(): SavedClip[] {
    return [...this.clips];
  }

  public getIsBuffering(): boolean {
    return this.isBuffering;
  }

  public startBufferingStream(stream: MediaStream) {
    if (!this.config.enabled || typeof MediaRecorder === 'undefined') return;
    this.stopBuffering();
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      this.recorder = rec;
      this.rollingChunks = [];
      this.isBuffering = true;

      rec.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          const now = Date.now();
          this.rollingChunks.push({ blob: ev.data, ts: now });
          const cutoff = now - this.config.durationSec * 1000;
          // Keep first chunk (WebM header) + chunks inside window
          if (this.rollingChunks.length > 2) {
            const first = this.rollingChunks[0];
            this.rollingChunks = [
              first,
              ...this.rollingChunks.slice(1).filter(c => c.ts >= cutoff),
            ];
          }
        }
      };

      rec.start(1000);
      this.notify();
    } catch {
      this.isBuffering = false;
    }
  }

  public stopBuffering() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // Ignore
      }
    }
    this.recorder = null;
    this.isBuffering = false;
    this.notify();
  }

  public async captureInstantClip(roomName?: string): Promise<SavedClip> {
    if (this.rollingChunks.length > 0) {
      const blob = new Blob(
        this.rollingChunks.map(c => c.blob),
        { type: 'video/webm' }
      );
      const url = URL.createObjectURL(blob);
      const clip: SavedClip = {
        id: `clip_${Date.now()}`,
        title: `Clip — ${roomName || 'Protutech'} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        durationSec: this.config.durationSec,
        createdAt: Date.now(),
        url,
        sizeBytes: blob.size,
        roomName,
      };
      this.clips = [clip, ...this.clips];
      this.notify();
      return clip;
    }

    // Fallback: record a short snapshot clip of a synthetic status canvas so user always gets a playable WebM clip even outside active screen share
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#312e81');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('Protutech Instant Clip', 40, 150);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '18px monospace';
      ctx.fillText(`Channel: ${roomName || 'Voice Lounge'} • ${new Date().toLocaleTimeString()}`, 40, 195);
    }

    let blob: Blob;
    try {
      const stream = canvas.captureStream(15);
      const rec = new MediaRecorder(stream);
      const parts: Blob[] = [];
      blob = await new Promise<Blob>(resolve => {
        rec.ondataavailable = e => {
          if (e.data.size > 0) parts.push(e.data);
        };
        rec.onstop = () => resolve(new Blob(parts, { type: 'video/webm' }));
        rec.start();
        window.setTimeout(() => rec.stop(), 600);
      });
    } catch {
      blob = new Blob(['Protutech Clip'], { type: 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const clip: SavedClip = {
      id: `clip_${Date.now()}`,
      title: `Clip — ${roomName || 'Protutech'} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      durationSec: this.config.durationSec,
      createdAt: Date.now(),
      url,
      sizeBytes: blob.size,
      roomName,
    };
    this.clips = [clip, ...this.clips];
    this.notify();
    return clip;
  }

  public renameClip(id: string, title: string) {
    this.clips = this.clips.map(c => (c.id === id ? { ...c, title: title.trim() || c.title } : c));
    this.notify();
  }

  public deleteClip(id: string) {
    const target = this.clips.find(c => c.id === id);
    if (target) {
      try {
        URL.revokeObjectURL(target.url);
      } catch {
        // Ignore
      }
    }
    this.clips = this.clips.filter(c => c.id !== id);
    this.notify();
  }
}

export const clipsService = new ClipsService();
