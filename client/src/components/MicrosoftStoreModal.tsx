import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  ShieldCheck,
  Package,
  Terminal,
  Cpu,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

export interface MicrosoftStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORE_LINK = 'ms-windows-store://pdp/?productid=00013812596749763330';
const STORE_WEB_URL = 'https://apps.microsoft.com/detail/00013812596749763330';
const BUILD_COMMAND = 'npm run electron:build:store';
const PRIVACY_URL = 'https://chat.protutech.vip/privacy';
const TERMS_URL = 'https://chat.protutech.vip/terms';

const APPX_METADATA = {
  applicationId: 'ProtutechChat',
  identityName: 'Protutech.200542756E8C1',
  displayName: 'ProtutechChat',
  publisher: 'CN=E81D70C0-1117-411E-AE08-9C9DEEEC2C88',
  publisherDisplayName: 'Protutech',
  backgroundColor: '#090d16',
  artifactName: 'ProtutechChat-Store.appx',
};

const STORE_TILES = [
  { name: 'StoreLogo.png', size: '50 × 50', desc: 'Store listing emblem' },
  { name: 'Square44x44Logo.png', size: '44 × 44', desc: 'Taskbar & App List' },
  { name: 'Square150x150Logo.png', size: '150 × 150', desc: 'Medium Start Tile' },
  { name: 'Wide310x150Logo.png', size: '310 × 150', desc: 'Wide Start Tile' },
];

