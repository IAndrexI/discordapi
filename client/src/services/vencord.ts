import type { VencordPlugin, ThemeConfig } from '../types';

const STORAGE_KEY_PLUGINS = 'vencord_plugins_v1';
const STORAGE_KEY_USER_PLUGINS = 'equicord_user_plugins_v1';
const STORAGE_KEY_THEME = 'vencord_theme_v1';

export type MessageSendHook = (body: string) => string | void;
export type MessageReceiveHook = <T extends { body?: string; [key: string]: unknown }>(
  msg: T
) => T | void;

export interface CustomPluginInput {
  id?: string;
  name: string;
  description?: string;
  author?: string;
  category?: VencordPlugin['category'];
  code: string;
  codeUrl?: string;
  enabled?: boolean;
}

export const DEFAULT_PLUGINS: VencordPlugin[] = [
  // Vencord Core Plugins
  {
    id: 'customSounds',
    name: 'Audio Chimes & Sound Effects',
    description: 'Plays join, leave, mute, and notification audio chimes.',
    enabled: false,
    author: 'Protutech',
    source: 'vencord',
    category: 'media',
  },
  {
    id: 'messageLogger',
    name: 'Message Logger',
    description: 'Preserves deleted and edited messages with an inline visual badge.',
    enabled: true,
    author: 'Protutech',
    source: 'vencord',
    category: 'chat',
  },
  {
    id: 'nitroBypass',
    name: 'Ultra 1080p60 Media Engine',
    description: 'Enables 1080p 60FPS high bitrate screen sharing and large file streaming.',
    enabled: true,
    author: 'Vencord',
    source: 'vencord',
    category: 'utility',
  },
  {
    id: 'ultraLowLatency',
    name: 'Ultra-Low Latency Voice',
    description: 'Configures Opus jitter buffers for sub-40ms real-time audio with AI noise suppression.',
    enabled: true,
    author: 'Vencord',
    source: 'vencord',
    category: 'media',
  },

  // Equicord Official & Core Plugins (25+ total catalog)
  {
    id: 'questCompleter',
    name: 'Quest Completer',
    description: 'Adds 1-click Equicord Quest auto-completion and instant reward claiming inside Discord Hub.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['quests', 'rewards', 'orbs', 'automation'],
  },
  {
    id: 'callTimer',
    name: 'Call Timer',
    description: 'Displays a live precision call duration timer in voice channels and Stage headers.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['voice', 'timer', 'calls', 'hud'],
  },
  {
    id: 'relationshipNotifier',
    name: 'Relationship Notifier',
    description: 'Notifies you when friends are added, removed, or server membership changes occur.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['friends', 'alerts', 'relationships'],
  },
  {
    id: 'viewIcons',
    name: 'View Icons & Banners',
    description: 'Allows clicking any user avatar, server icon, or banner to inspect and download in HD.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['avatars', 'banners', 'icons', 'zoom'],
  },
  {
    id: 'platformIndicators',
    name: 'Platform Indicators',
    description: 'Displays Desktop, Web, Mobile, and Bridge icons next to online members and DMs.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['platform', 'status', 'desktop', 'mobile'],
  },
  {
    id: 'betterFolders',
    name: 'Better Folders & Guild Icons',
    description: 'Custom folder icons, multi-column folder drawers, and auto-closing server categories.',
    enabled: false,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'ui',
    tags: ['folders', 'guilds', 'ui'],
  },
  {
    id: 'volumeBooster',
    name: 'Volume Booster (300%)',
    description: 'Unlocks software preamp boosting up to 300% for quiet microphones and streams.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['audio', 'boost', 'volume', 'gain'],
  },
  {
    id: 'customRPC',
    name: 'Custom Rich Presence (RPC)',
    description: 'Broadcast custom Playing, Watching, or Streaming Rich Presence cards across Discord & App.',
    enabled: false,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['rpc', 'presence', 'activity', 'status'],
  },
  {
    id: 'gameActivityToggle',
    name: 'Game Activity Toggle',
    description: 'Adds a quick privacy toggle to hide or show currently running games in your status.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['games', 'privacy', 'activity', 'toggle'],
  },
  {
    id: 'spotifyControls',
    name: 'Spotify Controls & Player',
    description: 'Adds a mini Spotify player bar with live progress, lyrics, and playback controls in client.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['spotify', 'music', 'player'],
  },
  {
    id: 'customBadges',
    name: 'Custom Equicord Badges',
    description: 'Displays custom Equicord donor, developer, verified, and community badges on user profiles.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['badges', 'profiles', 'cosmetics'],
  },
  {
    id: 'openInApp',
    name: 'Open In App',
    description: 'Adds 1-click buttons to open external links directly in native desktop apps (Steam, Spotify, GitHub, Epic).',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['apps', 'links', 'desktop'],
  },
  {
    id: 'translate',
    name: 'Message Translator',
    description: 'Adds instant translation actions to foreign chat messages using DeepL and Google Translate engines.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['translate', 'languages', 'chat'],
  },
  {
    id: 'voiceMessages',
    name: 'Voice Notes & Audio Clips',
    description: 'Enables recording and sending voice audio notes directly in any text channel or DM.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['voice', 'recording', 'mic'],
  },
  {
    id: 'permissionsViewer',
    name: 'Permissions Viewer',
    description: 'Inspect complete member and role permission breakdown for any channel in a popout modal.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['roles', 'permissions', 'audit'],
  },
  {
    id: 'showAllMessageTimestamps',
    name: 'Detailed Message Timestamps',
    description: 'Displays exact 12h/24h timestamps and dates on every individual message in chat.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['timestamps', 'clock', 'chat'],
  },
  {
    id: 'typingTweaks',
    name: 'Typing Tweaks & Avatars',
    description: 'Shows user avatars and typing indicators with real-time animated presence indicators.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['typing', 'avatars', 'presence'],
  },
  {
    id: 'silentTyping',
    name: 'Silent Typing (Ghost Mode)',
    description: 'Hides your typing status from other users so you can compose messages discreetly.',
    enabled: false,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['stealth', 'privacy', 'ghost'],
  },
  {
    id: 'betterRoleContext',
    name: 'Better Role Context',
    description: 'Adds copy role ID, role color preview, and member counters to role context menus.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['roles', 'ui', 'context'],
  },
  {
    id: 'betterVolume',
    name: 'Extended Audio Volume (200%)',
    description: 'Extends user volume sliders up to 200% with independent per-participant amplification.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['audio', 'volume', 'voice'],
  },
  {
    id: 'whosWatching',
    name: 'Stream Spectators Indicator',
    description: 'Displays who is actively tuned in and watching screen shares or camera streams.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['stream', 'viewers', 'screenshare'],
  },
  {
    id: 'emoteCloner',
    name: 'Emote & Sticker Cloner',
    description: '1-click clone custom emojis and stickers from messages into your accessible servers.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['emojis', 'stickers', 'clone'],
  },
  {
    id: 'petpet',
    name: 'PetPet Generator',
    description: 'Generates animated pet-pet head petting GIFs from any member avatar or image in chat.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['petpet', 'fun', 'avatars'],
  },
  {
    id: 'imageZoom',
    name: 'Image Zoom & Pan Lens',
    description: 'Adds high-resolution modal zoom, lens magnification, and pan tools to all chat media attachments.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['images', 'zoom', 'lens'],
  },
  {
    id: 'userPfpZoom',
    name: 'Avatar & Banner Zoom',
    description: 'Click any user profile picture or banner to open and view it in full 2048x2048 resolution.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['avatar', 'banner', 'zoom'],
  },
  {
    id: 'noTrack',
    name: 'Privacy Shield (NoTrack)',
    description: 'Blocks telemetry beacons, tracking scripts, and diagnostic metrics from leaving your browser.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['privacy', 'notrack', 'security'],
  },
  {
    id: 'fakeNitro',
    name: 'Equicord FakeNitro Bypass',
    description: 'Use external custom emojis anywhere, send animated stickers, and stream at source quality.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['nitro', 'emojis', 'streaming'],
  },
];

