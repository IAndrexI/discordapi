import type { NoiseSuppressionMode } from './discordSettingsSync';

export interface KrispStats {
  inputDb: number;
  outputDb: number;
  reductionDb: number;
  gateOpen: boolean;
  mode: NoiseSuppressionMode;
  thresholdDb: number;
}

const MIN_DB = -90;

function rmsToDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  if (rms <= 0.00003) return MIN_DB;
  return Math.max(MIN_DB, Math.min(0, 20 * Math.log10(rms)));
}

/**
 * Real-time Web Audio DSP noise suppression processor ("Krisp" / "Standard" / "Off").
 * Applies:
 *   1. Sub-bass & rumble High-Pass filter (110 Hz in Krisp, 80 Hz in Standard)
 *   2. Ultrasonic hiss Low-Pass filter (7.5 kHz in Krisp, 12 kHz in Standard)
 *   3. Vocal presence EQ (+2.5 dB @ 2.8 kHz in Krisp)
 *   4. Adaptive Noise Gate / Expander (-60 dB floor attenuation when below threshold)
 *   5. Dynamics Compressor for consistent speech levels
 */
export class KrispAudioProcessor {
  private ctx: AudioContext;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPass: BiquadFilterNode;
  private lowPass: BiquadFilterNode;
  private presenceEq: BiquadFilterNode;
  private preAnalyser: AnalyserNode;
  private gateGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private postAnalyser: AnalyserNode;
  private destination: MediaStreamAudioDestinationNode;

  private mode: NoiseSuppressionMode = 'krisp';
  private thresholdDb: number = -36;
  private adaptiveFloorDb: number = -62;
  private gateOpen: boolean = false;
  private lastAboveThresholdAt: number = 0;
  private holdMs: number = 220;
  private processTimer: number | null = null;
  private preBuf: Float32Array<ArrayBuffer>;
  private postBuf: Float32Array<ArrayBuffer>;

  private stats: KrispStats = {
    inputDb: MIN_DB,
    outputDb: MIN_DB,
    reductionDb: 0,
    gateOpen: false,
    mode: 'krisp',
    thresholdDb: -36,
  };

  constructor(ctx: AudioContext, initialMode: NoiseSuppressionMode = 'krisp', initialThresholdDb = -36) {
    this.ctx = ctx;
    this.mode = initialMode;
    this.thresholdDb = Math.max(-60, Math.min(-18, initialThresholdDb));

    this.highPass = ctx.createBiquadFilter();
    this.highPass.type = 'highpass';

    this.lowPass = ctx.createBiquadFilter();
    this.lowPass.type = 'lowpass';

    this.presenceEq = ctx.createBiquadFilter();
    this.presenceEq.type = 'peaking';
    this.presenceEq.frequency.value = 2800;
    this.presenceEq.Q.value = 1.1;

    this.preAnalyser = ctx.createAnalyser();
    this.preAnalyser.fftSize = 256;
    this.preBuf = new Float32Array(new ArrayBuffer(this.preAnalyser.fftSize * 4));

    this.gateGain = ctx.createGain();
    this.gateGain.gain.value = 1;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;

    this.postAnalyser = ctx.createAnalyser();
    this.postAnalyser.fftSize = 256;
    this.postBuf = new Float32Array(new ArrayBuffer(this.postAnalyser.fftSize * 4));

    this.destination = ctx.createMediaStreamDestination();

    // Wire DSP chain
    this.highPass.connect(this.lowPass);
    this.lowPass.connect(this.presenceEq);
    this.presenceEq.connect(this.preAnalyser);
    this.preAnalyser.connect(this.gateGain);
    this.gateGain.connect(this.compressor);
    this.compressor.connect(this.postAnalyser);
    this.postAnalyser.connect(this.destination);

    this.applyModeParams();
    this.startGateLoop();
  }

  public attachInputStream(stream: MediaStream): void {
    this.detachInputStream();
    if (!stream || stream.getAudioTracks().length === 0) return;
    this.sourceNode = this.ctx.createMediaStreamSource(stream);
    this.sourceNode.connect(this.highPass);
  }

