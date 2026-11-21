import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FlipHorizontal,
  Plus,
  Sliders,
  Sparkles,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import {
  WEBCAM_PRESETS,
  webcamBackground,
  type WebcamPreset,
} from '../services/webcamBackground';
import type { WebcamBackgroundConfig } from '../types';

export interface CameraPreviewPanelProps {
  compact?: boolean;
  autoStart?: boolean;
  showCameraActions?: boolean;
  onTurnOnCamera?: () => void;
}

interface StreamMeta {
  width: number;
  height: number;
  fps: number;
}

const SUBJECT_ISOLATION_MASK: React.CSSProperties = {
  maskImage:
    'radial-gradient(ellipse 46% 68% at 50% 58%, rgba(0,0,0,1) 44%, rgba(0,0,0,0.88) 60%, rgba(0,0,0,0) 84%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 46% 68% at 50% 58%, rgba(0,0,0,1) 44%, rgba(0,0,0,0.88) 60%, rgba(0,0,0,0) 84%)',
};

const BLUR_SUBJECT_MASK: React.CSSProperties = {
  maskImage:
    'radial-gradient(ellipse 52% 72% at 50% 56%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.85) 68%, rgba(0,0,0,0) 92%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 52% 72% at 50% 56%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.85) 68%, rgba(0,0,0,0) 92%)',
};