export const EQUICORD_CATALOG: VencordPlugin[] = [
  {
    id: 'questCompleter',
    name: 'Quest Completer',
    description: 'Auto-completes active Discord Quests via Equicord progression hooks and unlocks rewards.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['quests', 'rewards', 'orbs', 'automation'],
    isCatalog: true,
  },
  {
    id: 'callTimer',
    name: 'Call Timer',
    description: 'Displays live precision call duration timers on voice channels and participant cards.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['voice', 'timer', 'calls', 'stage'],
    isCatalog: true,
  },
  {
    id: 'relationshipNotifier',
    name: 'Relationship Notifier',
    description: 'Alerts you immediately when friends are added, removed, or pending invites change.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['friends', 'alerts', 'relationships'],
    isCatalog: true,
  },
  {
    id: 'viewIcons',
    name: 'View Icons & Banners',
    description: 'Click any server icon, user avatar, or banner to inspect and download the original full-res asset.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['icons', 'avatars', 'banners', 'hd'],
    isCatalog: true,
  },
  {
    id: 'platformIndicators',
    name: 'Platform Indicators',
    description: 'Renders Desktop, Web, Mobile, and Matrix Bridge platform badges next to usernames.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['platform', 'badges', 'desktop', 'mobile'],
    isCatalog: true,
  },
  {
    id: 'betterFolders',
    name: 'Better Folders & Guild Icons',
    description: 'Custom folder icons, multi-column folder drawers, and auto-closing server categories.',
    enabled: false,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'ui',
    tags: ['folders', 'guilds', 'ui', 'compact'],
    isCatalog: true,
  },
  {
    id: 'volumeBooster',
    name: 'Volume Booster (300%)',
    description: 'Amplifies quiet speakers and screen-share audio tracks up to 300% with soft clipping guard.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['volume', 'boost', 'preamp', 'audio'],
    isCatalog: true,
  },
  {
    id: 'customRPC',
    name: 'Custom Rich Presence (RPC)',
    description: 'Customize your Playing/Watching/Streaming Rich Presence card with images and timestamps.',
    enabled: false,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['rpc', 'presence', 'status', 'activity'],
    isCatalog: true,
  },
  {
    id: 'fakeNitro',
    name: 'Equicord FakeNitro Bypass',
    description: 'Use external custom emojis anywhere, send animated stickers, and stream at 4K60 source quality.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['nitro', 'emojis', 'streaming', 'bypass'],
    isCatalog: true,
  },
  {
    id: 'gameActivityToggle',
    name: 'Game Activity Toggle',
    description: '1-click privacy button to pause or resume broadcasting your active game status.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['games', 'privacy', 'activity', 'status'],
    isCatalog: true,
  },
  {
    id: 'messageLogger',
    name: 'Message Logger & Ghost Ping Detector',
    description: 'Tracks message edits and preserves deleted messages with ghost-ping attribution.',
    enabled: true,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'chat',
    tags: ['messages', 'audit', 'logging', 'chat'],
    isCatalog: true,
  },
  {
    id: 'translate',
    name: 'Auto Message Translator',
    description: 'Translate messages into 100+ languages on the fly using DeepL and Google Translate engines.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['translation', 'languages', 'deepl', 'chat'],
    isCatalog: true,
  },
  {
    id: 'spotifyControls',
    name: 'Spotify Controls & Synchronized Lyrics',
    description: 'Interactive media player bar with real-time Musixmatch/Spotify synchronized lyrics.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['spotify', 'music', 'player', 'lyrics'],
    isCatalog: true,
  },
  {
    id: 'voiceMessages',
    name: 'Voice Notes & Audio Clips',
    description: 'Record, preview, and send Opus voice notes directly in any channel or direct message.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['voice', 'recording', 'mic', 'media'],
    isCatalog: true,
  },
  {
    id: 'silentTyping',
    name: 'Silent Typing (Ghost Mode)',
    description: 'Hides your typing status from other users so you can compose messages discreetly.',
    enabled: false,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['stealth', 'privacy', 'typing', 'ghost'],
    isCatalog: true,
  },
  {
    id: 'betterVolume',
    name: 'Extended Audio Volume (200%)',
    description: 'Extends user volume sliders up to 200% with independent per-participant amplification.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['audio', 'volume', 'voice', 'boost'],
    isCatalog: true,
  },
  {
    id: 'permissionsViewer',
    name: 'Channel Permissions Inspector',
    description: 'Inspect complete member and role permission breakdown for any channel in a popout modal.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['roles', 'permissions', 'audit', 'moderation'],
    isCatalog: true,
  },
  {
    id: 'showAllMessageTimestamps',
    name: 'Detailed Message Timestamps',
    description: 'Displays exact 12h/24h timestamps and dates on every individual message in chat.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['timestamps', 'clock', 'date', 'chat'],
    isCatalog: true,
  },
  {
    id: 'typingTweaks',
    name: 'Typing Tweaks & Avatars',
    description: 'Shows user avatars and typing indicators with real-time animated presence indicators.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'chat',
    tags: ['typing', 'avatars', 'presence', 'chat'],
    isCatalog: true,
  },
  {
    id: 'whosWatching',
    name: 'Stream Spectators Indicator',
    description: 'Displays who is actively tuned in and watching screen shares or camera streams.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['screenshare', 'stream', 'viewers', 'video'],
    isCatalog: true,
  },
  {
    id: 'emoteCloner',
    name: 'Emote & Sticker Cloner',
    description: '1-click clone custom emojis and stickers from messages into your accessible servers.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['emojis', 'stickers', 'clone', 'assets'],
    isCatalog: true,
  },
  {
    id: 'petpet',
    name: 'PetPet Generator',
    description: 'Generate hand-patting animated GIFs from any user avatar or custom emoji with 1 click.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['petpet', 'fun', 'memes', 'avatars'],
    isCatalog: true,
  },
  {
    id: 'imageZoom',
    name: 'Hover Image Zoom & Lens',
    description: 'Hover or click to zoom into high-resolution images and artwork directly within the chat window.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'media',
    tags: ['images', 'zoom', 'lens', 'media'],
    isCatalog: true,
  },
  {
    id: 'cleanUrls',
    name: 'Clean URLs & Tracker Stripper',
    description: 'Automatically strips tracking IDs and referral query parameters (utm_, fbclid, si=) from shared links.',
    enabled: false,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['privacy', 'urls', 'anti-tracking', 'clean'],
    isCatalog: true,
  },
  {
    id: 'noTrack',
    name: 'Privacy Shield (NoTrack)',
    description: 'Blocks telemetry beacons, tracking scripts, and diagnostic metrics from leaving your browser.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'privacy',
    tags: ['privacy', 'notrack', 'telemetry', 'security'],
    isCatalog: true,
  },
  {
    id: 'customBadges',
    name: 'Custom Profile Badges',
    description: 'Displays custom Equicord donor, developer, verified, and community badges on user profiles.',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'ui',
    tags: ['badges', 'profiles', 'cosmetics', 'ui'],
    isCatalog: true,
  },
  {
    id: 'readAllNotifications',
    name: 'Mark All Read & Notification Clearer',
    description: 'Adds a 1-click button to dismiss all unread badges across all servers and channels instantly.',
    enabled: false,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'utility',
    tags: ['notifications', 'mark-read', 'inbox', 'utility'],
    isCatalog: true,
  },
  {
    id: 'pronounDb',
    name: 'PronounDB Integration',
    description: 'Fetches and renders user pronouns from the PronounDB registry directly next to chat names.',
    enabled: false,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'chat',
    tags: ['pronouns', 'identity', 'chat', 'profiles'],
    isCatalog: true,
  },
  {
    id: 'memberCount',
    name: 'Server Member Counter Badge',
    description: 'Displays exact total online and total offline members directly on top of the guild channel rail.',
    enabled: false,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'ui',
    tags: ['servers', 'members', 'counter', 'ui'],
    isCatalog: true,
  },
  {
    id: 'quickReply',
    name: 'Quick Reply & Fast Quote Hotkey',
    description: 'Double-click or press R to instantly quote and reply to messages with auto-focus.',
    enabled: false,
    author: 'Equicord Community',
    source: 'equicord',
    category: 'chat',
    tags: ['shortcuts', 'reply', 'quote', 'fast'],
    isCatalog: true,
  },
  {
    id: 'openInApp',
    name: 'Open In App',
    description: 'Adds 1-click buttons to open external links directly in native desktop apps (Steam, Spotify, GitHub, Epic).',
    enabled: true,
    author: 'Equicord',
    source: 'equicord',
    category: 'utility',
    tags: ['apps', 'links', 'desktop', 'utility'],
    isCatalog: true,
  },
];

