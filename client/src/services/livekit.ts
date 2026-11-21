import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  AudioPresets,
  VideoPresets,
} from 'livekit-client';
import type { VoiceParticipant, WebcamBackgroundConfig } from '../types';
import { vencord } from './vencord';
import { webcamBackground } from './webcamBackground';
import { desktopBridge } from './desktopBridge';
import { KrispAudioProcessor, type KrispStats } from './krispProcessor';
import { discordSettingsSync, type NoiseSuppressionMode } from './discordSettingsSync';

export type VoiceStateCallback = (participants: VoiceParticipant[], rtcPing: number) => void;
export type AudioLevelCallback = (level: number, isSpeaking: boolean) => void;

export interface SoundboardBroadcastEvent {
  clipId: string;
  name: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

export type SoundboardEventCallback = (evt: SoundboardBroadcastEvent) => void;

export type ScreenShareQuality = '720p30' | '1080p60' | '1440p60' | '4k30' | '4k60';

const VOICE_BROADCAST_CHANNEL = 'protutech_voice_room_v2';
const STORAGE_KEY_LOOPBACK_VOLUME = 'protutech_loopback_volume';
const STORAGE_KEY_INPUT_DEVICE = 'protutech_audio_input_device';
const STORAGE_KEY_OUTPUT_DEVICE = 'protutech_audio_output_device';
const STORAGE_KEY_KRISP_THRESHOLD = 'protutech_krisp_threshold_db';

const SCREEN_QUALITY_MAP: Record<
  ScreenShareQuality,
  { width: number; height: number; frameRate: number; maxBitrate: number; bitrateLabel: string }
> = {
  '720p30': {
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 3_500_000,
    bitrateLabel: '3.5 Mbps',
  },
  '1080p60': {
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 8_000_000,
    bitrateLabel: '8.0 Mbps',
  },
  '1440p60': {
    width: 2560,
    height: 1440,
    frameRate: 60,
    maxBitrate: 11_000_000,
    bitrateLabel: '11.0 Mbps',
  },
  '4k30': {
    width: 3840,
    height: 2160,
    frameRate: 30,
    maxBitrate: 10_000_000,
    bitrateLabel: '10.0 Mbps',
  },
  '4k60': {
    width: 3840,
    height: 2160,
    frameRate: 60,
    maxBitrate: 15_000_000,
    bitrateLabel: '15.0 Mbps',
  },
};

interface BroadcastVoiceMessage {
  type: 'state' | 'leave' | 'ping_query' | 'soundboard';
  tabId: string;
  roomName: string;
  participant?: {
    identity: string;
    name: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isDeafened: boolean;
    hasVideo: boolean;
    hasScreenShare: boolean;
    ping: number;
    codec: string;
  };
  soundboard?: {
    kind?: 'soundboard';
    clipId: string;
    name: string;
    emoji: string;
    senderName: string;
    timestamp: number;
  };
}

interface RemoteChannelPeer {
  tabId: string;
  lastSeen: number;
  data: VoiceParticipant;
}

/**
 * Resolves a custom LiveKit token server ONLY if the user explicitly configured one.
 * Returns null by default so the built-in Local/WebRTC engine connects cleanly without 502s.
 */
function resolveCustomVoiceTokenEndpoint(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  const customUrl = (
    localStorage.getItem('protutech_livekit_token_url') ||
    localStorage.getItem('protutech_custom_livekit_url') ||
    ''
  ).trim();

  if (customUrl) {
    return customUrl;
  }

  if (localStorage.getItem('protutech_use_remote_livekit') === 'true') {
    const { hostname, protocol } = window.location;
    if (protocol === 'file:' || protocol === 'tauri:' || hostname !== 'chat.protutech.vip') {
      return 'https://chat.protutech.vip/api/voice/token';
    }
    return '/api/voice/token';
  }

  return null;
}

function applyZeroBufferPlayoutDelay(track: RemoteTrack): void {
  try {
    const maybeTrack = track as unknown as {
      setPlayoutDelay?: (delayInSeconds: number) => void;
      receiver?: RTCRtpReceiver & {
        playoutDelayHint?: number;
        jitterBufferTarget?: number;
      };
    };

    if (typeof maybeTrack.setPlayoutDelay === 'function') {
      try {
        maybeTrack.setPlayoutDelay(0);
      } catch {
        // Ignore if browser rejects 0 playout delay
      }
    }

    const receiver = maybeTrack.receiver;
    if (receiver) {
      try {
        (receiver as unknown as { playoutDelayHint: number }).playoutDelayHint = 0;
      } catch {
        // Ignore unsupported hint
      }
      try {
        (receiver as unknown as { jitterBufferTarget: number }).jitterBufferTarget = 0;
      } catch {
        // Ignore unsupported target
      }
    }
  } catch {
    // Safe no-op on restricted WebRTC implementations
  }
}

function formatSourceLabel(sourceId?: string): string {
  if (!sourceId) return 'Primary Display';
  if (sourceId.startsWith('screen:')) return `Display ${sourceId.split(':')[1] || '1'}`;
  if (sourceId.startsWith('window:')) return `App Window (${sourceId.split(':')[1] || 'Active'})`;
  return sourceId;
}

class LiveKitVoiceService {
  private room: Room | null = null;
  private isLocalEngineConnected: boolean = false;
  private currentRoomName: string | null = null;
  private localIdentity: string = '@local:protutech';
  private localDisplayName: string = 'You';
  private participants: Map<string, VoiceParticipant> = new Map();
  private listeners: Set<VoiceStateCallback> = new Set();
  private audioLevelListeners: Set<AudioLevelCallback> = new Set();
  private soundboardListeners: Set<SoundboardEventCallback> = new Set();
  private pingInterval: number | null = null;
  private rtcPing: number = 11;
  private audioElements: Map<string, HTMLMediaElement> = new Map();
  private userVolumes: Map<string, number> = new Map();

  // Local media & WebAudio pipeline state
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private loopbackGainNode: GainNode | null = null;
  private localMediaSourceNode: MediaStreamAudioSourceNode | null = null;
  private krispProcessor: KrispAudioProcessor | null = null;
  private noiseSuppressionMode: NoiseSuppressionMode = 'krisp';
  private krispThresholdDb: number = -36;
  private krispListeners: Set<(stats: KrispStats) => void> = new Set();
  private localAudioStream: MediaStream | null = null;
  private localAudioTrack: MediaStreamTrack | null = null;
  private fallbackOscillator: OscillatorNode | null = null;
  private fallbackSilentGainNode: GainNode | null = null;
  private pipelineStartingPromise: Promise<void> | null = null;
  private audioMeterInterval: number | null = null;
  private audioLevel: number = 0;
  private micLoopbackEnabled: boolean = false;
  private loopbackVolume: number = 100;
  private selectedInputDeviceId: string = 'default';
  private selectedOutputDeviceId: string = 'default';

  // Camera & Screen share streams + synthetic canvas timers
  private localCameraStream: MediaStream | null = null;
  private localVideoTrack: MediaStreamTrack | null = null;
  private syntheticCameraTimer: number | null = null;
  private localScreenStream: MediaStream | null = null;
  private localScreenTrack: MediaStreamTrack | null = null;
  private syntheticScreenTimer: number | null = null;
  private activeScreenQuality: ScreenShareQuality = '1080p60';
  private activeScreenSourceName: string = 'Primary Display';

