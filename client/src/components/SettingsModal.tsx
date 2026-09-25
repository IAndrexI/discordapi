import React, { useState } from 'react';
import {
  X,
  Paintbrush,
  Puzzle,
  LogOut,
  Radio,
  Check,
  Shield,
  Layers,
  Monitor,
  FolderOpen,
  Download,
} from 'lucide-react';
import { vencord } from '../services/vencord';
import type { ThemeConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'voice' | 'themes' | 'plugins' | 'desktop'>('themes');
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(vencord.getTheme());
  const [customCss, setCustomCss] = useState(themeConfig.customCssText || '');
  const [customUrl, setCustomUrl] = useState(themeConfig.customCssUrl || '');
  const [plugins, setPlugins] = useState(vencord.getPlugins());

  if (!isOpen) return null;

  const handleSelectTheme = (themeName: ThemeConfig['activeTheme']) => {
    const updated: ThemeConfig = {
      ...themeConfig,
      activeTheme: themeName,
      customCssText: themeName === 'custom' ? customCss : undefined,
      customCssUrl: themeName === 'custom' ? customUrl : undefined,
    };
    setThemeConfig(updated);
    vencord.setTheme(updated);
  };

  const handleApplyCustomCss = () => {
    const updated: ThemeConfig = {
      activeTheme: 'custom',
      customCssText: customCss,
      customCssUrl: customUrl,
    };
    setThemeConfig(updated);
    vencord.setTheme(updated);
  };

  const handleTogglePlugin = (pluginId: string, currentEnabled: boolean) => {
    vencord.togglePlugin(pluginId, !currentEnabled);
    setPlugins([...vencord.getPlugins()]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl h-[640px] bg-[var(--bg-chat)] rounded-xl flex overflow-hidden shadow-2xl border border-white/10 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white flex flex-col items-center gap-0.5 group z-10"
        >
          <div className="w-9 h-9 rounded-full border-2 border-[var(--text-muted)] group-hover:border-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">ESC</span>
        </button>

        {/* Left Settings Sidebar */}
        <div className="w-60 bg-[var(--bg-channels)] p-6 flex flex-col justify-between select-none border-r border-black/20">
          <div className="space-y-6">
            {/* User Settings Category */}
            <div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-2">
                User Settings
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === 'account'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  My Account
                </button>
                <button
                  onClick={() => setActiveTab('voice')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === 'voice'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  Voice & Video
                </button>
              </div>
            </div>

            {/* Vencord & Equicord Category */}
            <div>
              <div className="text-[11px] font-bold text-[var(--discord-blurple)] uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                <Puzzle className="w-3.5 h-3.5" />
                <span>Vencord Settings</span>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('themes')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'themes'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span>Themes</span>
                </button>
                <button
                  onClick={() => setActiveTab('plugins')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'plugins'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Plugins</span>
                </button>
                <button
                  onClick={() => setActiveTab('desktop')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'desktop'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Desktop App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium text-[var(--status-dnd)] hover:bg-[var(--status-dnd)]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* THEMES TAB */}
          {activeTab === 'themes' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Themes & Appearance</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Customize the look and feel of your client using built-in presets or external BetterDiscord/Vencord CSS themes.
                </p>
              </div>

              {/* Theme Presets */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'dark' as const,
                    name: 'Discord Dark',
                    badge: 'Standard',
                    desc: 'Classic clean dark gray layout.',
                    colors: ['#1e1f22', '#2b2d31', '#313338', '#5865f2'],
                  },
                  {
                    id: 'midnight' as const,
                    name: 'Midnight AMOLED',
                    badge: 'OLED',
                    desc: 'Pure #000000 black background for OLED screens.',
                    colors: ['#000000', '#080808', '#101010', '#ffffff'],
                  },
                  {
                    id: 'translucent' as const,
                    name: 'Frosted Translucent',
                    badge: 'Aero Glass',
                    desc: 'Glassmorphic frosted dark acrylic with 20px blur.',
                    colors: ['#070d22', '#0a122a', '#0d1636', '#38bdf8'],
                  },
                  {
                    id: 'transparent' as const,
                    name: 'Pure Transparent',
                    badge: 'Acrylic Clear',
                    desc: 'Ultra-clear see-through panels for custom wallpapers.',
                    colors: ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.15)', '#00d2ff'],
                  },
                  {
                    id: 'catppuccin' as const,
                    name: 'Catppuccin Mocha',
                    badge: 'Pastel',
                    desc: 'Soothing pastel lavender and dark mauve tones.',
                    colors: ['#11111b', '#181825', '#1e1e2e', '#cba6f7'],
                  },
                  {
                    id: 'nord' as const,
                    name: 'Nord Frost',
                    badge: 'Arctic',
                    desc: 'Clean arctic polar palette with icy blue accents.',
                    colors: ['#242933', '#2e3440', '#3b4252', '#88c0d0'],
                  },
                  {
                    id: 'cyberpunk' as const,
                    name: 'Cyberpunk Neon',
                    badge: 'Vibrant',
                    desc: 'Neon synthwave aesthetic with magenta & electric cyan.',
                    colors: ['#0d041a', '#14072b', '#1d0b45', '#f43f5e'],
                  },
                  {
                    id: 'crimson' as const,
                    name: 'Crimson Moon',
                    badge: 'Blood Red',
                    desc: 'Deep obsidian shadows with striking ruby crimson.',
                    colors: ['#080304', '#0f0508', '#1a080d', '#f43f5e'],
                  },
                  {
                    id: 'emerald' as const,
                    name: 'Emerald Matrix',
                    badge: 'Cyber Green',
                    desc: 'Hacker terminal dark green phosphor luminescence.',
                    colors: ['#020d08', '#04170e', '#062819', '#10b981'],
                  },
                  {
                    id: 'solarized' as const,
                    name: 'Twilight Amber',
                    badge: 'Warm Dark',
                    desc: 'Golden amber and brass highlights on warm charcoal.',
                    colors: ['#0e0c07', '#16120b', '#211c12', '#f59e0b'],
                  },
                  {
                    id: 'custom' as const,
                    name: 'Custom CSS Engine',
                    badge: 'Engine',
                    desc: 'Load external BetterDiscord or Vencord CSS.',
                    colors: ['#1e1f22', '#2b2d31', '#5865f2', '#38bdf8'],
                  },
                ].map(t => (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTheme(t.id)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                      themeConfig.activeTheme === t.id
                        ? 'border-[var(--discord-blurple)] bg-[var(--discord-blurple)]/10 ring-1 ring-[var(--discord-blurple)]/50'
                        : 'border-white/10 bg-[var(--bg-userpanel)] hover:border-white/20 hover:bg-[var(--bg-userpanel)]/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-semibold text-white mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{t.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                            {t.badge}
                          </span>
                        </div>
                        {themeConfig.activeTheme === t.id && <Check className="w-4 h-4 text-[var(--discord-blurple)]" />}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] line-clamp-2 mb-2.5">{t.desc}</div>
                    </div>
                    <div className="flex gap-1.5 mt-auto pt-1">
                      {t.colors.map((c, idx) => (
                        <span
                          key={idx}
                          className="w-4 h-4 rounded-sm border border-white/20 inline-block shadow-sm"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom CSS Editor */}
              {themeConfig.activeTheme === 'custom' && (
                <div className="space-y-4 pt-2 border-t border-white/10">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Theme URL (BetterDiscord / Vencord CDN)
                    </label>
                    <input
                      type="text"
                      placeholder="https://raw.githubusercontent.com/.../theme.css"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  {typeof window !== 'undefined' && window.electronAPI?.openThemeFileDialog && (
                    <button
                      onClick={async () => {
                        if (!window.electronAPI?.openThemeFileDialog) return;
                        const res = await window.electronAPI.openThemeFileDialog();
                        if (res && res.content) {
                          setCustomCss(res.content);
                          vencord.setCustomCss(res.content);
                          vencord.setTheme({
                            ...themeConfig,
                            activeTheme: 'custom',
                            customCssText: res.content,
                          });
                          setThemeConfig(vencord.getTheme());
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 py-2 px-3 rounded text-xs font-semibold border border-white/10 transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                      <span>Browse Local .CSS Theme File...</span>
                    </button>
                  )}

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Raw Custom CSS
                    </label>
                    <textarea
                      rows={5}
                      placeholder=":root { --bg-chat: #18191c; }"
                      value={customCss}
                      onChange={e => setCustomCss(e.target.value)}
                      className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  <button
                    onClick={handleApplyCustomCss}
                    className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
                  >
                    Apply Custom CSS
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PLUGINS TAB */}
          {activeTab === 'plugins' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Vencord Plugins</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Modular extensions running locally in your client for extra power and customization.
                </p>
              </div>

              <div className="space-y-3">
                {plugins.map(plugin => (
                  <div
                    key={plugin.id}
                    className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-white/10 flex items-center justify-between"
                  >
                    <div className="pr-4">
                      <div className="font-semibold text-white text-sm mb-0.5">{plugin.name}</div>
                      <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {plugin.description}
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePlugin(plugin.id, plugin.enabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors flex-shrink-0 ${
                        plugin.enabled ? 'bg-[var(--status-online)]' : 'bg-neutral-600'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VOICE TAB */}
          {activeTab === 'voice' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Voice & Video Settings</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  LiveKit SFU ultra-low latency voice configuration.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--status-online)]/30 flex items-center gap-3">
                  <Radio className="w-6 h-6 text-[var(--status-online)]" />
                  <div>
                    <div className="text-sm font-semibold text-white">Ultra-Low Latency Mode</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Targeting sub-40ms round-trip latency via direct WebRTC SFU with 48kHz Opus audio.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Screen Share Quality
                  </label>
                  <select className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none">
                    <option value="1080p60">1080p @ 60 FPS (Nitro Source)</option>
                    <option value="720p60">720p @ 60 FPS</option>
                    <option value="720p30">720p @ 30 FPS</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Noise Suppression
                  </label>
                  <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                    <span className="text-sm text-white">RNNoise Neural Background Cancellation</span>
                    <span className="text-xs text-[var(--status-online)] font-semibold">Enabled</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACCOUNT TAB */}
          {activeTab === 'account' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">My Account</h2>
                <p className="text-sm text-[var(--text-muted)]">Manage your homeserver credentials and profile.</p>
              </div>

              <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-white/10 space-y-4">
                <div>
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase">User ID</div>
                  <div className="text-sm font-mono text-white mt-1">{userId}</div>
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Homeserver</div>
                  <div className="text-sm font-mono text-[var(--discord-blurple)] mt-1">
                    https://chat.protutech.vip
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-[var(--status-online)] font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>End-to-End Encryption & Double Puppeting Active</span>
                </div>
              </div>
            </div>
          )}

          {/* DESKTOP APP TAB */}
          {activeTab === 'desktop' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Desktop Application</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Standalone native Discord client with lower latency, global push-to-talk hotkeys, and system tray integration.
                </p>
              </div>

              {typeof window !== 'undefined' && window.electronAPI?.isElectron ? (
                <div className="space-y-4">
                  <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] shadow-[0_0_8px_rgba(35,165,90,0.6)]" />
                        <span className="font-semibold text-white">Native Windows Client Active</span>
                      </div>
                      <span className="text-xs bg-[var(--discord-blurple)] text-white px-2 py-0.5 rounded font-mono">v1.0.0</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Running with hardware-accelerated WebRTC PCM 16kHz audio, H.264 video codec, and system tray persistence.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Global Desktop Hotkeys
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Toggle Microphone Mute</span>
                      <kbd className="bg-black/40 border border-white/15 px-2 py-1 rounded text-xs font-mono text-gray-300">Ctrl + Shift + M</kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Toggle Headphone Deafen</span>
                      <kbd className="bg-black/40 border border-white/15 px-2 py-1 rounded text-xs font-mono text-gray-300">Ctrl + Shift + D</kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Close Window Behavior</span>
                      <span className="text-xs text-[var(--status-online)] font-semibold">Minimizes to System Tray</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-[var(--discord-blurple)]/20 to-[var(--bg-userpanel)] rounded-lg p-6 border border-[var(--discord-blurple)]/40 space-y-4">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-8 h-8 text-[var(--discord-blurple)]" />
                      <div>
                        <h3 className="font-bold text-white text-base">Protutech Discord for Windows</h3>
                        <p className="text-xs text-[var(--text-muted)]">64-bit Standalone Executable (.exe)</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300">
                      Install or run the native desktop client for global push-to-talk hotkeys, seamless 1080p60 screen capture, background system tray audio, and local Vencord CSS theme loading.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <a
                        href="/downloads/Protutech-Discord-Setup.exe"
                        className="inline-flex items-center gap-2 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white px-4 py-2.5 rounded font-semibold text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Windows Installer (.exe)</span>
                      </a>
                      <a
                        href="/downloads/Protutech-Discord-Portable.exe"
                        className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded font-semibold text-sm border border-white/15 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Portable (.exe)</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