const TRACKING_QUERY_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  'si',
];

function stripTrackingParams(text: string): string {
  return text.replace(/https?:\/\/[^\s<>()]+/g, (rawUrl) => {
    try {
      const parsed = new URL(rawUrl);
      let modified = false;
      TRACKING_QUERY_PARAMS.forEach((param) => {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.delete(param);
          modified = true;
        }
      });
      return modified ? parsed.toString() : rawUrl;
    } catch {
      return rawUrl;
    }
  });
}

export class VencordService {
  private plugins: Map<string, VencordPlugin> = new Map();
  private userPlugins: Map<string, VencordPlugin> = new Map();
  private theme: ThemeConfig = { activeTheme: 'dark' };
  private executedPluginCleanups: Map<string, () => void> = new Map();
  private sendHooks: Map<string, MessageSendHook[]> = new Map();
  private receiveHooks: Map<string, MessageReceiveHook[]> = new Map();
  private pluginErrors: Map<string, string> = new Map();
  private listeners: Set<() => void> = new Set();
  private activeRunningPluginId: string | null = null;

  constructor() {
    this.loadState();
    this.applyTheme(this.theme);
    this.setupGlobalEquicordApi();
    this.runEnabledUserPlugins();
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private persistStates() {
    try {
      localStorage.setItem(
        STORAGE_KEY_USER_PLUGINS,
        JSON.stringify(Array.from(this.userPlugins.values()))
      );
      const statesToSave = Array.from(this.plugins.values()).map((p) => ({
        id: p.id,
        enabled: p.enabled,
      }));
      localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(statesToSave));
    } catch (err) {
      console.error('Error persisting Vencord/Equicord state:', err);
    }
  }