export const MicrosoftStoreModal: React.FC<MicrosoftStoreModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    assets: true,
    manifest: true,
    wack: false,
    urls: true,
    submit: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLocalShell =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || window.location.hostname === 'localhost');

  const appxDownloadUrl = isLocalShell
    ? 'https://chat.protutech.vip/downloads/ProtutechChat-Store.appx'
    : '/downloads/ProtutechChat-Store.appx';

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 1800);
  };

  const toggleCheck = (id: string) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ms-store-modal-title"
        className="w-[min(48rem,100%)] max-w-full max-h-full bg-[var(--bg-chat)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[var(--bg-userpanel)] border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--discord-blurple)] flex items-center justify-center shadow-lg flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="ms-store-modal-title" className="text-base sm:text-lg font-bold text-[var(--text-header)]">
                  Microsoft Store Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)]">
                  {APPX_METADATA.artifactName}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Install the Windows Store package or review AppX submission readiness.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Microsoft Store Hub"
            className="w-8 h-8 rounded-full bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Quick Install Hero */}
          <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[var(--text-header)]">
                Install {APPX_METADATA.displayName} on Windows 10 / 11
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Desktop AppX package with global hotkeys and tray support.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <a
                href={STORE_LINK}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold shadow-md transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Store Install</span>
              </a>

              <a
                href={appxDownloadUrl}
                download={APPX_METADATA.artifactName}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-header)] border border-[var(--border-subtle)] text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[var(--text-link)]" />
                <span>Direct .appx</span>
              </a>
            </div>
          </div>

          {/* AppX Identity Metadata & Build Command */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-link)] uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Package Identity</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">App ID</span>
                  <span className="font-mono text-[var(--text-header)]">{APPX_METADATA.applicationId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Identity Name</span>
                  <span className="font-mono text-[var(--text-link)]">{APPX_METADATA.identityName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Publisher</span>
                  <span className="font-mono text-[var(--text-header)]">{APPX_METADATA.publisherDisplayName}</span>
                </div>
                <div className="pt-1">
                  <span className="text-[var(--text-muted)] block mb-0.5">Publisher CN</span>
                  <code className="block text-[10px] font-mono text-[var(--text-normal)] bg-[var(--bg-popout)] px-2 py-1 rounded border border-[var(--border-subtle)] break-all">
                    {APPX_METADATA.publisher}
                  </code>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-link)] uppercase tracking-wider">
                <Terminal className="w-4 h-4" />
                <span>Build Package</span>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                Packages <code className="text-[var(--text-link)]">{APPX_METADATA.artifactName}</code> and syncs downloads.
              </p>

              <div className="flex items-center gap-2 bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                <code className="flex-1 text-xs font-mono text-[var(--status-online)] truncate">
                  {BUILD_COMMAND}
                </code>
                <button
                  type="button"
                  onClick={() => copyText('cmd', BUILD_COMMAND)}
                  aria-label="Copy build command"
                  className="px-2 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-header)] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'cmd' ? (
                    <>
                      <Check className="w-3 h-3 text-[var(--status-online)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Web Store URL:</span>
                <a
                  href={STORE_WEB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--text-link)] hover:underline flex items-center gap-1"
                >
                  <span>apps.microsoft.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Store Tiles Preview */}
          <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-link)] uppercase tracking-wider">
                <ImageIcon className="w-4 h-4" />
                <span>Store Tile Assets</span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                BG: {APPX_METADATA.backgroundColor}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STORE_TILES.map(tile => (
                <div
                  key={tile.name}
                  className="p-2.5 rounded-lg bg-[var(--bg-channels)] border border-[var(--border-subtle)] flex flex-col items-center text-center gap-1.5"
                >
                  <div
                    className={`rounded-lg border border-[var(--border-subtle)] flex items-center justify-center bg-[#090d16] ${
                      tile.name.startsWith('Wide') ? 'w-20 h-10' : 'w-10 h-10'
                    }`}
                  >
                    <img
                      src="./protutech_logo.png"
                      alt={tile.name}
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--text-header)] truncate w-full">
                    {tile.name}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-link)]">{tile.size}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{tile.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Partner Center Submission Checklist */}
          <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-link)] uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Submission Checklist</span>
              </div>
              <span className="text-xs font-mono text-[var(--status-online)]">
                {completedCount} / 5 Ready
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  id: 'assets',
                  title: 'Generate & Verify AppX PNG Tiles',
                  detail: 'Run node scripts/generate-store-assets.cjs for 44x44, 50x50, 150x150, 310x150.',
                },
                {
                  id: 'manifest',
                  title: 'Verify Identity & Publisher Match Partner Center',
                  detail: `${APPX_METADATA.identityName} • ${APPX_METADATA.publisher}`,
                },
                {
                  id: 'wack',
                  title: 'Pass Windows App Certification Kit (WACK)',
                  detail: 'Validate ProtutechChat-Store.appx locally with appcertui.exe before upload.',
                },
                {
                  id: 'urls',
                  title: 'Configure Privacy Policy & Support URLs',
                  detail: `${PRIVACY_URL} • ${TERMS_URL}`,
                },
                {
                  id: 'submit',
                  title: 'Upload ProtutechChat-Store.appx to Partner Center',
                  detail: 'Submit package under Windows & Xbox -> Packages in Microsoft Partner Center.',
                },
              ].map(item => {
                const checked = !!checklist[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCheck(item.id)}
                    className={`w-full text-left p-2.5 rounded-lg border flex items-start gap-2.5 transition-colors cursor-pointer ${
                      checked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-[var(--text-header)]'
                        : 'bg-[var(--bg-channels)] border-[var(--border-subtle)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)]'
                    }`}
                  >
                    {checked ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-online)] mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] break-all">{item.detail}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => copyText('privacy', PRIVACY_URL)}
                className="px-2.5 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-normal)] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'privacy' ? (
                  <Check className="w-3 h-3 text-[var(--status-online)]" />
                ) : (
                  <Copy className="w-3 h-3 text-[var(--text-link)]" />
                )}
                <span>Copy Privacy URL</span>
              </button>
              <button
                type="button"
                onClick={() => copyText('terms', TERMS_URL)}
                className="px-2.5 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-normal)] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'terms' ? (
                  <Check className="w-3 h-3 text-[var(--status-online)]" />
                ) : (
                  <Copy className="w-3 h-3 text-[var(--text-link)]" />
                )}
                <span>Copy Terms URL</span>
              </button>
            </div>
          </div>

          {/* Rust / Tauri MSIX Note */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-start gap-3">
            <Cpu className="w-5 h-5 text-[var(--status-idle)] mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-[var(--text-header)]">
                Tauri v2 MSIX Alternative
              </div>
              <p className="text-[var(--text-muted)] leading-relaxed">
                Package the lightweight <code className="text-[var(--text-link)]">src-tauri/</code> build as an MSIX using <code className="text-[var(--status-online)]">cargo tauri build</code> and <code className="text-[var(--status-online)]">MakeAppx.exe</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