export const CameraPreviewPanel: React.FC<CameraPreviewPanelProps> = ({
  compact = false,
  autoStart = false,
  showCameraActions = false,
  onTurnOnCamera,
}) => {
  const [config, setConfig] = useState<WebcamBackgroundConfig>(() =>
    webcamBackground.getConfig()
  );
  const [customUploads, setCustomUploads] = useState<string[]>(() =>
    webcamBackground.getCustomUploads()
  );
  const [blurAmount, setBlurAmount] = useState<number>(
    () => webcamBackground.getConfig().blurAmount ?? 14
  );
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() =>
    webcamBackground.getCameraDeviceId()
  );
  const [mirrorPreview, setMirrorPreview] = useState<boolean>(() =>
    webcamBackground.getMirrorPreview()
  );
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [streamMeta, setStreamMeta] = useState<StreamMeta>({
    width: 1280,
    height: 720,
    fps: 30,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const selectedDeviceIdRef = useRef<string>(selectedDeviceId);
  const mountedRef = useRef<boolean>(true);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  const stopStreamTracks = (stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Ignore track stop errors
      }
    });
  };

  const stopPreview = useCallback(() => {
    requestSeqRef.current += 1;
    if (activeStreamRef.current) {
      stopStreamTracks(activeStreamRef.current);
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (blurVideoRef.current) {
      blurVideoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setPreviewStream(null);
      setIsStarting(false);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    const list = await webcamBackground.listVideoDevices();
    if (!mountedRef.current) return;
    const seen = new Set<string>();
    const deduped = list.filter((d) => {
      if (!d.deviceId || d.deviceId === 'default' || seen.has(d.deviceId)) {
        return false;
      }
      seen.add(d.deviceId);
      return true;
    });
    setDevices(deduped);
  }, []);

  const startPreview = useCallback(async (deviceOverride?: string) => {
    const targetDevice =
      deviceOverride !== undefined ? deviceOverride : selectedDeviceIdRef.current;
    const seq = ++requestSeqRef.current;

    if (activeStreamRef.current) {
      stopStreamTracks(activeStreamRef.current);
      activeStreamRef.current = null;
      if (mountedRef.current) {
        setPreviewStream(null);
      }
    }

    if (mountedRef.current) {
      setIsStarting(true);
    }
    try {
      const stream = await webcamBackground.acquireCameraPreviewStream(targetDevice);
      if (!mountedRef.current || seq !== requestSeqRef.current) {
        stopStreamTracks(stream);
        return;
      }

      activeStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getSettings === 'function') {
        const settings = track.getSettings();
        setStreamMeta({
          width: settings.width || 1280,
          height: settings.height || 720,
          fps: settings.frameRate ? Math.round(settings.frameRate) : 30,
        });
      }

      setPreviewStream(stream);
      setIsStarting(false);
      void refreshDevices();
    } catch {
      if (mountedRef.current && seq === requestSeqRef.current) {
        setIsStarting(false);
      }
    }
  }, [refreshDevices]);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = webcamBackground.subscribe((nextCfg) => {
      setConfig(nextCfg);
      if (typeof nextCfg.blurAmount === 'number') {
        setBlurAmount(nextCfg.blurAmount);
      }
      setCustomUploads(webcamBackground.getCustomUploads());
    });

    void refreshDevices();

    const mediaDevices =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    const handleDeviceChange = () => {
      void refreshDevices();
    };
    mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      mountedRef.current = false;
      unsub();
      mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      requestSeqRef.current += 1;
      if (activeStreamRef.current) {
        stopStreamTracks(activeStreamRef.current);
        activeStreamRef.current = null;
      }
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (autoStart) {
      void startPreview();
    }
  }, [autoStart, startPreview]);

  useEffect(() => {
    const attach = (el: HTMLVideoElement | null) => {
      if (!el) return;
      if (el.srcObject !== previewStream) {
        el.srcObject = previewStream;
      }
      if (previewStream) {
        el.play().catch(() => {});
      }
    };
    attach(videoRef.current);
    attach(blurVideoRef.current);
  }, [previewStream, config.type]);

  const handleTogglePreview = () => {
    if (previewStream || isStarting) {
      stopPreview();
    } else {
      void startPreview();
    }
  };

  const handleDeviceChange = (nextDeviceId: string) => {
    setSelectedDeviceId(nextDeviceId);
    webcamBackground.setCameraDeviceId(nextDeviceId);
    if (previewStream || isStarting) {
      void startPreview(nextDeviceId);
    }
  };

  const handleToggleMirror = () => {
    const next = !mirrorPreview;
    setMirrorPreview(next);
    webcamBackground.setMirrorPreview(next);
  };

  const handleSelectNone = () => {
    webcamBackground.removeBackground();
  };

  const handleSelectBlur = (amount: number) => {
    setBlurAmount(amount);
    webcamBackground.setBlur(amount);
  };

  const handleSelectPreset = (preset: WebcamPreset) => {
    webcamBackground.setPreset(preset.id);
  };

  const handleSelectCustom = (url: string) => {
    webcamBackground.setCustomImage(url);
  };

  const handleDeleteCustom = (
    e: React.MouseEvent<HTMLButtonElement>,
    url: string
  ) => {
    e.stopPropagation();
    webcamBackground.deleteCustomUpload(url);
    setCustomUploads(webcamBackground.getCustomUploads());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        webcamBackground.setCustomImage(result);
        setCustomUploads(webcamBackground.getCustomUploads());
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTurnOnCameraClick = () => {
    if (!onTurnOnCamera) return;
    stopPreview();
    onTurnOnCamera();
  };

  const activeBgUrl = webcamBackground.resolveBackgroundUrl(config);
  const activeBgName = webcamBackground.getBackgroundDisplayName(config);
  const isPreviewRunning = Boolean(previewStream);
  const isStudioFxActive = config.type !== 'none';

  return (
    <div
      data-testid="camera-preview-panel"
      className={`rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-normal)] ${
        compact ? 'p-2.5 space-y-1.5' : 'p-3 space-y-2'
      }`}
    >
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <label
            htmlFor="camera-preview-device-select"
            className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0"
          >
            Camera
          </label>
          <select
            id="camera-preview-device-select"
            data-testid="camera-device-select"
            value={selectedDeviceId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="flex-1 min-w-0 bg-[var(--bg-popout)] border border-[var(--border-subtle)] hover:border-[var(--text-muted)]/40 focus:border-[var(--discord-blurple)] rounded px-2.5 py-1.5 text-xs text-[var(--text-normal)] outline-none transition-colors cursor-pointer"
          >
            <option value="">Default Camera (Auto)</option>
            {devices.map((device, idx) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="camera-mirror-toggle-btn"
            aria-label={mirrorPreview ? 'Mirror Preview: On' : 'Mirror Preview: Off'}
            aria-pressed={mirrorPreview}
            title={mirrorPreview ? 'Mirror Preview: On' : 'Mirror Preview: Off'}
            onClick={handleToggleMirror}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              mirrorPreview
                ? 'bg-[var(--discord-blurple)]/20 border-[var(--discord-blurple)] text-[var(--text-header)]'
                : 'bg-[var(--bg-popout)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>{compact ? 'Mirror' : 'Mirror Preview'}</span>
          </button>

          <button
            type="button"
            data-testid="camera-preview-toggle-btn"
            aria-label={isPreviewRunning || isStarting ? 'Stop Preview' : 'Test Video'}
            aria-pressed={isPreviewRunning}
            onClick={handleTogglePreview}
            className={`px-3 py-1.5 rounded text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
              isPreviewRunning || isStarting
                ? 'bg-[var(--status-dnd)] hover:opacity-90'
                : 'bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)]'
            }`}
          >
            {isPreviewRunning || isStarting ? (
              <>
                <VideoOff className="w-3.5 h-3.5" />
                <span>Stop Preview</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>Test Video</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live 16:9 Camera Preview Stage */}
      <div
        data-testid="camera-preview-stage"
        className={`relative aspect-video mx-auto rounded-lg bg-[var(--bg-popout)] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shadow-inner ${
          compact ? 'w-full max-w-[300px] max-h-[168px]' : 'w-full max-w-[360px] max-h-[195px]'
        }`}
      >
        {isPreviewRunning ? (
          <>
            {/* Background FX Layer */}
            {config.type === 'blur' && (
              <video
                ref={blurVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none ${
                  mirrorPreview ? 'scale-x-[-1]' : ''
                }`}
                style={{ filter: `blur(${blurAmount}px)` }}
              />
            )}

            {(config.type === 'preset' || config.type === 'custom') &&
              activeBgUrl && (
                <>
                  <img
                    src={activeBgUrl}
                    alt={activeBgName}
                    className="absolute inset-0 w-full h-full object-cover scale-[1.03] pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20 pointer-events-none" />
                </>
              )}

            {/* Primary Live Camera Feed */}
            <video
              ref={videoRef}
              data-testid="camera-preview-video"
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth > 0 && v.videoHeight > 0) {
                  setStreamMeta((prev) => ({
                    ...prev,
                    width: v.videoWidth,
                    height: v.videoHeight,
                  }));
                }
              }}
              style={
                config.type === 'blur'
                  ? BLUR_SUBJECT_MASK
                  : config.type === 'preset' || config.type === 'custom'
                    ? SUBJECT_ISOLATION_MASK
                    : undefined
              }
              className={`relative z-10 w-full h-full object-cover transition-transform duration-150 ${
                mirrorPreview ? 'scale-x-[-1]' : 'scale-x-100'
              } ${
                isStudioFxActive
                  ? 'drop-shadow-[0_10px_28px_rgba(0,0,0,0.75)]'
                  : ''
              }`}
            />

            {/* Top-left Live Badges */}
            <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none">
              <span className="px-2 py-0.5 rounded bg-[var(--bg-popout)]/85 border border-[var(--border-subtle)] text-[10px] font-mono font-semibold text-[var(--text-normal)] flex items-center gap-1.5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)] animate-pulse" />
                <span>
                  {streamMeta.width}×{streamMeta.height} • {streamMeta.fps} FPS
                </span>
              </span>

              {isStudioFxActive && (
                <span className="px-2 py-0.5 rounded bg-[var(--discord-blurple)] text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>FX</span>
                </span>
              )}

              <span className="px-2 py-0.5 rounded bg-[var(--bg-channels)]/90 border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-muted)]">
                {activeBgName}
              </span>
            </div>

            {/* Bottom-right Mirror indicator */}
            {mirrorPreview && (
              <div className="absolute bottom-2.5 right-2.5 z-20 px-2 py-0.5 rounded bg-[var(--bg-popout)]/80 border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-muted)] pointer-events-none">
                Mirrored
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-4 gap-2.5">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[var(--text-header)]">
                {isStarting
                  ? 'Starting camera preview...'
                  : 'Preview paused — click Test Video'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Background:{' '}
                <span className="text-[var(--text-normal)] font-medium">{activeBgName}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Blur Intensity Slider when Blur is active */}
      {config.type === 'blur' && (
        <div
          data-testid="camera-blur-slider-box"
          className="p-3 rounded-lg bg-[var(--bg-popout)] border border-[var(--border-subtle)] space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-header)] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
              <span>Blur Intensity</span>
            </span>
            <span className="font-mono font-bold text-[var(--text-link)] text-[11px]">
              {blurAmount}px
            </span>
          </div>
          <input
            type="range"
            min={6}
            max={30}
            step={2}
            value={blurAmount}
            aria-label="Blur Intensity"
            data-testid="camera-blur-slider"
            onChange={(e) => handleSelectBlur(Number(e.target.value))}
            className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
          />
        </div>
      )}

      {/* Video Backgrounds Tile Grid */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Backgrounds
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-medium">
            {activeBgName}
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          data-testid="camera-bg-upload-input"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {/* None Tile */}
          <button
            type="button"
            data-testid="bg-tile-none"
            aria-label="No background"
            aria-pressed={config.type === 'none'}
            onClick={handleSelectNone}
            className={`relative ${compact ? 'h-9' : 'h-10'} rounded-md border flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden ${
              config.type === 'none'
                ? 'border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/60 bg-[var(--discord-blurple)]/15 text-[var(--text-header)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-channels)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
            }`}
          >
            <span className="text-xs font-bold leading-none">∅</span>
            <span className="text-[9px] font-semibold">None</span>
            {config.type === 'none' && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--discord-blurple)] text-white flex items-center justify-center">
                <Check className="w-2 h-2" />
              </span>
            )}
          </button>

          {/* Blur Tile */}
          <button
            type="button"
            data-testid="bg-tile-blur"
            aria-label="Blur background"
            aria-pressed={config.type === 'blur'}
            onClick={() => handleSelectBlur(blurAmount)}
            className={`relative ${compact ? 'h-9' : 'h-10'} rounded-md border flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden ${
              config.type === 'blur'
                ? 'border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/60 bg-[var(--discord-blurple)]/20 text-[var(--text-header)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-channels)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
            }`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[var(--discord-blurple)] to-cyan-400 flex items-center justify-center">
              <Sliders className="w-2 h-2 text-white" />
            </div>
            <span className="text-[9px] font-semibold">Blur</span>
            {config.type === 'blur' && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--discord-blurple)] text-white flex items-center justify-center">
                <Check className="w-2 h-2" />
              </span>
            )}
          </button>

          {/* + Add Image Tile */}
          <button
            type="button"
            data-testid="bg-tile-add-image"
            aria-label="Add custom background image"
            onClick={() => fileInputRef.current?.click()}
            className={`${compact ? 'h-9' : 'h-10'} rounded-md border border-dashed border-[var(--border-subtle)] hover:border-[var(--discord-blurple)] bg-[var(--bg-channels)] hover:bg-[var(--discord-blurple)]/10 text-[var(--text-muted)] hover:text-[var(--text-header)] flex flex-col items-center justify-center transition-colors cursor-pointer`}
          >
            <Plus className="w-3.5 h-3.5 text-[var(--text-link)]" />
            <span className="text-[9px] font-semibold">Add Image</span>
          </button>

          {/* Custom Uploaded Background Tiles */}
          {customUploads.map((imgUrl, idx) => {
            const isActive =
              config.type === 'custom' && config.customUrl === imgUrl;
            return (
              <div
                key={`${idx}-${imgUrl.slice(0, 24)}`}
                role="button"
                tabIndex={0}
                aria-label={`Custom background ${idx + 1}`}
                aria-pressed={isActive}
                onClick={() => handleSelectCustom(imgUrl)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectCustom(imgUrl);
                  }
                }}
                className={`relative ${compact ? 'h-9' : 'h-10'} rounded-md border overflow-hidden cursor-pointer group transition-all ${
                  isActive
                    ? 'border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/60'
                    : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]/50'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Custom background ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1 py-0.2">
                  <span className="block text-[9px] font-semibold text-white truncate">
                    Custom {idx + 1}
                  </span>
                </div>
                {isActive && (
                  <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-[var(--discord-blurple)] text-white flex items-center justify-center shadow">
                    <Check className="w-2 h-2" />
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Delete custom background"
                  title="Remove custom background"
                  onClick={(e) => handleDeleteCustom(e, imgUrl)}
                  className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--bg-popout)]/90 hover:bg-[var(--status-dnd)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity cursor-pointer"
                >
                  <X className="w-2 h-2" />
                </button>
              </div>
            );
          })}

          {/* Built-In Virtual Background Preset Tiles */}
          {WEBCAM_PRESETS.map((preset) => {
            const isActive =
              config.type === 'preset' && config.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`bg-tile-${preset.id}`}
                aria-label={preset.name}
                aria-pressed={isActive}
                onClick={() => handleSelectPreset(preset)}
                className={`relative ${compact ? 'h-9' : 'h-10'} rounded-md border overflow-hidden cursor-pointer group transition-all text-left ${
                  isActive
                    ? 'border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/60'
                    : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]/50'
                }`}
              >
                <img
                  src={preset.previewUrl}
                  alt={preset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-1 py-0.2">
                  <span className="block text-[9px] font-semibold text-white truncate">
                    {preset.name}
                  </span>
                </div>
                {isActive && (
                  <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--discord-blurple)] text-white flex items-center justify-center shadow">
                    <Check className="w-2 h-2" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional In-Call Camera Action */}
      {showCameraActions && onTurnOnCamera && (
        <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-end">
          <button
            type="button"
            data-testid="turn-on-camera-in-call-btn"
            aria-label="Turn On Camera in Call"
            onClick={handleTurnOnCameraClick}
            className="px-3.5 py-1.5 rounded bg-[var(--status-online)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-opacity cursor-pointer shadow-sm"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Turn On Camera in Call</span>
          </button>
        </div>
      )}
    </div>
  );
};
