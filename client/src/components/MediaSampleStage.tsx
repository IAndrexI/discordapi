import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Radio,
  Sparkles,
  Zap,
  CheckCircle,
  RefreshCw,
  Camera,
  Layers,
  PhoneOff,
} from 'lucide-react';
import { webcamBackground, WEBCAM_PRESETS, type WebcamPreset } from '../services/webcamBackground';

interface MediaSampleStageProps {
  roomName: string;
  initialMode?: 'voice' | 'video' | 'both';
  onDisconnect?: () => void;
}

export const MediaSampleStage: React.FC<MediaSampleStageProps> = ({
  roomName,
  initialMode = 'voice',
  onDisconnect,
}) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'video' | 'both'>(initialMode);

  // Audio testing states
  const [micActive, setMicActive] = useState(false);
  const [loopbackEnabled, setLoopbackEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Video testing states
  const [cameraActive, setCameraActive] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoResolution, setVideoResolution] = useState<string>('1280x720');
  const [selectedPresetBg, setSelectedPresetBg] = useState<string>('none');

  // Stream references
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const loopbackGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // 1. Initialize Microphone Audio Testing
  const startMicTest = async () => {
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // keep natural for loopback testing
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Loopback gain node (connects to headphones/speakers)
      const loopGain = ctx.createGain();
      loopGain.gain.value = loopbackEnabled ? 1.0 : 0.0;
      loopbackGainRef.current = loopGain;

      source.connect(analyser);
      analyser.connect(loopGain);
      loopGain.connect(ctx.destination);

      setMicActive(true);

      // Animation loop for audio visualizer
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        setAudioLevel(normalized);
        setIsSpeaking(normalized > 12);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied or device not found.';
      setMicError(msg);
      setMicActive(false);
    }
  };

  const stopMicTest = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicActive(false);
    setAudioLevel(0);
    setIsSpeaking(false);
  };

  // Toggle loopback playback
  const handleToggleLoopback = () => {
    const next = !loopbackEnabled;
    setLoopbackEnabled(next);
    if (loopbackGainRef.current) {
      loopbackGainRef.current.gain.value = next ? 1.0 : 0.0;
    }
  };

  // 2. Initialize Video Testing
  const startCameraTest = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      videoStreamRef.current = stream;
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
      }

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      if (settings.width && settings.height) {
        setVideoResolution(`${settings.width}x${settings.height} @ ${Math.round(settings.frameRate || 30)}fps`);
      }

      setCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera permission denied or device not found.';
      setCameraError(msg);
      setCameraActive(false);
    }
  };

  const stopCameraTest = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Auto-start based on initialMode
  useEffect(() => {
    if (initialMode === 'voice' || initialMode === 'both') {
      startMicTest();
    }
    if (initialMode === 'video' || initialMode === 'both') {
      startCameraTest();
    }

    return () => {
      stopMicTest();
      stopCameraTest();
    };
  }, []);

  // Update loopback gain if gain node exists
  useEffect(() => {
    if (loopbackGainRef.current) {
      loopbackGainRef.current.gain.value = loopbackEnabled ? 1.0 : 0.0;
    }
  }, [loopbackEnabled]);

  // Handle virtual background preset change
  const handleSelectBackground = (presetId: string) => {
    setSelectedPresetBg(presetId);
    if (presetId === 'none') {
      webcamBackground.setConfig({ type: 'none' });
    } else if (presetId === 'blur') {
      webcamBackground.setConfig({ type: 'blur', blurAmount: 14 });
    } else {
      webcamBackground.setConfig({ type: 'preset', presetId });
    }
  };

  return (
    <div className="bg-[var(--bg-servers)] border-b border-black/30 p-4 flex flex-col gap-4 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white text-sm">{roomName}</span>
          <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wider flex items-center gap-1 shadow-sm">
            <Radio className="w-3 h-3 text-cyan-200" />
            <span>INTERACTIVE TEST BENCH</span>
          </span>
          <span className="text-[11px] text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
            Live WebRTC / Web Audio Feed
          </span>
        </div>

        {/* Tab & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10 text-xs">
            <button
              onClick={() => {
                setActiveTab('voice');
                if (!micActive) startMicTest();
              }}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'voice'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Feedback</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('video');
                if (!cameraActive) startCameraTest();
              }}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'video'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video &amp; Camera</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('both');
                if (!micActive) startMicTest();
                if (!cameraActive) startCameraTest();
              }}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'both'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Combined</span>
            </button>
          </div>

          {onDisconnect && (
            <button
              onClick={() => {
                stopMicTest();
                stopCameraTest();
                onDisconnect();
              }}
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors cursor-pointer"
              title="Disconnect test bench"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Test Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* VOICE FEEDBACK CARD */}
        {(activeTab === 'voice' || activeTab === 'both') && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c1222] to-[#131b2e] border border-cyan-500/30 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Microphone Loopback &amp; Audio Level</h3>
                    <p className="text-[11px] text-gray-400">Hear your own audio real-time to check clarity and delay</p>
                  </div>
                </div>

                {micActive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Microphone Online</span>
                  </span>
                ) : (
                  <button
                    onClick={startMicTest}
                    className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Enable Mic</span>
                  </button>
                )}
              </div>

              {micError && (
                <div className="mb-3 p-2.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                  {micError}
                </div>
              )}

              {/* Avatar with dynamic speaking glow */}
              <div className="flex items-center gap-4 py-3">
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl transition-all duration-100 ${
                      isSpeaking
                        ? 'bg-emerald-500 shadow-[0_0_20px_#10b981] ring-4 ring-emerald-400 scale-105'
                        : 'bg-indigo-600 ring-2 ring-white/20'
                    }`}
                  >
                    GP
                  </div>
                  {isSpeaking && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">Input Volume VU Meter</span>
                    <span className="font-mono text-cyan-300 font-bold">{audioLevel}%</span>
                  </div>

                  {/* VU Meter Bars */}
                  <div className="h-3.5 bg-black/50 rounded-full overflow-hidden p-0.5 flex items-center gap-0.5 border border-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${audioLevel}%`,
                        background:
                          audioLevel > 80
                            ? 'linear-gradient(90deg, #10b981 60%, #eab308 80%, #ef4444 100%)'
                            : audioLevel > 50
                            ? 'linear-gradient(90deg, #10b981 70%, #eab308 100%)'
                            : '#10b981',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>Silent</span>
                    <span>Optimal (Green)</span>
                    <span>Peak</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loopback Toggle Switch */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {loopbackEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}
                <div>
                  <div className="text-xs font-semibold text-white">Hear My Own Voice (Loopback)</div>
                  <div className="text-[10px] text-gray-400">
                    {loopbackEnabled ? 'Currently playing through your speakers/headphones' : 'Audio loopback is muted'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleLoopback}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  loopbackEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/15'
                }`}
              >
                {loopbackEnabled ? 'Loopback: ON' : 'Loopback: OFF'}
              </button>
            </div>
          </div>
        )}

        {/* VIDEO & CAMERA PREVIEW CARD */}
        {(activeTab === 'video' || activeTab === 'both') && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c1222] to-[#131b2e] border border-cyan-500/30 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Webcam &amp; Video Test</h3>
                    <p className="text-[11px] text-gray-400">Real-time camera feed and virtual background filters</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cameraActive ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {videoResolution}
                    </span>
                  ) : (
                    <button
                      onClick={startCameraTest}
                      className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Start Camera</span>
                    </button>
                  )}
                </div>
              </div>

              {cameraError && (
                <div className="mb-3 p-2.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                  {cameraError}
                </div>
              )}

              {/* Video Monitor Stage */}
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-white/10 shadow-inner group">
                <video
                  ref={videoElementRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-transform ${
                    mirrorVideo ? 'scale-x-[-1]' : 'scale-x-100'
                  }`}
                />

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-gray-400 gap-2 p-4 text-center">
                    <VideoOff className="w-8 h-8 text-gray-500" />
                    <span className="text-xs">Camera is currently stopped. Click "Start Camera" to test video feed.</span>
                  </div>
                )}

                {/* Overlaid Badges */}
                {cameraActive && (
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 flex items-center gap-1 border border-white/10">
                    <Zap className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Live 60 FPS Capture</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Controls & Background Presets */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Virtual Background Presets</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMirrorVideo(!mirrorVideo)}
                  className="text-[11px] text-cyan-300 hover:underline cursor-pointer"
                >
                  {mirrorVideo ? 'Mirror: On' : 'Mirror: Off'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <button
                  onClick={() => handleSelectBackground('none')}
                  className={`px-2.5 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                    selectedPresetBg === 'none'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  None (Real)
                </button>
                <button
                  onClick={() => handleSelectBackground('blur')}
                  className={`px-2.5 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                    selectedPresetBg === 'blur'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  Soft Blur
                </button>
                {WEBCAM_PRESETS.slice(0, 3).map((preset: WebcamPreset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectBackground(preset.id)}
                    className={`px-2.5 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      selectedPresetBg === preset.id
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-black/40 text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
