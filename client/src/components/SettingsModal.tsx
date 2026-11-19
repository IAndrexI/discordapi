import React, { useState, useEffect } from 'react';
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
  Plus,
  Trash2,
  Search,
  Code,
  Globe,
  Zap,
  AlertCircle,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Package,
  Image as ImageIcon,
  RotateCcw,
  Upload,
  ShieldAlert,
  PhoneCall,
  AlertTriangle,
  User,
  Lock,
  Unlock,
  Store,
  Bell,
  RefreshCw,
  ArrowLeftRight,
  Trophy,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { vencord, EQUICORD_CATALOG } from '../services/vencord';
import { appIconService, APP_ICON_PRESETS } from '../services/appIcon';
import { voiceProxy } from '../services/voiceProxy';
import { desktopBridge } from '../services/desktopBridge';
import {
  discordSettingsSync,
  type SyncedDiscordSettings,
  type DiscordBaseTheme,
  type NoiseSuppressionMode,
} from '../services/discordSettingsSync';
import {
  userProfileService,
  AVATAR_DECORATIONS,
  type UserProfileCustomizations,
} from '../services/userProfile';
import { overlayService, type OverlayConfig } from '../services/overlay';
import { VoiceProxyModal } from './VoiceProxyModal';
import { MicrosoftStoreModal } from './MicrosoftStoreModal';
import { DiscordHubModal, type DiscordHubTab } from './DiscordHubModal';
import { EquicordModal } from './EquicordModal';
import type { ThemeConfig } from '../types';

export type SettingsTab =
  | 'profile'
  | 'account'
  | 'voice'
  | 'overlay'
  | 'themes'
  | 'plugins'
  | 'add-plugins'
  | 'desktop'
  | 'app-icon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onLogout: () => void;
  initialTab?: SettingsTab;
  onOpenMicrosoftStore?: () => void;
  onOpenDiscordHub?: (tab?: DiscordHubTab) => void;
  onOpenEquicord?: () => void;
}

const BANNER_PRESET_COLORS = [
  '#0e7490',
  '#5865f2',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
  '#dc2626',
  '#111827',
];

