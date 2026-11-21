import React, { useState, useEffect, useCallback } from 'react';
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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Music,
  ZoomIn,
  ZoomOut,
  Headphones,
  LayoutGrid,
  ListTree,
} from 'lucide-react';
import { vencord, EQUICORD_CATALOG } from '../services/vencord';
import { appIconService, APP_ICON_PRESETS } from '../services/appIcon';
import { voiceProxy } from '../services/voiceProxy';
import { desktopBridge } from '../services/desktopBridge';
import { livekit } from '../services/livekit';
import { zoomService, ZOOM_STEPS } from '../services/zoom';
import { soundboardService } from '../services/soundboard';
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
import { SoundboardPopover } from './SoundboardPopover';
import { CameraPreviewPanel } from './CameraPreviewPanel';
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
  onOpenSoundboard?: () => void;
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
  onOpenSoundboard,
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
  const [showLocalSoundboard, setShowLocalSoundboard] = useState(false);
  const [proxySession, setProxySession] = useState(voiceProxy.getSession());
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(vencord.getTheme());
  const [customCss, setCustomCss] = useState(themeConfig.customCssText || '');
  const [customUrl, setCustomUrl] = useState(themeConfig.customCssUrl || '');
  const [plugins, setPlugins] = useState(vencord.getPlugins());

  // Zoom & Audio Device / Mic Test / Soundboard States
  const [zoomPercent, setZoomPercent] = useState<number>(() => zoomService.getZoom());
  const [micLoopbackEnabled, setMicLoopbackEnabled] = useState<boolean>(() =>
    livekit.isMicLoopbackEnabled()
  );
  const [micTestBusy, setMicTestBusy] = useState(false);
  const [loopbackVolume, setLoopbackVolume] = useState<number>(() => livekit.getLoopbackVolume());
  const [micAudioLevel, setMicAudioLevel] = useState<number>(() => livekit.getAudioLevel());
  const [isMicSpeaking, setIsMicSpeaking] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>(() =>
    livekit.getSelectedInputDeviceId()
  );
  const [selectedOutputId, setSelectedOutputId] = useState<string>(() =>
    livekit.getSelectedOutputDeviceId()
  );
  const [soundboardVolume, setSoundboardVolume] = useState<number>(() =>
    soundboardService.getMasterVolume()
  );
  const [soundboardMuted, setSoundboardMuted] = useState<boolean>(() =>
    soundboardService.isMuted()
  );
  const [screenQuality, setScreenQuality] = useState<'1080p60' | '1440p60' | '4k60' | '720p30'>(() => {
    try {
      const saved = localStorage.getItem('protutech_screen_quality');
      if (saved === '1080p60' || saved === '1440p60' || saved === '4k60' || saved === '720p30') {
        return saved;
      }
    } catch {
      // ignore
    }
    return '1080p60';
  });
  const [appVersion, setAppVersion] = useState<string>('1.0.3');
  const [windowBoundsResetNotice, setWindowBoundsResetNotice] = useState(false);

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

  const refreshAudioDevices = useCallback(async () => {
    try {
      const { inputs, outputs } = await livekit.listAudioDevices();
      setAudioInputs(inputs);
      setAudioOutputs(outputs);
    } catch {
      // Ignore device enumeration errors
    }
  }, []);

  useEffect(() => {
    const unsubIcon = appIconService.subscribe(setCurrentIcon);
    const unsubVoice = voiceProxy.subscribe(setProxySession);
    const unsubProfile = userProfileService.subscribe(p => setProfileDraft(p));
    const unsubOverlay = overlayService.subscribe(cfg => setOverlayConfig(cfg));
    const unsubSync = discordSettingsSync.subscribe(s => setSyncSettings(s));
    const unsubVencord = vencord.subscribe(() => {
      setPlugins(vencord.getPlugins());
      setThemeConfig(vencord.getTheme());
    });
    const unsubZoom = zoomService.subscribe(setZoomPercent);
    const unsubSoundboard = soundboardService.subscribe(() => {
      setSoundboardVolume(soundboardService.getMasterVolume());
      setSoundboardMuted(soundboardService.isMuted());
    });
    const unsubAudioLevel = livekit.subscribeAudioLevel((lvl, speaking) => {
      setMicAudioLevel(lvl);
      setIsMicSpeaking(speaking);
    });
    const unsubLivekit = livekit.subscribe(() => {
      setMicLoopbackEnabled(livekit.isMicLoopbackEnabled());
      setLoopbackVolume(livekit.getLoopbackVolume());
    });
    return () => {
      unsubIcon();
      unsubVoice();
      unsubProfile();
      unsubOverlay();
      unsubSync();
      unsubVencord();
      unsubZoom();
      unsubSoundboard();
      unsubAudioLevel();
      unsubLivekit();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/version.json')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { version?: string } | null) => {
        if (!cancelled && data?.version && typeof data.version === 'string') {
          setAppVersion(data.version);
        }
      })
      .catch(() => {
        // Keep initial fallback 1.0.3
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncQuality = () => {
      try {
        const saved = localStorage.getItem('protutech_screen_quality');
        if (saved === '1080p60' || saved === '1440p60' || saved === '4k60' || saved === '720p30') {
          setScreenQuality(saved);
        }
      } catch {
        // ignore
      }
    };
    if (isOpen) {
      void Promise.resolve().then(syncQuality);
    }
    window.addEventListener('storage', syncQuality);
    return () => window.removeEventListener('storage', syncQuality);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'voice') return;
    let cancelled = false;
    const loadDevices = async () => {
      try {
        const { inputs, outputs } = await livekit.listAudioDevices();
        if (!cancelled) {
          setAudioInputs(inputs);
          setAudioOutputs(outputs);
        }
      } catch {
        // Ignore device enumeration errors
      }
    };
    void loadDevices();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      const onDeviceChange = () => {
        void loadDevices();
      };
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
      return () => {
        cancelled = true;
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showInstallModal) {
        setShowInstallModal(false);
        return;
      }
      if (
        showVoiceProxyModal ||
        showLocalStoreModal ||
        showLocalDiscordHub ||
        showLocalEquicord ||
        showLocalSoundboard
      ) {
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [
    isOpen,
    onClose,
    showInstallModal,
    showVoiceProxyModal,
    showLocalStoreModal,
    showLocalDiscordHub,
    showLocalEquicord,
    showLocalSoundboard,
  ]);

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

  const handleOpenSoundboardModal = () => {
    if (onOpenSoundboard) {
      onOpenSoundboard();
    } else {
      setShowLocalSoundboard(true);
    }
  };

  const handleToggleMicTest = async () => {
    setMicTestBusy(true);
    try {
      const next = !micLoopbackEnabled;
      const result = await livekit.setMicLoopback(next);
      setMicLoopbackEnabled(result);
      await refreshAudioDevices();
    } finally {
      setMicTestBusy(false);
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
    if (
      syncSettings.syncEnabled &&
      (themeName === 'dark' || themeName === 'light' || themeName === 'midnight')
    ) {
      void discordSettingsSync.updateSetting('theme', themeName);
    }
  };

  const handleApplyCustomCss = () => {
    const updated: ThemeConfig = {
      ...themeConfig,
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
    <div
      data-testid="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed top-[28px] inset-x-0 bottom-0 z-50 bg-[var(--bg-chat)] flex overflow-hidden"
    >
      {/* Circular ESC Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Settings"
        data-testid="settings-close-btn"
        className="absolute top-4 right-5 text-[var(--text-muted)] hover:text-[var(--text-header)] flex flex-col items-center gap-1 group z-20 cursor-pointer"
      >
        <div className="w-9 h-9 rounded-full border-2 border-[var(--text-muted)] group-hover:border-[var(--text-header)] group-hover:bg-[var(--bg-item-hover)] flex items-center justify-center transition-colors">
          <X className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-bold tracking-wider">ESC</span>
      </button>

      {/* Left Settings Sidebar */}
      <div className="w-44 sm:w-56 md:w-64 bg-[var(--bg-channels)] px-3 sm:px-4 py-5 flex flex-col justify-between select-none border-r border-[var(--border-subtle)] overflow-y-auto min-h-0 flex-shrink-0">
        <div className="space-y-5">
          {/* User Settings Category */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2.5 mb-1.5">
              User Settings
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[var(--discord-blurple)]" />
                  <span>User Profile</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-userpanel)] text-[var(--text-link)] font-bold">
                  Custom
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'account'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                My Account
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'voice'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                Voice &amp; Video
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('overlay')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  activeTab === 'overlay'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--status-online)]" />
                  <span>In-Game Overlay</span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    overlayConfig.enabled
                      ? 'bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/30'
                      : 'bg-[var(--bg-userpanel)] text-[var(--text-muted)]'
                  }`}
                >
                  {overlayConfig.enabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>

          {/* Appearance & Extensions Category */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2.5 mb-1.5 flex items-center gap-1.5">
              <Puzzle className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
              <span>Appearance &amp; Plugins</span>
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('themes')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === 'themes'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <Paintbrush className="w-4 h-4" />
                <span>Appearance</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('plugins')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  activeTab === 'plugins'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>Plugins</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-userpanel)] text-[var(--text-link)] font-bold">
                  Equicord
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('add-plugins')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  activeTab === 'add-plugins'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--discord-blurple)]" />
                  <span>Add Plugins</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--discord-blurple)] text-white font-bold">
                  Store
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === 'desktop'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Desktop App</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('app-icon')}
                className={`w-full text-left px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  activeTab === 'app-icon'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-normal)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[var(--discord-blurple)]" />
                  <span>App Icon</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-userpanel)] text-[var(--text-link)] font-bold">
                  Custom
                </span>
              </button>
            </div>
          </div>

          {/* Community Hub & Equicord Shortcuts */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2.5 mb-1.5 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[var(--status-idle)]" />
              <span>Community</span>
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleOpenDiscordHubModal('quests')}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-semibold text-[var(--text-normal)] bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-[var(--status-idle)]" />
                  <span>Community Hub</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-[var(--status-idle)] font-bold">
                  Quests
                </span>
              </button>
              <button
                type="button"
                onClick={handleOpenEquicordModal}
                className="w-full text-left px-3 py-1.5 rounded text-xs font-semibold text-[var(--text-normal)] bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                  <span>Equicord Engine</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-channels)] text-[var(--text-link)] font-bold">
                  25+
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="pt-3 border-t border-[var(--border-subtle)] mt-4">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium text-[var(--status-dnd)] hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Right Settings Content */}
      <div className="flex-1 min-w-0 min-h-0 bg-[var(--bg-chat)] overflow-y-auto relative">
        <div className="max-w-3xl mx-auto px-5 sm:px-10 py-6 sm:py-8 pr-16 sm:pr-20">
          {/* Preferences Sync Status Bar */}
          <div className="mb-6 p-3.5 rounded-lg bg-[var(--bg-channels)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-link)]">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-header)]">
                      Preferences Sync
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        syncSettings.syncEnabled
                          ? 'bg-emerald-500/15 text-[var(--status-online)] border-emerald-500/35'
                          : 'bg-[var(--bg-userpanel)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {syncSettings.syncEnabled
                        ? syncSettings.lastSyncedAt
                          ? 'Synced ✓'
                          : 'Active ✓'
                        : 'Paused'}
                    </span>
                    {syncSettings.discordTokenConnected && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-userpanel)] text-[var(--text-link)] font-semibold border border-[var(--border-subtle)]">
                        Bridge Connected
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
                    <span>{syncSettings.lastSyncLog}</span>
                    {syncSettings.lastSyncedAt && (
                      <span className="font-mono text-[var(--text-link)]">
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
                <label className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-normal)] cursor-pointer select-none">
                  <span>Auto-Sync</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={syncSettings.syncEnabled}
                    aria-label="Toggle Auto-Sync"
                    onClick={() =>
                      void discordSettingsSync.updateSetting(
                        'syncEnabled',
                        !syncSettings.syncEnabled
                      )
                    }
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                      syncSettings.syncEnabled ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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
                  className="px-2.5 py-1 rounded bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-xs font-semibold text-[var(--text-normal)] border border-[var(--border-subtle)] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncBusy === 'pull' ? 'animate-spin' : ''}`} />
                  <span>Pull</span>
                </button>

                <button
                  type="button"
                  disabled={syncBusy !== null}
                  onClick={() => void handlePushToDiscord()}
                  className="px-2.5 py-1 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-xs font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3 h-3" />
                  <span>Push</span>
                </button>
              </div>
            </div>
          </div>
          {/* USER PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-header)] mb-1">
                    User Profile
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Customize your profile card, banner, avatar decoration, and status.
                  </p>
                </div>
                {profileSavedToast && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[var(--status-online)] text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              {/* Live Profile Card Preview */}
              <div
                className="rounded-xl overflow-hidden border shadow-xl bg-[var(--bg-userpanel)]"
                style={{ borderColor: profileDraft.accentColor || 'var(--discord-blurple)' }}
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
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)]"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-extrabold text-[var(--text-header)]">
                      {previewDisplayName}
                    </h3>
                    {profileDraft.pronouns && (
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-channels)] text-[var(--text-normal)] text-[11px] font-medium">
                        {profileDraft.pronouns}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">{userId}</div>

                  {(profileDraft.customStatus || profileDraft.customStatusEmoji) && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-channels)] border border-[var(--border-subtle)] text-xs text-[var(--text-normal)]">
                      {profileDraft.customStatusEmoji && <span>{profileDraft.customStatusEmoji}</span>}
                      <span>{profileDraft.customStatus || 'Custom status'}</span>
                    </div>
                  )}

                  {profileDraft.bio && (
                    <p className="mt-3 text-xs text-[var(--text-normal)] leading-relaxed whitespace-pre-wrap border-t border-[var(--border-subtle)] pt-2.5">
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
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                      aria-label="Status Emoji"
                      value={profileDraft.customStatusEmoji}
                      onChange={e =>
                        setProfileDraft(p => ({ ...p, customStatusEmoji: e.target.value }))
                      }
                      maxLength={4}
                      className="w-14 text-center bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-2 py-2 text-sm text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                      title="Status Emoji"
                    />
                    <input
                      type="text"
                      aria-label="Custom Status Text"
                      value={profileDraft.customStatus}
                      onChange={e => setProfileDraft(p => ({ ...p, customStatus: e.target.value }))}
                      placeholder="What are you playing or working on?"
                      className="flex-1 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                    />
                    <select
                      aria-label="Presence Status"
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
                      className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-2.5 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                            ? 'bg-[var(--bg-item-active)] border-[var(--discord-blurple)]'
                            : 'bg-[var(--bg-userpanel)] border-[var(--border-subtle)] hover:bg-[var(--bg-item-hover)]'
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
                    About Me
                  </label>
                  <textarea
                    rows={3}
                    value={profileDraft.bio}
                    onChange={e => setProfileDraft(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Write a short bio for your profile..."
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] resize-none"
                  />
                </div>

                {/* Avatar URL + Upload */}
                <div className="p-3.5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2.5">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Avatar Image URL or Upload
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={profileDraft.avatarUrl}
                      onChange={e => setProfileDraft(p => ({ ...p, avatarUrl: e.target.value }))}
                      placeholder="https://... or upload an image file"
                      className="flex-1 min-w-[200px] bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold cursor-pointer transition-colors">
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
                        className="px-2.5 py-1.5 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-xs text-[var(--text-normal)] cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {profileAvatarError && (
                    <p className="text-xs text-[var(--status-dnd)]">{profileAvatarError}</p>
                  )}
                </div>

                {/* Banner Color / Image & Accent Color */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                      Banner Color &amp; Accent
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-muted)]">Banner:</span>
                        <input
                          type="color"
                          aria-label="Banner color"
                          value={profileDraft.bannerColor}
                          onChange={e =>
                            setProfileDraft(p => ({ ...p, bannerColor: e.target.value }))
                          }
                          className="w-8 h-7 rounded bg-transparent border border-[var(--border-subtle)] cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-[11px] text-[var(--text-muted)]">Accent:</span>
                        <input
                          type="color"
                          aria-label="Accent color"
                          value={profileDraft.accentColor}
                          onChange={e =>
                            setProfileDraft(p => ({ ...p, accentColor: e.target.value }))
                          }
                          className="w-8 h-7 rounded bg-transparent border border-[var(--border-subtle)] cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {BANNER_PRESET_COLORS.map(col => (
                        <button
                          key={col}
                          type="button"
                          aria-label={`Select banner color ${col}`}
                          onClick={() => setProfileDraft(p => ({ ...p, bannerColor: col }))}
                          className={`w-5 h-5 rounded-full border cursor-pointer ${
                            profileDraft.bannerColor === col ? 'border-[var(--text-header)] scale-110' : 'border-[var(--border-subtle)]'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                      Banner Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={profileDraft.bannerUrl}
                      onChange={e => setProfileDraft(p => ({ ...p, bannerUrl: e.target.value }))}
                      placeholder="https://.../banner.png"
                      className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                          className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            selected
                              ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] text-[var(--text-header)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-userpanel)] text-[var(--text-normal)] hover:bg-[var(--bg-item-hover)]'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-[var(--bg-popout)] ${dec.cssClass}`}
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
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setProfileDraft(userProfileService.getProfile())}
                    className="px-3 py-2 rounded text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-header)] bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] cursor-pointer"
                  >
                    Discard Edits
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
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
            <div className="space-y-6 max-w-2xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-[var(--text-header)]">
                    In-Game Overlay
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/30 font-bold uppercase">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  Floating HUD for active voice participants, telemetry, and chat alerts.
                </p>
              </div>

              {/* Master Toggle Card */}
              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-[var(--text-header)]">
                    Enable Overlay
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Toggle anytime from the title bar, user bar, or hotkey.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={overlayConfig.enabled}
                  aria-label="Enable In-Game Overlay"
                  onClick={() => {
                    const next = overlayService.toggleEnabled();
                    void desktopBridge.setOverlayMode(next, overlayConfig.isInteractive);
                  }}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    overlayConfig.enabled ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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
              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Screen Position
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
                      className={`py-2 px-3 rounded border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                        overlayConfig.position === pos.id
                          ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] text-[var(--text-header)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)]'
                      }`}
                    >
                      <span>{pos.label}</span>
                      {overlayConfig.position === pos.id && (
                        <Check className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-header)]">Overlay Opacity</span>
                  <span className="font-mono text-[var(--text-link)]">
                    {Math.round(overlayConfig.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Overlay Opacity"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={overlayConfig.opacity}
                  onChange={e =>
                    overlayService.updateConfig({ opacity: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
                />
              </div>

              {/* Behavior Switches */}
              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  HUD Options
                </div>

                {[
                  {
                    key: 'compactMode' as const,
                    label: 'Compact Mode',
                    desc: 'Condensed participant pills.',
                  },
                  {
                    key: 'showOnlySpeaking' as const,
                    label: 'Speaking-Only Filter',
                    desc: 'Show only active speakers.',
                  },
                  {
                    key: 'showChatToasts' as const,
                    label: 'Chat Toasts',
                    desc: 'Display incoming chat messages briefly.',
                  },
                  {
                    key: 'showTelemetry' as const,
                    label: 'Ping & FPS Telemetry',
                    desc: 'Display live RTC latency and frame rate.',
                  },
                ].map(item => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 pt-2 border-t border-[var(--border-subtle)] first:border-t-0 first:pt-0"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-header)]">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={overlayConfig[item.key]}
                      aria-label={item.label}
                      onClick={() =>
                        overlayService.updateConfig({ [item.key]: !overlayConfig[item.key] })
                      }
                      className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                        overlayConfig[item.key] ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-header)] flex items-center gap-1.5">
                      {overlayConfig.isInteractive ? (
                        <Unlock className="w-3.5 h-3.5 text-[var(--status-online)]" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[var(--status-idle)]" />
                      )}
                      <span>
                        {overlayConfig.isInteractive
                          ? 'Unlocked (Interactive)'
                          : 'Locked (Click-Through)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Let mouse clicks pass through to your game when locked.
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
                        ? 'bg-emerald-500/15 text-[var(--status-online)] border-emerald-500/40'
                        : 'bg-amber-500/15 text-[var(--status-idle)] border-amber-500/40'
                    }`}
                  >
                    {overlayConfig.isInteractive ? 'Lock HUD' : 'Unlock HUD'}
                  </button>
                </div>
              </div>

              {/* Hotkey & Preview Toast */}
              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text-header)]">
                    Toggle Hotkey
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Press{' '}
                    <kbd className="bg-[var(--bg-channels)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded font-mono text-[var(--text-link)]">
                      {overlayConfig.hotkey || 'Ctrl+Shift+O'}
                    </kbd>{' '}
                    or <kbd className="bg-[var(--bg-channels)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded font-mono text-[var(--text-normal)]">Alt+Shift+O</kbd>.
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
                      senderName: 'System',
                      body: 'Overlay toast preview active.',
                      source: 'app',
                    });
                  }}
                  className="px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Preview Toast</span>
                </button>
              </div>
            </div>
          )}

          {/* THEMES / APPEARANCE TAB */}
          {activeTab === 'themes' && (() => {
            const zoomStepIndex = ZOOM_STEPS.reduce(
              (bestIdx, step, idx) =>
                Math.abs(step - zoomPercent) < Math.abs(ZOOM_STEPS[bestIdx] - zoomPercent)
                  ? idx
                  : bestIdx,
              0
            );
            const themePresets: ReadonlyArray<{
              id: ThemeConfig['activeTheme'];
              name: string;
              badge: string;
              desc: string;
              colors: string[];
            }> = [
              {
                id: 'dark',
                name: 'Protutech Obsidian',
                badge: 'Default',
                desc: 'Obsidian dark workspace with crisp cyan highlights.',
                colors: ['#080c16', '#101626', '#141c2f', '#0284c7'],
              },
              {
                id: 'revolt' as ThemeConfig['activeTheme'],
                name: 'Revolt / Stoat',
                badge: 'Stoat',
                desc: 'High-contrast charcoal slate with Stoat crimson accents.',
                colors: ['#19191d', '#202026', '#26262e', '#ff4654'],
              },
              {
                id: 'classic-dark' as ThemeConfig['activeTheme'],
                name: 'Classic Dark',
                badge: 'Classic',
                desc: 'Familiar matte charcoal palette with blurple accents.',
                colors: ['#1e1f22', '#2b2d31', '#313338', '#5865f2'],
              },
              {
                id: 'light',
                name: 'Light Mode',
                badge: 'Light',
                desc: 'Clean, bright workspace for daytime clarity.',
                colors: ['#e3e5e8', '#f2f3f5', '#ffffff', '#0284c7'],
              },
              {
                id: 'midnight',
                name: 'Midnight AMOLED',
                badge: 'OLED',
                desc: 'Pure #000000 black background for OLED displays.',
                colors: ['#000000', '#080808', '#101010', '#0284c7'],
              },
              {
                id: 'translucent',
                name: 'Frosted Translucent',
                badge: 'Aero Glass',
                desc: 'Glassmorphic frosted acrylic with 20px blur.',
                colors: ['#070d22', '#0a122a', '#0d1636', '#38bdf8'],
              },
              {
                id: 'transparent',
                name: 'Pure Transparent',
                badge: 'Acrylic Clear',
                desc: 'See-through panels for custom desktop wallpapers.',
                colors: ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.15)', '#38bdf8'],
              },
              {
                id: 'catppuccin',
                name: 'Catppuccin Mocha',
                badge: 'Pastel',
                desc: 'Soothing pastel lavender and dark mauve tones.',
                colors: ['#11111b', '#181825', '#1e1e2e', '#cba6f7'],
              },
              {
                id: 'nord',
                name: 'Nord Frost',
                badge: 'Arctic',
                desc: 'Clean arctic polar palette with icy blue accents.',
                colors: ['#242933', '#2e3440', '#3b4252', '#88c0d0'],
              },
              {
                id: 'cyberpunk',
                name: 'Cyberpunk Neon',
                badge: 'Vibrant',
                desc: 'Neon synthwave aesthetic with magenta accents.',
                colors: ['#0d041a', '#14072b', '#1d0b45', '#f43f5e'],
              },
              {
                id: 'crimson',
                name: 'Crimson Moon',
                badge: 'Ruby',
                desc: 'Deep obsidian shadows with striking ruby crimson.',
                colors: ['#080304', '#0f0508', '#1a080d', '#f43f5e'],
              },
              {
                id: 'emerald',
                name: 'Emerald Matrix',
                badge: 'Matrix',
                desc: 'Dark emerald palette with phosphor highlights.',
                colors: ['#020d08', '#04170e', '#062819', '#10b981'],
              },
              {
                id: 'solarized',
                name: 'Twilight Amber',
                badge: 'Warm Dark',
                desc: 'Golden amber and brass highlights on warm charcoal.',
                colors: ['#0e0c07', '#16120b', '#211c12', '#f59e0b'],
              },
              {
                id: 'teamspeak',
                name: 'TeamSpeak Classic',
                badge: 'TS3 Palette',
                desc: 'Classic high-contrast navy slate palette.',
                colors: ['#182230', '#202c3d', '#263447', '#2563eb'],
              },
              {
                id: 'custom',
                name: 'Custom CSS Engine',
                badge: 'Engine',
                desc: 'Load external or local custom CSS stylesheets.',
                colors: ['#080c16', '#101626', '#0284c7', '#38bdf8'],
              },
            ];
            return (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-header)] mb-1">Appearance</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Choose your theme, workspace layout, zoom scale, and custom CSS.
                  </p>
                </div>

                {/* Theme Presets */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Theme Presets
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {themePresets.map(t => (
                      <div
                        key={t.id}
                        data-testid={`theme-card-${t.id}`}
                        onClick={() => handleSelectTheme(t.id)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                          themeConfig.activeTheme === t.id
                            ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] ring-1 ring-[var(--discord-blurple)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-userpanel)] hover:bg-[var(--bg-channels)]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between font-semibold text-[var(--text-header)] mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm">{t.name}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-channels)] text-[var(--text-muted)]">
                                {t.badge}
                              </span>
                            </div>
                            {themeConfig.activeTheme === t.id && (
                              <Check className="w-4 h-4 text-[var(--discord-blurple)] flex-shrink-0" />
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
                              className="w-4 h-4 rounded-sm border border-[var(--border-subtle)] inline-block shadow-sm"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Layout Format Switcher */}
                <div className="bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-2.5">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Workspace Layout
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Switch between standard channel layout and compact tree layout.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-testid="settings-layout-discord"
                      onClick={() => {
                        const updated: ThemeConfig = {
                          ...themeConfig,
                          layoutFormat: 'discord',
                        };
                        setThemeConfig(updated);
                        vencord.setTheme(updated);
                      }}
                      className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                        (themeConfig.layoutFormat || 'discord') === 'discord'
                          ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] text-[var(--text-header)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-[var(--discord-blurple)]" />
                        <span>Standard Layout</span>
                      </div>
                      {(themeConfig.layoutFormat || 'discord') === 'discord' && (
                        <Check className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="settings-layout-teamspeak"
                      onClick={() => {
                        const updated: ThemeConfig = {
                          ...themeConfig,
                          layoutFormat: 'teamspeak',
                        };
                        setThemeConfig(updated);
                        vencord.setTheme(updated);
                      }}
                      className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                        themeConfig.layoutFormat === 'teamspeak'
                          ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] text-[var(--text-header)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ListTree className="w-4 h-4 text-[var(--discord-blurple)]" />
                        <span>TeamSpeak Layout</span>
                      </div>
                      {themeConfig.layoutFormat === 'teamspeak' && (
                        <Check className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Interface Zoom */}
                <div className="bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Interface Zoom
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Scale the interface with <kbd className="px-1 py-0.5 rounded bg-[var(--bg-channels)] text-[10px] font-mono">Ctrl + =</kbd>, <kbd className="px-1 py-0.5 rounded bg-[var(--bg-channels)] text-[10px] font-mono">Ctrl + -</kbd>, or <kbd className="px-1 py-0.5 rounded bg-[var(--bg-channels)] text-[10px] font-mono">Ctrl + 0</kbd>.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="settings-zoom-out-btn"
                        aria-label="Zoom Out"
                        onClick={() => zoomService.zoomOut()}
                        className="p-1.5 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border border-[var(--border-subtle)] cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span
                        data-testid="settings-zoom-value"
                        className="min-w-[54px] text-center px-2 py-1 rounded bg-[var(--bg-channels)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--text-header)]"
                      >
                        {zoomPercent}%
                      </span>
                      <button
                        type="button"
                        data-testid="settings-zoom-in-btn"
                        aria-label="Zoom In"
                        onClick={() => zoomService.zoomIn()}
                        className="p-1.5 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border border-[var(--border-subtle)] cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid="settings-zoom-reset-btn"
                        onClick={() => zoomService.resetZoom()}
                        className="px-2.5 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Reset to 100%
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={ZOOM_STEPS.length - 1}
                    step={1}
                    value={zoomStepIndex}
                    data-testid="settings-zoom-slider"
                    aria-label="Interface Zoom"
                    onChange={e => {
                      const nextStep = ZOOM_STEPS[Number(e.target.value)] ?? 100;
                      zoomService.setZoom(nextStep);
                    }}
                    className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
                  />

                  <div className="flex items-center justify-between flex-wrap gap-1 pt-0.5">
                    {ZOOM_STEPS.map(step => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => zoomService.setZoom(step)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                          zoomPercent === step
                            ? 'bg-[var(--discord-blurple)] text-white font-bold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                        }`}
                      >
                        {step}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Synced Preferences */}
                <div className="bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Synced Preferences
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {syncSettings.syncEnabled ? 'Auto-sync ON' : 'Local only'}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] text-[var(--text-muted)] mb-1.5 font-semibold">
                      Base Theme
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
                            handleSelectTheme(mode.id);
                          }}
                          className={`py-1.5 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                            syncSettings.theme === mode.id
                              ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] text-[var(--text-header)]'
                              : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)]'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
                    {(
                      [
                        {
                          key: 'messageDisplayCompact',
                          label: 'Compact Messages',
                          desc: 'Tighter message spacing',
                        },
                        {
                          key: 'developerMode',
                          label: 'Developer Mode',
                          desc: 'Copy IDs & debug info',
                        },
                        {
                          key: 'animateEmoji',
                          label: 'Animate Emojis',
                          desc: 'Play custom emoji motion',
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
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-channels)] border border-[var(--border-subtle)]"
                        >
                          <div>
                            <div className="text-xs font-semibold text-[var(--text-header)]">
                              {item.label}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">{item.desc}</div>
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
                              active ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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

                {/* Custom CSS Editor */}
                {themeConfig.activeTheme === 'custom' && (
                  <div className="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                        Stylesheet URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://raw.githubusercontent.com/.../theme.css"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                      className="w-full flex items-center justify-center gap-2 bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] py-2 px-3 rounded text-xs font-semibold border border-[var(--border-subtle)] transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                      <span>Browse Local .CSS File...</span>
                    </button>

                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                        Raw Custom CSS
                      </label>
                      <textarea
                        rows={5}
                        placeholder=":root { --bg-chat: #141c2f; }"
                        value={customCss}
                        onChange={e => setCustomCss(e.target.value)}
                        className="w-full bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs font-mono text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyCustomCss}
                      className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white px-4 py-2 rounded text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Apply Custom CSS
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* PLUGINS TAB */}
          {activeTab === 'plugins' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-[var(--text-header)]">
                      Plugins
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)] flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[var(--discord-blurple)]" />
                      Equicord V2
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    Enable modular client extensions and custom JavaScript plugins.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenEquicordModal}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-header)] border border-[var(--border-subtle)] rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                    <span>Equicord Engine</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstallModal(true);
                      setInstallError('');
                      setInstallSuccess('');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Install Plugin</span>
                  </button>
                </div>
              </div>

              {/* Install Modal */}
              {showInstallModal && (
                <div className="p-5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--discord-blurple)] space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[var(--bg-channels)] text-[var(--text-link)] flex items-center justify-center">
                        <Code className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-header)]">
                          Install Plugin
                        </h3>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Load a plugin from a raw JavaScript URL or paste code directly.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Close install form"
                      onClick={() => setShowInstallModal(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-header)] p-1 rounded hover:bg-[var(--bg-item-hover)] cursor-pointer"
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
                          className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Author
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Community"
                          value={installAuthor}
                          onChange={e => setInstallAuthor(e.target.value)}
                          className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                          className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                          className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
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
                              ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-header)] bg-[var(--bg-channels)]'
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
                              ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-header)] bg-[var(--bg-channels)]'
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
                            className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs font-mono text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                          />
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            Direct HTTP/HTTPS link to JavaScript plugin source.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            rows={5}
                            placeholder="// Example Plugin&#10;export default {&#10;  name: 'MyPlugin',&#10;  start() { console.log('Plugin started!'); },&#10;  stop() { console.log('Plugin stopped!'); }&#10;};"
                            value={installCode}
                            onChange={e => setInstallCode(e.target.value)}
                            className="w-full bg-[var(--bg-popout)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs font-mono text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                          />
                        </div>
                      )}
                    </div>

                    {installError && (
                      <div className="flex items-center gap-2 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-[var(--status-dnd)] text-xs">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{installError}</span>
                      </div>
                    )}

                    {installSuccess && (
                      <div className="flex items-center gap-2 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[var(--status-online)] text-xs">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>{installSuccess}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowInstallModal(false)}
                        className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-header)] bg-[var(--bg-channels)] rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={installLoading}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] disabled:opacity-50 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {installLoading ? 'Installing...' : 'Install & Run'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Filters and Search Bar */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <input
                    type="text"
                    aria-label="Search plugins"
                    placeholder="Search plugins by name, tag, or description..."
                    value={pluginSearch}
                    onChange={e => setPluginSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-[var(--text-header)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  {pluginSearch && (
                    <button
                      type="button"
                      aria-label="Clear plugin search"
                      onClick={() => setPluginSearch('')}
                      className="text-[var(--text-muted)] hover:text-[var(--text-header)] text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  {/* Source filter tabs */}
                  <div className="flex items-center gap-1 bg-[var(--bg-userpanel)] p-1 rounded-lg border border-[var(--border-subtle)] flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPluginFilter('all')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        pluginFilter === 'all'
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      All ({plugins.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPluginFilter('equicord')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        pluginFilter === 'equicord'
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-[var(--discord-blurple)]" />
                      <span>Equicord ({equicordCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPluginFilter('vencord')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        pluginFilter === 'vencord'
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      Vencord ({vencordCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPluginFilter('user')}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        pluginFilter === 'user'
                          ? 'bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/40'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      <Code className="w-3 h-3 text-[var(--status-online)]" />
                      <span>Custom ({userCount})</span>
                    </button>
                  </div>

                  {/* Category filter */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[var(--text-muted)] text-[11px] font-medium">Category:</span>
                    <select
                      aria-label="Filter plugins by category"
                      value={pluginCategoryFilter}
                      onChange={e => setPluginCategoryFilter(e.target.value)}
                      className="bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-header)] outline-none"
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
                  <div className="p-8 text-center rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2">
                    <Layers className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                    <p className="text-sm font-semibold text-[var(--text-header)]">
                      No plugins match your search
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Adjust your keywords or clear the category filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPluginSearch('');
                        setPluginFilter('all');
                        setPluginCategoryFilter('all');
                      }}
                      className="mt-2 text-xs text-[var(--text-link)] hover:underline cursor-pointer"
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
                            ? 'border-[var(--discord-blurple)]'
                            : 'border-[var(--border-subtle)] opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className="font-semibold text-[var(--text-header)] text-sm">
                                {plugin.name}
                              </span>

                              {isEquicord && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)] flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5" />
                                  Equicord
                                </span>
                              )}
                              {isUser && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/30 flex items-center gap-1">
                                  <Code className="w-2.5 h-2.5" />
                                  Custom
                                </span>
                              )}
                              {isVencord && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)]">
                                  Vencord
                                </span>
                              )}

                              {plugin.category && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-channels)] text-[var(--text-muted)] capitalize">
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
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-link)] truncate">
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{plugin.codeUrl}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isUser && (
                              <button
                                type="button"
                                aria-label={`Uninstall ${plugin.name}`}
                                onClick={() => handleUninstallPlugin(plugin.id, plugin.name)}
                                title="Uninstall Plugin"
                                className="p-1.5 text-[var(--status-dnd)] hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              role="switch"
                              aria-checked={plugin.enabled}
                              aria-label={`Toggle ${plugin.name}`}
                              onClick={() => handleTogglePlugin(plugin.id, plugin.enabled)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                                plugin.enabled ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--discord-blurple)] flex items-center justify-center text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[var(--text-header)] flex items-center gap-2">
                        <span>Plugin Store</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)]">
                          Equicord
                        </span>
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        Browse and install built-in or community plugins in one click.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('plugins');
                      setShowInstallModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-header)] rounded text-xs font-semibold border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
                    <span>Load URL / Code</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Search plugin store"
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    placeholder="Search plugins..."
                    className="w-full bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--discord-blurple)]"
                  />
                  {storeSearch && (
                    <button
                      type="button"
                      aria-label="Clear store search"
                      onClick={() => setStoreSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-header)] text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-[var(--bg-userpanel)] p-1 rounded-lg border border-[var(--border-subtle)] flex-wrap">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'chat', label: 'Chat' },
                    { id: 'media', label: 'Media' },
                    { id: 'ui', label: 'UI' },
                    { id: 'privacy', label: 'Privacy' },
                    { id: 'utility', label: 'Utility' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setStoreCategory(cat.id)}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        storeCategory === cat.id
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-start gap-3">
                <Package className="w-5 h-5 text-[var(--discord-blurple)] flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 text-[var(--text-normal)]">
                  <span className="font-bold text-[var(--text-header)] block">
                    Sandboxed Plugin Runtime
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Compatible with <code className="text-[var(--text-link)]">window.Equicord</code>, <code className="text-[var(--text-link)]">window.Vencord</code>, and <code className="text-[var(--text-link)]">definePlugin()</code>.
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
                      className="p-3.5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] hover:border-[var(--discord-blurple)] transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <h4 className="font-bold text-[var(--text-header)] text-sm group-hover:text-[var(--text-link)] transition-colors">
                              {catalogItem.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[var(--text-muted)]">
                                by {catalogItem.author || 'Community'}
                              </span>
                              {catalogItem.category && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-channels)] text-[var(--text-muted)] font-semibold">
                                  {catalogItem.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isInstalled ? (
                              <button
                                type="button"
                                onClick={() => {
                                  handleTogglePlugin(catalogItem.id, isEnabled);
                                }}
                                className={`text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                  isEnabled
                                    ? 'bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/40'
                                    : 'bg-[var(--bg-channels)] text-[var(--text-muted)] hover:text-[var(--text-header)]'
                                }`}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>{isEnabled ? 'Active' : 'Disabled'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  vencord.installFromCatalog(catalogItem.id);
                                  setPlugins([...vencord.getPlugins()]);
                                }}
                                className="text-xs px-3 py-1 rounded font-bold bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white flex items-center gap-1 transition-colors cursor-pointer"
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
                        <div className="flex items-center gap-1 flex-wrap mt-3 pt-2 border-t border-[var(--border-subtle)]">
                          {catalogItem.tags.slice(0, 4).map(tag => (
                            <span
                              key={tag}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-channels)] text-[var(--text-muted)]"
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
          {activeTab === 'voice' && (() => {
            const uniqueInputs = audioInputs.filter(
              (d, idx, arr) => d.deviceId && d.deviceId !== 'default' && arr.findIndex(x => x.deviceId === d.deviceId) === idx
            );
            const uniqueOutputs = audioOutputs.filter(
              (d, idx, arr) => d.deviceId && d.deviceId !== 'default' && arr.findIndex(x => x.deviceId === d.deviceId) === idx
            );
            const vuSegments = 24;
            return (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-header)] mb-1">
                    Voice &amp; Video
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Test microphone playback, select devices, and configure camera or screen share.
                  </p>
                </div>

                {/* Mic Test — Hear Yourself (Playback) */}
                <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-[var(--status-online)]" />
                        <h3 className="text-sm font-bold text-[var(--text-header)]">
                          Mic Test — Hear Yourself
                        </h3>
                        {micLoopbackEnabled && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/35 font-bold">
                            Playback Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Preview your microphone audio directly in or outside of a call.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      disabled={micTestBusy}
                      data-testid="settings-mic-test-btn"
                      onClick={() => void handleToggleMicTest()}
                      className={`px-4 py-2 rounded font-semibold text-xs text-white flex items-center gap-2 cursor-pointer transition-colors flex-shrink-0 disabled:opacity-60 ${
                        micLoopbackEnabled
                          ? 'bg-[var(--status-dnd)] hover:opacity-90'
                          : 'bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)]'
                      }`}
                    >
                      {micLoopbackEnabled ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          <span>Stop Testing</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>Let&apos;s Check</span>
                        </>
                      )}
                    </button>

                    {/* Segmented VU Meter */}
                    <div
                      className="flex-1 min-w-[180px] bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-2.5 py-2 flex items-center gap-2"
                      title={`Microphone level: ${micAudioLevel}%`}
                    >
                      <div className="flex-1 flex items-center gap-0.5 h-3">
                        {Array.from({ length: vuSegments }).map((_, idx) => {
                          const threshold = ((idx + 1) / vuSegments) * 100;
                          const lit = micAudioLevel >= threshold - 2 && micAudioLevel > 0;
                          const colorClass =
                            idx < 15
                              ? 'bg-[var(--status-online)]'
                              : idx < 20
                              ? 'bg-[var(--status-idle)]'
                              : 'bg-[var(--status-dnd)]';
                          return (
                            <span
                              key={idx}
                              className={`flex-1 h-full rounded-[1px] transition-colors ${
                                lit ? colorClass : 'bg-[var(--bg-message-input)]'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span
                        className={`text-[11px] font-mono w-9 text-right ${
                          isMicSpeaking ? 'text-[var(--status-online)] font-bold' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {micAudioLevel}%
                      </span>
                    </div>
                  </div>

                  {/* Playback / Sidetone Volume Slider */}
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-normal)]">
                        Playback Volume
                      </span>
                      <span className="font-mono font-bold text-[var(--text-link)]">{loopbackVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={5}
                      value={loopbackVolume}
                      data-testid="settings-loopback-volume-slider"
                      aria-label="Playback Volume"
                      onChange={e => {
                        const val = Number(e.target.value);
                        setLoopbackVolume(val);
                        livekit.setLoopbackVolume(val);
                      }}
                      className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
                    />
                  </div>
                </div>

                {/* Input Device & Output Device Selection */}
                <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Audio Devices
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshAudioDevices()}
                      className="px-2 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[11px] font-semibold text-[var(--text-normal)] border border-[var(--border-subtle)] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                        Input Device
                      </label>
                      <select
                        aria-label="Input Device"
                        value={selectedInputId}
                        data-testid="settings-input-device-select"
                        onChange={e => {
                          const id = e.target.value;
                          setSelectedInputId(id);
                          void livekit.setInputDevice(id);
                        }}
                        className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                      >
                        <option value="default">Default Microphone</option>
                        {uniqueInputs.map((dev, idx) => (
                          <option key={dev.deviceId} value={dev.deviceId}>
                            {dev.label || `Microphone ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                        Output Device
                      </label>
                      <select
                        aria-label="Output Device"
                        value={selectedOutputId}
                        data-testid="settings-output-device-select"
                        onChange={e => {
                          const id = e.target.value;
                          setSelectedOutputId(id);
                          void livekit.setOutputDevice(id);
                        }}
                        className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                      >
                        <option value="default">Default Speaker / Headphones</option>
                        {uniqueOutputs.map((dev, idx) => (
                          <option key={dev.deviceId} value={dev.deviceId}>
                            {dev.label || `Speaker ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Video Settings — Camera Preview & Virtual Backgrounds */}
                <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-header)]">
                      Camera Preview &amp; Backgrounds
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Preview your camera, mirror feed, and apply blur or virtual backgrounds.
                    </p>
                  </div>
                  <CameraPreviewPanel compact />
                </div>

                {/* Soundboard Settings Card */}
                <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-[var(--discord-blurple)]" />
                      <div>
                        <div className="text-sm font-bold text-[var(--text-header)]">
                          Soundboard
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          Control Soundboard playback volume or open the soundboard panel.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="settings-open-soundboard-btn"
                      onClick={handleOpenSoundboardModal}
                      className="px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Music className="w-3.5 h-3.5" />
                      <span>Open Soundboard</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-normal)] flex items-center gap-1.5">
                        {soundboardMuted ? (
                          <VolumeX className="w-3.5 h-3.5 text-[var(--status-dnd)]" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-[var(--status-online)]" />
                        )}
                        <span>Soundboard Master Volume</span>
                      </span>
                      <span className="font-mono font-bold text-[var(--text-link)]">{soundboardVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={5}
                      value={soundboardVolume}
                      data-testid="settings-soundboard-volume-slider"
                      aria-label="Soundboard Master Volume"
                      onChange={e => soundboardService.setMasterVolume(Number(e.target.value))}
                      className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-header)]">
                        Mute Soundboard
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Silence local and remote sound effects.
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundboardMuted}
                      aria-label="Mute Soundboard"
                      data-testid="settings-soundboard-mute-toggle"
                      onClick={() => soundboardService.setMuted(!soundboardMuted)}
                      className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                        soundboardMuted ? 'bg-[var(--status-dnd)]' : 'bg-[var(--bg-message-input)]'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                          soundboardMuted ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-emerald-500/30 flex items-center gap-3">
                    <Radio className="w-6 h-6 text-[var(--status-online)] flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-header)]">
                        Low-Latency Voice Mode
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Direct WebRTC SFU transport with 48kHz Opus audio.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Screen Share Quality
                    </label>
                    <select
                      aria-label="Screen Share Quality"
                      data-testid="settings-screen-quality-select"
                      value={screenQuality}
                      onChange={e => {
                        const val = e.target.value as '1080p60' | '1440p60' | '4k60' | '720p30';
                        setScreenQuality(val);
                        try {
                          localStorage.setItem('protutech_screen_quality', val);
                        } catch {
                          // ignore
                        }
                      }}
                      className="w-full bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                    >
                      <option value="1080p60">1080p @ 60 FPS (Source)</option>
                      <option value="1440p60">1440p @ 60 FPS</option>
                      <option value="4k60">4K @ 60 FPS</option>
                      <option value="720p30">720p @ 30 FPS</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                      Noise Suppression
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
                              ? 'border-[var(--discord-blurple)] bg-[var(--bg-item-active)] text-[var(--text-header)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-userpanel)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)]'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Synced Audio Gain & Processing */}
                  <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--text-header)]">
                          Input Volume
                        </span>
                        <span className="font-mono text-[var(--text-link)]">{syncSettings.inputVolume}%</span>
                      </div>
                      <input
                        type="range"
                        aria-label="Input Volume"
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
                        className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--text-header)]">
                          Output Volume
                        </span>
                        <span className="font-mono text-[var(--text-link)]">{syncSettings.outputVolume}%</span>
                      </div>
                      <input
                        type="range"
                        aria-label="Output Volume"
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
                        className="w-full accent-[var(--discord-blurple)] cursor-pointer h-1.5 bg-[var(--bg-channels)] rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
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
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--bg-channels)] border border-[var(--border-subtle)]"
                          >
                            <div>
                              <div className="text-xs font-semibold text-[var(--text-header)]">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)]">{item.desc}</div>
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
                                active ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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

                  {/* External Call Bridge */}
                  <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[var(--status-idle)] uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-[var(--status-idle)]" />
                          <span>External Call Bridge</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Bridge audio to external Discord or Stoat/Revolt voice channels.
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-[var(--status-idle)] font-bold border border-amber-500/30 uppercase">
                        Optional
                      </span>
                    </div>

                    <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-[var(--status-idle)]">
                            <Radio className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[var(--text-header)] flex items-center gap-1.5">
                              <span>Active Gateway:</span>
                              <span className="text-[var(--status-idle)] font-mono">
                                {proxySession.status === 'connected'
                                  ? proxySession.provider === 'discord_proxy'
                                    ? 'External Bridge'
                                    : 'Stoat / Revolt'
                                  : 'Native LiveKit SFU'}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {proxySession.status === 'connected'
                                ? `In Call: ${proxySession.targetName} (${proxySession.ping}ms)`
                                : 'Native WebRTC SFU active.'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowVoiceProxyModal(true)}
                          className="px-3 py-1.5 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Configure Bridge...</span>
                        </button>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-[var(--text-normal)] leading-relaxed flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-[var(--status-idle)] flex-shrink-0 mt-0.5" />
                        <span>
                          External voice bridging operates outside official client software; Stoat nodes connect directly over open WebRTC.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ACCOUNT TAB */}
          {activeTab === 'account' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-header)] mb-1">My Account</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Manage your account ID, privacy preferences, and optional bridge token.
                </p>
              </div>

              <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-[var(--border-subtle)] space-y-4">
                <div>
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase">User ID</div>
                  <div className="text-sm font-mono text-[var(--text-header)] mt-1">{userId}</div>
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Homeserver</div>
                  <div className="text-sm font-mono text-[var(--text-link)] mt-1">
                    https://chat.protutech.vip
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 text-xs text-[var(--status-online)] font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>Encrypted Session &amp; Bridge Sync Ready</span>
                </div>
              </div>

              {/* Privacy & Sync */}
              <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-[var(--border-subtle)] space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Privacy &amp; Sync
                </div>

                {(
                  [
                    {
                      key: 'dmSpamFilter',
                      label: 'Direct Message Spam Filter',
                      desc: 'Filter suspicious DM invites and links.',
                    },
                    {
                      key: 'allowDmsFromServerMembers',
                      label: 'Allow Server Member DMs',
                      desc: 'Let members in shared servers message you.',
                    },
                  ] as const
                ).map(item => {
                  const active = Boolean(syncSettings[item.key]);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-4 pt-2 border-t border-[var(--border-subtle)] first:border-t-0 first:pt-0"
                    >
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-header)]">
                          {item.label}
                        </div>
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
                          active ? 'bg-[var(--status-online)]' : 'bg-[var(--bg-message-input)]'
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

              {/* External Bridge Token (Optional) */}
              <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-header)] uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-[var(--discord-blurple)]" />
                    <span>External Bridge Token (Optional)</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      syncSettings.discordTokenConnected
                        ? 'bg-emerald-500/20 text-[var(--status-online)]'
                        : 'bg-[var(--bg-channels)] text-[var(--text-muted)]'
                    }`}
                  >
                    {syncSettings.discordTokenConnected ? 'Connected' : 'Local Only'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Optional token stored locally to enable live external bridge sync.
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showDiscordToken ? 'text' : 'password'}
                      aria-label="External bridge token"
                      value={discordTokenInput}
                      onChange={e => setDiscordTokenInput(e.target.value)}
                      placeholder="Paste optional bridge token..."
                      className="w-full bg-[var(--bg-channels)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded px-3 py-2 pr-9 text-xs font-mono text-[var(--text-header)] outline-none"
                    />
                    <button
                      type="button"
                      aria-label={showDiscordToken ? 'Hide bridge token' : 'Show bridge token'}
                      onClick={() => setShowDiscordToken(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
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
                    className="px-3 py-2 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold cursor-pointer"
                  >
                    Save
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
                      className="px-3 py-2 rounded bg-[var(--bg-channels)] hover:bg-red-500/20 text-[var(--text-normal)] text-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {tokenSavedNotice && (
                  <div className="text-xs text-[var(--status-online)] font-semibold">{tokenSavedNotice}</div>
                )}
              </div>
            </div>
          )}

          {/* DESKTOP APP TAB */}
          {activeTab === 'desktop' && (
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-header)] mb-1 flex items-center gap-2">
                    <span>Desktop App</span>
                    <span
                      data-testid="settings-app-version"
                      className="text-xs bg-[var(--discord-blurple)] text-white px-2 py-0.5 rounded font-mono"
                    >
                      v{appVersion}
                    </span>
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    Native desktop client settings, window bounds recovery, and store downloads.
                  </p>
                </div>
              </div>

              {/* Window Size & Position Recovery Card */}
              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-bold text-[var(--text-header)]">
                    Window Size &amp; Position
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Center the window on your primary display and reset saved bounds.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {windowBoundsResetNotice && (
                    <span className="text-xs font-semibold text-[var(--status-online)]">Window reset ✓</span>
                  )}
                  <button
                    type="button"
                    data-testid="settings-reset-window-btn"
                    onClick={() => {
                      desktopBridge.resetWindowBounds();
                      setWindowBoundsResetNotice(true);
                      window.setTimeout(() => setWindowBoundsResetNotice(false), 2500);
                    }}
                    className="px-3.5 py-2 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Window</span>
                  </button>
                </div>
              </div>

              {/* Microsoft Store Publish & Install Card */}
              <div className="p-5 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--discord-blurple)] flex items-center justify-center text-white flex-shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[var(--text-header)] text-sm">
                          Microsoft Store Hub
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)] font-bold">
                          APPX / MSIX
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Install via Windows Store or download the direct <code className="text-[var(--text-link)]">.appx</code> package.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenStoreHub}
                    className="px-4 py-2 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Store className="w-4 h-4" />
                    <span>Open Store Hub</span>
                  </button>
                  <a
                    href="ms-windows-store://pdp/?productid=00013812596749763330"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] text-xs font-semibold border border-[var(--border-subtle)] transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Store App</span>
                  </a>
                </div>
              </div>

              {isNativeDesktop ? (
                <div className="space-y-4">
                  <div className="bg-[var(--bg-userpanel)] rounded-lg p-5 border border-[var(--border-subtle)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)]" />
                        <span className="font-semibold text-[var(--text-header)]">
                          Native {runtimeKind === 'tauri' ? 'Tauri v2 (Rust)' : 'Electron'} Client Active
                        </span>
                      </div>
                      <span className="text-xs bg-[var(--discord-blurple)] text-white px-2 py-0.5 rounded font-mono">
                        v{appVersion}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Hardware-accelerated 48kHz Opus audio, H.264 capture, and system tray persistence.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Global Hotkeys
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-sm text-[var(--text-header)]">Toggle Overlay</span>
                      <kbd className="bg-[var(--bg-channels)] border border-[var(--border-subtle)] px-2 py-1 rounded text-xs font-mono text-[var(--text-link)]">
                        Ctrl + Shift + O
                      </kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-sm text-[var(--text-header)]">Toggle Mute</span>
                      <kbd className="bg-[var(--bg-channels)] border border-[var(--border-subtle)] px-2 py-1 rounded text-xs font-mono text-[var(--text-normal)]">
                        Ctrl + Shift + M
                      </kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-sm text-[var(--text-header)]">Toggle Deafen</span>
                      <kbd className="bg-[var(--bg-channels)] border border-[var(--border-subtle)] px-2 py-1 rounded text-xs font-mono text-[var(--text-normal)]">
                        Ctrl + Shift + D
                      </kbd>
                    </div>
                    <div className="p-3 bg-[var(--bg-userpanel)] rounded border border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-sm text-[var(--text-header)]">Close Window Behavior</span>
                      <span className="text-xs text-[var(--status-online)] font-semibold">
                        Minimizes to Tray
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[var(--bg-userpanel)] rounded-lg p-6 border border-[var(--border-subtle)] space-y-4">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-8 h-8 text-[var(--discord-blurple)]" />
                      <div>
                        <h3 className="font-bold text-[var(--text-header)] text-base">
                          Protutech for Windows
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          Standalone Executable (.exe) &amp; Store AppX (v{appVersion})
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--text-normal)]">
                      Download the desktop app for global hotkeys, 1080p60/4K60 capture, and system tray audio.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <a
                        href="/downloads/ProtutechChat-Store.appx"
                        className="inline-flex items-center gap-2 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white px-4 py-2.5 rounded font-semibold text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Store (.appx)</span>
                      </a>
                      <a
                        href="/downloads/ProtutechChat-Setup.exe"
                        className="inline-flex items-center gap-2 bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-header)] px-4 py-2.5 rounded font-semibold text-sm border border-[var(--border-subtle)] transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Installer (.exe)</span>
                      </a>
                      <a
                        href="/downloads/ProtutechChat-Portable.exe"
                        className="inline-flex items-center gap-2 bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-header)] px-4 py-2.5 rounded font-semibold text-sm border border-[var(--border-subtle)] transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Portable (.exe)</span>
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
                <h2 className="text-xl font-bold text-[var(--text-header)] mb-1">
                  App Icon
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Customize your browser tab, taskbar, and dock icon.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)]">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Dock &amp; Taskbar Preview</span>
                  <span className="text-[10px] font-mono">Live</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 bg-[var(--bg-channels)] p-4 rounded-lg border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-popout)] border border-[var(--border-subtle)]">
                    <div className="relative group p-1.5 rounded-lg bg-[var(--bg-userpanel)]">
                      <img
                        src={currentIcon}
                        alt="Current Icon"
                        className="w-10 h-10 rounded-lg object-contain"
                      />
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-[var(--discord-blurple)]" />
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-sm font-bold text-[var(--text-header)] flex items-center justify-center sm:justify-start gap-2">
                      <span>Active Icon</span>
                      <CheckCircle className="w-4 h-4 text-[var(--status-online)]" />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Applied across title bar, browser tabs, and taskbar.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => handleSelectIcon('/protutech_logo.png')}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-[var(--discord-blurple)]" />
                        <span>Reset Icon</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Preset Icons
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {APP_ICON_PRESETS.map(preset => {
                    const isSelected = currentIcon === preset.url;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectIcon(preset.url)}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 relative group ${
                          isSelected
                            ? 'bg-[var(--bg-item-active)] border-[var(--discord-blurple)] ring-1 ring-[var(--discord-blurple)]'
                            : 'bg-[var(--bg-userpanel)] border-[var(--border-subtle)] hover:bg-[var(--bg-channels)]'
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl p-1.5 flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${preset.previewGradient} border border-[var(--border-subtle)]`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-[var(--text-header)] truncate">
                              {preset.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-[var(--bg-channels)] text-[var(--text-link)]">
                              {preset.tag}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                            {preset.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[var(--discord-blurple)] text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-header)]">
                  <Upload className="w-4 h-4 text-[var(--discord-blurple)]" />
                  <span>Upload Custom Icon</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Upload any image file (PNG, JPG, SVG, or WebP) to customize your app icon locally.
                </p>

                {customIconError && (
                  <div className="mb-2 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-[var(--status-dnd)] text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{customIconError}</span>
                  </div>
                )}

                <label className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold text-xs transition-colors cursor-pointer">
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

      {/* Local Soundboard Popover fallback if parent didn't pass onOpenSoundboard */}
      {!onOpenSoundboard && (
        <SoundboardPopover
          isOpen={showLocalSoundboard}
          onClose={() => setShowLocalSoundboard(false)}
          senderName={previewDisplayName}
          anchor="center"
        />
      )}
    </div>
  );
};
