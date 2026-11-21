import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { ServerRail } from './components/ServerRail';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { VoicePanel } from './components/VoicePanel';
import { UserBar } from './components/UserBar';
import { VoiceStage } from './components/VoiceStage';
import { SharedBrowserStage } from './components/SharedBrowserStage';
import { MemberList } from './components/MemberList';
import { SettingsModal, type SettingsTab } from './components/SettingsModal';
import { QuickSwitcherModal } from './components/QuickSwitcherModal';
import { LoginModal } from './components/LoginModal';
import { AddConversationModal, type AddModalTab } from './components/AddConversationModal';
import { ChannelSettingsModal } from './components/ChannelSettingsModal';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import {
  DiscordCallWarningModal,
  isDiscordLatencyWarningSuppressed,
} from './components/DiscordCallWarningModal';
import { DiscordConnectModal } from './components/DiscordConnectModal';
import { ActivityModal, EmbeddedActivityStage, type ActivityItem } from './components/ActivityModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MinecraftConsoleModal } from './components/MinecraftConsoleModal';
import { VoiceProxyModal } from './components/VoiceProxyModal';
import { InGameOverlay } from './components/InGameOverlay';
import { MicrosoftStoreModal } from './components/MicrosoftStoreModal';
import { DiscordHubModal, type DiscordHubTab } from './components/DiscordHubModal';
import { EquicordModal } from './components/EquicordModal';
import { ScriptingModal } from './components/ScriptingModal';
import { LargeFileShareModal } from './components/LargeFileShareModal';
import { SoundboardPopover } from './components/SoundboardPopover';
import { TeamSpeakLayout } from './components/TeamSpeakLayout';
import { WebcamBackgroundModal } from './components/WebcamBackgroundModal';
import { useAutoUpdater } from './hooks/useAutoUpdater';
import { Plus, Hash, Volume2, X, Sparkles, AlertCircle } from 'lucide-react';

import { matrix } from './services/matrix';
import { livekit } from './services/livekit';
import { voiceProxy } from './services/voiceProxy';
import { desktopBridge } from './services/desktopBridge';
import { overlayService } from './services/overlay';
import { userProfileService, type UserProfileCustomizations } from './services/userProfile';
import { vencord } from './services/vencord';
import { scriptEngine } from './services/scriptEngine';
import { zoomService } from './services/zoom';
import { soundboardService } from './services/soundboard';
import type {
  MatrixRoom,
  DiscordGuild,
  MatrixMessage,
  VoiceParticipant,
  MatrixUser,
  EngineMode,
  SoundboardPlayEvent,
} from './types';

interface MatrixModeBridge {
  getEngineMode?: () => EngineMode;
  setEngineMode?: (mode: EngineMode) => void;
}

function readInitialEngineMode(): EngineMode {
  try {
    const ext = matrix as unknown as MatrixModeBridge;
    const fromMatrix = ext.getEngineMode?.();
    if (fromMatrix) return fromMatrix;
    const saved = localStorage.getItem('protutech_engine_mode') as EngineMode | null;
    if (saved === 'hybrid' || saved === 'proprietary' || saved === 'discord_proxy') {
      return saved;
    }
  } catch {
    // Ignore storage failures
  }
  return 'hybrid';
}

const DEFAULT_GUEST_ROOMS: MatrixRoom[] = [
  {
    id: 'guest_welcome',
    name: 'welcome-sandbox',
    topic: 'Sandbox chat — type a message or /ping.',
    isDirect: false,
    isGroupChat: false,
    serverKind: 'proprietary',
    members: [
      {
        userId: '@protutech_bot:local.protutech',
        displayName: 'Protutech Bot',
        presence: 'online',
        statusMsg: 'Echo Test (8ms)',
      },
      {
        userId: '@guest:local.protutech',
        displayName: 'Guest (You)',
        presence: 'online',
        statusMsg: 'Sandbox Mode',
      },
    ],
  },
  {
    id: 'guest_voice_loopback',
    name: '🎙️-voice-loopback-test',
    topic: 'Test mic loopback, camera, and screen share.',
    isDirect: false,
    isGroupChat: false,
    isVoice: true,
    serverKind: 'proprietary',
    members: [
      {
        userId: '@guest:local.protutech',
        displayName: 'Guest (You)',
        presence: 'online',
      },
    ],
  },
  {
    id: 'guest_video_test',
    name: '📹-video-test',
    topic: 'Test live camera preview and virtual backgrounds.',
    isDirect: false,
    isGroupChat: false,
    isVoice: true,
    serverKind: 'proprietary',
    members: [
      {
        userId: '@guest:local.protutech',
        displayName: 'Guest (You)',
        presence: 'online',
      },
    ],
  },
];

const DEFAULT_GUEST_GUILD: DiscordGuild = {
  id: 'guest_demo_server',
  name: 'Guest Sandbox',
  channels: DEFAULT_GUEST_ROOMS,
  hasVoice: true,
  serverKind: 'proprietary',
  isProprietary: true,
};

const DEFAULT_GUEST_MESSAGES: MatrixMessage[] = [
  {
    id: 'gmsg_1',
    roomId: 'guest_welcome',
    sender: '@protutech_bot:local.protutech',
    senderName: 'Protutech Bot',
    body: 'Welcome to Protutech Sandbox. Local chat, voice, camera preview, screen share, and file tools are active.',
    timestamp: Date.now() - 30000,
    source: 'app',
  },
  {
    id: 'gmsg_2',
    roomId: 'guest_welcome',
    sender: '@protutech_bot:local.protutech',
    senderName: 'Protutech Bot',
    body: 'Try `/ping`, `/roll 20`, or open Tools in the top bar.',
    timestamp: Date.now() - 15000,
    source: 'app',
  },
];

function isProprietaryGuild(guild: DiscordGuild): boolean {
  if (guild.serverKind === 'proprietary' || guild.isProprietary) return true;
  if (guild.serverKind === 'discord' || guild.isAlwaysSynced) return false;
  const lower = `${guild.id} ${guild.name}`.toLowerCase();
  return !lower.includes('discord') && !lower.includes('bridged');
}

function buildTempRoom(
  name: string,
  channelType: 'text' | 'voice',
  guildId: string
): MatrixRoom {
  return {
    id: `temp_${Date.now()}`,
    name,
    topic: 'Ephemeral channel — will disappear when this browser tab is closed',
    isDirect: false,
    isGroupChat: false,
    isVoice: channelType === 'voice',
    guildId,
    guildName: 'Temporary Session',
    serverKind: 'proprietary',
    members: [
      {
        userId: '@guest:local.protutech',
        displayName: 'Guest Sampler (You)',
        presence: 'online',
      },
    ],
  };
}

function getInitialHydration(): {
  rooms: MatrixRoom[];
  guilds: DiscordGuild[];
  activeGuildId: string | null;
  activeRoomId: string | null;
  messages: MatrixMessage[];
} {
  const isGuest =
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem('protutech_guest_mode') === 'true';

  if (isGuest) {
    const savedTempRooms = sessionStorage.getItem('protutech_temp_rooms');
    const tempRooms: MatrixRoom[] = savedTempRooms ? JSON.parse(savedTempRooms) : [];
    const allRooms = [...DEFAULT_GUEST_ROOMS, ...tempRooms];
    return {
      rooms: allRooms,
      guilds: [{ ...DEFAULT_GUEST_GUILD, channels: allRooms }],
      activeGuildId: 'guest_demo_server',
      activeRoomId: 'guest_welcome',
      messages: DEFAULT_GUEST_MESSAGES,
    };
  }

  if (!matrix.isAuthenticated()) {
    return {
      rooms: [],
      guilds: [],
      activeGuildId: null,
      activeRoomId: null,
      messages: [],
    };
  }

  const cached = matrix.getCachedRooms();
  const initialRoomId = cached.rooms[0]?.id || null;
  const initialGuildId =
    cached.rooms[0]?.guildId ||
    cached.guilds.find(g => g.channels.some(c => c.id === initialRoomId))?.id ||
    cached.guilds[0]?.id ||
    null;
  const initialMessages = initialRoomId ? matrix.getCachedMessages(initialRoomId) : [];

  return {
    rooms: cached.rooms,
    guilds: cached.guilds,
    activeGuildId: initialGuildId,
    activeRoomId: initialRoomId,
    messages: initialMessages,
  };
}