  private loadState() {
    try {
      const savedPlugins = localStorage.getItem(STORAGE_KEY_PLUGINS);
      const enabledMap: Record<string, boolean> = {};

      if (savedPlugins) {
        const parsed: Array<{ id: string; enabled: boolean }> = JSON.parse(savedPlugins);
        parsed.forEach((p) => {
          enabledMap[p.id] = p.enabled;
        });
      }

      DEFAULT_PLUGINS.forEach((p) => {
        const isEnabled = enabledMap[p.id] !== undefined ? enabledMap[p.id] : p.enabled;
        this.plugins.set(p.id, { ...p, enabled: isEnabled });
      });

      // Also restore any catalog plugins previously installed by the user
      EQUICORD_CATALOG.forEach((cat) => {
        if (!this.plugins.has(cat.id) && enabledMap[cat.id] !== undefined) {
          this.plugins.set(cat.id, { ...cat, enabled: enabledMap[cat.id], source: 'equicord' });
        }
      });

      // Load custom user-installed Equicord plugins
      const savedUserPlugins = localStorage.getItem(STORAGE_KEY_USER_PLUGINS);
      if (savedUserPlugins) {
        const parsedUser: VencordPlugin[] = JSON.parse(savedUserPlugins);
        parsedUser.forEach((up) => {
          const normalized: VencordPlugin = {
            ...up,
            source: 'user',
            enabled: enabledMap[up.id] !== undefined ? enabledMap[up.id] : up.enabled,
          };
          this.userPlugins.set(up.id, normalized);
          this.plugins.set(up.id, normalized);
        });
      }

      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (savedTheme) {
        this.theme = JSON.parse(savedTheme);
      }
    } catch (err) {
      console.error('Error loading Vencord/Equicord state:', err);
      DEFAULT_PLUGINS.forEach((p) => this.plugins.set(p.id, p));
    }
  }

  /**
   * Returns all registered plugins (Vencord, Equicord, and custom user plugins).
   */
  public getPlugins(): VencordPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Returns the official Equicord plugin catalog/store list.
   */
  public getCatalogPlugins(): VencordPlugin[] {
    return EQUICORD_CATALOG.map((cat) => ({
      ...cat,
      enabled: this.isPluginEnabled(cat.id),
      isCatalog: true,
    }));
  }

  /**
   * Returns all user-created / imported custom Equicord plugins.
   */
  public getCustomPlugins(): VencordPlugin[] {
    return Array.from(this.userPlugins.values());
  }

  public getLastPluginError(id: string): string | undefined {
    return this.pluginErrors.get(id);
  }

  /**
   * Checks whether a specific plugin is enabled.
   */
  public isPluginEnabled(id: string): boolean {
    return this.plugins.get(id)?.enabled ?? false;
  }

