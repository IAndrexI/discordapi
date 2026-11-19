import React, { useState } from 'react';
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
    <div className="fixed inset-0 z-[65] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#0b101d] border border-cyan-500/25 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-950/70 via-[#0d1527] to-indigo-950/70 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Microsoft Store Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {APPX_METADATA.artifactName}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                1-Click Windows Store Install, AppX Packaging &amp; Partner Center Readiness
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Install Hero */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-sky-500/15 via-[#0f172a] to-indigo-500/15 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white">
                Install {APPX_METADATA.displayName} on Windows 10 / 11
              </div>
              <p className="text-xs text-gray-300">
                Verified AppX / MSIX bundle with hardware H.264, global hotkeys, and background tray audio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <a
                href={STORE_LINK}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-md transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>1-Click Store Install</span>
              </a>

              <a
                href={appxDownloadUrl}
                download={APPX_METADATA.artifactName}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-cyan-300" />
                <span>Direct .appx</span>
              </a>
            </div>
          </div>

          {/* AppX Identity Metadata & Build Command */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0e1526] border border-white/10 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Package Identity (build.appx)</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400">App ID</span>
                  <span className="font-mono text-white">{APPX_METADATA.applicationId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400">Identity Name</span>
                  <span className="font-mono text-cyan-300">{APPX_METADATA.identityName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-400">Publisher Display</span>
                  <span className="font-mono text-white">{APPX_METADATA.publisherDisplayName}</span>
                </div>
                <div className="pt-1">
                  <span className="text-gray-400 block mb-0.5">Publisher CN</span>
                  <code className="block text-[10px] font-mono text-gray-300 bg-black/40 px-2 py-1 rounded border border-white/5 break-all">
                    {APPX_METADATA.publisher}
                  </code>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0e1526] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <Terminal className="w-4 h-4" />
                <span>Build Store Package</span>
              </div>

              <p className="text-xs text-gray-400">
                Builds Vite production bundle, packages <code className="text-cyan-300">{APPX_METADATA.artifactName}</code>, and syncs to <code className="text-gray-300">../downloads/</code>.
              </p>

              <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-lg px-3 py-2">
                <code className="flex-1 text-xs font-mono text-emerald-300 truncate">
                  {BUILD_COMMAND}
                </code>
                <button
                  type="button"
                  onClick={() => copyText('cmd', BUILD_COMMAND)}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === 'cmd' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
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

              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Web Store URL:</span>
                <a
                  href={STORE_WEB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>apps.microsoft.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Store Tiles Preview */}
          <div className="p-4 rounded-xl bg-[#0e1526] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <ImageIcon className="w-4 h-4" />
                <span>AppX Store Tile Assets (build/appx/)</span>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                BG: {APPX_METADATA.backgroundColor}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STORE_TILES.map(tile => (
                <div
                  key={tile.name}
                  className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex flex-col items-center text-center gap-1.5"
                >
                  <div
                    className={`rounded-lg border border-cyan-500/30 flex items-center justify-center bg-[#090d16] ${
                      tile.name.startsWith('Wide') ? 'w-20 h-10' : 'w-10 h-10'
                    }`}
                  >
                    <img
                      src="./protutech_logo.png"
                      alt={tile.name}
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-white truncate w-full">
                    {tile.name}
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400">{tile.size}</div>
                  <div className="text-[10px] text-gray-500">{tile.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Partner Center Submission Checklist */}
          <div className="p-4 rounded-xl bg-[#0e1526] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Partner Center Submission Checklist</span>
              </div>
              <span className="text-xs font-mono text-emerald-400">
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
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                        : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {checked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-[11px] text-gray-400 break-all">{item.detail}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => copyText('privacy', PRIVACY_URL)}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'privacy' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-cyan-400" />
                )}
                <span>Copy Privacy URL</span>
              </button>
              <button
                type="button"
                onClick={() => copyText('terms', TERMS_URL)}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-gray-300 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'terms' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-cyan-400" />
                )}
                <span>Copy Terms URL</span>
              </button>
            </div>
          </div>

          {/* Rust / Tauri MSIX Note */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/25 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-200">
                Rust / Tauri v2 MSIX Alternative (Ultra-Light Footprint)
              </div>
              <p className="text-gray-300 leading-relaxed">
                Alongside Electron&apos;s <code className="text-cyan-300">ProtutechChat-Store.appx</code>, the{' '}
                <code className="text-amber-300">src-tauri/</code> Rust backend compiles to a ~12 MB native WebView2 binary. Package it as an MSIX for Microsoft Store using{' '}
                <code className="text-emerald-300">cargo tauri build</code> + Windows MSIX Packaging Tool /{' '}
                <code className="text-emerald-300">MakeAppx.exe</code> with the same Publisher CN &amp; Identity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
