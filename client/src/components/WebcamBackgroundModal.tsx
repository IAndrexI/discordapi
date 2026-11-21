import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const modalContent = (
    <div
      data-testid="webcam-background-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[95] bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webcam-modal-title"
        className="w-full max-w-[min(42rem,100%)] max-h-full bg-[var(--bg-chat)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-normal)]"
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[var(--bg-channels)] border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--discord-blurple)]/20 border border-[var(--discord-blurple)]/40 text-[var(--text-link)] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="webcam-modal-title"
                  className="text-sm font-bold text-[var(--text-header)] truncate"
                >
                  Camera Preview &amp; Backgrounds
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[var(--discord-blurple)] text-white tracking-wider shrink-0">
                  FX
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate">
                Preview your feed and pick a virtual background.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 bg-[var(--bg-chat)]">
          <CameraPreviewPanel
            autoStart={true}
            showCameraActions
            onTurnOnCamera={handleTurnOnCamera}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[var(--bg-channels)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 min-w-0">
            <ImageIcon className="w-3.5 h-3.5 text-[var(--text-link)] shrink-0" />
            <span className="truncate">
              Applies live to your camera stream
            </span>
          </div>

          <button
            type="button"
            data-testid="webcam-bg-modal-done-btn"
            aria-label="Done"
            onClick={onClose}
            className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold text-xs px-4 py-1.5 rounded transition-colors cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