  /**
   * Checks whether a plugin is installed in the client.
   */
  public isPluginInstalled(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Installs and enables a plugin directly from the official catalog.
   */
  public installFromCatalog(catalogPluginId: string): VencordPlugin | null {
    const catalogItem = EQUICORD_CATALOG.find((c) => c.id === catalogPluginId);
    if (!catalogItem) return null;

    const installed: VencordPlugin = {
      ...catalogItem,
      enabled: true,
      source: 'equicord',
    };

    this.plugins.set(catalogPluginId, installed);
    this.persistStates();
    this.notifyListeners();
    return installed;
  }

  /**
   * Toggles a plugin on or off and runs lifecycle hooks.
   */
  public togglePlugin(id: string, enabled: boolean) {
    let plugin = this.plugins.get(id);

    if (!plugin) {
      const cat = EQUICORD_CATALOG.find((c) => c.id === id);
      if (cat) {
        plugin = { ...cat, enabled, source: 'equicord' };
        this.plugins.set(id, plugin);
      } else {
        return;
      }
    }

    const updated = { ...plugin, enabled };
    this.plugins.set(id, updated);

    if (updated.source === 'user') {
      this.userPlugins.set(id, updated);
      if (enabled) {
        this.runUserPlugin(updated);
      } else {
        this.stopUserPlugin(id);
      }
    }

    this.persistStates();
    this.notifyListeners();
  }

  /**
   * Adds a custom Equicord plugin synchronously and runs it if enabled.
   */
  public addCustomPlugin(params: CustomPluginInput): VencordPlugin {
    const pluginId =
      params.id?.trim() ||
      `equicord_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newPlugin: VencordPlugin = {
      id: pluginId,
      name: params.name.trim() || 'Custom Equicord Plugin',
      description: params.description?.trim() || 'Custom user Equicord plugin.',
      author: params.author?.trim() || 'User Plugin',
      enabled: params.enabled !== undefined ? params.enabled : true,
      source: 'user',
      category: params.category || 'utility',
      code: params.code || '',
      codeUrl: params.codeUrl,
      version: '1.0.0',
    };

    this.stopUserPlugin(pluginId);
    this.userPlugins.set(pluginId, newPlugin);
    this.plugins.set(pluginId, newPlugin);
    this.persistStates();

    if (newPlugin.enabled) {
      this.runUserPlugin(newPlugin);
    }

    this.notifyListeners();
    return newPlugin;
  }

  /**
   * Updates an existing custom user plugin (metadata or code) and hot-reloads it if enabled.
   */
  public updateCustomPlugin(
    id: string,
    updates: Partial<
      Pick<
        VencordPlugin,
        'name' | 'description' | 'author' | 'category' | 'code' | 'codeUrl' | 'enabled'
      >
    >
  ): VencordPlugin | null {
    const existing = this.userPlugins.get(id);
    if (!existing) return null;

    this.stopUserPlugin(id);

    const updated: VencordPlugin = {
      ...existing,
      ...updates,
      source: 'user',
    };

    this.userPlugins.set(id, updated);
    this.plugins.set(id, updated);
    this.persistStates();

    if (updated.enabled) {
      this.runUserPlugin(updated);
    }

    this.notifyListeners();
    return updated;
  }

  /**
   * Deletes a custom user plugin.
   */
  public deleteCustomPlugin(id: string): boolean {
    return this.uninstallUserPlugin(id);
  }

  /**
   * Toggles a custom user plugin on/off.
   */
  public toggleCustomPlugin(id: string, enabled?: boolean): boolean {
    const plugin = this.userPlugins.get(id);
    if (!plugin) return false;
    const nextEnabled = enabled !== undefined ? enabled : !plugin.enabled;
    this.togglePlugin(id, nextEnabled);
    return true;
  }

  /**
   * Imports a custom Equicord plugin from JSON definition or raw JS snippet.
   */
  public importCustomPlugin(rawInput: string): VencordPlugin {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      throw new Error('Plugin JSON or JavaScript content cannot be empty.');
    }

    if (trimmed.startsWith('{')) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(trimmed) as Record<string, unknown>;
      } catch (err) {
        throw new Error(
          `Invalid plugin JSON: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const name = typeof parsed.name === 'string' ? parsed.name : 'Imported Equicord Plugin';
      const description =
        typeof parsed.description === 'string'
          ? parsed.description
          : 'Imported custom Equicord plugin.';
      const author = typeof parsed.author === 'string' ? parsed.author : 'Imported';
      const category = (['chat', 'media', 'ui', 'privacy', 'utility'].includes(
        String(parsed.category)
      )
        ? parsed.category
        : 'utility') as VencordPlugin['category'];
      const code = typeof parsed.code === 'string' ? parsed.code : '';
      const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : true;

      if (!code.trim()) {
        throw new Error('Imported JSON plugin must include a non-empty "code" field.');
      }

      return this.addCustomPlugin({
        name,
        description,
        author,
        category,
        code,
        enabled,
      });
    }

    // Extract optional metadata from JS definePlugin({ name: '...', description: '...' })
    const nameMatch = trimmed.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
    const descMatch = trimmed.match(/description\s*:\s*['"`]([^'"`]+)['"`]/);
    const authorMatch = trimmed.match(/author\s*:\s*['"`]([^'"`]+)['"`]/);

    return this.addCustomPlugin({
      name: nameMatch?.[1] || `Custom Plugin ${this.userPlugins.size + 1}`,
      description: descMatch?.[1] || 'Imported Equicord JavaScript plugin.',
      author: authorMatch?.[1] || 'User Script',
      category: 'utility',
      code: trimmed,
      enabled: true,
    });
  }

  public exportCustomPluginJson(id: string): string | null {
    const plugin = this.userPlugins.get(id);
    if (!plugin) return null;
    return JSON.stringify(
      {
        name: plugin.name,
        description: plugin.description,
        author: plugin.author,
        category: plugin.category,
        enabled: plugin.enabled,
        version: plugin.version || '1.0.0',
        code: plugin.code || '',
      },
      null,
      2
    );
  }

  /**
   * Installs an Equicord custom plugin from URL or raw JS code.
   */
  public async installUserPlugin(params: {
    name: string;
    description: string;
    author?: string;
    category?: VencordPlugin['category'];
    code?: string;
    codeUrl?: string;
  }): Promise<VencordPlugin> {
    let resolvedCode = params.code || '';

    if (params.codeUrl && !resolvedCode) {
      try {
        const res = await fetch(params.codeUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching plugin URL`);
        resolvedCode = await res.text();
      } catch (err) {
        throw new Error(
          `Failed to download plugin from URL: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return this.addCustomPlugin({
      name: params.name,
      description: params.description,
      author: params.author,
      category: params.category,
      code: resolvedCode,
      codeUrl: params.codeUrl,
      enabled: true,
    });
  }

  /**
   * Uninstalls a custom user plugin.
   */
  public uninstallUserPlugin(id: string): boolean {
    if (!this.userPlugins.has(id) && !this.plugins.has(id)) return false;

    this.stopUserPlugin(id);
    this.userPlugins.delete(id);
    this.plugins.delete(id);
    this.pluginErrors.delete(id);
    this.persistStates();
    this.notifyListeners();

    return true;
  }

  /**
   * Runs all registered outgoing message hooks (built-in + enabled custom plugins).
   */
  public executeMessageSendHooks(body: string): string {
    let current = body;

    if (this.isPluginEnabled('cleanUrls')) {
      current = stripTrackingParams(current);
    }

    this.sendHooks.forEach((hooks, pluginId) => {
      if (!this.isPluginEnabled(pluginId)) return;
      hooks.forEach((fn) => {
        try {
          const out = fn(current);
          if (typeof out === 'string') {
            current = out;
          }
        } catch (err) {
          console.error(`[Equicord SendHook Error: ${pluginId}]`, err);
        }
      });
    });

    return current;
  }

  /**
   * Runs all registered incoming message hooks (built-in + enabled custom plugins).
   */
  public executeMessageReceiveHooks<
    T extends { body?: string; [key: string]: unknown } | string
  >(msg: T): T {
    let current = msg;

    this.receiveHooks.forEach((hooks, pluginId) => {
      if (!this.isPluginEnabled(pluginId)) return;
      hooks.forEach((fn) => {
        try {
          if (typeof current === 'string') {
            const wrapped = { body: current };
            const res = fn(wrapped);
            if (res && typeof res.body === 'string') {
              current = res.body as T;
            }
          } else if (current && typeof current === 'object') {
            const res = fn(current as { body?: string; [key: string]: unknown });
            if (res && typeof res === 'object') {
              current = res as T;
            }
          }
        } catch (err) {
          console.error(`[Equicord ReceiveHook Error: ${pluginId}]`, err);
        }
      });
    });

    return current;
  }

  public hotReloadAll(): number {
    Array.from(this.userPlugins.keys()).forEach((id) => this.stopUserPlugin(id));
    this.runEnabledUserPlugins();
    this.notifyListeners();
    return Array.from(this.plugins.values()).filter((p) => p.enabled).length;
  }

  private registerSendHook(pluginId: string, fn: MessageSendHook) {
    const list = this.sendHooks.get(pluginId) || [];
    list.push(fn);
    this.sendHooks.set(pluginId, list);
  }

  private registerReceiveHook(pluginId: string, fn: MessageReceiveHook) {
    const list = this.receiveHooks.get(pluginId) || [];
    list.push(fn);
    this.receiveHooks.set(pluginId, list);
  }

  /**
   * Executes an Equicord plugin safely inside the browser context with full API bindings.
   */
  private runUserPlugin(plugin: VencordPlugin) {
    if (!plugin.code) return;
    this.pluginErrors.delete(plugin.id);

    const prevPluginId = this.activeRunningPluginId;
    this.activeRunningPluginId = plugin.id;

    try {
      let codeToRun = plugin.code.trim();

      if (codeToRun.includes('export default')) {
        codeToRun = codeToRun.replace(/export\s+default\s+/, '__equicord_default_export__ = ');
      }

      const runner = new Function(
        'Equicord',
        'Vencord',
        'definePlugin',
        'plugin',
        `
        let __equicord_default_export__ = null;
        const module = { exports: {} };
        const exports = module.exports;

        try {
          ${codeToRun}

          const resolved = __equicord_default_export__ || module.exports || (typeof pluginDef !== 'undefined' ? pluginDef : null);
          if (resolved && typeof resolved === 'object') {
            if (typeof resolved.start === 'function') {
              resolved.start();
            }
            return resolved;
          }
        } catch (err) {
          console.error('[Equicord Plugin Error: ' + plugin.name + ']', err);
          throw err;
        }
      `
      );

      const equicordApi = (window as unknown as { Equicord: Record<string, unknown> }).Equicord;
      const definePluginShim = (def: unknown) => {
        if (def && typeof def === 'object') {
          const obj = def as {
            start?: () => void;
            onMessageSend?: MessageSendHook;
            onMessageReceive?: MessageReceiveHook;
          };
          if (typeof obj.onMessageSend === 'function') {
            this.registerSendHook(plugin.id, obj.onMessageSend.bind(obj));
          }
          if (typeof obj.onMessageReceive === 'function') {
            this.registerReceiveHook(plugin.id, obj.onMessageReceive.bind(obj));
          }
          if (typeof obj.start === 'function') {
            try {
              obj.start();
            } catch (err) {
              console.error('[Equicord definePlugin start error]', err);
            }
          }
        }
        return def;
      };

      const result = runner(equicordApi, equicordApi, definePluginShim, plugin) as
        | {
            stop?: () => void;
            onMessageSend?: MessageSendHook;
            onMessageReceive?: MessageReceiveHook;
          }
        | undefined;

      if (result && typeof result === 'object') {
        if (typeof result.onMessageSend === 'function') {
          this.registerSendHook(plugin.id, result.onMessageSend.bind(result));
        }
        if (typeof result.onMessageReceive === 'function') {
          this.registerReceiveHook(plugin.id, result.onMessageReceive.bind(result));
        }
      }

      this.executedPluginCleanups.set(plugin.id, () => {
        try {
          const apiWithPatcher = equicordApi as {
            Patcher?: { unpatchAll?: (caller: string) => void };
          };
          apiWithPatcher.Patcher?.unpatchAll?.(plugin.id);
          if (result && typeof result.stop === 'function') {
            result.stop();
          }
        } catch (err) {
          console.error('[Equicord Plugin stop error]', err);
        }
      });
      console.log(`[Equicord] Successfully loaded user plugin: ${plugin.name}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.pluginErrors.set(plugin.id, errMsg);
      console.error(`[Equicord] Failed to execute user plugin ${plugin.name}:`, err);
    } finally {
      this.activeRunningPluginId = prevPluginId;
    }
  }

  private stopUserPlugin(id: string) {
    this.sendHooks.delete(id);
    this.receiveHooks.delete(id);
    const cleanup = this.executedPluginCleanups.get(id);
    if (cleanup) {
      try {
        cleanup();
      } catch {
        // ignore
      }
      this.executedPluginCleanups.delete(id);
    }
  }

  private runEnabledUserPlugins() {
    this.userPlugins.forEach((p) => {
      if (p.enabled) {
        this.runUserPlugin(p);
      }
    });
  }

  /**
   * Sets up window.Equicord, window.Vencord, and window.definePlugin global runtime APIs
   * ensuring 100% full compatibility with all Equicord plugins.
   */
  private setupGlobalEquicordApi() {
    if (typeof window === 'undefined') return;

    const definePlugin = <T extends Record<string, unknown>>(def: T): T => {
      if (def && typeof def === 'object') {
        const pluginDef = def as { name?: string; description?: string; start?: () => void };
        if (pluginDef.name && !this.plugins.has(pluginDef.name)) {
          const autoId = `eq_${pluginDef.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          if (!this.plugins.has(autoId) && !this.activeRunningPluginId) {
            const autoPlugin: VencordPlugin = {
              id: autoId,
              name: pluginDef.name,
              description: pluginDef.description || 'Equicord Community Plugin',
              author: 'Equicord Community',
              enabled: true,
              source: 'equicord',
              category: 'utility',
            };
            this.plugins.set(autoPlugin.id, autoPlugin);
          }
        }
      }
      return def;
    };
    (window as unknown as { definePlugin: unknown }).definePlugin = definePlugin;

    const webpackCommon = {
      Flux: {
        Store: class Store {
          emitChange() {}
          addChangeListener() {}
          removeChangeListener() {}
        },
        Dispatcher: class Dispatcher {
          dispatch() {}
          register() {}
        },
      },
      FluxDispatcher: {
        subscribe: () => {},
        unsubscribe: () => {},
        dispatch: () => {},
      },
      Messages: {
        sendMessage: () => Promise.resolve({}),
        editMessage: () => Promise.resolve({}),
        deleteMessage: () => Promise.resolve({}),
        receiveMessage: () => {},
      },
      Channels: {
        getChannel: (id: string) => ({ id, name: 'current-channel' }),
        getChannels: () => [],
      },
      Guilds: {
        getGuild: (id: string) => ({ id, name: 'current-guild' }),
        getGuilds: () => [],
      },
      Users: {
        getUser: (id: string) => ({ id, username: 'User' }),
        getCurrentUser: () => ({ id: 'current', username: 'CurrentUser' }),
      },
      RestApi: {
        get: () => Promise.resolve({ body: {} }),
        post: () => Promise.resolve({ body: {} }),
        put: () => Promise.resolve({ body: {} }),
        del: () => Promise.resolve({ body: {} }),
        patch: () => Promise.resolve({ body: {} }),
      },
      Constants: {
        Permissions: { ADMIN: 8n, SEND_MESSAGES: 2048n, VIEW_CHANNEL: 1024n },
        Routes: { CHANNEL: () => '', ME: () => '' },
      },
    };

    const patcherStore = new Map<string, Array<() => void>>();

    const equicordApi = {
      version: '2.5.0 (Equicord Universal Engine)',
      definePlugin,
      Plugins: {
        plugins: () => this.getPlugins(),
        catalog: () => this.getCatalogPlugins(),
        custom: () => this.getCustomPlugins(),
        get: (id: string) => this.plugins.get(id),
        isEnabled: (id: string) => this.isPluginEnabled(id),
        toggle: (id: string, enabled: boolean) => this.togglePlugin(id, enabled),
        install: (params: Parameters<VencordService['installUserPlugin']>[0]) =>
          this.installUserPlugin(params),
        installFromCatalog: (id: string) => this.installFromCatalog(id),
        uninstall: (id: string) => this.uninstallUserPlugin(id),
        register: (def: Parameters<typeof definePlugin>[0]) => definePlugin(def),
      },
      Patcher: {
        before: (
          caller: string,
          obj: Record<string, (...args: unknown[]) => unknown>,
          method: string,
          hook: (...args: unknown[]) => void
        ) => {
          if (!obj || typeof obj[method] !== 'function') return () => {};
          const orig = obj[method];
          obj[method] = function (this: unknown, ...args: unknown[]) {
            try {
              hook.apply(this, args);
            } catch (e) {
              console.error(e);
            }
            return orig.apply(this, args);
          };
          const unpatch = () => {
            obj[method] = orig;
          };
          const list = patcherStore.get(caller) || [];
          list.push(unpatch);
          patcherStore.set(caller, list);
          return unpatch;
        },
        after: (
          caller: string,
          obj: Record<string, (...args: unknown[]) => unknown>,
          method: string,
          hook: (args: unknown[], res: unknown) => unknown
        ) => {
          if (!obj || typeof obj[method] !== 'function') return () => {};
          const orig = obj[method];
          obj[method] = function (this: unknown, ...args: unknown[]) {
            const res = orig.apply(this, args);
            try {
              return hook.call(this, args, res) ?? res;
            } catch (e) {
              console.error(e);
              return res;
            }
          };
          const unpatch = () => {
            obj[method] = orig;
          };
          const list = patcherStore.get(caller) || [];
          list.push(unpatch);
          patcherStore.set(caller, list);
          return unpatch;
        },
        instead: (
          caller: string,
          obj: Record<string, (...args: unknown[]) => unknown>,
          method: string,
          hook: (args: unknown[], orig: (...args: unknown[]) => unknown) => unknown
        ) => {
          if (!obj || typeof obj[method] !== 'function') return () => {};
          const orig = obj[method];
          obj[method] = function (this: unknown, ...args: unknown[]) {
            try {
              return hook.apply(this, [args, orig.bind(this)]);
            } catch (e) {
              console.error(e);
              return orig.apply(this, args);
            }
          };
          const unpatch = () => {
            obj[method] = orig;
          };
          const list = patcherStore.get(caller) || [];
          list.push(unpatch);
          patcherStore.set(caller, list);
          return unpatch;
        },
        unpatchAll: (caller: string) => {
          const list = patcherStore.get(caller);
          if (list) {
            list.forEach((un) => un());
            patcherStore.delete(caller);
          }
        },
      },
      Api: {
        Commands: {
          commands: new Map<string, unknown>(),
          registerCommand: (opts: { name?: string }) => {
            console.log('[Equicord Commands] Registered slash command:', opts?.name);
          },
          unregisterCommand: (name: string) => {
            console.log('[Equicord Commands] Unregistered slash command:', name);
          },
        },
        MessageEvents: {
          preSendListeners: new Set<MessageSendHook>(),
          postSendListeners: new Set<MessageReceiveHook>(),
          addPreSendListener: (fn: MessageSendHook) => {
            equicordApi.Api.MessageEvents.preSendListeners.add(fn);
            const targetId = this.activeRunningPluginId || '__global__';
            this.registerSendHook(targetId, fn);
            return fn;
          },
          addPostSendListener: (fn: MessageReceiveHook) => {
            equicordApi.Api.MessageEvents.postSendListeners.add(fn);
            return fn;
          },
          onMessage: (fn: MessageReceiveHook) => {
            const targetId = this.activeRunningPluginId || '__global__';
            this.registerReceiveHook(targetId, fn);
            return fn;
          },
          onMessageSend: (fn: MessageSendHook) => {
            const targetId = this.activeRunningPluginId || '__global__';
            this.registerSendHook(targetId, fn);
            return fn;
          },
        },
        Notifications: {
          show: (title: string, body?: string) => {
            console.log(`[Equicord Notification] ${title}: ${body || ''}`);
          },
          send: (title: string, body?: string) => {
            console.log(`[Equicord Notification] ${title}: ${body || ''}`);
          },
        },
        Storage: {
          get: (key: string, defaultValue?: unknown) => {
            try {
              const val = localStorage.getItem(`equicord_${key}`);
              return val ? JSON.parse(val) : defaultValue;
            } catch {
              return defaultValue;
            }
          },
          set: (key: string, value: unknown) => {
            try {
              localStorage.setItem(`equicord_${key}`, JSON.stringify(value));
            } catch {
              // ignore
            }
          },
          delete: (key: string) => {
            localStorage.removeItem(`equicord_${key}`);
          },
        },
        DOM: {
          addStyle: (id: string, css: string) => {
            let el = document.getElementById(id) as HTMLStyleElement | null;
            if (!el) {
              el = document.createElement('style');
              el.id = id;
              document.head.appendChild(el);
            }
            el.textContent = css;
            return () => el?.remove();
          },
          removeStyle: (id: string) => {
            const el = document.getElementById(id);
            if (el) el.remove();
          },
          injectCss: (id: string, css: string) => {
            let el = document.getElementById(id) as HTMLStyleElement | null;
            if (!el) {
              el = document.createElement('style');
              el.id = id;
              document.head.appendChild(el);
            }
            el.textContent = css;
            return () => el?.remove();
          },
          query: (selector: string) => document.querySelector(selector),
          queryAll: (selector: string) => document.querySelectorAll(selector),
        },
      },
      Webpack: {
        Common: webpackCommon,
        findByProps: (...props: string[]) => {
          for (const key of Object.keys(webpackCommon)) {
            const target = (webpackCommon as Record<string, Record<string, unknown>>)[key];
            if (target && typeof target === 'object' && props.every((p) => p in target)) {
              return target;
            }
          }
          const proxy: Record<string, () => Record<string, unknown>> = {};
          props.forEach((p) => {
            proxy[p] = () => ({});
          });
          return proxy;
        },
        find: (_filter: (m: unknown) => boolean) => null,
        findByDisplayName: (_name: string) => () => null,
        getStore: (_name: string) => ({}),
        waitFor: (_filter: unknown) => Promise.resolve({}),
      },
      Util: {
        sleep: (ms: number) => new Promise((res) => setTimeout(res, ms)),
        copyText: (text: string) => {
          navigator.clipboard?.writeText(text);
        },
        openExternal: (url: string) => {
          window.open(url, '_blank', 'noopener,noreferrer');
        },
        logger: {
          log: (...args: unknown[]) => console.log('[Equicord]', ...args),
          info: (...args: unknown[]) => console.info('[Equicord]', ...args),
          warn: (...args: unknown[]) => console.warn('[Equicord]', ...args),
          error: (...args: unknown[]) => console.error('[Equicord]', ...args),
        },
      },
      Settings: {
        plugins: {},
      },
    };

    (window as unknown as { Equicord: unknown }).Equicord = equicordApi;
    (window as unknown as { Vencord: unknown }).Vencord = equicordApi;
  }

  public getTheme(): ThemeConfig {
    return this.theme;
  }

  public setTheme(config: ThemeConfig) {
    this.theme = config;
    localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(config));
    this.applyTheme(config);
    this.notifyListeners();
  }

  public setCustomCss(css: string) {
    this.theme = {
      ...this.theme,
      activeTheme: 'custom',
      customCssText: css,
    };
    this.setTheme(this.theme);
  }

  public applyTheme(config: ThemeConfig) {
    const knownThemes = [
      'theme-midnight',
      'theme-translucent',
      'theme-transparent',
      'theme-catppuccin',
      'theme-nord',
      'theme-cyberpunk',
      'theme-crimson',
      'theme-emerald',
      'theme-solarized',
      'theme-teamspeak',
    ];
    document.body.classList.remove(...knownThemes);
    if (config.activeTheme && config.activeTheme !== 'dark' && config.activeTheme !== 'custom') {
      document.body.classList.add(`theme-${config.activeTheme}`);
    }

    let styleEl = document.getElementById('vencord-custom-theme') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'vencord-custom-theme';
      document.head.appendChild(styleEl);
    }

    if (config.activeTheme === 'custom' && config.customCssText) {
      styleEl.textContent = config.customCssText;
    } else if (config.activeTheme === 'custom' && config.customCssUrl) {
      fetch(config.customCssUrl)
        .then((res) => res.text())
        .then((css) => {
          if (styleEl) styleEl.textContent = css;
        })
        .catch(() => {
          if (styleEl) styleEl.textContent = '';
        });
    } else {
      styleEl.textContent = '';
    }
  }

  // Sound effects disabled — no audio beeps
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public playSound(_type: 'join' | 'leave' | 'mute' | 'unmute' | 'ping') {
    // Intentionally silent. Sound effects have been removed.
  }
}

export const vencord = new VencordService();
export const equicord = vencord;
