import type { SoundboardClip, SoundboardPlayEvent } from '../types';
import { livekit } from './livekit';

const STORAGE_KEY_META = 'protutech_soundboard_meta_v1';
const STORAGE_KEY_MASTER_VOL = 'protutech_soundboard_master_vol';
const STORAGE_KEY_MUTED = 'protutech_soundboard_muted';
const IDB_NAME = 'protutech_soundboard_db';
const IDB_STORE = 'clips';
const IDB_VERSION = 1;

interface PersistedMeta {
  builtinOverrides: Record<
    string,
    Partial<Pick<SoundboardClip, 'name' | 'emoji' | 'volume' | 'favorite' | 'hotkey'>>
  >;
  customClips: SoundboardClip[];
}

interface StoredAudioRecord {
  id: string;
  blob?: Blob;
  dataUrl?: string;
  mimeType: string;
  createdAt: number;
}

interface ActivePlayback {
  token: string;
  clipId: string;
  stop: () => void;
  timerId: number | null;
}

const BUILTIN_CLIPS: SoundboardClip[] = [
  { id: 'builtin_airhorn', name: 'Airhorn', emoji: '📢', category: 'builtin', volume: 100, durationMs: 920 },
  { id: 'builtin_quack', name: 'Quack', emoji: '🦆', category: 'builtin', volume: 100, durationMs: 380 },
  { id: 'builtin_rimshot', name: 'Rimshot', emoji: '🥁', category: 'builtin', volume: 100, durationMs: 900 },
  { id: 'builtin_applause', name: 'Applause', emoji: '👏', category: 'builtin', volume: 100, durationMs: 1650 },
  { id: 'builtin_sad_trombone', name: 'Sad Trombone', emoji: '🎺', category: 'builtin', volume: 100, durationMs: 1850 },
  { id: 'builtin_ding', name: 'Ding', emoji: '🔔', category: 'builtin', volume: 100, durationMs: 800 },
  { id: 'builtin_vine_boom', name: 'Vine Boom', emoji: '💥', category: 'builtin', volume: 100, durationMs: 980 },
  { id: 'builtin_crickets', name: 'Crickets', emoji: '🦗', category: 'builtin', volume: 100, durationMs: 1450 },
  { id: 'builtin_victory', name: 'Victory Fanfare', emoji: '🏆', category: 'builtin', volume: 100, durationMs: 1350 },
  { id: 'builtin_siren', name: 'Siren', emoji: '🚨', category: 'builtin', volume: 100, durationMs: 1350 },
  { id: 'builtin_bass_drop', name: 'Bass Drop', emoji: '🔊', category: 'builtin', volume: 100, durationMs: 1250 },
  { id: 'builtin_discord_chime', name: 'Protutech Chime', emoji: '✨', category: 'builtin', volume: 100, durationMs: 600 },
];

