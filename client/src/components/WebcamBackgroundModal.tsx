import React, { useEffect } from 'react';
import { Image as ImageIcon, Sparkles, X } from 'lucide-react';
import { CameraPreviewPanel } from './CameraPreviewPanel';

export interface WebcamBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTurnOnCamera?: () => void;
}

export const WebcamBackgroundModal: React.FC<WebcamBackgroundModalProps> = ({
  isOpen,
  onClose,
  onTurnOnCamera,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTurnOnCamera = onTurnOnCamera
    ? () => {
        void Promise.resolve(onTurnOnCamera()).finally(() => {
          onClose();
        });
      }
    : undefined;

  return (
    <div
      data-testid="webcam-background-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl bg-[#313338] border border-[#1e1f22] rounded-xl shadow-2xl max-w-[calc(100vw-32px)] max-h-[calc(100vh-48px)] overflow-hidden flex flex-col text-[#dbdee1]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#5865f2]/20 border border-[#5865f2]/40 text-[#949cf7] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate">
                  Camera Preview &amp; Virtual Backgrounds
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#5865f2] text-white tracking-wider shrink-0">
                  Studio FX
                </span>
              </div>
              <p className="text-xs text-[#949ba4] truncate">
                Preview your camera feed, toggle mirror mode, and choose virtual backgrounds.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[#b5bac1] hover:text-white hover:bg-[#3f4147] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-[#313338]">
          <CameraPreviewPanel
            showCameraActions
            onTurnOnCamera={handleTurnOnCamera}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#2b2d31] border-t border-[#1e1f22] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#949ba4] flex items-center gap-1.5 min-w-0">
            <ImageIcon className="w-3.5 h-3.5 text-[#949cf7] shrink-0" />
            <span className="truncate">
              Applies in real-time to your camera stream
            </span>
          </div>

          <button
            type="button"
            data-testid="webcam-bg-modal-done-btn"
            onClick={onClose}
            className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold text-xs px-4 py-2 rounded transition-colors cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
