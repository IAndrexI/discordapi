import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Sparkles, Upload, Check, Sliders } from 'lucide-react';
import { webcamBackground, WEBCAM_PRESETS, type WebcamPreset } from '../services/webcamBackground';
import type { WebcamBackgroundConfig } from '../types';

interface WebcamBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebcamBackgroundModal: React.FC<WebcamBackgroundModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<WebcamBackgroundConfig>(webcamBackground.getConfig());
  const [customUploads, setCustomUploads] = useState<string[]>(webcamBackground.getCustomUploads());
  const [blurAmount, setBlurAmount] = useState<number>(config.blurAmount ?? 14);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectNone = () => {
    webcamBackground.removeBackground();
    setConfig(webcamBackground.getConfig());
  };

  const handleSelectBlur = (amount: number) => {
    setBlurAmount(amount);
    webcamBackground.setBlur(amount);
    setConfig(webcamBackground.getConfig());
  };

  const handleSelectPreset = (preset: WebcamPreset) => {
    webcamBackground.setPreset(preset.id);
    setConfig(webcamBackground.getConfig());
  };

  const handleSelectCustomImage = (url: string) => {
    webcamBackground.setCustomImage(url);
    setConfig(webcamBackground.getConfig());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        webcamBackground.setCustomImage(result);
        setConfig(webcamBackground.getConfig());
        setCustomUploads(webcamBackground.getCustomUploads());
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[var(--bg-chat)] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-white/10 relative">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/20 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Camera Video Backgrounds</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Studio FX
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Blur your background or choose immersive themes and custom wallpapers.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[460px] overflow-y-auto space-y-5">
          {/* Default Options: None & Blur */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2.5">
              Filters & Effects
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* None */}
              <button
                type="button"
                onClick={handleSelectNone}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  config.type === 'none'
                    ? 'border-[var(--discord-blurple)] bg-[var(--discord-blurple)]/15 text-white ring-1 ring-[var(--discord-blurple)]'
                    : 'border-white/10 bg-[var(--bg-userpanel)] text-gray-300 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs">
                    ∅
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">None</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Raw camera video</div>
                  </div>
                </div>
                {config.type === 'none' && <Check className="w-4 h-4 text-cyan-400" />}
              </button>

              {/* Blur */}
              <button
                type="button"
                onClick={() => handleSelectBlur(blurAmount)}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  config.type === 'blur'
                    ? 'border-[var(--discord-blurple)] bg-[var(--discord-blurple)]/15 text-white ring-1 ring-[var(--discord-blurple)]'
                    : 'border-white/10 bg-[var(--bg-userpanel)] text-gray-300 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs blur-[0.5px]">
                    <Sliders className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Blur Background</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Defocus surroundings</div>
                  </div>
                </div>
                {config.type === 'blur' && <Check className="w-4 h-4 text-cyan-400" />}
              </button>
            </div>
          </div>

          {/* Blur Intensity Slider */}
          {config.type === 'blur' && (
            <div className="p-3 bg-[var(--bg-userpanel)] border border-white/10 rounded-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Blur Intensity</span>
                </span>
                <span className="text-cyan-300 font-mono text-[11px]">{blurAmount}px</span>
              </div>
              <input
                type="range"
                min="6"
                max="30"
                step="2"
                value={blurAmount}
                onChange={e => handleSelectBlur(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>
          )}

          {/* Custom Image Upload */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Upload Custom Background
              </span>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-3 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Image...</span>
              </button>
            </div>

            {customUploads.length > 0 && (
              <div className="grid grid-cols-4 gap-2.5">
                {customUploads.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectCustomImage(imgUrl)}
                    className={`relative aspect-video rounded-xl overflow-hidden border cursor-pointer group transition-all ${
                      config.type === 'custom' && config.customUrl === imgUrl
                        ? 'border-cyan-400 ring-2 ring-cyan-400/60 scale-[1.02]'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img src={imgUrl} alt="Uploaded Background" className="w-full h-full object-cover" />
                    {config.type === 'custom' && config.customUrl === imgUrl && (
                      <div className="absolute inset-0 bg-cyan-900/40 flex items-center justify-center">
                        <Check className="w-5 h-5 text-cyan-300 bg-black/60 rounded-full p-0.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discord-Style Preset Backgrounds */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2.5">
              Featured Presets
            </div>
            <div className="grid grid-cols-3 gap-3">
              {WEBCAM_PRESETS.map(preset => {
                const isActive = config.type === 'preset' && config.presetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`relative rounded-xl overflow-hidden border cursor-pointer group flex flex-col transition-all ${
                      isActive
                        ? 'border-[var(--discord-blurple)] ring-2 ring-[var(--discord-blurple)]/70 scale-[1.02]'
                        : 'border-white/10 hover:border-white/30 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="aspect-video w-full relative overflow-hidden bg-black/40">
                      <img
                        src={preset.previewUrl}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isActive && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--discord-blurple)] text-white flex items-center justify-center shadow-lg">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-[var(--bg-userpanel)] text-left">
                      <div className="text-xs font-semibold text-white truncate">{preset.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] capitalize truncate">
                        {preset.category}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[var(--bg-userpanel)] border-t border-black/20 flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Applies in real-time to your camera stream</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