  public detachInputStream(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.sourceNode = null;
    }
  }

  public getProcessedStream(): MediaStream {
    return this.destination.stream;
  }

  public getOutputNode(): AudioNode {
    return this.postAnalyser;
  }

  public setMode(mode: NoiseSuppressionMode): void {
    this.mode = mode;
    this.applyModeParams();
  }

  public setThresholdDb(db: number): void {
    this.thresholdDb = Math.max(-60, Math.min(-18, Math.round(db)));
    this.stats.thresholdDb = this.thresholdDb;
  }

  public getStats(): KrispStats {
    return { ...this.stats };
  }

  private applyModeParams(): void {
    const now = this.ctx.currentTime;
    if (this.mode === 'krisp') {
      this.highPass.frequency.setTargetAtTime(110, now, 0.02);
      this.lowPass.frequency.setTargetAtTime(7500, now, 0.02);
      this.presenceEq.gain.setTargetAtTime(2.5, now, 0.02);
      this.compressor.ratio.setTargetAtTime(3.5, now, 0.02);
    } else if (this.mode === 'standard') {
      this.highPass.frequency.setTargetAtTime(80, now, 0.02);
      this.lowPass.frequency.setTargetAtTime(12000, now, 0.02);
      this.presenceEq.gain.setTargetAtTime(0, now, 0.02);
      this.compressor.ratio.setTargetAtTime(2, now, 0.02);
    } else {
      // 'none' — transparent bypass
      this.highPass.frequency.setTargetAtTime(10, now, 0.02);
      this.lowPass.frequency.setTargetAtTime(22000, now, 0.02);
      this.presenceEq.gain.setTargetAtTime(0, now, 0.02);
      this.compressor.ratio.setTargetAtTime(1, now, 0.02);
      this.gateGain.gain.setTargetAtTime(1.0, now, 0.01);
      this.gateOpen = true;
    }
    this.stats.mode = this.mode;
    this.stats.thresholdDb = this.thresholdDb;
  }

  private startGateLoop(): void {
    if (this.processTimer !== null) return;
    this.processTimer = window.setInterval(() => {
      if (this.ctx.state === 'closed') {
        this.destroy();
        return;
      }
      this.preAnalyser.getFloatTimeDomainData(this.preBuf);
      this.postAnalyser.getFloatTimeDomainData(this.postBuf);

      const inputDb = rmsToDb(this.preBuf);
      const outputDb = rmsToDb(this.postBuf);
      const nowMs = performance.now();
      const nowAudio = this.ctx.currentTime;

      if (this.mode === 'none') {
        this.gateOpen = true;
        this.stats = {
          inputDb,
          outputDb,
          reductionDb: 0,
          gateOpen: true,
          mode: this.mode,
          thresholdDb: this.thresholdDb,
        };
        return;
      }

      // Track slow ambient noise floor when below threshold
      if (inputDb < this.thresholdDb) {
        this.adaptiveFloorDb = this.adaptiveFloorDb * 0.96 + inputDb * 0.04;
      }
      const effectiveThreshold =
        this.mode === 'krisp'
          ? Math.max(this.thresholdDb, this.adaptiveFloorDb + 7)
          : this.thresholdDb - 6;

      if (inputDb >= effectiveThreshold) {
        this.lastAboveThresholdAt = nowMs;
        if (!this.gateOpen) {
          this.gateOpen = true;
          this.gateGain.gain.setTargetAtTime(1.0, nowAudio, 0.005); // 5ms fast attack
        }
      } else if (nowMs - this.lastAboveThresholdAt > this.holdMs) {
        if (this.gateOpen) {
          this.gateOpen = false;
          // Attenuate background noise to -60 dB (0.001 gain) in Krisp, -26 dB (0.05) in Standard
          const closedGain = this.mode === 'krisp' ? 0.001 : 0.05;
          this.gateGain.gain.setTargetAtTime(closedGain, nowAudio, 0.06); // smooth release
        }
      }

      const reductionDb = Math.max(0, Math.round(inputDb - outputDb));
      this.stats = {
        inputDb: Math.round(inputDb),
        outputDb: Math.round(outputDb),
        reductionDb,
        gateOpen: this.gateOpen,
        mode: this.mode,
        thresholdDb: this.thresholdDb,
      };
    }, 30);
  }

  public destroy(): void {
    if (this.processTimer !== null) {
      window.clearInterval(this.processTimer);
      this.processTimer = null;
    }
    this.detachInputStream();
    try {
      this.highPass.disconnect();
      this.lowPass.disconnect();
      this.presenceEq.disconnect();
      this.preAnalyser.disconnect();
      this.gateGain.disconnect();
      this.compressor.disconnect();
      this.postAnalyser.disconnect();
      this.destination.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  }
}