function clampVolume(vol: number, fallback: number = 100): number {
  const num = Number(vol);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(200, Math.round(num)));
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : '';
  return `data:${mimeType || 'audio/mpeg'};base64,${b64}`;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const b64 = dataUrl.slice(commaIdx + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

class SoundboardService {
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private masterVolume: number = 100;
  private muted: boolean = false;
  private builtinOverrides: PersistedMeta['builtinOverrides'] = {};
  private customClips: SoundboardClip[] = [];

  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private cachedNoiseBuffer: AudioBuffer | null = null;

  private activePlaybacks: Map<string, ActivePlayback> = new Map();
  private customRecords: Map<string, StoredAudioRecord> = new Map();
  private customBuffers: Map<string, ArrayBuffer> = new Map();
  private decodedBuffers: Map<string, AudioBuffer> = new Map();

  private listeners: Set<() => void> = new Set();
  private playEventListeners: Set<(evt: SoundboardPlayEvent) => void> = new Set();
  private remoteUnsub: (() => void) | null = null;

  constructor() {
    this.loadMetaFromStorage();
  }

  private loadMetaFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const volRaw = localStorage.getItem(STORAGE_KEY_MASTER_VOL);
      if (volRaw !== null) {
        this.masterVolume = clampVolume(Number(volRaw), 100);
      }
      const mutedRaw = localStorage.getItem(STORAGE_KEY_MUTED);
      if (mutedRaw !== null) {
        this.muted = mutedRaw === 'true';
      }
      const metaRaw = localStorage.getItem(STORAGE_KEY_META);
      if (metaRaw) {
        const parsed = JSON.parse(metaRaw) as Partial<PersistedMeta>;
        if (parsed.builtinOverrides && typeof parsed.builtinOverrides === 'object') {
          this.builtinOverrides = parsed.builtinOverrides;
        }
        if (Array.isArray(parsed.customClips)) {
          this.customClips = parsed.customClips.map((c) => ({
            ...c,
            category: 'custom',
            volume: clampVolume(c.volume, 100),
          }));
        }
      }
    } catch {
      // Ignore corrupt storage
    }
  }

  private saveMetaToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_MASTER_VOL, String(this.masterVolume));
      localStorage.setItem(STORAGE_KEY_MUTED, String(this.muted));
      const payload: PersistedMeta = {
        builtinOverrides: this.builtinOverrides,
        customClips: this.customClips,
      };
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private emitPlayEvent(evt: SoundboardPlayEvent): void {
    this.playEventListeners.forEach((cb) => {
      try {
        cb(evt);
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async putDbRecord(record: StoredAudioRecord): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(record);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  private async deleteDbRecord(clipId: string): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(clipId);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  private async loadAllDbRecords(): Promise<StoredAudioRecord[]> {
    const db = await this.openDb();
    if (!db) return [];
    return new Promise<StoredAudioRecord[]>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = () => {
          const list = Array.isArray(req.result) ? (req.result as StoredAudioRecord[]) : [];
          db.close();
          resolve(list);
        };
        req.onerror = () => {
          db.close();
          resolve([]);
        };
      } catch {
        db.close();
        resolve([]);
      }
    });
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      this.loadMetaFromStorage();
      const records = await this.loadAllDbRecords();
      for (const rec of records) {
        if (rec && rec.id) {
          this.customRecords.set(rec.id, rec);
        }
      }

      if (!this.remoteUnsub) {
        this.remoteUnsub = livekit.subscribeSoundboardEvents((remoteEvt) => {
          const playEvt: SoundboardPlayEvent = {
            id: `sb_remote_${remoteEvt.timestamp}_${Math.random().toString(36).slice(2, 6)}`,
            clipId: remoteEvt.clipId,
            name: remoteEvt.name,
            emoji: remoteEvt.emoji,
            senderName: remoteEvt.senderName,
            timestamp: remoteEvt.timestamp,
          };
          this.emitPlayEvent(playEvt);

          const matchingClip = this.getSounds().find((c) => c.id === remoteEvt.clipId);
          if (matchingClip && !this.muted) {
            void this.playAudioOnly(matchingClip);
          }
        });
      }

      this.initialized = true;
      this.notify();
    })().finally(() => {
      this.initPromise = null;
    });

    await this.initPromise;
  }

  public getSounds(): SoundboardClip[] {
    const builtins = BUILTIN_CLIPS.map((clip) => {
      const ov = this.builtinOverrides[clip.id];
      if (!ov) return { ...clip };
      return {
        ...clip,
        ...ov,
        volume: clampVolume(ov.volume ?? clip.volume, clip.volume),
      };
    });
    const customs = this.customClips.map((c) => ({ ...c }));
    return [...builtins, ...customs];
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = clampVolume(vol, 100);
    this.updateMasterGain();
    this.saveMetaToStorage();
    this.notify();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = Boolean(muted);
    this.updateMasterGain();
    if (this.muted) {
      this.stopAll();
    }
    this.saveMetaToStorage();
    this.notify();
  }

  public getPlayingIds(): string[] {
    const unique = new Set<string>();
    this.activePlaybacks.forEach((pb) => unique.add(pb.clipId));
    return Array.from(unique);
  }

  private updateMasterGain(): void {
    if (!this.masterGainNode) return;
    this.masterGainNode.gain.value = this.muted ? 0 : this.masterVolume / 100;
  }

  private async ensureAudioContext(): Promise<{
    ctx: AudioContext;
    masterGain: GainNode;
  } | null> {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
      } catch {
        this.audioContext = new AudioCtx();
      }
      this.cachedNoiseBuffer = null;

      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -6;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;

      const masterGain = this.audioContext.createGain();
      masterGain.gain.value = this.muted ? 0 : this.masterVolume / 100;
      masterGain.connect(compressor);
      compressor.connect(this.audioContext.destination);

      this.masterGainNode = masterGain;
    }

    const sinkId = livekit.getSelectedOutputDeviceId();
    const sinkCtx = this.audioContext as AudioContext & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof sinkCtx.setSinkId === 'function') {
      void sinkCtx.setSinkId(sinkId === 'default' ? '' : sinkId).catch(() => {});
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    if (!this.masterGainNode) return null;
    this.updateMasterGain();
    return { ctx: this.audioContext, masterGain: this.masterGainNode };
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.cachedNoiseBuffer && this.cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.cachedNoiseBuffer;
    }
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.22));
    }
    this.cachedNoiseBuffer = buffer;
    return buffer;
  }

  private registerPlayback(
    clipId: string,
    durationMs: number,
    onStop: () => void
  ): void {
    const token = `${clipId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let cleaned = false;

    const finish = () => {
      if (cleaned) return;
      cleaned = true;
      const existing = this.activePlaybacks.get(token);
      if (existing?.timerId !== null && existing?.timerId !== undefined) {
        clearTimeout(existing.timerId);
      }
      this.activePlaybacks.delete(token);
      try {
        onStop();
      } catch {
        // Ignore stop cleanup errors
      }
      this.notify();
    };

    const timerId =
      typeof window !== 'undefined'
        ? window.setTimeout(finish, Math.max(180, durationMs))
        : null;

    this.activePlaybacks.set(token, {
      token,
      clipId,
      stop: finish,
      timerId,
    });
    this.notify();
  }

  private synthesizeBuiltinClip(
    ctx: AudioContext,
    dest: AudioNode,
    clipId: string
  ): { durationMs: number; stop: () => void } {
    const now = ctx.currentTime;
    const stopCallbacks: Array<() => void> = [];

    const trackNode = <T extends AudioNode>(node: T): T => {
      stopCallbacks.push(() => {
        try {
          const stoppable = node as unknown as { stop?: () => void };
          if (typeof stoppable.stop === 'function') {
            stoppable.stop();
          }
        } catch {
          // Ignore already-stopped nodes
        }
        try {
          node.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      });
      return node;
    };

    const playTone = (
      type: OscillatorType,
      freqStart: number,
      freqEnd: number,
      startOffset: number,
      duration: number,
      peakGain: number,
      outNode: AudioNode = dest
    ) => {
      const osc = trackNode(ctx.createOscillator());
      const gain = trackNode(ctx.createGain());
      osc.type = type;
      const t0 = now + startOffset;
      osc.frequency.setValueAtTime(Math.max(20, freqStart), t0);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.025, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(outNode);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    };

    const playNoiseBurst = (
      filterType: BiquadFilterType,
      freqStart: number,
      freqEnd: number,
      q: number,
      startOffset: number,
      duration: number,
      peakGain: number,
      outNode: AudioNode = dest
    ) => {
      const src = trackNode(ctx.createBufferSource());
      src.buffer = this.getNoiseBuffer(ctx);
      const filter = trackNode(ctx.createBiquadFilter());
      filter.type = filterType;
      const t0 = now + startOffset;
      filter.frequency.setValueAtTime(freqStart, t0);
      if (freqEnd !== freqStart) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
      }
      filter.Q.value = q;

      const gain = trackNode(ctx.createGain());
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.015, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(outNode);
      src.start(t0, Math.random() * 0.4, duration + 0.03);
    };

    let durationMs = 800;

    switch (clipId) {
      case 'builtin_airhorn': {
        durationMs = 920;
        const lp = trackNode(ctx.createBiquadFilter());
        lp.type = 'lowpass';
        lp.frequency.value = 2600;
        lp.connect(dest);
        const freqs = [440, 446, 554.37];
        for (const f of freqs) {
          playTone('sawtooth', f, f * 0.99, 0, 0.09, 0.22, lp);
          playTone('sawtooth', f, f * 0.96, 0.13, 0.72, 0.28, lp);
        }
        break;
      }
      case 'builtin_quack': {
        durationMs = 380;
        for (const offset of [0, 0.16]) {
          const bp = trackNode(ctx.createBiquadFilter());
          bp.type = 'bandpass';
          bp.Q.value = 3.2;
          bp.frequency.setValueAtTime(1450, now + offset);
          bp.frequency.exponentialRampToValueAtTime(820, now + offset + 0.13);
          bp.connect(dest);
          playTone('sawtooth', 195, 132, offset, 0.14, 0.45, bp);
        }
        break;
      }
      case 'builtin_rimshot': {
        durationMs = 900;
        // Ba (snare), dum (tom), tss (cymbal)
        playTone('triangle', 195, 95, 0, 0.11, 0.45);
        playNoiseBurst('bandpass', 1800, 1200, 1.2, 0, 0.11, 0.35);
        playTone('triangle', 145, 78, 0.16, 0.13, 0.42);
        playTone('triangle', 200, 95, 0.3, 0.11, 0.45);
        playNoiseBurst('bandpass', 2100, 1300, 1.0, 0.3, 0.11, 0.38);
        playNoiseBurst('highpass', 5800, 4200, 0.8, 0.42, 0.46, 0.42);
        break;
      }
      case 'builtin_applause': {
        durationMs = 1650;
        for (let i = 0; i < 24; i += 1) {
          const offset = i * 0.058 + Math.random() * 0.025;
          const env = i < 6 ? 0.16 + i * 0.04 : i > 18 ? 0.32 - (i - 18) * 0.045 : 0.34;
          playNoiseBurst(
            'bandpass',
            1200 + Math.random() * 1400,
            900 + Math.random() * 900,
            1.4,
            offset,
            0.065,
            Math.max(0.08, env)
          );
        }
        break;
      }
      case 'builtin_sad_trombone': {
        durationMs = 1850;
        const lp = trackNode(ctx.createBiquadFilter());
        lp.type = 'lowpass';
        lp.frequency.value = 1150;
        lp.connect(dest);
        playTone('sawtooth', 293.66, 286, 0, 0.33, 0.36, lp);
        playTone('sawtooth', 277.18, 270, 0.36, 0.33, 0.36, lp);
        playTone('sawtooth', 261.63, 255, 0.72, 0.33, 0.36, lp);
        playTone('sawtooth', 246.94, 212, 1.08, 0.74, 0.4, lp);
        break;
      }
      case 'builtin_ding': {
        durationMs = 800;
        playTone('sine', 1046.5, 1046.5, 0, 0.75, 0.48);
        playTone('sine', 2093, 2093, 0, 0.55, 0.2);
        playTone('sine', 3135.96, 3135.96, 0, 0.35, 0.1);
        break;
      }
      case 'builtin_vine_boom': {
        durationMs = 980;
        playTone('sine', 115, 31, 0, 0.92, 0.85);
        playTone('triangle', 220, 48, 0, 0.24, 0.45);
        playNoiseBurst('lowpass', 720, 120, 1.0, 0, 0.16, 0.55);
        break;
      }
      case 'builtin_crickets': {
        durationMs = 1450;
        for (const groupStart of [0, 0.48, 0.96]) {
          for (let p = 0; p < 4; p += 1) {
            playTone('sine', 4250, 4180, groupStart + p * 0.055, 0.036, 0.22);
          }
        }
        break;
      }
      case 'builtin_victory': {
        durationMs = 1350;
        const lp = trackNode(ctx.createBiquadFilter());
        lp.type = 'lowpass';
        lp.frequency.value = 2800;
        lp.connect(dest);
        const notes: Array<[number, number, number]> = [
          [523.25, 0, 0.14],
          [659.25, 0.14, 0.14],
          [783.99, 0.28, 0.14],
          [1046.5, 0.44, 0.82],
        ];
        for (const [freq, start, dur] of notes) {
          playTone('triangle', freq, freq, start, dur, 0.36, lp);
          playTone('sawtooth', freq * 0.5, freq * 0.5, start, dur, 0.16, lp);
        }
        break;
      }
      case 'builtin_siren': {
        durationMs = 1350;
        const osc = trackNode(ctx.createOscillator());
        const gain = trackNode(ctx.createGain());
        osc.type = 'sawtooth';
        const lp = trackNode(ctx.createBiquadFilter());
        lp.type = 'lowpass';
        lp.frequency.value = 1800;

        osc.frequency.setValueAtTime(560, now);
        osc.frequency.linearRampToValueAtTime(980, now + 0.32);
        osc.frequency.linearRampToValueAtTime(560, now + 0.65);
        osc.frequency.linearRampToValueAtTime(980, now + 0.98);
        osc.frequency.linearRampToValueAtTime(540, now + 1.3);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.04);
        gain.gain.setValueAtTime(0.32, now + 1.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.32);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 1.34);
        break;
      }
      case 'builtin_bass_drop': {
        durationMs = 1250;
        playTone('sawtooth', 75, 240, 0, 0.28, 0.28);
        playTone('sine', 145, 34, 0.3, 0.9, 0.82);
        playTone('triangle', 95, 38, 0.3, 0.65, 0.35);
        playNoiseBurst('lowpass', 900, 140, 0.8, 0.3, 0.15, 0.38);
        break;
      }
      case 'builtin_discord_chime':
      default: {
        durationMs = 600;
        playTone('sine', 659.25, 659.25, 0, 0.24, 0.36);
        playTone('triangle', 659.25, 659.25, 0, 0.18, 0.14);
        playTone('sine', 987.77, 987.77, 0.11, 0.45, 0.38);
        playTone('triangle', 987.77, 987.77, 0.11, 0.34, 0.14);
        break;
      }
    }

    return {
      durationMs,
      stop: () => {
        for (const fn of stopCallbacks) {
          fn();
        }
      },
    };
  }

  private async getCustomArrayBuffer(clipId: string): Promise<ArrayBuffer | null> {
    const cached = this.customBuffers.get(clipId);
    if (cached) return cached;

    let rec = this.customRecords.get(clipId);
    if (!rec) {
      const all = await this.loadAllDbRecords();
      for (const r of all) {
        if (r?.id) this.customRecords.set(r.id, r);
      }
      rec = this.customRecords.get(clipId);
    }

    if (!rec) return null;

    if (rec.blob) {
      try {
        const buf = await rec.blob.arrayBuffer();
        this.customBuffers.set(clipId, buf);
        return buf;
      } catch {
        // Fallback to dataUrl
      }
    }

    if (rec.dataUrl) {
      const buf = dataUrlToArrayBuffer(rec.dataUrl);
      if (buf) {
        this.customBuffers.set(clipId, buf);
        return buf;
      }
    }

    return null;
  }

  private async playAudioOnly(clip: SoundboardClip): Promise<void> {
    if (this.muted) return;

    const audio = await this.ensureAudioContext();
    if (!audio) {
      this.registerPlayback(clip.id, clip.durationMs || 600, () => {});
      return;
    }

    const { ctx, masterGain } = audio;
    const clipGain = ctx.createGain();
    clipGain.gain.value = clampVolume(clip.volume, 100) / 100;
    clipGain.connect(masterGain);

    if (clip.category === 'builtin') {
      const synth = this.synthesizeBuiltinClip(ctx, clipGain, clip.id);
      this.registerPlayback(clip.id, synth.durationMs, () => {
        synth.stop();
        try {
          clipGain.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      });
      return;
    }

    // Custom clip playback
    let decoded = this.decodedBuffers.get(clip.id);
    if (!decoded) {
      const rawBuf = await this.getCustomArrayBuffer(clip.id);
      if (rawBuf) {
        try {
          decoded = await ctx.decodeAudioData(rawBuf.slice(0));
          this.decodedBuffers.set(clip.id, decoded);
        } catch {
          decoded = undefined;
        }
      }
    }

    if (decoded) {
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(clipGain);
      const durMs = Math.max(200, Math.round(decoded.duration * 1000));
      src.start();
      this.registerPlayback(clip.id, durMs, () => {
        try {
          src.stop();
        } catch {
          // Ignore stop errors
        }
        try {
          src.disconnect();
          clipGain.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      });
      return;
    }

    // Fallback chime if uploaded blob was non-decodable in headless/test environment
    const fallbackSynth = this.synthesizeBuiltinClip(ctx, clipGain, 'builtin_discord_chime');
    this.registerPlayback(clip.id, clip.durationMs || fallbackSynth.durationMs, () => {
      fallbackSynth.stop();
      try {
        clipGain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    });
  }

  public async play(
    clipId: string,
    opts?: { localOnly?: boolean; senderName?: string }
  ): Promise<boolean> {
    await this.init();
    const clip = this.getSounds().find((c) => c.id === clipId);
    if (!clip) return false;

    const senderName = opts?.senderName || 'You';
    const evt: SoundboardPlayEvent = {
      id: `sb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clipId: clip.id,
      name: clip.name,
      emoji: clip.emoji,
      senderName,
      timestamp: Date.now(),
    };

    this.emitPlayEvent(evt);

    if (!opts?.localOnly && livekit.isConnected()) {
      livekit.broadcastSoundboardPlay(clip.id, clip.name, clip.emoji, senderName);
    }

    if (!this.muted) {
      await this.playAudioOnly(clip);
    }

    return true;
  }

  public stopAll(): void {
    const handles = Array.from(this.activePlaybacks.values());
    for (const handle of handles) {
      handle.stop();
    }
    this.activePlaybacks.clear();
    this.notify();
  }

  public async addCustomSound(
    file: File,
    meta: { name: string; emoji: string; hotkey?: string }
  ): Promise<SoundboardClip> {
    await this.init();

    const buffer = await file.arrayBuffer();
    const mimeType = file.type || 'audio/mpeg';
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    let durationMs = 1500;
    const audio = await this.ensureAudioContext();
    if (audio) {
      try {
        const decoded = await audio.ctx.decodeAudioData(buffer.slice(0));
        this.decodedBuffers.set(id, decoded);
        durationMs = Math.max(200, Math.round(decoded.duration * 1000));
      } catch {
        durationMs = 1500;
      }
    }

    const blob = new Blob([buffer], { type: mimeType });
    const dataUrl = buffer.byteLength <= 10 * 1024 * 1024 ? arrayBufferToDataUrl(buffer, mimeType) : undefined;
    const record: StoredAudioRecord = {
      id,
      blob,
      dataUrl,
      mimeType,
      createdAt: Date.now(),
    };

    this.customRecords.set(id, record);
    this.customBuffers.set(id, buffer);
    await this.putDbRecord(record);

    const clip: SoundboardClip = {
      id,
      name: meta.name.trim() || file.name.replace(/\.[^.]+$/, '') || 'Custom Sound',
      emoji: meta.emoji.trim() || '🎵',
      category: 'custom',
      volume: 100,
      favorite: false,
      hotkey: meta.hotkey?.trim() || undefined,
      durationMs,
      createdAt: Date.now(),
    };

    this.customClips = [...this.customClips, clip];
    this.saveMetaToStorage();
    this.notify();
    return { ...clip };
  }

  public async deleteCustomSound(clipId: string): Promise<void> {
    await this.init();

    for (const [token, handle] of this.activePlaybacks.entries()) {
      if (handle.clipId === clipId) {
        handle.stop();
        this.activePlaybacks.delete(token);
      }
    }

    this.customClips = this.customClips.filter((c) => c.id !== clipId);
    this.customRecords.delete(clipId);
    this.customBuffers.delete(clipId);
    this.decodedBuffers.delete(clipId);
    await this.deleteDbRecord(clipId);
    this.saveMetaToStorage();
    this.notify();
  }

  public toggleFavorite(clipId: string): void {
    const clip = this.getSounds().find((c) => c.id === clipId);
    if (!clip) return;
    this.updateSound(clipId, { favorite: !clip.favorite });
  }

  public updateSound(
    clipId: string,
    patch: Partial<Pick<SoundboardClip, 'name' | 'emoji' | 'volume' | 'hotkey' | 'favorite'>>
  ): void {
    const isBuiltin = BUILTIN_CLIPS.some((c) => c.id === clipId);
    const normalizedPatch = {
      ...patch,
      ...(patch.volume !== undefined ? { volume: clampVolume(patch.volume, 100) } : {}),
    };

    if (isBuiltin) {
      this.builtinOverrides[clipId] = {
        ...(this.builtinOverrides[clipId] || {}),
        ...normalizedPatch,
      };
    } else {
      const idx = this.customClips.findIndex((c) => c.id === clipId);
      if (idx < 0) return;
      this.customClips[idx] = {
        ...this.customClips[idx],
        ...normalizedPatch,
      };
    }

    this.saveMetaToStorage();
    this.notify();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public subscribePlayEvents(cb: (evt: SoundboardPlayEvent) => void): () => void {
    this.playEventListeners.add(cb);
    return () => {
      this.playEventListeners.delete(cb);
    };
  }
}

export const soundboardService = new SoundboardService();