export const App: React.FC = () => {
  const [initialHydration] = useState(getInitialHydration);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(matrix.isAuthenticated());
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    return (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('protutech_guest_mode') === 'true'
    );
  });
  const [engineMode, setEngineMode] = useState<EngineMode>(readInitialEngineMode);

  const [isCreateTempChannelOpen, setIsCreateTempChannelOpen] = useState(false);
  const [tempChannelName, setTempChannelName] = useState('');
  const [tempChannelType, setTempChannelType] = useState<'text' | 'voice'>('text');
  const [tempChannelError, setTempChannelError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<MatrixRoom[]>(initialHydration.rooms);
  const [guilds, setGuilds] = useState<DiscordGuild[]>(initialHydration.guilds);
  const [activeGuildId, setActiveGuildId] = useState<string | null>(initialHydration.activeGuildId);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialHydration.activeRoomId);
  const [messages, setMessages] = useState<MatrixMessage[]>(initialHydration.messages);

  // Voice state
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [rtcPing, setRtcPing] = useState<number>(14);
  const [activeVoiceRoom, setActiveVoiceRoom] = useState<string | null>(null);

  // Profile state
  const [userProfile, setUserProfile] = useState<UserProfileCustomizations>(() =>
    userProfileService.getProfile()
  );

  // UI toggles & Modals
  const [showMemberList, setShowMemberList] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSwitcherOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('themes');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState<AddModalTab>('server');
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activeActivity, setActiveActivity] = useState<ActivityItem | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<MatrixUser | null>(null);
  const [isMinecraftConsoleOpen, setIsMinecraftConsoleOpen] = useState(false);
  const [isVoiceProxyOpen, setIsVoiceProxyOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Newly wired Hubs, Scripts, Large Files, & Co-Browse
  const [isDiscordHubOpen, setIsDiscordHubOpen] = useState(false);
  const [discordHubTab, setDiscordHubTab] = useState<DiscordHubTab>('quests');
  const [isEquicordOpen, setIsEquicordOpen] = useState(false);
  const [isScriptsOpen, setIsScriptsOpen] = useState(false);
  const [isLargeFileModalOpen, setIsLargeFileModalOpen] = useState(false);
  const [isCoBrowseOpen, setIsCoBrowseOpen] = useState(false);
  const [coBrowseInitialQuery, setCoBrowseInitialQuery] = useState<string | undefined>(undefined);

  // Layout Format, Zoom, Soundboard, & Voice Stage Display States
  const [layoutFormat, setLayoutFormat] = useState<'discord' | 'teamspeak'>(() =>
    vencord.getTheme().layoutFormat === 'teamspeak' ? 'teamspeak' : 'discord'
  );
  const [zoomLevel, setZoomLevel] = useState<number>(() => zoomService.getZoom());
  const [showZoomHud, setShowZoomHud] = useState(false);
  const zoomHudTimerRef = useRef<number | null>(null);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [isCameraPreviewOpen, setIsCameraPreviewOpen] = useState(false);
  const [soundboardToasts, setSoundboardToasts] = useState<SoundboardPlayEvent[]>([]);
  const [isVoiceStageExpanded, setIsVoiceStageExpanded] = useState(false);
  const [isVoiceStageCollapsed, setIsVoiceStageCollapsed] = useState(false);

  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  const roomsRef = useRef<MatrixRoom[]>(rooms);
  const locallyDeletedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleOpenCameraPreview = () => {
      setIsCameraPreviewOpen(true);
    };
    window.addEventListener('protutech:open-camera-preview', handleOpenCameraPreview);
    return () => {
      window.removeEventListener('protutech:open-camera-preview', handleOpenCameraPreview);
    };
  }, []);

  useEffect(() => {
    if (!isCreateTempChannelOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreateTempChannelOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isCreateTempChannelOpen]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // Real-time live auto-update sentinel with Discord-style restart
  const { updateAvailable, newVersion, restartAndApplyUpdate } = useAutoUpdater();

  // Subscribe to User Profile customizations
  useEffect(() => {
    const unsub = userProfileService.subscribe(setUserProfile);
    return unsub;
  }, []);

  // Subscribe to Vencord/Equicord theme & layout format switches
  useEffect(() => {
    const unsub = vencord.subscribe(() => {
      const theme = vencord.getTheme();
      setLayoutFormat(theme.layoutFormat === 'teamspeak' ? 'teamspeak' : 'discord');
    });
    return unsub;
  }, []);

  // Initialize Soundboard & subscribe to play toast events
  useEffect(() => {
    void soundboardService.init();
    const unsub = soundboardService.subscribePlayEvents(evt => {
      setSoundboardToasts(prev => [...prev.slice(-2), evt]);
      window.setTimeout(() => {
        setSoundboardToasts(prev => prev.filter(item => item.id !== evt.id));
      }, 3200);
    });
    return unsub;
  }, []);

  // Subscribe to Zoom Service & global Ctrl/Cmd zoom keyboard shortcuts
  useEffect(() => {
    let mounted = true;
    const unsub = zoomService.subscribe(nextZoom => {
      if (!mounted) return;
      setZoomLevel(nextZoom);
      setShowZoomHud(true);
      if (zoomHudTimerRef.current !== null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
      zoomHudTimerRef.current = window.setTimeout(() => {
        setShowZoomHud(false);
      }, 2000);
    });

    const onZoomKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomService.zoomIn();
      } else if (
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract'
      ) {
        e.preventDefault();
        zoomService.zoomOut();
      } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        zoomService.resetZoom();
      }
    };

    window.addEventListener('keydown', onZoomKeyDown);
    return () => {
      mounted = false;
      unsub();
      window.removeEventListener('keydown', onZoomKeyDown);
      if (zoomHudTimerRef.current !== null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
    };
  }, []);

  // Sync Overlay config changes to native DesktopBridge (Electron / Tauri)
  useEffect(() => {
    const unsub = overlayService.subscribe(cfg => {
      if (desktopBridge.isDesktopApp()) {
        void desktopBridge.setOverlayMode(cfg.enabled, cfg.isInteractive);
      }
    });
    return unsub;
  }, []);

  // Always subscribe to LiveKit & VoiceProxy regardless of Guest, Proprietary, or Hybrid mode!
  useEffect(() => {
    const unsubscribeVoice = livekit.subscribe((participants, ping) => {
      if (voiceProxy.getSession().status === 'connected') return;
      setVoiceParticipants(participants);
      setRtcPing(ping);
      setActiveVoiceRoom(livekit.getActiveRoom());
    });

    const unsubscribeVoiceProxy = voiceProxy.subscribe(session => {
      if (session.status === 'connected') {
        setActiveVoiceRoom(session.targetName);
        setVoiceParticipants(session.participants);
        setRtcPing(session.ping);
      } else if (session.status === 'disconnected') {
        if (voiceProxy.getConfig().activeProvider !== 'native_livekit') {
          setActiveVoiceRoom(livekit.getActiveRoom());
        }
      }
    });

    return () => {
      unsubscribeVoice();
      unsubscribeVoiceProxy();
    };
  }, []);

  // Auto-Idle Inactivity Detector (5 minutes idle timeout)
  useEffect(() => {
    let idleTimer: number;
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

    const resetIdleTimer = () => {
      const savedPref = localStorage.getItem('protutech_user_presence');
      if (savedPref === 'auto_idle') {
        localStorage.setItem('protutech_user_presence', 'online');
        matrix.setPresence('online');
      }

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        const currentPref = localStorage.getItem('protutech_user_presence');
        if (currentPref === 'online' || !currentPref) {
          localStorage.setItem('protutech_user_presence', 'auto_idle');
          matrix.setPresence('idle', 'Away from keyboard (Auto-Idle)');
        }
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      window.clearTimeout(idleTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
    };
  }, []);

  // Native Desktop Shortcuts Listener (Electron & Tauri via desktopBridge + Web fallback hotkey)
  useEffect(() => {
    const unsubMute = desktopBridge.onToggleMute(() => {
      if (voiceProxy.getSession().status === 'connected') {
        const next = !livekit.isMuted;
        livekit.isMuted = next;
        voiceProxy.setMute(next);
      } else {
        void livekit.setMute(!livekit.isMuted);
      }
    });

    const unsubDeafen = desktopBridge.onToggleDeafen(() => {
      if (voiceProxy.getSession().status === 'connected') {
        const next = !livekit.isDeafened;
        livekit.isDeafened = next;
        voiceProxy.setDeafen(next);
      } else {
        livekit.setDeafened(!livekit.isDeafened);
      }
    });

    const unsubVoice = desktopBridge.onJoinVoice((roomName: string) => {
      const userId = matrix.getUserId() || '@andrex:local.protutech';
      const profile = userProfileService.getProfile();
      const displayName =
        profile.displayName.trim() || userId.split(':')[0].replace('@', '');
      void livekit.joinVoice(roomName, userId, displayName);
      setActiveVoiceRoom(roomName);
    });

    const unsubOverlay = desktopBridge.onToggleOverlay(() => {
      overlayService.toggleEnabled();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (desktopBridge.isDesktopApp()) return;
      if (e.shiftKey && (e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        overlayService.toggleEnabled();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsubMute();
      unsubDeafen();
      unsubVoice();
      unsubOverlay();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleInjectedMessage = useCallback((msg: MatrixMessage) => {
    if (msg.roomId === activeRoomIdRef.current) {
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    }
  }, []);

  const handleEnterGuestMode = () => {
    sessionStorage.setItem('protutech_guest_mode', 'true');
    setIsGuestMode(true);
    const savedTempRooms = sessionStorage.getItem('protutech_temp_rooms');
    const tempRooms: MatrixRoom[] = savedTempRooms ? JSON.parse(savedTempRooms) : [];
    const allRooms = [...DEFAULT_GUEST_ROOMS, ...tempRooms];
    setRooms(allRooms);
    setGuilds([
      {
        ...DEFAULT_GUEST_GUILD,
        channels: allRooms,
      },
    ]);
    setActiveGuildId('guest_demo_server');
    setActiveRoomId('guest_welcome');
    setMessages(DEFAULT_GUEST_MESSAGES);
  };

  const handleExitGuestMode = () => {
    sessionStorage.removeItem('protutech_guest_mode');
    sessionStorage.removeItem('protutech_temp_rooms');
    void livekit.leaveVoice();
    setActiveVoiceRoom(null);
    setVoiceParticipants([]);
    setIsGuestMode(false);
    setRooms([]);
    setGuilds([]);
    setActiveRoomId(null);
    setMessages([]);
  };

  const handleCreateTempChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempChannelName.trim()) {
      setTempChannelError('Channel name is required.');
      return;
    }

    const cleanName =
      tempChannelType === 'text' && !tempChannelName.startsWith('#')
        ? `#${tempChannelName.trim().toLowerCase().replace(/\s+/g, '-')}`
        : tempChannelName.trim();

    const newRoom = buildTempRoom(
      cleanName,
      tempChannelType,
      activeGuildId || 'guest_demo_server'
    );

    const savedTempRooms = sessionStorage.getItem('protutech_temp_rooms');
    const existingTemps: MatrixRoom[] = savedTempRooms ? JSON.parse(savedTempRooms) : [];
    const updatedTemps = [...existingTemps, newRoom];
    sessionStorage.setItem('protutech_temp_rooms', JSON.stringify(updatedTemps));

    const updatedRooms = [...rooms, newRoom];
    setRooms(updatedRooms);

    setGuilds(prevGuilds =>
      prevGuilds.map(g =>
        g.id === (activeGuildId || 'guest_demo_server')
          ? { ...g, channels: [...g.channels, newRoom] }
          : g
      )
    );

    setActiveRoomId(newRoom.id);
    if (tempChannelType === 'voice') {
      void handleJoinVoice(newRoom);
    }

    setIsCreateTempChannelOpen(false);
    setTempChannelName('');
    setTempChannelError(null);
  };

  const loadData = useCallback(
    async (targetId?: string, overrideMode?: EngineMode) => {
      const effectiveMode = overrideMode || engineMode;

      if (isGuestMode) {
        const savedTempRooms = sessionStorage.getItem('protutech_temp_rooms');
        const tempRooms: MatrixRoom[] = savedTempRooms ? JSON.parse(savedTempRooms) : [];
        const allRooms = [...DEFAULT_GUEST_ROOMS, ...tempRooms];
        setRooms(allRooms);
        setGuilds([
          {
            ...DEFAULT_GUEST_GUILD,
            channels: allRooms,
          },
        ]);
        setActiveGuildId('guest_demo_server');
        if (targetId) {
          setActiveRoomId(targetId);
        } else if (!activeRoomIdRef.current) {
          setActiveRoomId('guest_welcome');
        }
        return;
      }

      // 1. Instant cache hydration before network finishes
      const cached = matrix.getCachedRooms();
      if (cached.rooms.length > 0 || cached.guilds.length > 0) {
        setRooms(prev => (prev.length === 0 ? cached.rooms : prev));
        setGuilds(prev => (prev.length === 0 ? cached.guilds : prev));
        if (!activeRoomIdRef.current && cached.rooms.length > 0) {
          const firstRoom = cached.rooms[0];
          setActiveRoomId(firstRoom.id);
          setMessages(matrix.getCachedMessages(firstRoom.id));
        }
      }

      // 2. Network sync
      const data = await matrix.loadInitialRooms();
      setRooms(data.rooms);
      setGuilds(data.guilds);

      if (targetId) {
        const foundGuild = data.guilds.find(g => g.id === targetId);
        if (foundGuild) {
          setActiveGuildId(foundGuild.id);
          if (foundGuild.channels.length > 0) {
            setActiveRoomId(foundGuild.channels[0].id);
          }
        } else {
          setActiveRoomId(targetId);
        }
      } else {
        const visibleGuilds =
          effectiveMode === 'proprietary'
            ? data.guilds.filter(isProprietaryGuild)
            : data.guilds;

        setActiveGuildId(prevGuildId => {
          if (prevGuildId && visibleGuilds.some(g => g.id === prevGuildId)) {
            return prevGuildId;
          }
          return visibleGuilds[0]?.id || null;
        });

        const currentActiveRoomValid =
          activeRoomIdRef.current &&
          data.rooms.some(r => r.id === activeRoomIdRef.current) &&
          (effectiveMode !== 'proprietary' ||
            (() => {
              const r = data.rooms.find(rm => rm.id === activeRoomIdRef.current);
              if (!r?.guildId) return true;
              const g = data.guilds.find(gd => gd.id === r.guildId);
              return g ? isProprietaryGuild(g) : true;
            })());

        if (!currentActiveRoomValid) {
          const firstVisibleChannel =
            visibleGuilds[0]?.channels.find(c => !c.isVoice && c.id !== 'livekit_lounge') ||
            visibleGuilds[0]?.channels[0] ||
            data.rooms[0];
          if (firstVisibleChannel) {
            setActiveRoomId(firstVisibleChannel.id);
          }
        }
      }
    },
    [isGuestMode, engineMode]
  );

  // Initialize rooms & real-time subscriptions once per auth session
  useEffect(() => {
    if (isGuestMode) {
      return;
    }

    if (!isAuthenticated) return;
    let disposed = false;

    const initSession = async () => {
      if (!disposed) {
        await loadData();
      }
    };
    void initSession();

    const unsubscribeMessages = matrix.onMessage((rId, incomingMsg) => {
      const vencordExt = vencord as unknown as {
        executeMessageReceiveHooks?: (m: MatrixMessage) => MatrixMessage;
      };
      const newMsg =
        typeof vencordExt.executeMessageReceiveHooks === 'function'
          ? vencordExt.executeMessageReceiveHooks(incomingMsg)
          : incomingMsg;

      if (rId === activeRoomIdRef.current) {
        setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      }

      const targetRoom = roomsRef.current.find(r => r.id === rId);
      const myUserId = matrix.getUserId();
      if (newMsg.sender !== myUserId) {
        void scriptEngine.processIncomingMessage(newMsg, targetRoom?.name, handleInjectedMessage);
      }

      const overlayCfg = overlayService.getConfig();
      if (overlayCfg.enabled && overlayCfg.showChatToasts && newMsg.sender !== myUserId) {
        overlayService.pushToast({
          id: newMsg.id,
          roomId: rId,
          roomName: targetRoom?.name || 'channel',
          senderName: newMsg.senderName,
          body: newMsg.body || (newMsg.mediaType ? `[${newMsg.mediaType} attachment]` : ''),
          source: newMsg.source || 'app',
          timestamp: newMsg.timestamp,
        });
      }
    });

    const unsubscribeEdits = matrix.onEdit((rId, eventId, newBody) => {
      if (rId === activeRoomIdRef.current) {
        setMessages(prev =>
          prev.map(m => (m.id === eventId ? { ...m, body: newBody, isEdited: true } : m))
        );
      }
    });

    const unsubscribeReactions = matrix.onReaction((rId, eventId, emoji, sender) => {
      if (rId === activeRoomIdRef.current) {
        setMessages(prev =>
          prev.map(m => {
            if (m.id !== eventId) return m;
            const currentReactions = m.reactions ? { ...m.reactions } : {};
            const existingUsers = currentReactions[emoji] || [];
            if (existingUsers.includes(sender)) return m;
            currentReactions[emoji] = [...existingUsers, sender];
            return { ...m, reactions: currentReactions };
          })
        );
      }
    });

    const unsubscribeRedactions = matrix.onRedaction((rId, eventId) => {
      if (rId !== activeRoomIdRef.current) return;
      const isLocallyDeleted = locallyDeletedIdsRef.current.has(eventId);
      if (isLocallyDeleted) {
        locallyDeletedIdsRef.current.delete(eventId);
        setMessages(prev => prev.filter(m => m.id !== eventId));
        return;
      }

      if (vencord.isPluginEnabled('messageLogger')) {
        setMessages(prev =>
          prev.map(m => (m.id === eventId ? { ...m, isDeleted: true } : m))
        );
      } else {
        setMessages(prev => prev.filter(m => m.id !== eventId));
      }
    });

    const unsubscribePresence = matrix.onPresence((uId, presence) => {
      setRooms(prevRooms =>
        prevRooms.map(r => ({
          ...r,
          members: r.members.map(m => (m.userId === uId ? { ...m, presence } : m)),
        }))
      );
    });

    const unsubscribeRoomsUpdated =
      typeof (matrix as unknown as { onRoomsUpdated?: (cb: (data: { rooms: MatrixRoom[]; guilds: DiscordGuild[] }) => void) => () => void }).onRoomsUpdated === 'function'
        ? (matrix as unknown as { onRoomsUpdated: (cb: (data: { rooms: MatrixRoom[]; guilds: DiscordGuild[] }) => void) => () => void }).onRoomsUpdated(
            data => {
              setRooms(data.rooms);
              setGuilds(data.guilds);
            }
          )
        : () => {};

    return () => {
      disposed = true;
      unsubscribeMessages();
      unsubscribeEdits();
      unsubscribeReactions();
      unsubscribeRedactions();
      unsubscribePresence();
      unsubscribeRoomsUpdated();
    };
  }, [isAuthenticated, isGuestMode, loadData, handleInjectedMessage]);

  // Refresh room messages from network when activeRoomId changes
  useEffect(() => {
    if (isGuestMode || !activeRoomId || !isAuthenticated) return;

    let cancelled = false;
    const fetchMsgs = async () => {
      const cachedMsgs = matrix.getCachedMessages(activeRoomId);
      if (cachedMsgs.length > 0 && !cancelled) {
        setMessages(cachedMsgs);
      }
      const list = await matrix.fetchMessages(activeRoomId);
      if (!cancelled) {
        setMessages(list);
      }
    };

    void fetchMsgs();
    return () => {
      cancelled = true;
    };
  }, [activeRoomId, isAuthenticated, isGuestMode]);

  const handleLogin = async (u: string, p: string) => {
    const success = await matrix.login(u, p);
    if (success) {
      setEngineMode(readInitialEngineMode());
      setIsAuthenticated(true);
      setIsGuestMode(false);
    }
    return success;
  };

  const handleLogout = () => {
    if (isGuestMode) {
      handleExitGuestMode();
      return;
    }
    void livekit.leaveVoice();
    matrix.logout();
    setActiveVoiceRoom(null);
    setVoiceParticipants([]);
    setIsAuthenticated(false);
    setIsSettingsOpen(false);
    setIsCameraPreviewOpen(false);
    setIsEquicordOpen(false);
    setIsDiscordHubOpen(false);
    setIsScriptsOpen(false);
    setIsLargeFileModalOpen(false);
    setIsSoundboardOpen(false);
    setIsAddModalOpen(false);
    setIsVoiceProxyOpen(false);
    setIsActivityModalOpen(false);
    setIsMinecraftConsoleOpen(false);
    setIsStoreModalOpen(false);
    setIsCoBrowseOpen(false);
    setRooms([]);
    setGuilds([]);
    setActiveRoomId(null);
    setMessages([]);
  };

  const handleToggleEngineMode = useCallback(() => {
    const nextMode: EngineMode = engineMode === 'proprietary' ? 'hybrid' : 'proprietary';
    setEngineMode(nextMode);
    try {
      localStorage.setItem('protutech_engine_mode', nextMode);
      const ext = matrix as unknown as MatrixModeBridge;
      ext.setEngineMode?.(nextMode);
    } catch {
      // Ignore storage errors
    }

    if (nextMode === 'proprietary') {
      const firstPropGuild = guilds.find(isProprietaryGuild);
      if (firstPropGuild) {
        setActiveGuildId(firstPropGuild.id);
        const firstChannel =
          firstPropGuild.channels.find(c => !c.isVoice && c.id !== 'livekit_lounge') ||
          firstPropGuild.channels[0];
        if (firstChannel) {
          setActiveRoomId(firstChannel.id);
          if (!isGuestMode && isAuthenticated) {
            setMessages(matrix.getCachedMessages(firstChannel.id));
          }
        }
      }
    }

    if (!isGuestMode && isAuthenticated) {
      void loadData(undefined, nextMode);
    }
  }, [engineMode, guilds, isGuestMode, isAuthenticated, loadData]);

  const handleSendMessage = useCallback(
    async (text: string, replyTo?: { id: string; sender: string; body: string }) => {
      const targetRoomId = activeRoomIdRef.current;
      if (!targetRoomId) return;
      const targetRoom = roomsRef.current.find(r => r.id === targetRoomId);

      if (isGuestMode) {
        const userMsg: MatrixMessage = {
          id: `guest_msg_${Date.now()}`,
          roomId: targetRoomId,
          sender: '@guest:local.protutech',
          senderName: userProfile.displayName.trim() || 'Guest Sampler (You)',
          avatarUrl: userProfile.avatarUrl.trim() || undefined,
          body: text,
          timestamp: Date.now(),
          replyTo,
          source: 'app',
        };
        setMessages(prev => [...prev, userMsg]);
        void scriptEngine.processIncomingMessage(userMsg, targetRoom?.name, handleInjectedMessage);

        if (!text.trim().startsWith('!mc ')) {
          setTimeout(() => {
            const pingTime = Math.floor(Math.random() * 8) + 8;
            const botReplies = [
              `Delivered in **${pingTime}ms**.`,
              `Echo (${pingTime}ms): "${text.slice(0, 32)}${
                text.length > 32 ? '...' : ''
              }"`,
            ];
            const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)];

            const botMsg: MatrixMessage = {
              id: `bot_msg_${Date.now()}`,
              roomId: targetRoomId,
              sender: '@protutech_bot:local.protutech',
              senderName: 'Protutech Bot',
              body: randomReply,
              timestamp: Date.now(),
              source: 'app',
            };
            if (activeRoomIdRef.current === targetRoomId) {
              setMessages(prev => [...prev, botMsg]);
            }
            const overlayCfg = overlayService.getConfig();
            if (overlayCfg.enabled && overlayCfg.showChatToasts) {
              overlayService.pushToast({
                id: botMsg.id,
                roomId: targetRoomId,
                roomName: targetRoom?.name || 'welcome-sandbox',
                senderName: botMsg.senderName,
                body: botMsg.body,
                source: 'app',
                timestamp: botMsg.timestamp,
              });
            }
          }, 250);
        }
        return;
      }

      const sent = replyTo
        ? await matrix.sendReplyMessage(targetRoomId, text, replyTo)
        : await matrix.sendMessage(targetRoomId, text);
      if (sent) {
        if (activeRoomIdRef.current === targetRoomId) {
          setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
        }
        void scriptEngine.processIncomingMessage(sent, targetRoom?.name, handleInjectedMessage);
      }
    },
    [isGuestMode, userProfile.displayName, userProfile.avatarUrl, handleInjectedMessage]
  );

  const handleMediaSent = useCallback((sent: MatrixMessage) => {
    if (sent.roomId === activeRoomIdRef.current) {
      setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
    }
  }, []);

  const handleSendMediaGuest = useCallback(
    async (roomId: string, file: File) => {
      const objectUrl = URL.createObjectURL(file);
      const mime = file.type.toLowerCase();
      const mediaType: MatrixMessage['mediaType'] = mime.startsWith('image/')
        ? 'image'
        : mime.startsWith('video/')
        ? 'video'
        : mime.startsWith('audio/')
        ? 'audio'
        : 'file';

      const guestMediaMsg: MatrixMessage = {
        id: `guest_media_${Date.now()}`,
        roomId,
        sender: '@guest:local.protutech',
        senderName: userProfile.displayName.trim() || 'Guest Sampler (You)',
        avatarUrl: userProfile.avatarUrl.trim() || undefined,
        body: file.name,
        timestamp: Date.now(),
        mediaUrl: objectUrl,
        mediaType,
        source: 'app',
      };
      if (roomId === activeRoomIdRef.current) {
        setMessages(prev => [...prev, guestMediaMsg]);
      }
    },
    [userProfile.displayName, userProfile.avatarUrl]
  );

  const handleEditMessage = useCallback(
    async (roomId: string, messageId: string, newText: string) => {
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, body: newText, isEdited: true } : m))
      );
      if (!isGuestMode) {
        await matrix.editMessage(roomId, messageId, newText);
      }
    },
    [isGuestMode]
  );

  const handleAddReaction = useCallback(
    async (roomId: string, messageId: string, emoji: string) => {
      const actor = isGuestMode
        ? '@guest:local.protutech'
        : matrix.getUserId() || '@andrex:local.protutech';

      setMessages(prev =>
        prev.map(m => {
          if (m.id !== messageId) return m;
          const nextReactions = m.reactions ? { ...m.reactions } : {};
          const existing = nextReactions[emoji] || [];
          if (existing.includes(actor)) {
            if (isGuestMode) {
              const filtered = existing.filter(u => u !== actor);
              if (filtered.length === 0) {
                delete nextReactions[emoji];
              } else {
                nextReactions[emoji] = filtered;
              }
            }
          } else {
            nextReactions[emoji] = [...existing, actor];
          }
          return { ...m, reactions: nextReactions };
        })
      );

      if (!isGuestMode) {
        await matrix.sendReaction(roomId, messageId, emoji);
      }
    },
    [isGuestMode]
  );

  const handleDeleteMessage = useCallback(
    async (roomId: string, messageId: string) => {
      locallyDeletedIdsRef.current.add(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      if (!isGuestMode) {
        await matrix.redactMessage(roomId, messageId);
      }
    },
    [isGuestMode]
  );

  const effectiveUserId = isGuestMode
    ? '@guest:local.protutech'
    : matrix.getUserId() || '@andrex:local.protutech';
  const effectiveDisplayName =
    userProfile.displayName.trim() ||
    (isGuestMode
      ? 'Guest Sampler'
      : matrix.getUserId()?.split(':')[0].replace('@', '') || 'andrex');

  // CRITICAL FIX: Always connect LiveKit Dual-Mode Engine across Guest, Proprietary, and Hybrid modes!
  const [editingChannel, setEditingChannel] = useState<MatrixRoom | null>(null);
  const [editingGuild, setEditingGuild] = useState<DiscordGuild | null>(null);
  const [pendingDiscordCallRoom, setPendingDiscordCallRoom] = useState<MatrixRoom | null>(null);
  const [isDiscordConnectOpen, setIsDiscordConnectOpen] = useState(false);

  // Auto-AFK idle timer: route idle voice users to the server's AFK / Sleep channel
  useEffect(() => {
    const currentGuild = guilds.find(g => g.id === activeGuildId);
    if (!activeVoiceRoom || !currentGuild?.afkChannelId || !currentGuild?.afkTimeoutSeconds) return;
    const timeoutMs = currentGuild.afkTimeoutSeconds * 1000;
    if (timeoutMs <= 0) return;
    const afkRoom = rooms.find(r => r.id === currentGuild.afkChannelId && r.isVoice);
    if (!afkRoom || afkRoom.name === activeVoiceRoom) return;

    let idleTimer: number;
    const resetIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        void handleJoinVoice(afkRoom);
      }, timeoutMs);
    };

    resetIdle();
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('mousedown', resetIdle);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('mousedown', resetIdle);
    };
  }, [activeVoiceRoom, activeGuildId, guilds, rooms]);

  const handleJoinVoice = async (room: MatrixRoom) => {
    if (
      room.userLimit &&
      room.userLimit > 0 &&
      activeVoiceRoom !== room.name &&
      voiceParticipants.length >= room.userLimit
    ) {
      window.alert(`Voice channel "${room.name}" is full (${room.userLimit}/${room.userLimit} members).`);
      return;
    }
    if (room.bitrate) {
      livekit.setChannelBitrate(room.bitrate);
    }
    await livekit.joinVoice(room.name, effectiveUserId, effectiveDisplayName);
    if (room.isAfkChannel) {
      await livekit.setMute(true);
    }
    setActiveVoiceRoom(livekit.getActiveRoom() || room.name);
    setVoiceParticipants(livekit.getParticipants());
  };

  const executeJoinDiscordCall = async (room: MatrixRoom) => {
    const ok = await voiceProxy.quickJoinDiscordChannel(room);
    if (ok) {
      setActiveVoiceRoom(
        livekit.getActiveRoom() || voiceProxy.getSession().targetName || room.name
      );
      if (livekit.isConnected()) {
        setVoiceParticipants(livekit.getParticipants());
      }
      return;
    }
    await handleJoinVoice(room);
  };

  const handleJoinDiscordCall = async (room: MatrixRoom) => {
    if (isDiscordLatencyWarningSuppressed()) {
      await executeJoinDiscordCall(room);
      return;
    }
    setPendingDiscordCallRoom(room);
  };

  const handleDisconnectVoice = async () => {
    if (voiceProxy.getSession().status === 'connected') {
      await voiceProxy.disconnect();
    }
    await livekit.leaveVoice();
    setActiveVoiceRoom(null);
    setVoiceParticipants([]);
    setIsVoiceStageExpanded(false);
    setIsVoiceStageCollapsed(false);
    if (isGuestMode && (activeRoomId === 'guest_voice_loopback' || activeRoomId === 'guest_video_test')) {
      setActiveRoomId('guest_welcome');
    }
  };

  const handleOpenAddModal = (tab: AddModalTab = 'server') => {
    if (isGuestMode) {
      setIsCreateTempChannelOpen(true);
      return;
    }
    setAddModalTab(tab);
    setIsAddModalOpen(true);
  };

  const handleOpenSyncLater = (room: MatrixRoom) => {
    if (isGuestMode) return;
    if (room.isGroupChat) {
      setAddModalTab('group');
    } else if (room.isDirect) {
      setAddModalTab('dm');
    } else {
      setAddModalTab('server');
    }
    setIsAddModalOpen(true);
  };

  const selectRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      if (!isGuestMode && isAuthenticated) {
        setMessages(matrix.getCachedMessages(roomId));
      }
    },
    [isGuestMode, isAuthenticated]
  );

  const handleSelectGuild = useCallback(
    (id: string | null) => {
      setActiveGuildId(id);
      if (id === null) {
        const firstDM = rooms.find(r => r.isDirect);
        if (firstDM) selectRoom(firstDM.id);
      } else {
        const guild = guilds.find(g => g.id === id);
        if (guild && guild.channels.length > 0) {
          const firstText =
            guild.channels.find(c => !c.isVoice && c.id !== 'livekit_lounge') ||
            guild.channels[0];
          selectRoom(firstText.id);
        }
      }
    },
    [rooms, guilds, selectRoom]
  );

  const handleToggleLayoutFormat = useCallback((nextFormat?: 'discord' | 'teamspeak') => {
    const current = vencord.getTheme();
    const target: 'discord' | 'teamspeak' =
      nextFormat || (current.layoutFormat === 'teamspeak' ? 'discord' : 'teamspeak');
    vencord.setTheme({
      ...current,
      layoutFormat: target,
    });
  }, []);

  const openSettingsTab = (tab: SettingsTab = 'themes') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const openDiscordHub = (tab: DiscordHubTab = 'quests') => {
    setDiscordHubTab(tab);
    setIsDiscordHubOpen(true);
  };

  const zoomHudPill = showZoomHud ? (
    <div
      data-testid="zoom-hud-pill"
      className="fixed top-9 right-4 z-[60] bg-[var(--bg-popout)]/95 border border-[var(--border-subtle)] shadow-xl rounded-full px-2.5 py-1 flex items-center gap-1.5 text-xs text-[var(--text-header)]"
    >
      <button
        type="button"
        onClick={() => zoomService.zoomOut()}
        aria-label="Zoom Out"
        className="w-5 h-5 rounded-full hover:bg-[var(--bg-item-hover)] flex items-center justify-center font-bold cursor-pointer"
        title="Zoom Out"
      >
        -
      </button>
      <span className="font-mono font-bold px-1 min-w-[42px] text-center">{zoomLevel}%</span>
      <button
        type="button"
        onClick={() => zoomService.zoomIn()}
        aria-label="Zoom In"
        className="w-5 h-5 rounded-full hover:bg-[var(--bg-item-hover)] flex items-center justify-center font-bold cursor-pointer"
        title="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => zoomService.resetZoom()}
        className="ml-0.5 px-2 py-0.5 rounded-full bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-[11px] font-semibold cursor-pointer"
      >
        Reset
      </button>
    </div>
  ) : null;

  const cameraPreviewModal = (
    <WebcamBackgroundModal
      isOpen={isCameraPreviewOpen}
      onClose={() => setIsCameraPreviewOpen(false)}
      onTurnOnCamera={
        activeVoiceRoom
          ? async () => {
              await livekit.setCamera(true);
            }
          : undefined
      }
    />
  );

  if (!isAuthenticated && !isGuestMode) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--bg-frame)] relative">
        <TitleBar
          engineMode={engineMode}
          onToggleEngineMode={handleToggleEngineMode}
          onToggleOverlay={() => overlayService.toggleEnabled()}
          onOpenMicrosoftStore={() => setIsStoreModalOpen(true)}
          onOpenCameraPreview={() => setIsCameraPreviewOpen(true)}
          layoutFormat={layoutFormat}
          onToggleLayoutFormat={handleToggleLayoutFormat}
          zoomLevel={zoomLevel}
          onZoomIn={() => zoomService.zoomIn()}
          onZoomOut={() => zoomService.zoomOut()}
          onZoomReset={() => zoomService.resetZoom()}
        />
        {zoomHudPill}
        <div className="flex-1 min-h-0 overflow-auto">
          <LoginModal
            onLogin={handleLogin}
            onSampleGuest={handleEnterGuestMode}
            onModeChange={nextMode => setEngineMode(nextMode)}
            onOpenDiscordConnect={() => setIsDiscordConnectOpen(true)}
          />
        </div>
        <MicrosoftStoreModal
          isOpen={isStoreModalOpen}
          onClose={() => setIsStoreModalOpen(false)}
        />
        {cameraPreviewModal}
      </div>
    );
  }

  const activeGuild = activeGuildId ? guilds.find(g => g.id === activeGuildId) || null : null;
  const currentRoom =
    rooms.find(r => r.id === activeRoomId) ||
    rooms[0] || {
      id: 'placeholder',
      name: 'general',
      isDirect: false,
      isGroupChat: false,
      members: [],
    };

  const isCurrentRoomVoice = activeVoiceRoom !== null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--bg-servers)] relative">
      <TitleBar
        engineMode={engineMode}
        onToggleEngineMode={handleToggleEngineMode}
        onOpenDiscordHub={() => openDiscordHub('quests')}
        onOpenEquicord={() => setIsEquicordOpen(true)}
        onOpenScripts={() => setIsScriptsOpen(true)}
        onOpenCoBrowse={() => setIsCoBrowseOpen(prev => !prev)}
        isCoBrowsing={isCoBrowseOpen}
        onToggleOverlay={() => overlayService.toggleEnabled()}
        onOpenMicrosoftStore={() => setIsStoreModalOpen(true)}
        onOpenCameraPreview={() => setIsCameraPreviewOpen(true)}
        layoutFormat={layoutFormat}
        onToggleLayoutFormat={handleToggleLayoutFormat}
        zoomLevel={zoomLevel}
        onZoomIn={() => zoomService.zoomIn()}
        onZoomOut={() => zoomService.zoomOut()}
        onZoomReset={() => zoomService.resetZoom()}
        onOpenSoundboard={() => setIsSoundboardOpen(prev => !prev)}
        onOpenMinecraftConsole={() => setIsMinecraftConsoleOpen(true)}
        onOpenLargeFileShare={() => setIsLargeFileModalOpen(true)}
      />

      {/* Sandbox Mode Banner */}
      {isGuestMode && (
        <div className="bg-[var(--bg-channels)] border-b border-[var(--border-subtle)] px-4 py-1.5 flex items-center justify-between text-xs text-[var(--text-normal)] z-20 flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-pulse" />
            <span className="font-semibold text-[var(--text-header)]">Sandbox Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTempChannelName('');
                setTempChannelError(null);
                setIsCreateTempChannelOpen(true);
              }}
              className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-semibold px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Channel</span>
            </button>
            <button
              type="button"
              onClick={handleExitGuestMode}
              className="bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] hover:text-[var(--text-header)] px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer border border-[var(--border-subtle)]"
            >
              <span>Sign In</span>
            </button>
          </div>
        </div>
      )}

      {/* Workspace Body: TeamSpeak Classic Tree Format OR Standard 4-Column Layout */}
      {layoutFormat === 'teamspeak' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--bg-chat)]">
          <TeamSpeakLayout
            guilds={guilds}
            activeGuildId={activeGuildId}
            rooms={rooms}
            activeRoomId={activeRoomId}
            currentRoom={currentRoom}
            messages={messages}
            voiceParticipants={voiceParticipants}
            activeVoiceRoom={activeVoiceRoom}
            rtcPing={rtcPing}
            effectiveUserId={effectiveUserId}
            effectiveDisplayName={effectiveDisplayName}
            isGuestMode={isGuestMode}
            isCoBrowseOpen={isCoBrowseOpen}
            coBrowseInitialQuery={coBrowseInitialQuery}
            zoomLevel={zoomLevel}
            onSelectGuild={handleSelectGuild}
            onSelectRoom={selectRoom}
            onJoinVoice={handleJoinVoice}
            onJoinDiscordCall={handleJoinDiscordCall}
            onDisconnectVoice={handleDisconnectVoice}
            onSendMessage={handleSendMessage}
            onMediaSent={handleMediaSent}
            onSendMediaGuest={handleSendMediaGuest}
            onEditMessage={handleEditMessage}
            onAddReaction={handleAddReaction}
            onDeleteMessage={handleDeleteMessage}
            onMessageInjected={handleInjectedMessage}
            onSelectUser={user => setSelectedProfileUser(user)}
            onOpenSettings={tab => openSettingsTab(tab || 'themes')}
            onOpenSoundboard={() => setIsSoundboardOpen(prev => !prev)}
            onOpenCameraPreview={() => setIsCameraPreviewOpen(true)}
            onToggleCoBrowse={() => setIsCoBrowseOpen(prev => !prev)}
            onCloseCoBrowse={() => {
              setIsCoBrowseOpen(false);
              setCoBrowseInitialQuery(undefined);
            }}
            onOpenLargeFileShare={() => setIsLargeFileModalOpen(true)}
            onOpenScripts={() => setIsScriptsOpen(true)}
            onOpenDiscordHub={() => openDiscordHub('quests')}
            onOpenEquicord={() => setIsEquicordOpen(true)}
            onOpenAddModal={() => handleOpenAddModal('server')}
            onSwitchToDiscordLayout={() => handleToggleLayoutFormat('discord')}
            onZoomIn={() => zoomService.zoomIn()}
            onZoomOut={() => zoomService.zoomOut()}
            onZoomReset={() => zoomService.resetZoom()}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 w-full flex overflow-hidden bg-[var(--bg-channels)]">
          {/* 1. Left Server Rail */}
          <ServerRail
            guilds={guilds}
            activeGuildId={activeGuildId}
            engineMode={engineMode}
            onSelectGuild={handleSelectGuild}
            onOpenAddModal={() => handleOpenAddModal('server')}
            onOpenDiscordHub={tab => openDiscordHub(tab || 'quests')}
            onOpenEquicord={() => setIsEquicordOpen(true)}
          />

          {/* 2. Channel & DM Sidebar */}
          <div className="flex flex-col h-full min-h-0 flex-shrink-0">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ChannelSidebar
                activeGuild={activeGuild}
                rooms={rooms}
                activeRoomId={activeRoomId}
                onSelectRoom={selectRoom}
                onJoinVoice={handleJoinVoice}
                onJoinDiscordCall={handleJoinDiscordCall}
                activeVoiceRoomId={activeVoiceRoom}
                onOpenAddModal={handleOpenAddModal}
                onOpenVoiceProxy={() => setIsVoiceProxyOpen(true)}
                voiceParticipants={voiceParticipants}
                onOpenDiscordHub={tab => openDiscordHub(tab || 'quests')}
                onOpenEquicord={() => setIsEquicordOpen(true)}
                onOpenScripts={() => setIsScriptsOpen(true)}
                onEditChannel={ch => setEditingChannel(ch)}
                onOpenServerSettings={g => setEditingGuild(g)}
                onOpenDiscordConnect={() => setIsDiscordConnectOpen(true)}
              />
            </div>

            {/* Bottom Voice Panel (if connected) */}
            {activeVoiceRoom && (
              <VoicePanel
                roomName={activeVoiceRoom}
                rtcPing={rtcPing}
                onDisconnect={handleDisconnectVoice}
                onOpenCoBrowse={() => setIsCoBrowseOpen(prev => !prev)}
                isCoBrowsing={isCoBrowseOpen}
                onOpenSoundboard={() => setIsSoundboardOpen(prev => !prev)}
                isSoundboardOpen={isSoundboardOpen}
                onOpenCameraPreview={() => setIsCameraPreviewOpen(true)}
              />
            )}

            {/* Bottom User Controls Bar */}
            <UserBar
              userId={effectiveUserId}
              displayName={effectiveDisplayName}
              avatarUrl={userProfile.avatarUrl.trim() || undefined}
              onOpenSettings={() => openSettingsTab('themes')}
              onOpenProfile={() => openSettingsTab('profile')}
              onToggleOverlay={() => overlayService.toggleEnabled()}
              onOpenMinecraftConsole={() => setIsMinecraftConsoleOpen(true)}
              onOpenSoundboard={() => setIsSoundboardOpen(prev => !prev)}
              isSoundboardOpen={isSoundboardOpen}
              onOpenCameraPreview={() => setIsCameraPreviewOpen(true)}
            />
          </div>

          {/* 3. Main Chat, Voice, & Co-Browse Stage Area */}
          <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden rounded-tl-xl border-t border-l border-[var(--border-subtle)] bg-[var(--bg-chat)]">
            {(isCoBrowseOpen || isCurrentRoomVoice || activeActivity) && (
              <div
                className={`flex-shrink-0 flex flex-col ${
                  isVoiceStageExpanded
                    ? 'max-h-[82%] overflow-y-auto'
                    : isCoBrowseOpen || activeActivity
                    ? 'max-h-[70%] overflow-y-auto'
                    : 'overflow-visible'
                }`}
              >
                {/* Synchronized Co-Browser & Built-In Search Engine */}
                {isCoBrowseOpen && (
                  <SharedBrowserStage
                    isOpen={isCoBrowseOpen}
                    roomName={activeVoiceRoom || currentRoom.name}
                    roomId={currentRoom.id}
                    initialQueryOrUrl={coBrowseInitialQuery}
                    onClose={() => {
                      setIsCoBrowseOpen(false);
                      setCoBrowseInitialQuery(undefined);
                    }}
                    onShareToChat={text => void handleSendMessage(text)}
                  />
                )}

                {/* LiveKit Dual-Mode Voice / Video / Screen Share Stage */}
                {isCurrentRoomVoice && (
                  <VoiceStage
                    participants={voiceParticipants}
                    roomName={activeVoiceRoom || 'Voice Channel'}
                    onToggleCoBrowse={() => setIsCoBrowseOpen(prev => !prev)}
                    isCoBrowsing={isCoBrowseOpen}
                    onOpenSoundboard={() => setIsSoundboardOpen(prev => !prev)}
                    onOpenCameraPreview={() => setIsCameraPreviewOpen(true)}
                    onDisconnect={handleDisconnectVoice}
                    isExpanded={isVoiceStageExpanded}
                    onToggleExpand={() => setIsVoiceStageExpanded(prev => !prev)}
                    isCollapsed={isVoiceStageCollapsed}
                    onToggleCollapse={() => setIsVoiceStageCollapsed(prev => !prev)}
                  />
                )}

                {/* Embedded Synchronized Activity Stage (Mini-Games, YouTube, Web Browser) */}
                {activeActivity && (
                  <EmbeddedActivityStage
                    activity={activeActivity}
                    onClose={() => setActiveActivity(null)}
                  />
                )}
              </div>
            )}

            {/* Chat Area */}
            <ChatArea
              onEditChannel={ch => setEditingChannel(ch)}
              room={currentRoom}
              messages={messages}
              onSendMessage={handleSendMessage}
              onMediaSent={handleMediaSent}
              onSendMediaGuest={handleSendMediaGuest}
              onEditMessage={handleEditMessage}
              onAddReaction={handleAddReaction}
              onDeleteMessage={handleDeleteMessage}
              onJoinVoice={handleJoinVoice}
              isVoiceActive={isCurrentRoomVoice}
              onToggleMemberList={() => setShowMemberList(!showMemberList)}
              showMemberList={showMemberList}
              onOpenSyncLater={handleOpenSyncLater}
              onOpenActivity={() => setIsActivityModalOpen(true)}
              onOpenLargeFileShare={() => setIsLargeFileModalOpen(true)}
              onOpenCoBrowse={() => setIsCoBrowseOpen(prev => !prev)}
              onOpenScripts={() => setIsScriptsOpen(true)}
              onMessageInjected={handleInjectedMessage}
              currentUserId={effectiveUserId}
              currentUserName={effectiveDisplayName}
              isGuestMode={isGuestMode}
            />
          </div>

          {/* 4. Right Member Sidebar */}
          {showMemberList && (
            <MemberList
              members={currentRoom.members}
              onSelectUser={user => setSelectedProfileUser(user)}
            />
          )}
        </div>
      )}

      {/* Soundboard Popover */}
      <SoundboardPopover
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        senderName={effectiveDisplayName}
      />

      {/* Camera Preview & Virtual Backgrounds Modal */}
      {cameraPreviewModal}

      {/* Transient 2-Second Zoom HUD Pill */}
      {zoomHudPill}

      {/* Non-intrusive Bottom-Right Soundboard Play Toasts */}
      {soundboardToasts.length > 0 && (
        <div
          data-testid="soundboard-play-toasts"
          className={`fixed right-4 z-40 flex flex-col gap-1.5 pointer-events-none ${
            updateAvailable ? 'bottom-20' : 'bottom-4'
          }`}
        >
          {soundboardToasts.map(toast => {
            const isSelf =
              toast.senderName === effectiveDisplayName || toast.senderName === 'You';
            return (
              <div
                key={toast.id}
                className="px-3.5 py-2 rounded-lg bg-[var(--bg-popout)]/95 border border-[var(--border-accent)] shadow-xl text-xs text-[var(--text-header)] flex items-center gap-2 animate-fadeIn"
              >
                <span className="text-base leading-none">{toast.emoji}</span>
                <span>
                  <strong className="font-semibold text-[var(--text-header)]">
                    {isSelf ? 'You' : toast.senderName}
                  </strong>{' '}
                  played <span className="font-semibold text-[var(--text-link)]">{toast.name}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        user={selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        onSendGameInvite={inviteMsg => void handleSendMessage(inviteMsg)}
        isOwnProfile={selectedProfileUser?.userId === effectiveUserId}
        onOpenProfileCustomization={() => {
          setSelectedProfileUser(null);
          openSettingsTab('profile');
        }}
      />

      {/* Minecraft RCON Console & Logs Modal */}
      <MinecraftConsoleModal
        isOpen={isMinecraftConsoleOpen}
        onClose={() => setIsMinecraftConsoleOpen(false)}
      />

      {/* Mini-Games & Shared Web Activity Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        room={currentRoom}
        onClose={() => setIsActivityModalOpen(false)}
        onLaunchActivity={activity => {
          setActiveActivity(activity);
          setIsActivityModalOpen(false);
        }}
        onOpenCoBrowse={initialQuery => {
          setCoBrowseInitialQuery(initialQuery);
          setIsCoBrowseOpen(true);
        }}
      />

      {/* Settings & Customization Modal */}
      <QuickSwitcherModal
        isOpen={isQuickSwitcherOpen}
        onClose={() => setIsQuickSwitcherOpen(false)}
        guilds={guilds}
        rooms={rooms}
        onSelectGuild={guildId => setActiveGuildId(guildId)}
        onSelectRoom={roomId => setActiveRoomId(roomId)}
        onJoinVoice={room => void handleJoinVoice(room)}
      />

      <SettingsModal
        key={isSettingsOpen ? `open-${settingsInitialTab}` : 'closed'}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={effectiveUserId}
        onLogout={handleLogout}
        initialTab={settingsInitialTab}
        onOpenMicrosoftStore={() => setIsStoreModalOpen(true)}
        onOpenDiscordHub={tab => {
          setIsSettingsOpen(false);
          openDiscordHub(tab || 'quests');
        }}
        onOpenEquicord={() => {
          setIsSettingsOpen(false);
          setIsEquicordOpen(true);
        }}
        onOpenSoundboard={() => {
          setIsSettingsOpen(false);
          setIsSoundboardOpen(true);
        }}
        onOpenDiscordConnect={() => {
          setIsSettingsOpen(false);
          setIsDiscordConnectOpen(true);
        }}
      />

      {/* Discord Hub Modal (Quests, Friends, Nitro, Inbox, Discover) */}
      <DiscordHubModal
        isOpen={isDiscordHubOpen}
        onClose={() => setIsDiscordHubOpen(false)}
        initialTab={discordHubTab}
        onSelectChannelByName={channelName => {
          const target = rooms.find(
            r => r.name.toLowerCase() === channelName.toLowerCase() || r.id === channelName
          );
          if (target) {
            if (target.guildId) setActiveGuildId(target.guildId);
            selectRoom(target.id);
          }
          setIsDiscordHubOpen(false);
        }}
        onStartVoiceCall={targetName => {
          void livekit.joinVoice(targetName, effectiveUserId, effectiveDisplayName);
          setActiveVoiceRoom(livekit.getActiveRoom() || targetName);
          setVoiceParticipants(livekit.getParticipants());
          setIsDiscordHubOpen(false);
        }}
        onOpenDiscordConnect={() => {
          setIsDiscordHubOpen(false);
          setIsDiscordConnectOpen(true);
        }}
      />

      {/* Equicord Plugins & Custom Mod Manager Modal */}
      <EquicordModal
        isOpen={isEquicordOpen}
        onClose={() => setIsEquicordOpen(false)}
      />

      {/* Scripts, Webhooks & Minecraft Chat Bridge API Modal */}
      <ScriptingModal
        isOpen={isScriptsOpen}
        onClose={() => setIsScriptsOpen(false)}
        activeRoomId={currentRoom.id !== 'placeholder' ? currentRoom.id : activeRoomId}
        activeRoomName={currentRoom.name}
        onMessageInjected={handleInjectedMessage}
      />

      {/* Zero-Size-Cap Large File Transfer Modal */}
      <LargeFileShareModal
        isOpen={isLargeFileModalOpen}
        onClose={() => setIsLargeFileModalOpen(false)}
        activeRoomId={currentRoom.id !== 'placeholder' ? currentRoom.id : activeRoomId || 'general'}
        senderId={effectiveUserId}
        senderName={effectiveDisplayName}
        onShareComplete={handleInjectedMessage}
      />

      {/* Voice Gateway & Call Proxy Modal (Discord / Stoat) */}
      <VoiceProxyModal
        isOpen={isVoiceProxyOpen}
        onClose={() => setIsVoiceProxyOpen(false)}
        availableChannels={rooms.map(r => ({
          id: r.discordChannelId || r.id,
          name: r.name,
          type: r.isVoice ? 'voice' : 'text',
          guildId: r.discordGuildId || r.guildId,
        }))}
      />

      {/* Microsoft Store Install & Publishing Hub Modal */}
      <MicrosoftStoreModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
      />

      {/* Add / Sync Conversation Modal */}
      {editingChannel && (
        <ChannelSettingsModal
          channel={editingChannel}
          onClose={() => setEditingChannel(null)}
          onSave={async (roomId, updates) => {
            const updated = await matrix.updateRoomSettings(roomId, updates);
            if (updated) {
              setRooms(prev => prev.map(r => (r.id === roomId ? updated : r)));
              setGuilds(prev =>
                prev.map(g => ({
                  ...g,
                  channels: g.channels.map(c => (c.id === roomId ? updated : c)),
                }))
              );
            }
          }}
          onDelete={async roomId => {
            const ok = await matrix.deleteRoom(roomId);
            if (ok) {
              setRooms(prev => prev.filter(r => r.id !== roomId));
              setGuilds(prev =>
                prev.map(g => ({
                  ...g,
                  channels: g.channels.filter(c => c.id !== roomId),
                }))
              );
              if (activeRoomId === roomId) setActiveRoomId(null);
            }
          }}
        />
      )}

      {editingGuild && (
        <ServerSettingsModal
          guild={editingGuild}
          onClose={() => setEditingGuild(null)}
          onSave={async (guildId, updates) => {
            const updated = await matrix.updateGuildSettings(guildId, updates);
            if (updated) {
              setGuilds(prev => prev.map(g => (g.id === guildId ? { ...g, ...updated } : g)));
            }
          }}
        />
      )}

      <AddConversationModal
        isOpen={isAddModalOpen}
        initialTab={addModalTab}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={targetId => {
          void loadData(targetId);
        }}
      />

      {pendingDiscordCallRoom && (
        <DiscordCallWarningModal
          room={pendingDiscordCallRoom}
          onConfirm={() => {
            const target = pendingDiscordCallRoom;
            setPendingDiscordCallRoom(null);
            void executeJoinDiscordCall(target);
          }}
          onCancel={() => setPendingDiscordCallRoom(null)}
        />
      )}

      <DiscordConnectModal
        isOpen={isDiscordConnectOpen}
        onClose={() => setIsDiscordConnectOpen(false)}
        onConnected={() => {
          void loadData();
        }}
      />

      {/* Optional In-Game Overlay HUD */}
      <InGameOverlay
        participants={voiceParticipants}
        activeVoiceRoom={activeVoiceRoom}
        rtcPing={rtcPing}
        onToggleMute={() => {
          if (voiceProxy.getSession().status === 'connected') {
            const next = !livekit.isMuted;
            livekit.isMuted = next;
            voiceProxy.setMute(next);
          } else {
            void livekit.setMute(!livekit.isMuted);
          }
        }}
        onToggleDeafen={() => {
          if (voiceProxy.getSession().status === 'connected') {
            const next = !livekit.isDeafened;
            livekit.isDeafened = next;
            voiceProxy.setDeafen(next);
          } else {
            livekit.setDeafened(!livekit.isDeafened);
          }
        }}
        onDisconnectVoice={handleDisconnectVoice}
        onQuickReply={async (roomId, text) => {
          if (isGuestMode) {
            const qrMsg: MatrixMessage = {
              id: `guest_qr_${Date.now()}`,
              roomId,
              sender: '@guest:local.protutech',
              senderName: effectiveDisplayName,
              avatarUrl: userProfile.avatarUrl.trim() || undefined,
              body: text,
              timestamp: Date.now(),
              source: 'app',
            };
            if (roomId === activeRoomIdRef.current) {
              setMessages(prev => [...prev, qrMsg]);
            }
            return;
          }
          const sent = await matrix.sendMessage(roomId, text);
          if (sent && roomId === activeRoomIdRef.current) {
            setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
          }
        }}
      />

      {/* Create Temporary Channel Modal */}
      {isCreateTempChannelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="temp-channel-modal-title"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsCreateTempChannelOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="w-full max-w-md max-h-full overflow-y-auto bg-[var(--bg-card)] rounded-xl shadow-2xl p-6 border border-[var(--border-subtle)] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--accent-cyan)]" />
                <h3
                  id="temp-channel-modal-title"
                  className="font-bold text-[var(--text-header)] text-base"
                >
                  New Channel
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setIsCreateTempChannelOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer p-1 rounded-lg hover:bg-[var(--bg-item-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTempChannel} className="space-y-4 mt-4">
              <div>
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                  Channel Type
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={tempChannelType === 'text'}
                    onClick={() => setTempChannelType('text')}
                    className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all text-xs font-semibold cursor-pointer ${
                      tempChannelType === 'text'
                        ? 'bg-[var(--bg-item-active)] border-[var(--border-accent)] text-[var(--text-header)] shadow-md'
                        : 'bg-[var(--bg-channels)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                    }`}
                  >
                    <Hash className="w-4 h-4 text-[var(--accent-cyan)]" />
                    <div className="text-left">
                      <div className="text-[var(--text-header)] font-bold">Text</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Sandbox chat</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={tempChannelType === 'voice'}
                    onClick={() => setTempChannelType('voice')}
                    className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all text-xs font-semibold cursor-pointer ${
                      tempChannelType === 'voice'
                        ? 'bg-[var(--bg-item-active)] border-[var(--border-accent)] text-[var(--text-header)] shadow-md'
                        : 'bg-[var(--bg-channels)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)]'
                    }`}
                  >
                    <Volume2 className="w-4 h-4 text-[var(--status-online)]" />
                    <div className="text-left">
                      <div className="text-[var(--text-header)] font-bold">Voice</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Mic, video &amp; share</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="temp-channel-name-input"
                  className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5"
                >
                  Channel Name
                </label>
                <div className="relative">
                  <input
                    id="temp-channel-name-input"
                    type="text"
                    value={tempChannelName}
                    onChange={e => setTempChannelName(e.target.value)}
                    placeholder={tempChannelType === 'text' ? 'e.g. testing-lounge' : 'e.g. squad-voice'}
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-cyan)] transition-colors"
                    autoFocus
                  />
                </div>
                {tempChannelError && (
                  <p className="text-xs text-[var(--status-dnd)] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{tempChannelError}</span>
                  </p>
                )}
              </div>

              <div className="p-2.5 rounded-md bg-[var(--status-idle)]/10 border border-[var(--status-idle)]/25 text-[var(--text-normal)] text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--status-idle)] flex-shrink-0" />
                <span>Stored in memory for this tab session only.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateTempChannelOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-md text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-md bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white transition-colors cursor-pointer shadow-md"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real-time live auto-update toast banner */}
      {updateAvailable && (
        <div className="fixed bottom-5 right-5 z-[999999] bg-[var(--bg-popout)] border border-[var(--border-accent)] shadow-2xl rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] animate-ping" />
          <div className="text-xs text-[var(--text-normal)]">
            <span className="font-bold text-[var(--text-link)] block">
              Update Ready ({newVersion || 'latest'})
            </span>
            <span>Restart application to apply update.</span>
          </div>
          <button
            type="button"
            onClick={restartAndApplyUpdate}
            className="ml-2 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Restart to Update</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
