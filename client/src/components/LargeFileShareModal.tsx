import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Package,
  Upload,
  Zap,
  Server,
  Share2,
  CheckCircle2,
  Download,
  FileArchive,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { LargeFileTransfer, MatrixMessage } from '../types';
import {
  fileTransferService,
  createTestBundleFile,
  formatBytes,
} from '../services/fileTransfer';

export interface LargeFileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomId: string;
  senderId: string;
  senderName: string;
  onShareComplete: (msg: MatrixMessage) => void;
}

export const LargeFileShareModal: React.FC<LargeFileShareModalProps> = ({
  isOpen,
  onClose,
  activeRoomId,
  senderId,
  senderName,
  onShareComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transferMode, setTransferMode] = useState<'chunked' | 'p2p'>('chunked');
  const [activeTransfer, setActiveTransfer] = useState<LargeFileTransfer | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<LargeFileTransfer[]>(() =>
    fileTransferService.getTransfers()
  );
  const [bundleSizeMB, setBundleSizeMB] = useState<number>(3);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = fileTransferService.subscribe(() => {
      setRecentTransfers(fileTransferService.getTransfers());
    });
    if (isOpen) {
      void fileTransferService.fetchServerFiles();
    }
    return unsub;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      setError(null);
      setActiveTransfer(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setSelectedFile(f);
      setError(null);
      setActiveTransfer(null);
    }
  };

  const handleGenerateTestBundle = () => {
    const generated = createTestBundleFile(bundleSizeMB);
    setSelectedFile(generated);
    setError(null);
    setActiveTransfer(null);
  };

  const handleStartUpload = async () => {
    const targetFile = selectedFile || createTestBundleFile(bundleSizeMB);
    if (!selectedFile) {
      setSelectedFile(targetFile);
    }

    setIsUploading(true);
    setError(null);
    try {
      const { transfer, message } = await fileTransferService.startTransfer({
        file: targetFile,
        mode: transferMode,
        roomId: activeRoomId,
        senderId,
        senderName,
        onProgress: progressSnapshot => {
          setActiveTransfer(progressSnapshot);
        },
      });
      setActiveTransfer(transfer);
      onShareComplete(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Large file transfer failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="large-file-modal-title"
        className="w-[min(42rem,100%)] max-w-full max-h-full bg-[var(--bg-chat)] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-[var(--border-subtle)]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-userpanel)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--discord-blurple)] flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="large-file-modal-title" className="text-base font-bold text-[var(--text-header)] flex items-center gap-2 flex-wrap">
                <span>Large File Share</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[var(--discord-blurple)]/20 text-[var(--text-link)] border border-[var(--border-subtle)]">
                  No Size Limit
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Stream chunked files to disk or share a direct WebRTC peer link.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Large File Share"
            className="w-8 h-8 rounded-full hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-[var(--status-dnd)] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Transfer Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTransferMode('chunked')}
              disabled={isUploading}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                transferMode === 'chunked'
                  ? 'bg-[var(--bg-item-active)] border-[var(--discord-blurple)] shadow-md'
                  : 'bg-[var(--bg-userpanel)] border-[var(--border-subtle)] hover:bg-[var(--bg-item-hover)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--text-header)] flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-[var(--text-link)]" />
                  <span>Chunked Server Stream</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)]">
                  1.5MB Chunks
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Uploads in 1.5MB chunks with a persistent download link.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTransferMode('p2p')}
              disabled={isUploading}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                transferMode === 'p2p'
                  ? 'bg-[var(--bg-item-active)] border-[var(--discord-blurple)] shadow-md'
                  : 'bg-[var(--bg-userpanel)] border-[var(--border-subtle)] hover:bg-[var(--bg-item-hover)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--text-header)] flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span>WebRTC P2P Direct</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-channels)] text-purple-300 border border-[var(--border-subtle)]">
                  Zero Disk
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Generates a peer-to-peer stream manifest with SHA-256 verification.
              </p>
            </button>
          </div>

          {/* File Picker / Dropzone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--discord-blurple)] bg-[var(--bg-userpanel)] rounded-xl p-5 text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="space-y-1.5">
                <FileArchive className="w-9 h-9 text-[var(--text-link)] mx-auto" />
                <div className="text-sm font-bold text-[var(--text-header)] truncate max-w-md mx-auto">
                  {selectedFile.name}
                </div>
                <div className="text-xs text-[var(--text-link)] font-mono">
                  {formatBytes(selectedFile.size)} • {selectedFile.type || 'application/octet-stream'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  Click to choose a different file
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-9 h-9 text-[var(--text-link)] mx-auto" />
                <div className="text-sm font-bold text-[var(--text-header)]">
                  Drop a file here or click to browse
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Supports ZIPs, ISOs, videos, modpacks, and large archives.
                </div>
              </div>
            )}
          </div>

          {/* Test Bundle Generator */}
          <div className="p-3 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-normal)]">
              <Sparkles className="w-4 h-4 text-[var(--status-idle)]" />
              <span>Generate a sample bundle to test chunked upload</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Test bundle size"
                value={bundleSizeMB}
                onChange={e => setBundleSizeMB(Number(e.target.value))}
                disabled={isUploading}
                className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-header)] outline-none"
              >
                <option value={2}>2 MB Bundle</option>
                <option value={3}>3 MB Bundle</option>
                <option value={6}>6 MB Bundle</option>
                <option value={12}>12 MB Bundle</option>
              </select>
              <button
                type="button"
                onClick={handleGenerateTestBundle}
                disabled={isUploading}
                data-testid="generate-test-bundle-btn"
                className="px-3 py-1 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-header)] cursor-pointer"
              >
                Generate Test Bundle
              </button>
            </div>
          </div>

          {/* Live Transfer Progress */}
          {activeTransfer && (
            <div className="p-4 rounded-xl bg-[var(--bg-popout)] border border-[var(--border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-[var(--text-header)] truncate">
                  {activeTransfer.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--status-online)] flex-shrink-0" />
                  ) : (
                    <Zap className="w-4 h-4 text-[var(--text-link)] animate-pulse flex-shrink-0" />
                  )}
                  <span className="truncate">{activeTransfer.fileName}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[var(--text-link)] flex-shrink-0">
                  <span>{activeTransfer.speedMBps.toFixed(2)} MB/s</span>
                  <span>•</span>
                  <span>{activeTransfer.progress}%</span>
                </div>
              </div>

              <div className="w-full h-2.5 bg-[var(--bg-channels)] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    activeTransfer.status === 'completed'
                      ? 'bg-[var(--status-online)]'
                      : 'bg-[var(--discord-blurple)]'
                  }`}
                  style={{ width: `${activeTransfer.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>
                  Chunk {activeTransfer.completedChunks} / {activeTransfer.totalChunks} (
                  {formatBytes(activeTransfer.uploadedBytes)} / {formatBytes(activeTransfer.fileSize)})
                </span>
                {activeTransfer.status === 'completed' && (
                  <a
                    href={fileTransferService.getDownloadHref(activeTransfer)}
                    download={activeTransfer.fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--text-link)] hover:underline font-bold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleStartUpload}
              disabled={isUploading}
              data-testid="start-large-upload-btn"
              className="px-5 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              <span>
                {isUploading
                  ? 'Streaming Chunks...'
                  : selectedFile
                  ? `Upload & Share (${formatBytes(selectedFile.size)})`
                  : `Upload & Share Test Bundle (${bundleSizeMB} MB)`}
              </span>
            </button>
          </div>

          {/* Recent Large Transfers */}
          {recentTransfers.length > 0 && (
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Recent Shared Files ({recentTransfers.length})
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {recentTransfers.slice(0, 6).map(t => (
                  <div
                    key={t.id}
                    className="px-3 py-2 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--text-header)] truncate">{t.fileName}</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">
                        {formatBytes(t.fileSize)} • {t.mode.toUpperCase()} • {t.speedMBps} MB/s
                      </div>
                    </div>
                    <a
                      href={fileTransferService.getDownloadHref(t)}
                      download={t.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[var(--text-link)] font-bold text-[11px] flex items-center gap-1 flex-shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
