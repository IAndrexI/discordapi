import React, { useEffect, useRef, useState } from 'react';
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
  const mountedRef = useRef<boolean>(true);
  const requestSeqRef = useRef<number>(0);

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

  const stopPreview = () => {
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
  };

  const refreshDevices = async () => {
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
  };

  const startPreview = async (deviceOverride?: string) => {
    const targetDevice =
      deviceOverride !== undefined ? deviceOverride : selectedDeviceId;
    const seq = ++requestSeqRef.current;

    if (activeStreamRef.current) {
      stopStreamTracks(activeStreamRef.current);
      activeStreamRef.current = null;
      setPreviewStream(null);
    }

    setIsStarting(true);
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
  };

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
  }, []);

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
      className={`rounded-lg bg-[#2b2d31] border border-[#1e1f22] text-[#dbdee1] ${
        compact ? 'p-3 space-y-3' : 'p-4 space-y-4'
      }`}
    >
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex-1 min-w-[180px]">
          <label
            htmlFor="camera-preview-device-select"
            className="block text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] mb-1.5"
          >
            Camera
          </label>
          <select
            id="camera-preview-device-select"
            data-testid="camera-device-select"
            value={selectedDeviceId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="w-full bg-[#1e1f22] border border-[#111214] hover:border-[#3f4147] focus:border-[#5865f2] rounded px-3 py-2 text-xs text-[#dbdee1] outline-none transition-colors cursor-pointer"
          >
            <option value="">Default Camera (Auto)</option>
            {devices.map((device, idx) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="camera-mirror-toggle-btn"
            aria-pressed={mirrorPreview}
            title={mirrorPreview ? 'Mirror Preview: On' : 'Mirror Preview: Off'}
            onClick={handleToggleMirror}
            className={`px-3 py-2 rounded text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              mirrorPreview
                ? 'bg-[#5865f2]/20 border-[#5865f2] text-white'
                : 'bg-[#1e1f22] border-[#3f4147] text-[#b5bac1] hover:text-white hover:border-[#4e5058]'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>{compact ? 'Mirror' : 'Mirror Preview'}</span>
          </button>

          <button
            type="button"
            data-testid="camera-preview-toggle-btn"
            onClick={handleTogglePreview}
            className={`px-4 py-2 rounded text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
              isPreviewRunning || isStarting
                ? 'bg-[#da373c] hover:bg-[#b62b30]'
                : 'bg-[#5865f2] hover:bg-[#4752c4]'
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
        className="relative aspect-video w-full rounded-lg bg-[#111214] border border-[#1e1f22] overflow-hidden flex items-center justify-center shadow-inner"
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
              <span className="px-2 py-0.5 rounded bg-[#111214]/85 border border-white/10 text-[10px] font-mono font-semibold text-[#dbdee1] flex items-center gap-1.5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#23a55a] animate-pulse" />
                <span>
                  {streamMeta.width}×{streamMeta.height} • {streamMeta.fps} FPS
                </span>
              </span>

              {isStudioFxActive && (
                <span className="px-2 py-0.5 rounded bg-[#5865f2] text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>STUDIO FX</span>
                </span>
              )}

              <span className="px-2 py-0.5 rounded bg-[#1e1f22]/90 border border-white/10 text-[10px] font-semibold text-[#b5bac1]">
                {activeBgName}
              </span>
            </div>

            {/* Bottom-right Mirror indicator */}
            {mirrorPreview && (
              <div className="absolute bottom-2.5 right-2.5 z-20 px-2 py-0.5 rounded bg-[#111214]/80 border border-white/10 text-[10px] font-medium text-[#b5bac1] pointer-events-none">
                Mirrored
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-4 gap-2.5">
            <div className="w-12 h-12 rounded-full bg-[#1e1f22] border border-[#3f4147]/60 flex items-center justify-center text-[#949ba4]">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#dbdee1]">
                {isStarting
                  ? 'Starting camera preview...'
                  : 'Camera preview stopped — click Test Video'}
              </p>
              <p className="text-[11px] text-[#949ba4]">
                Active background:{' '}
                <span className="text-[#dbdee1] font-medium">{activeBgName}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Blur Intensity Slider when Blur is active */}
      {config.type === 'blur' && (
        <div
          data-testid="camera-blur-slider-box"
          className="p-3 rounded-lg bg-[#1e1f22] border border-[#3f4147]/40 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#dbdee1] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#5865f2]" />
              <span>Blur Intensity</span>
            </span>
            <span className="font-mono font-bold text-[#949cf7] text-[11px]">
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
            className="w-full accent-[#5865f2] cursor-pointer h-1.5 bg-[#111214] rounded-lg"
          />
        </div>
      )}

      {/* Discord-style Video Backgrounds Tile Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1]">
            Video Backgrounds
          </span>
          <span className="text-[11px] text-[#949ba4] font-medium">
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

        <div
          className={`grid gap-2.5 ${
            compact
              ? 'grid-cols-3 sm:grid-cols-4'
              : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
          }`}
        >
          {/* None Tile */}
          <button
            type="button"
            data-testid="bg-tile-none"
            onClick={handleSelectNone}
            className={`relative aspect-video rounded-md border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer overflow-hidden ${
              config.type === 'none'
                ? 'border-[#5865f2] ring-2 ring-[#5865f2]/60 bg-[#5865f2]/15 text-white'
                : 'border-[#3f4147]/70 bg-[#1e1f22] text-[#b5bac1] hover:border-[#6d6f78] hover:text-white'
            }`}
          >
            <span className="text-base font-bold leading-none">∅</span>
            <span className="text-[10px] font-semibold">None</span>
            {config.type === 'none' && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5865f2] text-white flex items-center justify-center">
                <Check className="w-2.5 h-2.5" />
              </span>
            )}
          </button>

          {/* Blur Tile */}
          <button
            type="button"
            data-testid="bg-tile-blur"
            onClick={() => handleSelectBlur(blurAmount)}
            className={`relative aspect-video rounded-md border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer overflow-hidden ${
              config.type === 'blur'
                ? 'border-[#5865f2] ring-2 ring-[#5865f2]/60 bg-[#5865f2]/20 text-white'
                : 'border-[#3f4147]/70 bg-[#1e1f22] text-[#b5bac1] hover:border-[#6d6f78] hover:text-white'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#5865f2] to-[#38bdf8] flex items-center justify-center">
              <Sliders className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] font-semibold">Blur</span>
            {config.type === 'blur' && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5865f2] text-white flex items-center justify-center">
                <Check className="w-2.5 h-2.5" />
              </span>
            )}
          </button>

          {/* + Add Image Tile */}
          <button
            type="button"
            data-testid="bg-tile-add-image"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-video rounded-md border border-dashed border-[#4e5058] hover:border-[#5865f2] bg-[#1e1f22] hover:bg-[#5865f2]/10 text-[#b5bac1] hover:text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#949cf7]" />
            <span className="text-[10px] font-semibold">Add Image</span>
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
                onClick={() => handleSelectCustom(imgUrl)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectCustom(imgUrl);
                  }
                }}
                className={`relative aspect-video rounded-md border overflow-hidden cursor-pointer group transition-all ${
                  isActive
                    ? 'border-[#5865f2] ring-2 ring-[#5865f2]/60'
                    : 'border-[#3f4147]/70 hover:border-[#6d6f78]'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Custom background ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 py-0.5">
                  <span className="block text-[9px] font-semibold text-white truncate">
                    Custom {idx + 1}
                  </span>
                </div>
                {isActive && (
                  <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#5865f2] text-white flex items-center justify-center shadow">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Delete custom background"
                  title="Remove custom background"
                  onClick={(e) => handleDeleteCustom(e, imgUrl)}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#111214]/85 hover:bg-[#da373c] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* 8 Built-In Virtual Background Preset Tiles */}
          {WEBCAM_PRESETS.map((preset) => {
            const isActive =
              config.type === 'preset' && config.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`bg-tile-${preset.id}`}
                onClick={() => handleSelectPreset(preset)}
                className={`relative aspect-video rounded-md border overflow-hidden cursor-pointer group transition-all text-left ${
                  isActive
                    ? 'border-[#5865f2] ring-2 ring-[#5865f2]/60'
                    : 'border-[#3f4147]/70 hover:border-[#6d6f78]'
                }`}
              >
                <img
                  src={preset.previewUrl}
                  alt={preset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-1.5 py-0.5">
                  <span className="block text-[9px] font-semibold text-white truncate">
                    {preset.name}
                  </span>
                </div>
                {isActive && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5865f2] text-white flex items-center justify-center shadow">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional In-Call Camera Action */}
      {showCameraActions && onTurnOnCamera && (
        <div className="pt-2 border-t border-[#1e1f22] flex items-center justify-end">
          <button
            type="button"
            data-testid="turn-on-camera-in-call-btn"
            onClick={handleTurnOnCameraClick}
            className="px-4 py-2 rounded bg-[#248046] hover:bg-[#1a6334] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Turn On Camera in Call</span>
          </button>
        </div>
      )}
    </div>
  );
};
