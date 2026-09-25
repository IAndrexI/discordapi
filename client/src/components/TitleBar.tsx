import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMax: boolean) => void) => () => void;
  openThemeFileDialog?: () => Promise<{ path: string; name: string; content: string } | null>;
  getDesktopSources?: () => Promise<Array<{ id: string; name: string; thumbnail: string; appIcon?: string }>>;
  setTrayBadge?: (count: number) => void;
  onToggleMute?: (callback: () => void) => () => void;
  onToggleDeafen?: (callback: () => void) => () => void;
  onJoinVoice?: (callback: (roomName: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const TitleBar: React.FC = () => {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    window.electronAPI.isMaximized().then(setIsMaximized);
    const cleanup = window.electronAPI.onMaximizeChange((max) => setIsMaximized(max));
    return cleanup;
  }, [isElectron]);

  if (!isElectron) return null;

  return (
    <div
      className="flex items-center justify-between h-[30px] w-full bg-[#111827] border-b border-white/5 select-none z-50 text-[#9ca3af] text-xs"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Branding & Draggable Label */}
      <div className="flex items-center gap-2 px-3">
        <img src="/icon.png" alt="Protutech" className="w-4 h-4 rounded object-cover" />
        <span className="font-semibold text-gray-300 tracking-wide text-[11px]">Protutech</span>
      </div>

      {/* Center Draggable Spacer */}
      <div className="flex-1 h-full" />

      {/* Right: Window Controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.electronAPI?.minimize()}
          title="Minimize"
          className="w-11 h-full flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => window.electronAPI?.maximize()}
          title={isMaximized ? 'Restore Down' : 'Maximize'}
          className="w-11 h-full flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          onClick={() => window.electronAPI?.close()}
          title="Close (Minimize to Tray)"
          className="w-11 h-full flex items-center justify-center hover:bg-[#ed4245] text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
