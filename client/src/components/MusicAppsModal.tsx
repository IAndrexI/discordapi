import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Music, X, Plus, ExternalLink, Check, Trash2, Radio } from 'lucide-react';
import { musicAppsService, type MusicAppConfig } from '../services/musicApps';

export interface MusicAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicAppsModal: React.FC<MusicAppsModalProps> = ({ isOpen, onClose }) => {
  const [apps, setApps] = useState<MusicAppConfig[]>(() => musicAppsService.getApps());
  const [activePlayerApp, setActivePlayerApp] = useState<MusicAppConfig | null>(null);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    return musicAppsService.subscribe(() => setApps(musicAppsService.getApps()));
  }, []);

  if (!isOpen) return null;

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) return;
    const created = musicAppsService.addCustomApp(customName, customUrl);
    setCustomName('');
    setCustomUrl('');
    setActivePlayerApp(created);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Music Apps"
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] rounded-2xl border border-[#2d323e] bg-[#16181f] text-white shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#252834] px-5 py-4 bg-[#12141a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Connected Music Apps</h2>
              <p className="text-xs text-[#949ba4]">
                Connect Spotify, YouTube Music, Apple Music, SoundCloud, Tidal, or custom apps like SoulSync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Music Apps"
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-[#252834] hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activePlayerApp && (
            <div className="rounded-xl border border-[#2d323e] bg-[#0d1017] overflow-hidden flex flex-col h-80">
              <div className="px-3 py-2 bg-[#12141a] border-b border-[#252834] flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{activePlayerApp.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={activePlayerApp.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open External</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setActivePlayerApp(null)}
                    className="text-[#949ba4] hover:text-white cursor-pointer"
                  >
                    Close Player
                  </button>
                </div>
              </div>
              {isElectron ? (
                React.createElement('webview', {
                  src: activePlayerApp.url,
                  partition: `persist:music-${activePlayerApp.id}`,
                  allowpopups: 'true',
                  style: { width: '100%', height: '100%', background: '#000' },
                })
              ) : (
                <iframe
                  src={activePlayerApp.url}
                  title={activePlayerApp.name}
                  className="w-full h-full border-none bg-black"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {apps.map(app => (
              <div
                key={app.id}
                className="rounded-xl border border-[#252834] bg-[#12141a] p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: app.color }}
                    />
                    <span className="text-sm font-bold truncate">{app.name}</span>
                  </div>
                  <div className="text-[11px] text-[#949ba4] truncate mt-0.5">{app.url}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setActivePlayerApp(app)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#252834] hover:bg-[#323646] text-xs font-semibold cursor-pointer"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => musicAppsService.toggleConnect(app.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      app.connected
                        ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white'
                    }`}
                  >
                    {app.connected && <Check className="w-3 h-3" />}
                    <span>{app.connected ? 'Linked' : 'Connect'}</span>
                  </button>
                  {app.isCustom && app.id !== 'soulsync' && (
                    <button
                      type="button"
                      onClick={() => musicAppsService.removeApp(app.id)}
                      className="p-1.5 rounded text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                      aria-label={`Remove ${app.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom Music App (SoulSync / Self-Hosted) */}
          <form
            onSubmit={handleAddCustom}
            className="rounded-xl border border-[#252834] bg-[#101218] p-4 space-y-3"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
              Add Custom Music App (SoulSync, Navidrome, Subsonic, etc.)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="App Name (e.g. SoulSync)"
                className="rounded-lg border border-[#2d323e] bg-[#16181f] px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="URL (e.g. http://localhost:3000)"
                className="rounded-lg border border-[#2d323e] bg-[#16181f] px-3 py-2 text-xs text-white font-mono sm:col-span-2"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add &amp; Launch Custom Music App</span>
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