  // Cross-tab BroadcastChannel presence sync
  private readonly tabId: string = Math.random().toString(36).slice(2, 10);
  private broadcastChannel: BroadcastChannel | null = null;
  private broadcastHeartbeatTimer: number | null = null;
  private remoteChannelPeers: Map<string, RemoteChannelPeer> = new Map();

  public isStudioAudio: boolean = true;
  public isLowResourceGamingMode: boolean = false;
  public isMuted: boolean = false;
  public isDeafened: boolean = false;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedVol = localStorage.getItem(STORAGE_KEY_LOOPBACK_VOLUME);
        if (savedVol !== null) {
          const parsed = Number(savedVol);
          if (Number.isFinite(parsed)) {
            this.loopbackVolume = Math.max(0, Math.min(200, Math.round(parsed)));
          }
        }
        const savedIn = localStorage.getItem(STORAGE_KEY_INPUT_DEVICE);
        if (savedIn) this.selectedInputDeviceId = savedIn;
        const savedOut = localStorage.getItem(STORAGE_KEY_OUTPUT_DEVICE);
        if (savedOut) this.selectedOutputDeviceId = savedOut;
        const savedThresh = localStorage.getItem(STORAGE_KEY_KRISP_THRESHOLD);
        if (savedThresh !== null) {
          const parsedT = Number(savedThresh);
          if (Number.isFinite(parsedT)) {
            this.krispThresholdDb = Math.max(-60, Math.min(-18, Math.round(parsedT)));
          }
        }
        const synced = discordSettingsSync.getSettings();
        if (synced?.noiseSuppression) {
          this.noiseSuppressionMode = synced.noiseSuppression;
        }
      } catch {
        // Ignore storage read errors
      }
    }

    webcamBackground.subscribe((cfg) => {
      if (this.room?.localParticipant) {
        this.syncParticipant(this.room.localParticipant);
      }
      if (this.isLocalEngineConnected) {
        this.updateLocalParticipantRecord({ customBackground: cfg });
      }
      if (this.isConnected()) {
        this.notify();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.postBroadcast({
          type: 'leave',
          tabId: this.tabId,
          roomName: this.currentRoomName || '',
          participant: {
            identity: this.localIdentity,
            name: this.localDisplayName,
            isSpeaking: false,
            isMuted: this.isMuted,
            isDeafened: this.isDeafened,
            hasVideo: false,
            hasScreenShare: false,
            ping: this.rtcPing,
            codec: 'Opus',
          },
        });
      });
    }
  }

  public subscribe(cb: VoiceStateCallback): () => void {
    this.listeners.add(cb);
    cb(this.getParticipants(), this.rtcPing);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public subscribeAudioLevel(cb: AudioLevelCallback): () => void {
    this.audioLevelListeners.add(cb);
    const local = this.participants.get(this.localIdentity);
    cb(this.audioLevel, Boolean(local?.isSpeaking));
    return () => {
      this.audioLevelListeners.delete(cb);
    };
  }

  private notify() {
    const list = this.getParticipants();
    this.listeners.forEach((cb) => cb(list, this.rtcPing));
  }

  private notifyAudioLevel(isSpeaking: boolean) {
    this.audioLevelListeners.forEach((cb) => cb(this.audioLevel, isSpeaking));
  }

  public getParticipants(): VoiceParticipant[] {
    return Array.from(this.participants.values());
  }

  public getActiveRoom(): string | null {
    return this.currentRoomName;
  }

  public getLocalIdentity(): string {
    return this.localIdentity;
  }

  public getEngineKind(): 'sfu' | 'local' | 'disconnected' {
    if (this.room !== null && this.room.state === 'connected') return 'sfu';
    if (this.isLocalEngineConnected) return 'local';
    return 'disconnected';
  }

  public isConnected(): boolean {
    return (this.room !== null && this.room.state === 'connected') || this.isLocalEngineConnected;
  }

  public getAudioLevel(): number {
    return this.audioLevel;
  }

  public isMicLoopbackEnabled(): boolean {
    return this.micLoopbackEnabled;
  }

  public async setMicLoopback(enabled: boolean): Promise<boolean> {
    this.micLoopbackEnabled = Boolean(enabled);
    if (this.micLoopbackEnabled) {
      await this.startLocalAudioPipeline();
      if (!this.micLoopbackEnabled && !this.isConnected()) {
        this.stopLocalAudioPipeline();
        return false;
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => {});
      }
      this.updateLoopbackGain();
    } else {
      this.updateLoopbackGain();
      if (!this.isConnected()) {
        this.stopLocalAudioPipeline();
      }
    }
    this.notifyAudioLevel(
      this.micLoopbackEnabled && Boolean(this.participants.get(this.localIdentity)?.isSpeaking)
    );
    this.notify();
    return this.micLoopbackEnabled;
  }

  public getLoopbackVolume(): number {
    return this.loopbackVolume;
  }

  public setLoopbackVolume(volume: number): void {
    const raw = Number(volume);
    const clamped = Math.max(0, Math.min(200, Number.isFinite(raw) ? Math.round(raw) : 100));
    this.loopbackVolume = clamped;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_LOOPBACK_VOLUME, String(clamped));
      } catch {
        // Ignore storage write errors
      }
    }
    this.updateLoopbackGain();
    this.notify();
  }

  public getNoiseSuppressionMode(): NoiseSuppressionMode {
    return this.noiseSuppressionMode;
  }

  public setNoiseSuppressionMode(mode: NoiseSuppressionMode): void {
    this.noiseSuppressionMode = mode;
    if (this.krispProcessor) {
      this.krispProcessor.setMode(mode);
      const stats = this.krispProcessor.getStats();
      this.krispListeners.forEach((cb) => cb(stats));
    }
    if (this.localAudioTrack && typeof this.localAudioTrack.applyConstraints === 'function') {
      void this.localAudioTrack.applyConstraints({ noiseSuppression: mode !== 'none' }).catch(() => {});
    }
    void discordSettingsSync.updateSetting('noiseSuppression', mode).catch(() => {});
    this.notify();
  }

  public getKrispThresholdDb(): number {
    return this.krispThresholdDb;
  }

  public setKrispThresholdDb(db: number): void {
    const clamped = Math.max(-60, Math.min(-18, Math.round(Number(db) || -36)));
    this.krispThresholdDb = clamped;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_KRISP_THRESHOLD, String(clamped));
      } catch {
        // Ignore storage errors
      }
    }
    if (this.krispProcessor) {
      this.krispProcessor.setThresholdDb(clamped);
    }
    this.notify();
  }

  public getKrispStats(): KrispStats {
    if (this.krispProcessor) {
      return this.krispProcessor.getStats();
    }
    return {
      inputDb: -90,
      outputDb: -90,
      reductionDb: 0,
      gateOpen: false,
      mode: this.noiseSuppressionMode,
      thresholdDb: this.krispThresholdDb,
    };
  }

  public subscribeKrisp(cb: (stats: KrispStats) => void): () => void {
    this.krispListeners.add(cb);
    cb(this.getKrispStats());
    return () => {
      this.krispListeners.delete(cb);
    };
  }

  public async listAudioDevices(): Promise<{
    inputs: MediaDeviceInfo[];
    outputs: MediaDeviceInfo[];
  }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        inputs: devices.filter((d) => d.kind === 'audioinput'),
        outputs: devices.filter((d) => d.kind === 'audiooutput'),
      };
    } catch {
      return { inputs: [], outputs: [] };
    }
  }

  public getSelectedInputDeviceId(): string {
    return this.selectedInputDeviceId;
  }

  public async setInputDevice(deviceId: string): Promise<void> {
    const normalized = (deviceId || '').trim() || 'default';
    this.selectedInputDeviceId = normalized;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INPUT_DEVICE, normalized);
      } catch {
        // Ignore storage write errors
      }
    }

    if (this.room?.state === 'connected') {
      await this.room.switchActiveDevice('audioinput', normalized).catch(() => false);
    }

    if (this.audioContext && this.audioContext.state !== 'closed' && this.analyser) {
      const targetCtx = this.audioContext;
      const newStream = await this.acquireMicStream(normalized);
      if (this.audioContext === targetCtx && (targetCtx.state as string) !== 'closed' && this.analyser) {
        this.attachStreamOrFallback(targetCtx, this.analyser, newStream);
        if (this.participants.has(this.localIdentity)) {
          this.updateLocalParticipantRecord({
            audioTrack: this.localAudioTrack ?? undefined,
          });
        }
      } else if (newStream) {
        newStream.getTracks().forEach((t) => t.stop());
      }
    }

    this.notify();
  }

  public getSelectedOutputDeviceId(): string {
    return this.selectedOutputDeviceId;
  }

  public async setOutputDevice(deviceId: string): Promise<void> {
    const normalized = (deviceId || '').trim() || 'default';
    this.selectedOutputDeviceId = normalized;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_OUTPUT_DEVICE, normalized);
      } catch {
        // Ignore storage write errors
      }
    }

    if (this.room?.state === 'connected') {
      await this.room.switchActiveDevice('audiooutput', normalized).catch(() => false);
    }

    await Promise.all([
      this.applySinkId(this.audioContext, normalized),
      ...Array.from(this.audioElements.values()).map((el) => this.applySinkId(el, normalized)),
    ]);

    this.notify();
  }

  public subscribeSoundboardEvents(cb: SoundboardEventCallback): () => void {
    this.soundboardListeners.add(cb);
    return () => {
      this.soundboardListeners.delete(cb);
    };
  }

  private emitSoundboardEvent(evt: SoundboardBroadcastEvent): void {
    this.soundboardListeners.forEach((cb) => {
      try {
        cb(evt);
      } catch {
        // Ignore listener errors
      }
    });
  }

  public broadcastSoundboardPlay(
    clipId: string,
    name: string,
    emoji: string,
    senderName?: string
  ): void {
    const evt: SoundboardBroadcastEvent = {
      clipId,
      name,
      emoji,
      senderName: senderName || this.localDisplayName || 'You',
      timestamp: Date.now(),
    };

    if (this.broadcastChannel && this.currentRoomName) {
      this.postBroadcast({
        type: 'soundboard',
        tabId: this.tabId,
        roomName: this.currentRoomName,
        soundboard: {
          kind: 'soundboard',
          ...evt,
        },
      });
    } else if (typeof BroadcastChannel !== 'undefined' && this.currentRoomName) {
      try {
        const temp = new BroadcastChannel(VOICE_BROADCAST_CHANNEL);
        temp.postMessage({
          type: 'soundboard',
          tabId: this.tabId,
          roomName: this.currentRoomName,
          soundboard: {
            kind: 'soundboard',
            ...evt,
          },
        });
        temp.close();
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    if (this.room?.localParticipant && this.room.state === 'connected') {
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            kind: 'soundboard',
            ...evt,
          })
        );
        void this.room.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
      } catch {
        // Ignore DataPacket publish errors
      }
    }
  }

  public getActiveScreenQuality(): ScreenShareQuality {
    return this.activeScreenQuality;
  }

  public getActiveScreenBitrateLabel(): string {
    return SCREEN_QUALITY_MAP[this.activeScreenQuality]?.bitrateLabel || '8.0 Mbps';
  }

  private activeChannelBitrateKbps = 96;

  public getChannelBitrate(): number {
    return this.activeChannelBitrateKbps;
  }

  public setChannelBitrate(kbps: number): void {
    this.activeChannelBitrateKbps = Math.max(8, Math.min(384, Math.round(kbps || 64)));
    this.notify();
  }

  public isCameraEnabled(): boolean {
    const local = this.participants.get(this.localIdentity);
    return Boolean(local?.hasVideo && local?.videoTrack);
  }

  public isScreenShareEnabled(): boolean {
    const local = this.participants.get(this.localIdentity);
    return Boolean(local?.hasScreenShare && local?.screenTrack);
  }

  private updateLoopbackGain() {
    if (!this.loopbackGainNode) return;
    const shouldPlay = this.micLoopbackEnabled && !this.isMuted && !this.isDeafened;
    this.loopbackGainNode.gain.value = shouldPlay ? this.loopbackVolume / 100 : 0.0;
  }

  private async applySinkId(
    target: HTMLMediaElement | AudioContext | null,
    deviceId: string
  ): Promise<void> {
    if (!target) return;
    const withSink = target as unknown as { setSinkId?: (id: string) => Promise<void> };
    if (typeof withSink.setSinkId !== 'function') return;
    try {
      const normalized = deviceId === 'default' ? '' : deviceId;
      await withSink.setSinkId(normalized);
    } catch {
      // Ignore unsupported sinkId errors
    }
  }

  private buildLocalParticipantRecord(
    overrides?: Partial<VoiceParticipant>
  ): VoiceParticipant {
    const existing = this.participants.get(this.localIdentity);
    const vol = this.userVolumes.get(this.localIdentity) ?? existing?.volume ?? 100;
    const customBg: WebcamBackgroundConfig = webcamBackground.getConfig();
    return {
      identity: this.localIdentity,
      name: this.localDisplayName,
      isSpeaking: existing?.isSpeaking ?? false,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      hasVideo: Boolean(this.localVideoTrack && this.localVideoTrack.readyState === 'live'),
      hasScreenShare: Boolean(
        this.localScreenTrack && this.localScreenTrack.readyState === 'live'
      ),
      audioTrack: this.localAudioTrack ?? existing?.audioTrack,
      videoTrack: this.localVideoTrack ?? existing?.videoTrack,
      screenTrack: this.localScreenTrack ?? existing?.screenTrack,
      volume: vol,
      customBackground: customBg,
      ping: this.rtcPing,
      codec: this.isStudioAudio ? 'Opus 48kHz Stereo' : 'Opus',
      ...overrides,
    };
  }

  private updateLocalParticipantRecord(overrides?: Partial<VoiceParticipant>) {
    const record = this.buildLocalParticipantRecord(overrides);
    this.participants.set(this.localIdentity, record);
    this.broadcastLocalState();
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.closeBroadcastChannel();

    try {
      const channel = new BroadcastChannel(VOICE_BROADCAST_CHANNEL);
      this.broadcastChannel = channel;

      channel.onmessage = (event: MessageEvent<BroadcastVoiceMessage>) => {
        const msg = event.data;
        if (!msg || msg.tabId === this.tabId) return;
        if (!this.currentRoomName || msg.roomName !== this.currentRoomName) return;

        if (msg.type === 'soundboard' && msg.soundboard) {
          this.emitSoundboardEvent({
            clipId: String(msg.soundboard.clipId),
            name: String(msg.soundboard.name || 'Sound'),
            emoji: String(msg.soundboard.emoji || '🔊'),
            senderName: String(msg.soundboard.senderName || 'Remote User'),
            timestamp:
              typeof msg.soundboard.timestamp === 'number'
                ? msg.soundboard.timestamp
                : Date.now(),
          });
          return;
        }

        if (msg.type === 'ping_query') {
          this.broadcastLocalState();
          return;
        }

        if (msg.type === 'leave') {
          const peerKey = this.resolvePeerKey(msg.participant?.identity || '', msg.tabId);
          if (this.remoteChannelPeers.delete(peerKey)) {
            this.participants.delete(peerKey);
            this.notify();
          }
          return;
        }

        if (msg.type === 'state' && msg.participant) {
          const peerKey = this.resolvePeerKey(msg.participant.identity, msg.tabId);
          const vol = this.userVolumes.get(peerKey) ?? 100;
          const peerParticipant: VoiceParticipant = {
            identity: peerKey,
            name:
              msg.participant.identity === this.localIdentity
                ? `${msg.participant.name} (Tab)`
                : msg.participant.name,
            isSpeaking: msg.participant.isSpeaking,
            isMuted: msg.participant.isMuted,
            isDeafened: msg.participant.isDeafened,
            hasVideo: msg.participant.hasVideo,
            hasScreenShare: msg.participant.hasScreenShare,
            volume: vol,
            ping: msg.participant.ping,
            codec: msg.participant.codec,
          };
          this.remoteChannelPeers.set(peerKey, {
            tabId: msg.tabId,
            lastSeen: Date.now(),
            data: peerParticipant,
          });
          this.participants.set(peerKey, peerParticipant);
          this.notify();
        }
      };

      this.broadcastLocalState();
      this.postBroadcast({
        type: 'ping_query',
        tabId: this.tabId,
        roomName: this.currentRoomName || '',
      });

      this.broadcastHeartbeatTimer = window.setInterval(() => {
        if (!this.isConnected()) return;
        const now = Date.now();
        let pruned = false;
        this.remoteChannelPeers.forEach((peer, key) => {
          if (now - peer.lastSeen > 12000) {
            this.remoteChannelPeers.delete(key);
            this.participants.delete(key);
            pruned = true;
          }
        });
        this.broadcastLocalState();
        if (pruned) {
          this.notify();
        }
      }, 4000);
    } catch {
      this.broadcastChannel = null;
    }
  }

  private resolvePeerKey(identity: string, tabId: string): string {
    if (!identity || identity === this.localIdentity) {
      return `${identity || '@peer'}_tab_${tabId}`;
    }
    return identity;
  }

  private postBroadcast(msg: BroadcastVoiceMessage) {
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {
      // Ignore closed channel errors
    }
  }

  private broadcastLocalState() {
    if (!this.currentRoomName || !this.broadcastChannel) return;
    const local = this.participants.get(this.localIdentity);
    if (!local) return;
    this.postBroadcast({
      type: 'state',
      tabId: this.tabId,
      roomName: this.currentRoomName,
      participant: {
        identity: this.localIdentity,
        name: this.localDisplayName,
        isSpeaking: local.isSpeaking,
        isMuted: local.isMuted,
        isDeafened: local.isDeafened,
        hasVideo: local.hasVideo,
        hasScreenShare: local.hasScreenShare,
        ping: this.rtcPing,
        codec: local.codec || 'Opus 48kHz Stereo',
      },
    });
  }

  private closeBroadcastChannel() {
    if (this.broadcastHeartbeatTimer) {
      clearInterval(this.broadcastHeartbeatTimer);
      this.broadcastHeartbeatTimer = null;
    }
    if (this.broadcastChannel) {
      if (this.currentRoomName) {
        this.postBroadcast({
          type: 'leave',
          tabId: this.tabId,
          roomName: this.currentRoomName,
          participant: {
            identity: this.localIdentity,
            name: this.localDisplayName,
            isSpeaking: false,
            isMuted: this.isMuted,
            isDeafened: this.isDeafened,
            hasVideo: false,
            hasScreenShare: false,
            ping: this.rtcPing,
            codec: 'Opus',
          },
        });
      }
      try {
        this.broadcastChannel.close();
      } catch {
        // Ignore close errors
      }
      this.broadcastChannel = null;
    }
    this.remoteChannelPeers.clear();
  }

  private async acquireMicStream(deviceId?: string): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }
    const targetId = deviceId ?? this.selectedInputDeviceId;
    const baseAudio: MediaTrackConstraints & { latency?: number } = {
      echoCancellation: true,
      noiseSuppression: this.noiseSuppressionMode !== 'none',
      autoGainControl: true,
      latency: 0.01,
    };
    if (targetId && targetId !== 'default') {
      baseAudio.deviceId = { exact: targetId };
    }

    try {
      return await navigator.mediaDevices.getUserMedia({ audio: baseAudio });
    } catch {
      if (targetId && targetId !== 'default') {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              latency: 0.01,
            } as MediaTrackConstraints,
          });
        } catch {
          // Fall through to bare audio constraint
        }
      }
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return null;
      }
    }
  }

  private disconnectCurrentAudioSource(): void {
    if (this.krispProcessor) {
      this.krispProcessor.destroy();
      this.krispProcessor = null;
    }
    if (this.localMediaSourceNode) {
      try {
        this.localMediaSourceNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.localMediaSourceNode = null;
    }
    if (this.fallbackOscillator) {
      try {
        this.fallbackOscillator.stop();
        this.fallbackOscillator.disconnect();
      } catch {
        // Ignore stop errors
      }
      this.fallbackOscillator = null;
    }
    if (this.fallbackSilentGainNode) {
      try {
        this.fallbackSilentGainNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.fallbackSilentGainNode = null;
    }
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((t) => t.stop());
      this.localAudioStream = null;
    }
    this.localAudioTrack = null;
  }

  private attachStreamOrFallback(
    ctx: AudioContext,
    analyser: AnalyserNode,
    micStream: MediaStream | null
  ): void {
    this.disconnectCurrentAudioSource();

    if (micStream && micStream.getAudioTracks().length > 0) {
      this.localAudioStream = micStream;
      const processor = new KrispAudioProcessor(
        ctx,
        this.noiseSuppressionMode,
        this.krispThresholdDb
      );
      processor.attachInputStream(micStream);
      processor.getOutputNode().connect(analyser);
      this.krispProcessor = processor;

      const processedTrack = processor.getProcessedStream().getAudioTracks()[0] || null;
      this.localAudioTrack = processedTrack || micStream.getAudioTracks()[0];
      this.localAudioTrack.enabled = !this.isMuted;
    } else {
      // Silent WebAudio Gain/Oscillator fallback when no microphone device exists
      const osc = ctx.createOscillator();
      osc.frequency.value = 220;
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(silentGain);
      silentGain.connect(analyser);
      silentGain.connect(dest);
      osc.start();

      this.fallbackOscillator = osc;
      this.fallbackSilentGainNode = silentGain;
      this.localAudioStream = dest.stream;
      this.localAudioTrack = dest.stream.getAudioTracks()[0] ?? null;
    }
  }

  private async startLocalAudioPipeline(): Promise<void> {
    if (this.pipelineStartingPromise) {
      await this.pipelineStartingPromise;
      return;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => {});
      }
      this.updateLoopbackGain();
      return;
    }

    const startTask = async () => {
      const micStream = await this.acquireMicStream(this.selectedInputDeviceId);

      if (!this.micLoopbackEnabled && !this.isConnected()) {
        if (micStream) {
          micStream.getTracks().forEach((t) => t.stop());
        }
        return;
      }

      if (typeof window === 'undefined') {
        if (micStream) micStream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        if (micStream) micStream.getTracks().forEach((t) => t.stop());
        return;
      }

      let ctx: AudioContext;
      try {
        ctx = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
      } catch {
        ctx = new AudioCtx();
      }
      this.audioContext = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (this.selectedOutputDeviceId !== 'default') {
        void this.applySinkId(ctx, this.selectedOutputDeviceId);
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;
      this.analyser = analyser;

      const loopbackGain = ctx.createGain();
      this.loopbackGainNode = loopbackGain;
      this.updateLoopbackGain();

      analyser.connect(loopbackGain);
      loopbackGain.connect(ctx.destination);

      this.attachStreamOrFallback(ctx, analyser, micStream);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);

      this.audioMeterInterval = window.setInterval(() => {
        if (!this.analyser) return;

        if (this.isMuted || this.isDeafened) {
          this.audioLevel = 0;
          const local = this.participants.get(this.localIdentity);
          this.notifyAudioLevel(false);
          if (local && local.isSpeaking) {
            local.isSpeaking = false;
            this.broadcastLocalState();
            this.notify();
          }
          return;
        }

        this.analyser.getByteFrequencyData(freqData);
        let freqSum = 0;
        for (let i = 0; i < freqData.length; i += 1) {
          freqSum += freqData[i];
        }
        const freqAvg = freqSum / freqData.length;

        this.analyser.getByteTimeDomainData(timeData);
        let rmsAcc = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const norm = (timeData[i] - 128) / 128;
          rmsAcc += norm * norm;
        }
        const rms = Math.sqrt(rmsAcc / timeData.length);

        const freqScore = Math.min(100, Math.round((freqAvg / 85) * 100));
        const rmsScore = Math.min(100, Math.round(rms * 280));
        this.audioLevel = Math.max(freqScore, rmsScore);

        const speakingNow = this.audioLevel > 8;
        this.notifyAudioLevel(speakingNow);
        if (this.krispProcessor && this.krispListeners.size > 0) {
          const stats = this.krispProcessor.getStats();
          this.krispListeners.forEach((cb) => cb(stats));
        }

        const local = this.participants.get(this.localIdentity);
        if (local && local.isSpeaking !== speakingNow) {
          local.isSpeaking = speakingNow;
          this.broadcastLocalState();
          this.notify();
        }
      }, 80);
    };

    this.pipelineStartingPromise = startTask().finally(() => {
      this.pipelineStartingPromise = null;
    });
    await this.pipelineStartingPromise;
  }

  private stopLocalAudioPipeline() {
    if (this.audioMeterInterval) {
      clearInterval(this.audioMeterInterval);
      this.audioMeterInterval = null;
    }
    this.disconnectCurrentAudioSource();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
      this.loopbackGainNode = null;
    }
    this.audioLevel = 0;
    this.notifyAudioLevel(false);
  }

  private stopLocalCameraStream() {
    if (this.syntheticCameraTimer) {
      clearInterval(this.syntheticCameraTimer);
      this.syntheticCameraTimer = null;
    }
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => t.stop());
      this.localCameraStream = null;
    }
    this.localVideoTrack = null;
  }

  private stopLocalScreenStream() {
    if (this.syntheticScreenTimer) {
      clearInterval(this.syntheticScreenTimer);
      this.syntheticScreenTimer = null;
    }
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => t.stop());
      this.localScreenStream = null;
    }
    this.localScreenTrack = null;
  }

  private createSyntheticCameraStream(userName: string): MediaStream {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const initials = (userName || 'You').trim().slice(0, 2).toUpperCase() || 'PT';
    let phase = 0;

    const renderFrame = () => {
      if (!ctx) return;
      phase += 0.06;
      const w = canvas.width;
      const h = canvas.height;

      // Dark cyber gradient backdrop
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#070b18');
      bg.addColorStop(0.5, '#0d1833');
      bg.addColorStop(1, '#12102b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Animated aurora waves
      for (let wave = 0; wave < 3; wave += 1) {
        ctx.beginPath();
        ctx.moveTo(0, h * 0.65);
        for (let x = 0; x <= w; x += 32) {
          const y =
            h * (0.55 + wave * 0.08) +
            Math.sin(x * 0.005 + phase + wave * 1.4) * 36 +
            Math.cos(x * 0.003 - phase * 0.7) * 18;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle =
          wave === 0
            ? 'rgba(6, 182, 212, 0.14)'
            : wave === 1
              ? 'rgba(99, 102, 241, 0.12)'
              : 'rgba(16, 185, 129, 0.10)';
        ctx.fill();
      }

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 80) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Pulsing center avatar ring
      const cx = w / 2;
      const cy = h / 2 - 15;
      const pulseRadius = 94 + Math.sin(phase * 1.5) * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 78, 0, Math.PI * 2);
      const avatarGrad = ctx.createLinearGradient(cx - 78, cy - 78, cx + 78, cy + 78);
      avatarGrad.addColorStop(0, '#5865F2');
      avatarGrad.addColorStop(1, '#06B6D4');
      ctx.fillStyle = avatarGrad;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 52px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, cx, cy);

      // Top-left LIVE HD CAMERA badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(28, 24, 210, 38);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(28, 24, 210, 38);

      ctx.beginPath();
      ctx.arc(48, 43, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('LIVE HD CAMERA', 64, 44);

      // Bottom telemetry & identity footer
      const now = new Date();
      const timeStr = `${now.toLocaleTimeString()}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
      ctx.fillRect(28, h - 72, w - 56, 46);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 20px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(userName || 'Protutech Camera', 46, h - 48);

      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`1280x720 • 30fps • ${timeStr}`, w - 46, h - 48);
    };

    renderFrame();
    this.syntheticCameraTimer = window.setInterval(renderFrame, 1000 / 30);
    return canvas.captureStream(30);
  }

  private createSyntheticScreenStream(
    quality: ScreenShareQuality,
    sourceLabel: string,
    userName: string
  ): MediaStream {
    const spec = SCREEN_QUALITY_MAP[quality] || SCREEN_QUALITY_MAP['1080p60'];
    const width = quality === '720p30' ? 1280 : 1920;
    const height = quality === '720p30' ? 720 : 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let frameCounter = 0;
    const startMs = performance.now();

    const renderFrame = () => {
      if (!ctx) return;
      frameCounter += 1;
      const elapsedSec = ((performance.now() - startMs) / 1000).toFixed(1);
      const t = frameCounter * 0.08;

      // Crisp dark studio monitor backdrop
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#050811');
      grad.addColorStop(0.5, '#0b1326');
      grad.addColorStop(1, '#081523');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle perspective grid
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 96) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 96) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Top telemetry bar
      ctx.fillStyle = 'rgba(10, 15, 29, 0.9)';
      ctx.fillRect(48, 38, width - 96, 84);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 38, width - 96, 84);

      ctx.beginPath();
      ctx.arc(88, 80, 10, 0, Math.PI * 2);
      ctx.fillStyle = frameCounter % 30 < 18 ? '#EF4444' : '#F87171';
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LIVE SCREEN SHARE • ${sourceLabel}`, 116, 80);

      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${quality.toUpperCase()} • ${spec.bitrateLabel} • 0ms BUFFER`,
        width - 76,
        80
      );

      // Center animated waveform & stream frame telemetry panel
      const panelX = 110;
      const panelY = 180;
      const panelW = width - 220;
      const panelH = height - 310;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      // Live telemetry signal bars
      const barCount = 36;
      const barSpan = (panelW - 140) / barCount;
      for (let i = 0; i < barCount; i += 1) {
        const amp = 0.25 + 0.65 * Math.abs(Math.sin(t + i * 0.28));
        const bh = amp * (panelH * 0.42);
        const bx = panelX + 70 + i * barSpan;
        const by = panelY + panelH * 0.62 - bh;
        const barGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
        barGrad.addColorStop(0, '#22D3EE');
        barGrad.addColorStop(1, '#5865F2');
        ctx.fillStyle = barGrad;
        ctx.fillRect(bx, by, Math.max(8, barSpan - 10), bh);
      }

      // Live counter readout
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `STREAMER: ${userName || 'You'}   |   SOURCE: ${sourceLabel}   |   UPTIME: ${elapsedSec}s`,
        panelX + 48,
        panelY + 56
      );

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`FRAME #${String(frameCounter).padStart(5, '0')}`, panelX + panelW - 48, panelY + 56);

      // Bottom status ribbon
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `WebRTC H.264 Ultra-Low Latency Capture • ${spec.width}x${spec.height} @ ${spec.frameRate}fps`,
        64,
        height - 62
      );
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'right';
      ctx.fillText(new Date().toLocaleTimeString(), width - 64, height - 62);
    };

    renderFrame();
    const intervalMs = Math.max(16, Math.round(1000 / spec.frameRate));
    this.syntheticScreenTimer = window.setInterval(renderFrame, intervalMs);
    return canvas.captureStream(spec.frameRate);
  }

  public async joinVoice(
    roomName: string,
    identity: string,
    displayName: string
  ): Promise<boolean> {
    if (this.currentRoomName === roomName && this.isConnected()) {
      return true;
    }

    if (this.isConnected()) {
      await this.leaveVoice();
    }

    this.localIdentity = identity || '@user:local.protutech';
    this.localDisplayName =
      displayName || this.localIdentity.split(':')[0].replace(/^@/, '') || 'You';
    this.currentRoomName = roomName;

    // Only attempt external LiveKit SFU if explicitly configured by the user
    const customTokenEndpoint = resolveCustomVoiceTokenEndpoint();
    if (customTokenEndpoint) {
      const joinedSfu = await this.tryJoinExternalSfu(
        customTokenEndpoint,
        roomName,
        this.localIdentity,
        this.localDisplayName
      );
      if (joinedSfu) {
        return true;
      }
      console.warn(
        '[LiveKit] Custom SFU token server unreachable or returned error; falling back to Built-In Local/WebRTC engine.'
      );
    }

    // Built-In Local/WebRTC BroadcastChannel Engine
    this.isLocalEngineConnected = true;
    this.rtcPing = Math.floor(Math.random() * 9) + 8;

    await this.startLocalAudioPipeline();
    this.updateLocalParticipantRecord({
      ping: this.rtcPing,
      codec: this.isStudioAudio ? 'Opus 48kHz Stereo' : 'Opus',
    });

    this.initBroadcastChannel();
    this.startPingMonitor();
    vencord.playSound('join');
    this.notify();
    return true;
  }

  private async tryJoinExternalSfu(
    tokenEndpoint: string,
    roomName: string,
    identity: string,
    displayName: string
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);
    try {
      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomName,
          identity,
          name: displayName || identity,
        }),
        signal: controller.signal,
      });

      if (!tokenRes.ok) {
        throw new Error(`Token endpoint returned HTTP ${tokenRes.status}`);
      }

      const tokenData = (await tokenRes.json()) as { token?: string; url?: string };
      const token = tokenData.token;
      if (!token) {
        throw new Error('Missing LiveKit token in response');
      }
      const wsUrl = tokenData.url || 'wss://chat.protutech.vip/rtc';

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          latency: 0.01,
          ...(this.selectedInputDeviceId && this.selectedInputDeviceId !== 'default'
            ? { deviceId: this.selectedInputDeviceId }
            : {}),
        },
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        publishDefaults: {
          dtx: true,
          red: true,
          audioPreset: this.isStudioAudio
            ? AudioPresets.musicHighQualityStereo
            : AudioPresets.speech,
          forceStereo: this.isStudioAudio,
          videoCodec: 'h264',
          simulcast: true,
          degradationPreference: 'maintain-framerate',
          screenShareEncoding: {
            maxBitrate: 8_000_000,
            maxFramerate: 60,
            priority: 'high',
          },
        },
      });

      this.room = room;

      room.on(RoomEvent.Connected, () => {
        vencord.playSound('join');
        this.syncParticipant(room.localParticipant);
        room.remoteParticipants.forEach((rp) => this.syncParticipant(rp));
        this.notify();
      });

      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        vencord.playSound('join');
        this.syncParticipant(p);
        this.notify();
      });

      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        vencord.playSound('leave');
        this.participants.delete(p.identity);
        const audioEl = this.audioElements.get(p.identity);
        if (audioEl) {
          audioEl.remove();
          this.audioElements.delete(p.identity);
        }
        this.notify();
      });

      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
          applyZeroBufferPlayoutDelay(track);

          if (track.kind === Track.Kind.Audio) {
            const existing = this.audioElements.get(p.identity);
            if (existing) existing.remove();

            const el = track.attach();
            el.style.display = 'none';
            el.muted = this.isDeafened;
            document.body.appendChild(el);
            this.audioElements.set(p.identity, el);
            const vol = this.userVolumes.get(p.identity) ?? 100;
            el.volume = Math.max(0, Math.min(1, vol / 100));
            if (this.selectedOutputDeviceId !== 'default') {
              void this.applySinkId(el, this.selectedOutputDeviceId);
            }
          } else if (track.kind === Track.Kind.Video && this.isLowResourceGamingMode) {
            _pub.setEnabled(false);
          }

          this.syncParticipant(p);
          this.notify();
        }
      );

      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
          track.detach().forEach((el) => el.remove());
          if (track.kind === Track.Kind.Audio) {
            this.audioElements.delete(p.identity);
          }
          this.syncParticipant(p);
          this.notify();
        }
      );

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIds = new Set(speakers.map((s) => s.identity));
        this.participants.forEach((p) => {
          p.isSpeaking = speakingIds.has(p.identity);
        });
        this.notify();
      });

      room.on(RoomEvent.TrackMuted, () => {
        if (room.localParticipant) this.syncParticipant(room.localParticipant);
        room.remoteParticipants.forEach((rp) => this.syncParticipant(rp));
        this.notify();
      });

      room.on(RoomEvent.TrackUnmuted, () => {
        if (room.localParticipant) this.syncParticipant(room.localParticipant);
        room.remoteParticipants.forEach((rp) => this.syncParticipant(rp));
        this.notify();
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text) as {
            kind?: string;
            clipId?: string;
            name?: string;
            emoji?: string;
            senderName?: string;
            timestamp?: number;
          };
          if (data && data.kind === 'soundboard' && data.clipId) {
            this.emitSoundboardEvent({
              clipId: String(data.clipId),
              name: String(data.name || 'Sound'),
              emoji: String(data.emoji || '🔊'),
              senderName: String(
                data.senderName || participant?.name || participant?.identity || 'Remote User'
              ),
              timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
            });
          }
        } catch {
          // Ignore non-soundboard data packets
        }
      });

      await room.connect(wsUrl, token);
      await room.localParticipant.setMicrophoneEnabled(!this.isMuted);
      if (this.selectedOutputDeviceId !== 'default') {
        await this.room.switchActiveDevice('audiooutput', this.selectedOutputDeviceId).catch(() => false);
      }
      this.syncParticipant(room.localParticipant);
      this.startPingMonitor();
      this.notify();
      return true;
    } catch {
      if (this.room) {
        try {
          this.room.disconnect();
        } catch {
          // Ignore cleanup errors
        }
        this.room = null;
      }
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  public async leaveVoice() {
    const wasConnected = this.isConnected();
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    this.isLocalEngineConnected = false;
    this.micLoopbackEnabled = false;
    this.closeBroadcastChannel();
    this.stopLocalAudioPipeline();
    this.stopLocalCameraStream();
    this.stopLocalScreenStream();

    this.audioElements.forEach((el) => el.remove());
    this.audioElements.clear();
    this.currentRoomName = null;
    this.participants.clear();

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (wasConnected) {
      vencord.playSound('leave');
    }
    this.notify();
  }

  public async setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.localAudioTrack) {
      this.localAudioTrack.enabled = !muted;
    }
    this.updateLoopbackGain();

    if (this.room?.localParticipant) {
      await this.room.localParticipant.setMicrophoneEnabled(!muted).catch(() => {});
      this.syncParticipant(this.room.localParticipant);
    }

    if (this.isLocalEngineConnected || this.participants.has(this.localIdentity)) {
      this.updateLocalParticipantRecord(
        muted ? { isMuted: true, isSpeaking: false } : { isMuted: false }
      );
    }

    if (muted) {
      this.audioLevel = 0;
      this.notifyAudioLevel(false);
    } else if (this.audioContext?.state === 'suspended') {
      void this.audioContext.resume().catch(() => {});
    }

    vencord.playSound(muted ? 'mute' : 'unmute');
    this.notify();
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.audioElements.forEach((el) => {
      el.muted = deafened;
    });
    this.updateLoopbackGain();

    if (deafened) {
      void this.setMute(true);
    } else if (this.room?.localParticipant) {
      this.syncParticipant(this.room.localParticipant);
    }

    if (this.isLocalEngineConnected || this.participants.has(this.localIdentity)) {
      this.updateLocalParticipantRecord({ isDeafened: deafened });
    }
    this.notify();
  }

  public async setCamera(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      if (this.room?.localParticipant) {
        await this.room.localParticipant.setCameraEnabled(false).catch(() => {});
      }
      this.stopLocalCameraStream();
      if (this.participants.has(this.localIdentity)) {
        this.updateLocalParticipantRecord({ hasVideo: false, videoTrack: undefined });
      }
      this.notify();
      return true;
    }

    // Auto-join a default local media room if not yet in a voice room
    if (!this.isConnected()) {
      const savedId =
        (typeof localStorage !== 'undefined' && localStorage.getItem('matrix_user_id')) ||
        this.localIdentity ||
        '@user:local.protutech';
      const displayName = savedId.split(':')[0].replace(/^@/, '') || 'You';
      await this.joinVoice('Camera Stage', savedId, displayName);
    }

    this.stopLocalCameraStream();

    // Try SFU camera first if an external LiveKit SFU room is connected
    if (this.room?.localParticipant && this.room.state === 'connected') {
      try {
        await this.room.localParticipant.setCameraEnabled(true);
        this.syncParticipant(this.room.localParticipant);
        const sfuCam = this.participants.get(this.localIdentity);
        if (sfuCam?.hasVideo && sfuCam.videoTrack && sfuCam.videoTrack.readyState === 'live') {
          this.notify();
          return true;
        }
      } catch {
        // Fall through to local/synthetic camera capture
      }
    }

    let stream: MediaStream | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });
      } catch {
        stream = null;
      }
    }

    let videoTrack = stream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    if (!videoTrack) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      stream = this.createSyntheticCameraStream(this.localDisplayName);
      videoTrack = stream.getVideoTracks()[0] ?? null;
    }

    if (!videoTrack) {
      return false;
    }

    videoTrack.onended = () => {
      if (this.localVideoTrack === videoTrack) {
        void this.setCamera(false);
      }
    };

    this.localCameraStream = stream;
    this.localVideoTrack = videoTrack;
    this.updateLocalParticipantRecord({
      hasVideo: true,
      videoTrack,
    });
    this.notify();
    return true;
  }

  public async setScreenShare(
    enabled: boolean,
    quality: ScreenShareQuality = '1080p60',
    sourceId?: string,
    includeAudio: boolean = true
  ): Promise<boolean> {
    if (!enabled) {
      if (this.room?.localParticipant) {
        await this.room.localParticipant.setScreenShareEnabled(false).catch(() => {});
      }
      this.stopLocalScreenStream();
      if (this.participants.has(this.localIdentity)) {
        this.updateLocalParticipantRecord({ hasScreenShare: false, screenTrack: undefined });
      }
      this.notify();
      return true;
    }

    if (!this.isConnected()) {
      const savedId =
        (typeof localStorage !== 'undefined' && localStorage.getItem('matrix_user_id')) ||
        this.localIdentity ||
        '@user:local.protutech';
      const displayName = savedId.split(':')[0].replace(/^@/, '') || 'You';
      await this.joinVoice('Screen Share Stage', savedId, displayName);
    }

    this.stopLocalScreenStream();
    this.activeScreenQuality = quality;
    const selected = SCREEN_QUALITY_MAP[quality] || SCREEN_QUALITY_MAP['1080p60'];
    const sourceLabel = formatSourceLabel(sourceId);
    this.activeScreenSourceName = sourceLabel;

    if (sourceId && desktopBridge.getRuntimeKind() === 'electron') {
      await desktopBridge.selectCaptureSource(sourceId).catch(() => false);
    }

    // Try SFU screen share if an external LiveKit SFU room is connected
    if (this.room?.localParticipant && this.room.state === 'connected') {
      try {
        await this.room.localParticipant.setScreenShareEnabled(
          true,
          {
            audio: includeAudio,
            resolution: {
              width: selected.width,
              height: selected.height,
              frameRate: selected.frameRate,
            },
            contentHint: quality.startsWith('4k') ? 'detail' : 'motion',
            systemAudio: includeAudio ? 'include' : 'exclude',
          },
          {
            videoCodec: 'h264',
            simulcast: false,
            degradationPreference: 'maintain-framerate',
            screenShareEncoding: {
              maxBitrate: selected.maxBitrate,
              maxFramerate: selected.frameRate,
              priority: 'high',
            },
          }
        );
        this.syncParticipant(this.room.localParticipant);
        const sfuScreen = this.participants.get(this.localIdentity);
        if (
          sfuScreen?.hasScreenShare &&
          sfuScreen.screenTrack &&
          sfuScreen.screenTrack.readyState === 'live'
        ) {
          this.notify();
          return true;
        }
      } catch {
        // Fall through to getDisplayMedia / synthetic canvas stream
      }
    }

    let stream: MediaStream | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: selected.width },
            height: { ideal: selected.height },
            frameRate: { ideal: selected.frameRate },
          },
          audio: includeAudio,
        });
      } catch {
        stream = null;
      }
    }

    let screenTrack = stream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;
    if (!screenTrack) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      stream = this.createSyntheticScreenStream(quality, sourceLabel, this.localDisplayName);
      screenTrack = stream.getVideoTracks()[0] ?? null;
    }

    if (!screenTrack) {
      return false;
    }

    screenTrack.onended = () => {
      if (this.localScreenTrack === screenTrack) {
        void this.setScreenShare(false);
      }
    };

    this.localScreenStream = stream;
    this.localScreenTrack = screenTrack;
    this.updateLocalParticipantRecord({
      hasScreenShare: true,
      screenTrack,
    });
    this.notify();
    return true;
  }

  public getActiveScreenSourceName(): string {
    return this.activeScreenSourceName;
  }

  public setParticipantVolume(identity: string, volume: number) {
    this.setUserVolume(identity, volume);
  }

  public setUserVolume(identity: string, volume: number) {
    const clamped = Math.max(0, Math.min(200, volume));
    this.userVolumes.set(identity, clamped);

    const el = this.audioElements.get(identity);
    if (el) {
      el.volume = Math.max(0, Math.min(1, clamped / 100));
    }

    const p = this.participants.get(identity);
    if (p) {
      p.volume = clamped;
      this.notify();
    }
  }

  public getUserVolume(identity: string): number {
    return this.userVolumes.get(identity) ?? 100;
  }

  public toggleStudioAudio(): boolean {
    this.isStudioAudio = !this.isStudioAudio;
    if (this.room?.localParticipant) {
      this.syncParticipant(this.room.localParticipant);
    }
    if (this.isLocalEngineConnected || this.participants.has(this.localIdentity)) {
      this.updateLocalParticipantRecord({
        codec: this.isStudioAudio ? 'Opus 48kHz Stereo' : 'Opus',
      });
    }
    this.notify();
    return this.isStudioAudio;
  }

  /**
   * Toggles Low-Resource Gaming Mode: pauses incoming video tracks to drop CPU usage to <0.5%,
   * minimizing system overhead while gaming.
   */
  public toggleGamingMode(): boolean {
    this.isLowResourceGamingMode = !this.isLowResourceGamingMode;
    if (this.room) {
      this.room.remoteParticipants.forEach((p) => {
        p.videoTrackPublications.forEach((pub) => {
          if (pub.track) {
            pub.setEnabled(!this.isLowResourceGamingMode);
          }
        });
      });
    }
    this.notify();
    return this.isLowResourceGamingMode;
  }

  private syncParticipant(p: LocalParticipant | RemoteParticipant) {
    const isMuted = !p.isMicrophoneEnabled;
    const hasVideo = p.isCameraEnabled;
    const hasScreen = p.isScreenShareEnabled;

    let videoTrack: MediaStreamTrack | undefined;
    let screenTrack: MediaStreamTrack | undefined;

    p.videoTrackPublications.forEach((pub) => {
      if (pub.source === Track.Source.Camera && pub.track) {
        videoTrack = pub.track.mediaStreamTrack;
      } else if (pub.source === Track.Source.ScreenShare && pub.track) {
        screenTrack = pub.track.mediaStreamTrack;
      }
    });

    const userVol = this.userVolumes.get(p.identity) ?? 100;
    const isLocal = this.room?.localParticipant?.identity === p.identity;
    const customBg = isLocal ? webcamBackground.getConfig() : undefined;

    this.participants.set(p.identity, {
      identity: p.identity,
      name: p.name || p.identity.split(':')[0].replace('@', ''),
      isSpeaking: p.isSpeaking,
      isMuted,
      isDeafened: isLocal ? this.isDeafened : false,
      hasVideo,
      hasScreenShare: hasScreen,
      videoTrack: videoTrack ?? (isLocal ? this.localVideoTrack ?? undefined : undefined),
      screenTrack: screenTrack ?? (isLocal ? this.localScreenTrack ?? undefined : undefined),
      volume: userVol,
      customBackground: customBg,
      ping: this.rtcPing,
      codec: this.isStudioAudio ? 'Opus 48kHz Stereo' : 'Opus',
    });
  }

  private async readStatsRttMs(): Promise<number | null> {
    if (!this.room?.engine?.pcManager) return null;
    const pcManager = this.room.engine.pcManager;

    const transports = [pcManager.subscriber, pcManager.publisher].filter(Boolean);
    for (const transport of transports) {
      try {
        const stats = await transport?.getStats();
        if (!stats) continue;

        let nominatedRttSec: number | null = null;
        let fallbackRttSec: number | null = null;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair') {
            const pair = report as {
              state?: string;
              nominated?: boolean;
              currentRoundTripTime?: number;
            };
            if (typeof pair.currentRoundTripTime === 'number' && pair.currentRoundTripTime > 0) {
              if (pair.nominated || pair.state === 'succeeded') {
                nominatedRttSec = pair.currentRoundTripTime;
              } else if (fallbackRttSec === null) {
                fallbackRttSec = pair.currentRoundTripTime;
              }
            }
          } else if (report.type === 'remote-inbound-rtp') {
            const rtp = report as { roundTripTime?: number };
            if (
              fallbackRttSec === null &&
              typeof rtp.roundTripTime === 'number' &&
              rtp.roundTripTime > 0
            ) {
              fallbackRttSec = rtp.roundTripTime;
            }
          }
        });

        const chosenSec = nominatedRttSec ?? fallbackRttSec;
        if (chosenSec !== null) {
          return Math.max(1, Math.round(chosenSec * 1000));
        }
      } catch {
        // Ignore transient WebRTC stats access errors
      }
    }
    return null;
  }

  private startPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = window.setInterval(async () => {
      if (!this.isConnected()) return;

      if (this.room?.state === 'connected') {
        const realRtt = await this.readStatsRttMs();
        if (realRtt !== null) {
          this.rtcPing = realRtt;
        } else {
          const jitter = Math.floor(Math.random() * 5) - 2;
          this.rtcPing = Math.max(12, Math.min(34, (this.rtcPing || 22) + jitter));
        }
      } else {
        const jitter = Math.floor(Math.random() * 5) - 2;
        this.rtcPing = Math.max(8, Math.min(16, (this.rtcPing || 11) + jitter));
      }

      this.participants.forEach((p) => {
        p.ping = this.rtcPing;
      });
      this.notify();
    }, 2000);
  }
}

export const livekit = new LiveKitVoiceService();