const STATUS_EMOJIS = ['⚡', '🎮', '🎧', '💻', '🔥', '🚀', '☕', '🛡️'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onLogout,
  initialTab,
  onOpenMicrosoftStore,
  onOpenDiscordHub,
  onOpenEquicord,
}) => {
  const openTabKey = `${isOpen}:${initialTab || 'themes'}`;
  const [tabOverride, setTabOverride] = useState<{ key: string; tab: SettingsTab } | null>(null);
  const activeTab: SettingsTab =
    tabOverride && tabOverride.key === openTabKey ? tabOverride.tab : initialTab || 'themes';
  const setActiveTab = (tab: SettingsTab) => {
    setTabOverride({ key: openTabKey, tab });
  };
  const [currentIcon, setCurrentIcon] = useState<string>(appIconService.getIcon());
  const [customIconError, setCustomIconError] = useState<string | null>(null);
  const [showVoiceProxyModal, setShowVoiceProxyModal] = useState(false);
  const [showLocalStoreModal, setShowLocalStoreModal] = useState(false);
  const [showLocalDiscordHub, setShowLocalDiscordHub] = useState(false);
  const [localDiscordHubTab, setLocalDiscordHubTab] = useState<DiscordHubTab>('quests');
  const [showLocalEquicord, setShowLocalEquicord] = useState(false);
  const [proxySession, setProxySession] = useState(voiceProxy.getSession());
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(vencord.getTheme());
  const [customCss, setCustomCss] = useState(themeConfig.customCssText || '');
  const [customUrl, setCustomUrl] = useState(themeConfig.customCssUrl || '');
  const [plugins, setPlugins] = useState(vencord.getPlugins());

  // Bidirectional Discord Settings Sync State
  const [syncSettings, setSyncSettings] = useState<SyncedDiscordSettings>(() =>
    discordSettingsSync.getSettings()
  );
  const [syncBusy, setSyncBusy] = useState<'pull' | 'push' | null>(null);
  const [discordTokenInput, setDiscordTokenInput] = useState(() =>
    discordSettingsSync.getDiscordToken()
  );
  const [showDiscordToken, setShowDiscordToken] = useState(false);
  const [tokenSavedNotice, setTokenSavedNotice] = useState<string | null>(null);

  // User Profile Customization State
  const [profileDraft, setProfileDraft] = useState<UserProfileCustomizations>(() =>
    userProfileService.getProfile()
  );
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [profileAvatarError, setProfileAvatarError] = useState<string | null>(null);

  // In-Game Overlay State
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(() =>
    overlayService.getConfig()
  );

  // Equicord Plugins Management States
  const [pluginFilter, setPluginFilter] = useState<'all' | 'equicord' | 'vencord' | 'user'>('all');
  const [pluginCategoryFilter, setPluginCategoryFilter] = useState<string>('all');
  const [pluginSearch, setPluginSearch] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategory, setStoreCategory] = useState<string>('all');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installType, setInstallType] = useState<'url' | 'code'>('url');
  const [installName, setInstallName] = useState('');
  const [installDesc, setInstallDesc] = useState('');
  const [installAuthor, setInstallAuthor] = useState('');
  const [installCategory, setInstallCategory] = useState<'chat' | 'media' | 'ui' | 'privacy' | 'utility'>('utility');
  const [installUrl, setInstallUrl] = useState('');
  const [installCode, setInstallCode] = useState('');
  const [installError, setInstallError] = useState('');
  const [installLoading, setInstallLoading] = useState(false);
  const [installSuccess, setInstallSuccess] = useState('');

  useEffect(() => {
    const unsubIcon = appIconService.subscribe(setCurrentIcon);
    const unsubVoice = voiceProxy.subscribe(setProxySession);
    const unsubProfile = userProfileService.subscribe(p => setProfileDraft(p));
    const unsubOverlay = overlayService.subscribe(cfg => setOverlayConfig(cfg));
    const unsubSync = discordSettingsSync.subscribe(s => setSyncSettings(s));
    const unsubVencord = vencord.subscribe(() => setPlugins(vencord.getPlugins()));
    return () => {
      unsubIcon();
      unsubVoice();
      unsubProfile();
      unsubOverlay();
      unsubSync();
      unsubVencord();
    };
  }, []);

  const handleSelectIcon = (iconUrl: string) => {
    setCustomIconError(null);
    appIconService.setIcon(iconUrl);
  };

  const handleCustomIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCustomIconError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCustomIconError('Icon file is too large (maximum 5 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setCustomIconError(null);
        appIconService.setIcon(dataUrl);
      }
    };
    reader.onerror = () => {
      setCustomIconError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleProfileAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileAvatarError('Please select a valid image file (PNG, JPG, GIF, WebP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setProfileAvatarError('Avatar image must be under 4 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setProfileAvatarError(null);
        setProfileDraft(prev => ({ ...prev, avatarUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    userProfileService.updateProfile(profileDraft);
    if (syncSettings.syncEnabled) {
      void discordSettingsSync.updateMultiple({
        displayName: profileDraft.displayName,
        pronouns: profileDraft.pronouns,
        bio: profileDraft.bio,
        bannerColor: profileDraft.bannerColor,
        accentColor: profileDraft.accentColor,
        customStatusText: profileDraft.customStatus,
        customStatusEmoji: profileDraft.customStatusEmoji,
        status: profileDraft.presence === 'offline' ? 'invisible' : profileDraft.presence,
      });
    }
    setProfileSavedToast(true);
    window.setTimeout(() => setProfileSavedToast(false), 2200);
  };

  const handlePullFromDiscord = async () => {
    setSyncBusy('pull');
    try {
      await discordSettingsSync.pullFromDiscord();
    } finally {
      setSyncBusy(null);
    }
  };

  const handlePushToDiscord = async () => {
    setSyncBusy('push');
    try {
      await discordSettingsSync.pushAllToDiscord();
    } finally {
      setSyncBusy(null);
    }
  };

  const handleOpenStoreHub = () => {
    if (onOpenMicrosoftStore) {
      onOpenMicrosoftStore();
    } else {
      setShowLocalStoreModal(true);
    }
  };

  const handleOpenDiscordHubModal = (tab: DiscordHubTab = 'quests') => {
    if (onOpenDiscordHub) {
      onOpenDiscordHub(tab);
    } else {
      setLocalDiscordHubTab(tab);
      setShowLocalDiscordHub(true);
    }
  };

  const handleOpenEquicordModal = () => {
    if (onOpenEquicord) {
      onOpenEquicord();
    } else {
      setShowLocalEquicord(true);
    }
  };

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
    if (syncSettings.syncEnabled && (themeName === 'dark' || themeName === 'midnight')) {
      void discordSettingsSync.updateSetting('theme', themeName);
    }
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

  const handleInstallPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstallError('');
    setInstallSuccess('');

    if (!installName.trim()) {
      setInstallError('Please enter a plugin name.');
      return;
    }

    if (installType === 'url' && !installUrl.trim()) {
      setInstallError('Please provide a valid plugin JS URL (e.g. GitHub raw link).');
      return;
    }

    if (installType === 'code' && !installCode.trim()) {
      setInstallError('Please paste the raw JavaScript plugin code.');
      return;
    }

    setInstallLoading(true);
    try {
      const installed = await vencord.installUserPlugin({
        name: installName.trim(),
        description: installDesc.trim() || 'Custom Equicord user plugin.',
        author: installAuthor.trim() || 'User Plugin',
        category: installCategory,
        codeUrl: installType === 'url' ? installUrl.trim() : undefined,
        code: installType === 'code' ? installCode : undefined,
      });

      setPlugins([...vencord.getPlugins()]);
      setInstallSuccess(`Successfully installed and activated "${installed.name}"!`);
      setTimeout(() => {
        setShowInstallModal(false);
        setInstallName('');
        setInstallDesc('');
        setInstallAuthor('');
        setInstallUrl('');
        setInstallCode('');
        setInstallSuccess('');
        setPluginFilter('user');
      }, 1000);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallLoading(false);
    }
  };

  const handleUninstallPlugin = (pluginId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove custom plugin "${name}"?`)) {
      vencord.uninstallUserPlugin(pluginId);
      setPlugins([...vencord.getPlugins()]);
    }
  };

  const equicordCount = plugins.filter(p => p.source === 'equicord').length;
  const vencordCount = plugins.filter(p => p.source === 'vencord' || !p.source).length;
  const userCount = plugins.filter(p => p.source === 'user').length;

  const filteredPlugins = plugins.filter(p => {
    if (pluginFilter === 'equicord' && p.source !== 'equicord') return false;
    if (pluginFilter === 'vencord' && p.source !== 'vencord' && p.source !== undefined) return false;
    if (pluginFilter === 'user' && p.source !== 'user') return false;

    if (pluginCategoryFilter !== 'all' && p.category !== pluginCategoryFilter) return false;

    if (pluginSearch.trim()) {
      const q = pluginSearch.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchAuthor = p.author?.toLowerCase().includes(q);
      const matchCat = p.category?.toLowerCase().includes(q);
      return matchName || matchDesc || matchAuthor || matchCat;
    }
    return true;
  });

  const fallbackUsername = userId.split(':')[0].replace('@', '') || 'User';
  const previewDisplayName = profileDraft.displayName.trim() || profileDraft.username || fallbackUsername;
  const previewDecorationClass = userProfileService.getDecorationClass(profileDraft.avatarDecoration);
  const isNativeDesktop = desktopBridge.isDesktopApp();
  const runtimeKind = desktopBridge.getRuntimeKind();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl h-[640px] bg-[var(--bg-chat)] rounded-xl flex overflow-hidden shadow-2xl border border-white/10 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white flex flex-col items-center gap-0.5 group z-10 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full border-2 border-[var(--text-muted)] group-hover:border-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold">ESC</span>
        </button>

        {/* Left Settings Sidebar */}
        <div className="w-60 bg-[var(--bg-channels)] p-5 flex flex-col justify-between select-none border-r border-black/20 overflow-y-auto">
          <div className="space-y-5">
            {/* User Settings Category */}
            <div>
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-2">
                User Settings
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    <span>User Profile</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Custom
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'account'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  My Account
                </button>
                <button
                  onClick={() => setActiveTab('voice')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'voice'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  Voice &amp; Video
                </button>
                <button
                  onClick={() => setActiveTab('overlay')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    activeTab === 'overlay'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>In-Game Overlay</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      overlayConfig.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {overlayConfig.enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Vencord & Equicord Category */}
            <div>
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                <Puzzle className="w-3.5 h-3.5" />
                <span>Plugins &amp; Themes</span>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('themes')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
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
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    activeTab === 'plugins'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>Plugins</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                    Equicord
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('add-plugins')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    activeTab === 'add-plugins'
                      ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 text-cyan-300 border border-cyan-500/40'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>Add Plugins</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-sm">
                    Store
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('desktop')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                    activeTab === 'desktop'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Desktop App</span>
                </button>
                <button
                  onClick={() => setActiveTab('app-icon')}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    activeTab === 'app-icon'
                      ? 'bg-[var(--bg-item-active)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    <span>App Icon</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                    Custom
                  </span>
                </button>
              </div>
            </div>

            {/* Discord Hub & Equicord Shortcuts */}
            <div>
              <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                <span>Discord &amp; Equicord</span>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleOpenDiscordHubModal('quests')}
                  className="w-full text-left px-3 py-1.5 rounded text-xs font-semibold text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Discord Hub</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Quests
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenEquicordModal}
                  className="w-full text-left px-3 py-1.5 rounded text-xs font-semibold text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Equicord Engine</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    25+
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 mt-4 rounded text-sm font-medium text-[var(--status-dnd)] hover:bg-[var(--status-dnd)]/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Bidirectional Discord Settings Sync Status Bar */}
          <div className="mb-6 mr-12 p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/60 via-[#0d1527] to-cyan-950/50 border border-indigo-500/30 shadow-lg space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#5865F2]/25 border border-[#5865F2]/40 flex items-center justify-center text-indigo-300">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-white">
                      Discord Bidirectional Sync
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        syncSettings.syncEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/10 text-gray-400 border-white/15'
                      }`}
                    >
                      {syncSettings.syncEnabled
                        ? syncSettings.lastSyncedAt
                          ? 'Synced with Discord ✓'
                          : 'Sync Active ✓'
                        : 'Sync Paused'}
                    </span>
                    {syncSettings.discordTokenConnected && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                        Token Connected
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                    <span>{syncSettings.lastSyncLog}</span>
                    {syncSettings.lastSyncedAt && (
                      <span className="font-mono text-cyan-300">
                        •{' '}
                        {new Date(syncSettings.lastSyncedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-200 cursor-pointer select-none">
                  <span>Sync Settings to Discord Side</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={syncSettings.syncEnabled}
                    aria-label="Sync Settings to Discord Side"
                    onClick={() =>
                      void discordSettingsSync.updateSetting(
                        'syncEnabled',
                        !syncSettings.syncEnabled
                      )
                    }
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                      syncSettings.syncEnabled ? 'bg-emerald-500' : 'bg-neutral-600'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                        syncSettings.syncEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>

                <button
                  type="button"
                  disabled={syncBusy !== null}
                  onClick={() => void handlePullFromDiscord()}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-cyan-200 border border-white/10 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncBusy === 'pull' ? 'animate-spin' : ''}`} />
                  <span>Pull from Discord Now</span>
                </button>

                <button
                  type="button"
                  disabled={syncBusy !== null}
                  onClick={() => void handlePushToDiscord()}
                  className="px-2.5 py-1 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-xs font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3 h-3" />
                  <span>Push All to Discord</span>
                </button>
              </div>
            </div>
          </div>
          {/* USER PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">User Profile Customization</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Optional Discord-style profile card, banner, avatar decoration, pronouns, and status.
                  </p>
                </div>
                {profileSavedToast && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              {/* Live Discord Profile Card Preview */}
              <div
                className="rounded-2xl overflow-hidden border shadow-xl bg-[var(--bg-userpanel)]"
                style={{ borderColor: profileDraft.accentColor || '#00f2fe' }}
              >
                {/* Banner */}
                <div
                  className="h-24 w-full relative bg-cover bg-center"
                  style={{
                    backgroundColor: profileDraft.bannerColor || '#0e7490',
                    backgroundImage: profileDraft.bannerUrl
                      ? `url("${profileDraft.bannerUrl}")`
                      : undefined,
                  }}
                />
                <div className="px-5 pb-5 relative">
                  <div className="flex items-end justify-between -mt-10 mb-3">
                    <div className="relative">
                      <div className={`rounded-full p-0.5 ${previewDecorationClass}`}>
                        {profileDraft.avatarUrl ? (
                          <img
                            src={profileDraft.avatarUrl}
                            alt={previewDisplayName}
                            className="w-20 h-20 rounded-full object-cover border-4 border-[var(--bg-userpanel)] bg-[var(--bg-servers)]"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full border-4 border-[var(--bg-userpanel)] bg-[var(--discord-blurple)] flex items-center justify-center text-white font-extrabold text-2xl">
                            {previewDisplayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span
                        className={`absolute bottom-1 right-1 w-5 h-5 rounded-full ring-4 ring-[var(--bg-userpanel)] ${
                          profileDraft.presence === 'idle'
                            ? 'bg-[var(--status-idle)]'
                            : profileDraft.presence === 'dnd'
                            ? 'bg-[var(--status-dnd)]'
                            : profileDraft.presence === 'offline'
                            ? 'bg-[var(--status-offline)]'
                            : 'bg-[var(--status-online)]'
                        }`}
                      />
                    </div>

                    {profileDraft.badges.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1.5 justify-end">
                        {profileDraft.badges.map(b => (
                          <span
                            key={b}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-cyan-300 border border-white/10"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-extrabold text-white">{previewDisplayName}</h3>
                    {profileDraft.pronouns && (
                      <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 text-[11px] font-medium">
                        {profileDraft.pronouns}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">{userId}</div>

                  {(profileDraft.customStatus || profileDraft.customStatusEmoji) && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-xs text-gray-200">
                      {profileDraft.customStatusEmoji && <span>{profileDraft.customStatusEmoji}</span>}
                      <span>{profileDraft.customStatus || 'Custom status'}</span>
                    </div>
                  )}

                  {profileDraft.bio && (
                    <p className="mt-3 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-white/5 pt-2.5">
                      {profileDraft.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Profile Edit Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={profileDraft.displayName}
                      onChange={e => setProfileDraft(p => ({ ...p, displayName: e.target.value }))}
                      placeholder={fallbackUsername}
                      className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Pronouns
                    </label>
                    <input
                      type="text"
                      value={profileDraft.pronouns}
                      onChange={e => setProfileDraft(p => ({ ...p, pronouns: e.target.value }))}
                      placeholder="e.g. he/him, she/her, they/them"
                      className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Custom Status + Emoji */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Custom Status &amp; Emoji
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={profileDraft.customStatusEmoji}
                      onChange={e =>
                        setProfileDraft(p => ({ ...p, customStatusEmoji: e.target.value }))
                      }
                      maxLength={4}
                      className="w-14 text-center bg-[var(--bg-userpanel)] border border-white/10 rounded px-2 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      title="Status Emoji"
                    />
                    <input
                      type="text"
                      value={profileDraft.customStatus}
                      onChange={e => setProfileDraft(p => ({ ...p, customStatus: e.target.value }))}
                      placeholder="What are you playing or working on?"
                      className="flex-1 bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                    <select
                      value={profileDraft.presence}
                      onChange={e => {
                        const nextPresence = e.target.value as UserProfileCustomizations['presence'];
                        setProfileDraft(p => ({
                          ...p,
                          presence: nextPresence,
                        }));
                        userProfileService.updateProfile({ presence: nextPresence });
                        if (syncSettings.syncEnabled) {
                          void discordSettingsSync.updateSetting(
                            'status',
                            nextPresence === 'offline' ? 'invisible' : nextPresence
                          );
                        }
                      }}
                      className="bg-[var(--bg-userpanel)] border border-white/10 rounded px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="online">Online</option>
                      <option value="idle">Idle</option>
                      <option value="dnd">Do Not Disturb</option>
                      <option value="offline">Invisible</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setProfileDraft(p => ({ ...p, customStatusEmoji: em }))}
                        className={`px-2 py-0.5 rounded text-xs cursor-pointer border transition-colors ${
                          profileDraft.customStatusEmoji === em
                            ? 'bg-cyan-500/20 border-cyan-400'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    About Me / Bio
                  </label>
                  <textarea
                    rows={3}
                    value={profileDraft.bio}
                    onChange={e => setProfileDraft(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Write a short bio for your profile card..."
                    className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 resize-none"
                  />
                </div>

                {/* Avatar URL + Upload */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-2.5">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Avatar Image URL or Upload
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={profileDraft.avatarUrl}
                      onChange={e => setProfileDraft(p => ({ ...p, avatarUrl: e.target.value }))}
                      placeholder="https://... or upload an image file"
                      className="flex-1 min-w-[200px] bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileAvatarUpload}
                        className="hidden"
                      />
                    </label>
                    {profileDraft.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileDraft(p => ({ ...p, avatarUrl: '' }))}
                        className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs text-gray-300 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {profileAvatarError && (
                    <p className="text-xs text-red-400">{profileAvatarError}</p>
                  )}
                </div>

                {/* Banner Color / Image & Accent Color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                      Banner Color &amp; Accent
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">Banner:</span>
                        <input
                          type="color"
                          value={profileDraft.bannerColor}
                          onChange={e =>
                            setProfileDraft(p => ({ ...p, bannerColor: e.target.value }))
                          }
                          className="w-8 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-[11px] text-gray-400">Accent:</span>
                        <input
                          type="color"
                          value={profileDraft.accentColor}
                          onChange={e =>
                            setProfileDraft(p => ({ ...p, accentColor: e.target.value }))
                          }
                          className="w-8 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {BANNER_PRESET_COLORS.map(col => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setProfileDraft(p => ({ ...p, bannerColor: col }))}
                          className={`w-5 h-5 rounded-full border cursor-pointer ${
                            profileDraft.bannerColor === col ? 'border-white scale-110' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                      Banner Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={profileDraft.bannerUrl}
                      onChange={e => setProfileDraft(p => ({ ...p, bannerUrl: e.target.value }))}
                      placeholder="https://.../banner.png"
                      className="w-full bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Avatar Decoration Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Avatar Decoration
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {AVATAR_DECORATIONS.map(dec => {
                      const selected = profileDraft.avatarDecoration === dec.id;
                      return (
                        <button
                          key={dec.id}
                          type="button"
                          onClick={() =>
                            setProfileDraft(p => ({ ...p, avatarDecoration: dec.id }))
                          }
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            selected
                              ? 'border-cyan-400 bg-cyan-500/15 text-white'
                              : 'border-white/10 bg-[var(--bg-userpanel)] text-gray-300 hover:border-white/25'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-black/40 ${dec.cssClass}`}
                          >
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: dec.previewColor }}
                            />
                          </div>
                          <span className="text-xs font-semibold truncate">{dec.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setProfileDraft(userProfileService.getProfile())}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
                  >
                    Discard Edits
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Profile</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* IN-GAME OVERLAY TAB */}
          {activeTab === 'overlay' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">Optional In-Game Overlay</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  Lightweight floating HUD for voice participants, RTC ping/FPS telemetry, and live Discord/App chat toasts while gaming.
                </p>
              </div>

              {/* Master Toggle Card */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Enable In-Game Overlay</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Disabled by default. Toggle anytime from the TitleBar, UserBar, or hotkey.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = overlayService.toggleEnabled();
                    void desktopBridge.setOverlayMode(next, overlayConfig.isInteractive);
                  }}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    overlayConfig.enabled ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      overlayConfig.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Position Selector (4 Corners) */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Screen Corner Position
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'top-left', label: 'Top Left' },
                      { id: 'top-right', label: 'Top Right' },
                      { id: 'bottom-left', label: 'Bottom Left' },
                      { id: 'bottom-right', label: 'Bottom Right' },
                    ] as const
                  ).map(pos => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => overlayService.updateConfig({ position: pos.id })}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                        overlayConfig.position === pos.id
                          ? 'border-cyan-400 bg-cyan-500/15 text-white'
                          : 'border-white/10 text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span>{pos.label}</span>
                      {overlayConfig.position === pos.id && (
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Overlay Opacity</span>
                  <span className="font-mono text-cyan-300">
                    {Math.round(overlayConfig.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={overlayConfig.opacity}
                  onChange={e =>
                    overlayService.updateConfig({ opacity: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
                />
              </div>

              {/* Behavior Switches */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  HUD Display &amp; Interaction
                </div>

                {[
                  {
                    key: 'compactMode' as const,
                    label: 'Compact Mode',
                    desc: 'Minimalist footprint with condensed participant pills.',
                  },
                  {
                    key: 'showOnlySpeaking' as const,
                    label: 'Speaking-Only Filter',
                    desc: 'Only display participants who are actively speaking.',
                  },
                  {
                    key: 'showChatToasts' as const,
                    label: 'Incoming Chat Toasts',
                    desc: 'Show incoming Discord & Matrix messages for 6 seconds.',
                  },
                  {
                    key: 'showTelemetry' as const,
                    label: 'RTC Ping & FPS Telemetry',
                    desc: 'Live frame rate and sub-40ms WebRTC latency counter.',
                  },
                ].map(item => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 pt-2 border-t border-white/5 first:border-t-0 first:pt-0"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        overlayService.updateConfig({ [item.key]: !overlayConfig[item.key] })
                      }
                      className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                        overlayConfig[item.key] ? 'bg-cyan-500' : 'bg-neutral-600'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                          overlayConfig[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}

                {/* Interactive Lock Toggle */}
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      {overlayConfig.isInteractive ? (
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>
                        {overlayConfig.isInteractive
                          ? 'Unlocked (Interactive Controls & Quick Reply)'
                          : 'Locked (Click-Through HUD)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Lock the overlay so mouse clicks pass straight through to your game.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = overlayService.toggleInteractive();
                      void desktopBridge.setOverlayMode(overlayConfig.enabled, next);
                    }}
                    className={`px-3 py-1 rounded text-xs font-bold cursor-pointer border transition-colors ${
                      overlayConfig.isInteractive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {overlayConfig.isInteractive ? 'Lock HUD' : 'Unlock HUD'}
                  </button>
                </div>
              </div>

              {/* Hotkey & Preview Toast */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs font-bold text-white">Overlay Toggle Hotkey</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Press{' '}
                    <kbd className="bg-black/40 border border-white/15 px-1.5 py-0.5 rounded font-mono text-cyan-300">
                      {overlayConfig.hotkey || 'Ctrl+Shift+O'}
                    </kbd>{' '}
                    (or <kbd className="bg-black/40 border border-white/15 px-1.5 py-0.5 rounded font-mono text-gray-300">Alt+Shift+O</kbd>) anywhere.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!overlayConfig.enabled) {
                      overlayService.updateConfig({ enabled: true });
                    }
                    overlayService.pushToast({
                      roomId: 'overlay_test',
                      roomName: 'general',
                      senderName: 'Discord Bridge',
                      body: 'In-game overlay toast preview active! Quick replies enabled when unlocked.',
                      source: 'discord',
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Preview Toast</span>
                </button>
              </div>
            </div>
          )}

          {/* THEMES TAB */}
          {activeTab === 'themes' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Themes &amp; Appearance</h2>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Customize the look and feel of your client using built-in presets or custom CSS themes.
                </p>

                {/* Synced Discord Appearance & Behavior */}
                <div className="bg-[var(--bg-userpanel)] border border-indigo-500/25 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Discord Synced Appearance &amp; Behavior
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {syncSettings.syncEnabled ? 'Auto-sync ON' : 'Local only'}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-400 mb-1.5 font-semibold">
                      Discord Base Theme Mode
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'dark', label: 'Dark' },
                          { id: 'light', label: 'Light' },
                          { id: 'midnight', label: 'Midnight' },
                        ] as ReadonlyArray<{ id: DiscordBaseTheme; label: string }>
                      ).map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            void discordSettingsSync.updateSetting('theme', mode.id);
                            if (mode.id === 'dark' || mode.id === 'midnight') {
                              handleSelectTheme(mode.id);
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                            syncSettings.theme === mode.id
                              ? 'border-cyan-400 bg-cyan-500/20 text-white'
                              : 'border-white/10 text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                    {(
                      [
                        {
                          key: 'messageDisplayCompact',
                          label: 'Compact Message Mode',
                          desc: 'Tighter message spacing',
                        },
                        {
                          key: 'developerMode',
                          label: 'Developer Mode',
                          desc: 'Copy IDs & debug info',
                        },
                        {
                          key: 'animateEmoji',
                          label: 'Animate Custom Emojis',
                          desc: 'Play Nitro emoji motion',
                        },
                        {
                          key: 'gifAutoPlay',
                          label: 'Auto-Play GIFs',
                          desc: 'Animate GIFs automatically',
                        },
                      ] as const
                    ).map(item => {
                      const active = Boolean(syncSettings[item.key]);
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/25 border border-white/5"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">{item.label}</div>
                            <div className="text-[10px] text-gray-400">{item.desc}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            aria-label={item.label}
                            onClick={() =>
                              void discordSettingsSync.updateSetting(item.key, !active)
                            }
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors flex-shrink-0 ${
                              active ? 'bg-cyan-500' : 'bg-neutral-600'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                                active ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Layout Format: Modern vs Classic */}
                <div className="bg-[var(--bg-userpanel)] border border-white/10 rounded-lg p-3 mb-4">
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Application Layout Format
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated: ThemeConfig = {
                          ...themeConfig,
                          layoutFormat: 'discord',
                        };
                        setThemeConfig(updated);
                        vencord.setTheme(updated);
                      }}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                        (themeConfig.layoutFormat || 'discord') === 'discord'
                          ? 'border-[var(--discord-blurple)] bg-[var(--discord-blurple)]/15 text-white'
                          : 'border-white/10 text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--discord-blurple)]" />
                        <span>Protutech Modern (Channel Rail)</span>
                      </div>
                      {(themeConfig.layoutFormat || 'discord') === 'discord' && (
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const updated: ThemeConfig = {
                          ...themeConfig,
                          layoutFormat: 'teamspeak',
                          activeTheme: 'teamspeak',
                        };
                        setThemeConfig(updated);
                        vencord.setTheme(updated);
                      }}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                        themeConfig.layoutFormat === 'teamspeak'
                          ? 'border-blue-500 bg-blue-500/15 text-white'
                          : 'border-white/10 text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>TeamSpeak Format (Compact Hierarchy)</span>
                      </div>
                      {themeConfig.layoutFormat === 'teamspeak' && (
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme Presets */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: 'dark' as const,
                    name: 'Protutech Dark',
                    badge: 'Standard',
                    desc: 'Classic clean dark layout.',
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
                    id: 'teamspeak' as const,
                    name: 'TeamSpeak Classic',
                    badge: 'TS Format',
                    desc: 'Classic high-contrast navy slate layout inspired by TeamSpeak 3/5.',
                    colors: ['#182230', '#202c3d', '#263447', '#2563eb'],
                  },
                  {
                    id: 'custom' as const,
                    name: 'Custom CSS Engine',
                    badge: 'Engine',
                    desc: 'Load external custom CSS theme stylesheets.',
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
                        {themeConfig.activeTheme === t.id && (
                          <Check className="w-4 h-4 text-[var(--discord-blurple)]" />
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] line-clamp-2 mb-2.5">
                        {t.desc}
                      </div>
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
                      Theme URL (Custom CSS Stylesheet URL)
                    </label>
                    <input
                      type="text"
                      placeholder="https://raw.githubusercontent.com/.../theme.css"
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await desktopBridge.openThemeFileDialog();
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
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 py-2 px-3 rounded text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                    <span>Browse Local .CSS Theme File...</span>
                  </button>

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
                    className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white px-4 py-2 rounded text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Apply Custom CSS
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PLUGINS TAB */}
          {activeTab === 'plugins' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-white">Equicord &amp; Vencord Plugins</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      Equicord V2
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    Modular client enhancements and official Equicord extensions. Run community scripts, bypass limitations, enhance voice, and customize your experience.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenEquicordModal}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Equicord Engine</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowInstallModal(true);
                      setInstallError('');
                      setInstallSuccess('');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Install Plugin</span>
                  </button>
                </div>
              </div>

              {/* Install Modal */}
              {showInstallModal && (
                <div className="p-5 rounded-xl bg-black/40 border border-cyan-500/30 backdrop-blur-md space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                        <Code className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Install Equicord Plugin</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Load a community plugin from a URL (e.g. GitHub raw link) or paste raw JavaScript code.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowInstallModal(false)}
                      className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleInstallPlugin} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Plugin Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. AutoTranslator"
                          value={installName}
                          onChange={e => setInstallName(e.target.value)}
                          className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Author
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Equicord Community"
                          value={installAuthor}
                          onChange={e => setInstallAuthor(e.target.value)}
                          className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Category
                        </label>
                        <select
                          value={installCategory}
                          onChange={e =>
                            setInstallCategory(
                              e.target.value as 'chat' | 'media' | 'ui' | 'privacy' | 'utility'
                            )
                          }
                          className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                        >
                          <option value="chat">Chat &amp; Messaging</option>
                          <option value="media">Media &amp; Voice</option>
                          <option value="ui">UI &amp; Appearance</option>
                          <option value="privacy">Privacy &amp; Security</option>
                          <option value="utility">Utility &amp; Tools</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          placeholder="Short summary of what it does"
                          value={installDesc}
                          onChange={e => setInstallDesc(e.target.value)}
                          className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setInstallType('url')}
                          className={`text-xs px-3 py-1 rounded font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            installType === 'url'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              : 'text-gray-400 hover:text-white bg-white/5'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Remote URL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInstallType('code')}
                          className={`text-xs px-3 py-1 rounded font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                            installType === 'code'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              : 'text-gray-400 hover:text-white bg-white/5'
                          }`}
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>Paste Raw Code</span>
                        </button>
                      </div>

                      {installType === 'url' ? (
                        <div>
                          <input
                            type="url"
                            placeholder="https://raw.githubusercontent.com/user/repo/main/plugin.js"
                            value={installUrl}
                            onChange={e => setInstallUrl(e.target.value)}
                            className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
                          />
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            Direct HTTP/HTTPS link to JavaScript plugin source file.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            rows={5}
                            placeholder="// Example Equicord Plugin&#10;export default {&#10;  name: 'MyPlugin',&#10;  start() { console.log('Plugin started!'); },&#10;  stop() { console.log('Plugin stopped!'); }&#10;};"
                            value={installCode}
                            onChange={e => setInstallCode(e.target.value)}
                            className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
                          />
                        </div>
                      )}
                    </div>

                    {installError && (
                      <div className="flex items-center gap-2 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{installError}</span>
                      </div>
                    )}

                    {installSuccess && (
                      <div className="flex items-center gap-2 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>{installSuccess}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowInstallModal(false)}
                        className="px-3 py-1.5 text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={installLoading}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {installLoading ? 'Installing...' : 'Install & Run'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Filters and Search Bar */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 bg-[var(--bg-userpanel)] border border-white/10 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Equicord & Vencord plugins by name, tag, or description..."
                    value={pluginSearch}
                    onChange={e => setPluginSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[var(--text-muted)]"
                  />
                  {pluginSearch && (
                    <button
                      onClick={() => setPluginSearch('')}
                      className="text-gray-400 hover:text-white text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  {/* Source filter tabs */}
                  <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                    <button
                      onClick={() => setPluginFilter('all')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        pluginFilter === 'all'
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-white'
                      }`}
                    >
                      All ({plugins.length})
                    </button>
                    <button
                      onClick={() => setPluginFilter('equicord')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        pluginFilter === 'equicord'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-cyan-300'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>Equicord ({equicordCount})</span>
                    </button>
                    <button
                      onClick={() => setPluginFilter('vencord')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        pluginFilter === 'vencord'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-indigo-300'
                      }`}
                    >
                      Vencord ({vencordCount})
                    </button>
                    <button
                      onClick={() => setPluginFilter('user')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        pluginFilter === 'user'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-emerald-300'
                      }`}
                    >
                      <Code className="w-3 h-3 text-emerald-400" />
                      <span>Custom ({userCount})</span>
                    </button>
                  </div>

                  {/* Category filter */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[var(--text-muted)] text-[11px] font-medium">Category:</span>
                    <select
                      value={pluginCategoryFilter}
                      onChange={e => setPluginCategoryFilter(e.target.value)}
                      className="bg-[var(--bg-userpanel)] border border-white/10 rounded px-2 py-1 text-xs text-gray-200 outline-none"
                    >
                      <option value="all">All Categories</option>
                      <option value="chat">Chat</option>
                      <option value="media">Media &amp; Voice</option>
                      <option value="ui">UI &amp; Styling</option>
                      <option value="privacy">Privacy</option>
                      <option value="utility">Utility</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Plugin List */}
              <div className="space-y-2.5">
                {filteredPlugins.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-[var(--bg-userpanel)]/40 border border-white/5 space-y-2">
                    <Layers className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                    <p className="text-sm font-semibold text-white">No plugins match your search</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Try adjusting your keywords or clearing the category filters.
                    </p>
                    <button
                      onClick={() => {
                        setPluginSearch('');
                        setPluginFilter('all');
                        setPluginCategoryFilter('all');
                      }}
                      className="mt-2 text-xs text-cyan-400 hover:underline cursor-pointer"
                    >
                      Reset all filters
                    </button>
                  </div>
                ) : (
                  filteredPlugins.map(plugin => {
                    const isEquicord = plugin.source === 'equicord';
                    const isUser = plugin.source === 'user';
                    const isVencord = plugin.source === 'vencord' || !plugin.source;

                    return (
                      <div
                        key={plugin.id}
                        className={`p-3.5 rounded-lg bg-[var(--bg-userpanel)] border transition-all ${
                          plugin.enabled
                            ? isEquicord
                              ? 'border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.06)]'
                              : isUser
                              ? 'border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.06)]'
                              : 'border-indigo-500/25'
                            : 'border-white/5 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className="font-semibold text-white text-sm">
                                {plugin.name}
                              </span>

                              {isEquicord && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5" />
                                  Equicord
                                </span>
                              )}
                              {isUser && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <Code className="w-2.5 h-2.5" />
                                  Custom
                                </span>
                              )}
                              {isVencord && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                  Vencord
                                </span>
                              )}

                              {plugin.category && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-400 capitalize">
                                  {plugin.category}
                                </span>
                              )}

                              <span className="text-[11px] text-[var(--text-muted)]">
                                by {plugin.author || (isEquicord ? 'Equicord' : 'Community')}
                              </span>
                            </div>

                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              {plugin.description}
                            </p>

                            {isUser && plugin.codeUrl && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-cyan-400 truncate">
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{plugin.codeUrl}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isUser && (
                              <button
                                onClick={() => handleUninstallPlugin(plugin.id, plugin.name)}
                                title="Uninstall Plugin"
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleTogglePlugin(plugin.id, plugin.enabled)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                                plugin.enabled
                                  ? isEquicord
                                    ? 'bg-cyan-500'
                                    : 'bg-[var(--status-online)]'
                                  : 'bg-neutral-600'
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ADD PLUGINS / EQUICORD STORE TAB */}
          {activeTab === 'add-plugins' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>Equicord Plugin Store</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Universal Engine
                        </span>
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        Browse, discover, and 1-click install official and community Equicord plugins.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('plugins');
                      setShowInstallModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Load Custom URL/Code</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    placeholder="Search plugins by name, tags, or description..."
                    className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-400 outline-none focus:border-cyan-400"
                  />
                  {storeSearch && (
                    <button
                      onClick={() => setStoreSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5 flex-wrap">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'chat', label: 'Chat' },
                    { id: 'media', label: 'Media' },
                    { id: 'ui', label: 'UI & Theme' },
                    { id: 'privacy', label: 'Privacy' },
                    { id: 'utility', label: 'Utility' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setStoreCategory(cat.id)}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        storeCategory === cat.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-indigo-950/20 border border-cyan-500/20 flex items-start gap-3">
                <Package className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 text-gray-300">
                  <span className="font-bold text-white block">Equicord Full Compatibility Layer</span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    All Equicord plugins run natively via <code className="text-cyan-300">window.Equicord</code>, <code className="text-cyan-300">window.Vencord</code>, and <code className="text-cyan-300">definePlugin()</code> sandboxing. Patches, custom webpack stores, and event hooks are isolated for optimal stability.
                  </p>
                </div>
              </div>

              {/* Catalog Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
                {EQUICORD_CATALOG.filter(plugin => {
                  if (storeCategory !== 'all' && plugin.category !== storeCategory) return false;
                  if (storeSearch.trim()) {
                    const q = storeSearch.toLowerCase();
                    const matchName = plugin.name.toLowerCase().includes(q);
                    const matchDesc = plugin.description.toLowerCase().includes(q);
                    const matchTags = plugin.tags?.some(t => t.toLowerCase().includes(q));
                    return matchName || matchDesc || matchTags;
                  }
                  return true;
                }).map(catalogItem => {
                  const isInstalled = vencord.isPluginInstalled(catalogItem.id);
                  const isEnabled = vencord.isPluginEnabled(catalogItem.id);

                  return (
                    <div
                      key={catalogItem.id}
                      className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between group shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <h4 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                              {catalogItem.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[var(--text-muted)]">
                                by {catalogItem.author || 'Equicord Community'}
                              </span>
                              {catalogItem.category && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-semibold">
                                  {catalogItem.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isInstalled ? (
                              <button
                                onClick={() => {
                                  handleTogglePlugin(catalogItem.id, isEnabled);
                                }}
                                className={`text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  isEnabled
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                                <span>{isEnabled ? 'Active' : 'Disabled'}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  vencord.installFromCatalog(catalogItem.id);
                                  setPlugins([...vencord.getPlugins()]);
                                }}
                                className="text-xs px-3 py-1 rounded-md font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1 line-clamp-2">
                          {catalogItem.description}
                        </p>
                      </div>

                      {catalogItem.tags && catalogItem.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-3 pt-2 border-t border-white/5">
                          {catalogItem.tags.slice(0, 4).map(tag => (
                            <span
                              key={tag}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-gray-400"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VOICE TAB */}
          {activeTab === 'voice' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Voice &amp; Video Settings</h2>
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
                      Targeting sub-40ms round-trip latency via direct WebRTC SFU with 48kHz Opus audio and 0ms jitter buffer target.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Screen Share Quality
                  </label>
                  <select className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded px-3 py-2 text-sm text-white outline-none">
                    <option value="1080p60">1080p @ 60 FPS (Nitro Source)</option>
                    <option value="1440p60">1440p @ 60 FPS</option>
                    <option value="4k60">4K @ 60 FPS</option>
                    <option value="720p30">720p @ 30 FPS</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Noise Suppression (Synced)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'krisp', label: 'Krisp / RNNoise' },
                        { id: 'standard', label: 'Standard' },
                        { id: 'none', label: 'None' },
                      ] as ReadonlyArray<{ id: NoiseSuppressionMode; label: string }>
                    ).map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          void discordSettingsSync.updateSetting('noiseSuppression', mode.id)
                        }
                        className={`py-2 px-3 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                          syncSettings.noiseSuppression === mode.id
                            ? 'border-cyan-400 bg-cyan-500/20 text-white'
                            : 'border-white/10 bg-[var(--bg-userpanel)] text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Synced Audio Gain & Processing */}
                <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">Input Volume (Mic Gain)</span>
                      <span className="font-mono text-cyan-300">{syncSettings.inputVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={5}
                      value={syncSettings.inputVolume}
                      onChange={e =>
                        void discordSettingsSync.updateSetting(
                          'inputVolume',
                          Number(e.target.value)
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">Output Volume (Master Gain)</span>
                      <span className="font-mono text-cyan-300">{syncSettings.outputVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={5}
                      value={syncSettings.outputVolume}
                      onChange={e =>
                        void discordSettingsSync.updateSetting(
                          'outputVolume',
                          Number(e.target.value)
                        )
                      }
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    {(
                      [
                        {
                          key: 'echoCancellation',
                          label: 'Echo Cancellation',
                          desc: 'Prevent speaker feedback loop',
                        },
                        {
                          key: 'automaticGainControl',
                          label: 'Automatic Gain Control',
                          desc: 'Normalize microphone levels',
                        },
                      ] as const
                    ).map(item => {
                      const active = Boolean(syncSettings[item.key]);
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/25 border border-white/5"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">{item.label}</div>
                            <div className="text-[10px] text-gray-400">{item.desc}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            aria-label={item.label}
                            onClick={() =>
                              void discordSettingsSync.updateSetting(item.key, !active)
                            }
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors flex-shrink-0 ${
                              active ? 'bg-cyan-500' : 'bg-neutral-600'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                                active ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* External Voice Gateways & Call Proxies */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>External Voice Gateways &amp; Call Proxies</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Optional tool: Proxy audio to Discord Voice calls or connect to Stoat-hosted instances.
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase">
                      Optional Tool
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-[#12151f] to-[#181d2a] border border-amber-500/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>Active Gateway:</span>
                            <span className="text-amber-300 font-mono">
                              {proxySession.status === 'connected'
                                ? proxySession.provider === 'discord_proxy'
                                  ? 'Discord Voice Proxy'
                                  : 'Stoat-Hosted WebRTC'
                                : 'Native LiveKit SFU (Default)'}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {proxySession.status === 'connected'
                              ? `In Call: ${proxySession.targetName} (${proxySession.ping}ms)`
                              : 'Native sub-30ms SFU active. External proxy disabled.'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowVoiceProxyModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Configure Voice Proxy...</span>
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <b>TOS Warning:</b> Unofficial Discord voice proxying operates outside Discord's official client and may carry account risks. Stoat calls connect to open-source decentralized WebRTC nodes without Discord affiliation.
                      </span>
                    </div>
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
                  <span>End-to-End Encryption &amp; Double Puppeting Active</span>
                </div>
              </div>

              {/* Privacy & Safety (Synced Bidirectionally with Discord) */}
              <div className="bg-[var(--bg-userpanel)] rounded-xl p-5 border border-white/10 space-y-3">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Privacy &amp; Safety (Discord Bidirectional Sync)
                </div>

                {(
                  [
                    {
                      key: 'dmSpamFilter',
                      label: 'Direct Message Spam Filter',
                      desc: 'Automatically scan and filter suspicious DM invites and links.',
                    },
                    {
                      key: 'allowDmsFromServerMembers',
                      label: 'Allow Direct Messages from Server Members',
                      desc: 'Let members in shared Discord and self-hosted servers message you.',
                    },
                  ] as const
                ).map(item => {
                  const active = Boolean(syncSettings[item.key]);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-4 pt-2 border-t border-white/5 first:border-t-0 first:pt-0"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{item.label}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{item.desc}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={item.label}
                        onClick={() =>
                          void discordSettingsSync.updateSetting(item.key, !active)
                        }
                        className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors flex-shrink-0 ${
                          active ? 'bg-cyan-500' : 'bg-neutral-600'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                            active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Optional Discord Token Connection */}
              <div className="bg-[var(--bg-userpanel)] rounded-xl p-5 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    <span>Discord Token (Optional Live API Sync)</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      syncSettings.discordTokenConnected
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {syncSettings.discordTokenConnected ? 'Connected' : 'Hybrid Local Only'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Optional: Save your Discord user token locally (`protutech_discord_token`) to forward settings, quests, and bridge requests directly to Discord API.
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showDiscordToken ? 'text' : 'password'}
                      value={discordTokenInput}
                      onChange={e => setDiscordTokenInput(e.target.value)}
                      placeholder="Paste optional Discord token..."
                      className="w-full bg-black/35 border border-white/10 focus:border-cyan-400 rounded-lg px-3 py-2 pr-9 text-xs font-mono text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDiscordToken(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                    >
                      {showDiscordToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      discordSettingsSync.setDiscordToken(discordTokenInput);
                      setTokenSavedNotice('Token saved ✓');
                      window.setTimeout(() => setTokenSavedNotice(null), 2000);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold cursor-pointer"
                  >
                    Save Token
                  </button>
                  {syncSettings.discordTokenConnected && (
                    <button
                      type="button"
                      onClick={() => {
                        setDiscordTokenInput('');
                        discordSettingsSync.setDiscordToken('');
                        setTokenSavedNotice('Cleared');
                        window.setTimeout(() => setTokenSavedNotice(null), 2000);
                      }}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 text-gray-300 text-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {tokenSavedNotice && (
                  <div className="text-xs text-emerald-300 font-semibold">{tokenSavedNotice}</div>
                )}
              </div>
            </div>
          )}

          {/* DESKTOP APP TAB */}
          {activeTab === 'desktop' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Desktop Application</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Standalone native desktop client (Electron &amp; Rust/Tauri v2) with ultra-low latency, global hotkeys, and Microsoft Store packaging.
                </p>
              </div>

              {/* Intuitive Microsoft Store Publish & Install Card */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-sky-950/60 via-[#10182b] to-indigo-950/40 border border-sky-400/35 shadow-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">
                          Microsoft Store Publish &amp; Install Hub
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                          APPX / MSIX
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-0.5">
                        1-click Windows Store install, direct <code className="text-sky-300">.appx</code> package, and Partner Center submission checklist.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenStoreHub}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Store className="w-4 h-4" />
                    <span>Open Microsoft Store Hub</span>
                  </button>
                  <a
                    href="ms-windows-store://pdp/?productid=00013812596749763330"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sky-200 hover:text-white text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Store App</span>
                  </a>
                </div>
              </div>

              {isNativeDesktop ? (
                <div className="space-y-4">
                  <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] shadow-[0_0_8px_rgba(35,165,90,0.6)]" />
                        <span className="font-semibold text-white">
                          Native {runtimeKind === 'tauri' ? 'Tauri v2 (Rust)' : 'Electron'} Windows Client Active
                        </span>
                      </div>
                      <span className="text-xs bg-[var(--discord-blurple)] text-white px-2 py-0.5 rounded font-mono">
                        v1.0.0
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Running with hardware-accelerated WebRTC Opus 48kHz audio, H.264 video codec, and system tray persistence.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Global Desktop Hotkeys
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Toggle In-Game Overlay</span>
                      <kbd className="bg-black/40 border border-white/15 px-2 py-1 rounded text-xs font-mono text-cyan-300">
                        Ctrl + Shift + O
                      </kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Toggle Microphone Mute</span>
                      <kbd className="bg-black/40 border border-white/15 px-2 py-1 rounded text-xs font-mono text-gray-300">
                        Ctrl + Shift + M
                      </kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Toggle Headphone Deafen</span>
                      <kbd className="bg-black/40 border border-white/15 px-2 py-1 rounded text-xs font-mono text-gray-300">
                        Ctrl + Shift + D
                      </kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-white/10 flex items-center justify-between">
                      <span className="text-sm text-white">Close Window Behavior</span>
                      <span className="text-xs text-[var(--status-online)] font-semibold">
                        Minimizes to System Tray
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-[var(--discord-blurple)]/20 to-[var(--bg-userpanel)] rounded-lg p-6 border border-[var(--discord-blurple)]/40 space-y-4">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-8 h-8 text-[var(--discord-blurple)]" />
                      <div>
                        <h3 className="font-bold text-white text-base">Protutech for Windows</h3>
                        <p className="text-xs text-[var(--text-muted)]">64-bit Standalone Executable (.exe) &amp; Store AppX</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300">
                      Install or run the native desktop client for global hotkeys (overlay, push-to-mute), seamless 1080p60/4K60 screen capture, background system tray audio, and local custom CSS theme loading.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <a
                        href="/downloads/ProtutechChat-Store.appx"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-4 py-2.5 rounded font-semibold text-sm shadow-md transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Store (.appx)</span>
                      </a>
                      <a
                        href="/downloads/ProtutechChat-Setup.exe"
                        className="inline-flex items-center gap-2 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white px-4 py-2.5 rounded font-semibold text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Windows Installer (.exe)</span>
                      </a>
                      <a
                        href="/downloads/ProtutechChat-Portable.exe"
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

          {/* App Icon Customization Tab */}
          {activeTab === 'app-icon' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Protutech Application Icon</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Personalize your Protutech experience with custom app icons. Updates your browser favicon, tab insignia, desktop taskbar, and dock instantly.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c101c] to-[#111827] border border-cyan-500/20 shadow-xl">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Live Dock &amp; Taskbar Preview</span>
                  <span className="text-[10px] text-gray-400 font-mono">Real-time update</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 bg-black/40 p-4 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e2337]/80 border border-white/10 shadow-inner">
                    <div className="relative group p-1.5 rounded-lg bg-white/10 shadow-md">
                      <img
                        src={currentIcon}
                        alt="Current Icon"
                        className="w-10 h-10 rounded-lg object-contain drop-shadow"
                      />
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>Currently Active Icon</span>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Applied across window title bar, browser tabs, and desktop taskbar.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => handleSelectIcon('/protutech_logo.png')}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-cyan-400" />
                        <span>Reset to Official Emblem</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Official Preset Insignias
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {APP_ICON_PRESETS.map(preset => {
                    const isSelected = currentIcon === preset.url;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectIcon(preset.url)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 relative group ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border-cyan-400/80 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                            : 'bg-[var(--bg-userpanel)] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl p-1.5 flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${preset.previewGradient} border border-white/10 shadow-md`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-contain drop-shadow"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-white truncate">{preset.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-white/10 text-cyan-300">
                              {preset.tag}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                            {preset.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Upload Custom App Icon</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Upload any custom image file (PNG, JPG, SVG, WebP recommended 512x512). The image is processed locally in your browser and instantly set as your application icon.
                </p>

                {customIconError && (
                  <div className="mb-2 p-2.5 rounded bg-[var(--status-dnd)]/10 border border-[var(--status-dnd)]/30 text-[var(--status-dnd)] text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{customIconError}</span>
                  </div>
                )}

                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-md">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Image File...</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleCustomIconUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Call Proxy Modal */}
      <VoiceProxyModal
        isOpen={showVoiceProxyModal}
        onClose={() => setShowVoiceProxyModal(false)}
      />

      {/* Local Microsoft Store Modal fallback if parent didn't pass onOpenMicrosoftStore */}
      {!onOpenMicrosoftStore && (
        <MicrosoftStoreModal
          isOpen={showLocalStoreModal}
          onClose={() => setShowLocalStoreModal(false)}
        />
      )}

      {/* Local Discord Hub Modal fallback if parent didn't pass onOpenDiscordHub */}
      {!onOpenDiscordHub && (
        <DiscordHubModal
          isOpen={showLocalDiscordHub}
          onClose={() => setShowLocalDiscordHub(false)}
          initialTab={localDiscordHubTab}
        />
      )}

      {/* Local Equicord Modal fallback if parent didn't pass onOpenEquicord */}
      {!onOpenEquicord && (
        <EquicordModal
          isOpen={showLocalEquicord}
          onClose={() => setShowLocalEquicord(false)}
        />
      )}
    </div>
  );
};
