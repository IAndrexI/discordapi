import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Trophy,
  Users,
  Gem,
  Inbox,
  Compass,
  Zap,
  CheckCircle2,
  Gift,
  MessageSquare,
  PhoneCall,
  UserPlus,
  Check,
  Search,
  Sparkles,
  Crown,
  Radio,
  ArrowUpRight,
  BellOff,
  Server,
} from 'lucide-react';
import {
  userProfileService,
  AVATAR_DECORATIONS,
  type AvatarDecorationId,
  type UserProfileCustomizations,
} from '../services/userProfile';
import { discordSettingsSync, type SyncedDiscordSettings } from '../services/discordSettingsSync';
import { vencord } from '../services/vencord';
import { matrix } from '../services/matrix';
import { livekit } from '../services/livekit';

export type DiscordHubTab = 'quests' | 'friends' | 'nitro' | 'inbox' | 'discover';

export interface DiscordHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: DiscordHubTab;
  onSelectChannelByName?: (name: string) => void;
  onJumpToChannel?: (name: string) => void;
  onApplyReward?: (reward: { type: string; value: string; label: string }) => void;
  onStartVoiceCall?: (targetName: string) => void;
}

interface DiscordQuestItem {
  id: string;
  title: string;
  game: string;
  category: 'stream' | 'play' | 'orbs' | 'decoration';
  description: string;
  progress: number;
  accepted: boolean;
  claimed: boolean;
  rewardLabel: string;
  rewardDecoration: AvatarDecorationId;
  rewardBadge: string;
}

interface FriendItem {
  id: string;
  username: string;
  displayName: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  activity?: string;
  relation: 'friend' | 'pending_in' | 'pending_out';
  channelTarget: string;
  voiceChannel?: string;
  avatarColor: string;
}

interface InboxEntry {
  id: string;
  title: string;
  sender: string;
  channelName: string;
  body: string;
  kind: 'mention' | 'discord' | 'system';
  timestamp: number;
  read: boolean;
}

interface DiscoverGuildItem {
  id: string;
  name: string;
  category: 'Gaming' | 'Tech & Dev' | 'Community' | 'Self-Hosted';
  description: string;
  memberCount: number;
  onlineCount: number;
  defaultChannel: string;
  isBridged: boolean;
  joined: boolean;
  accent: string;
}

const QUESTS_STORAGE_KEY = 'protutech_discord_quests_v1';
const FRIENDS_STORAGE_KEY = 'protutech_discord_friends_v1';
const INBOX_STORAGE_KEY = 'protutech_discord_inbox_v1';
const DISCOVER_JOINED_KEY = 'protutech_joined_discover_v1';

const DEFAULT_QUESTS: DiscordQuestItem[] = [
  {
    id: 'quest_cyber_stream',
    title: 'Protutech Launch Stream Quest',
    game: 'LiveKit 1080p60',
    category: 'stream',
    description: 'Stream gameplay or Co-Browse screen share for 15 minutes in any voice channel.',
    progress: 25,
    accepted: true,
    claimed: false,
    rewardLabel: 'Cyber Ring Decoration + Quest Pioneer Badge',
    rewardDecoration: 'cyber_ring',
    rewardBadge: 'Quest Pioneer',
  },
  {
    id: 'quest_mc_coop',
    title: 'Minecraft SMP Co-Op Adventure',
    game: 'Minecraft Java Edition',
    category: 'play',
    description: 'Play or bridge live Minecraft chat events into Protutech HQ for 30 minutes.',
    progress: 0,
    accepted: false,
    claimed: false,
    rewardLabel: 'Plasma Aura Frame + 250 Orbs',
    rewardDecoration: 'plasma_aura',
    rewardBadge: 'Minecraft Explorer',
  },
  {
    id: 'quest_cobrowse_orbs',
    title: 'Co-Browse Watch Together Orbs',
    game: 'Shared Browser Stage',
    category: 'orbs',
    description: 'Search and watch a synchronized video together inside a call room.',
    progress: 50,
    accepted: true,
    claimed: false,
    rewardLabel: 'Neon Pulse Ring + 500 Discord Orbs',
    rewardDecoration: 'neon_pulse',
    rewardBadge: 'Watch Party Host',
  },
  {
    id: 'quest_voice_crown',
    title: 'Ultra-Low Latency Voice Champion',
    game: 'Studio 48kHz Voice',
    category: 'decoration',
    description: 'Join a voice lounge with Opus 48kHz Studio Audio enabled.',
    progress: 75,
    accepted: true,
    claimed: false,
    rewardLabel: 'Discord Crown Avatar Decoration',
    rewardDecoration: 'discord_crown',
    rewardBadge: 'Crown Earner',
  },
];

const DEFAULT_FRIENDS: FriendItem[] = [
  {
    id: 'fr_nova',
    username: 'nova_dev',
    displayName: 'Nova',
    status: 'online',
    activity: 'Playing Minecraft 1.21 • Protutech SMP',
    relation: 'friend',
    channelTarget: 'general',
    voiceChannel: 'Gaming Lounge',
    avatarColor: '#06b6d4',
  },
  {
    id: 'fr_kaelen',
    username: 'kaelen_gg',
    displayName: 'Kaelen',
    status: 'online',
    activity: 'Streaming Elden Ring (1080p60)',
    relation: 'friend',
    channelTarget: 'discord-lounge',
    voiceChannel: 'Discord Voice Bridge',
    avatarColor: '#8b5cf6',
  },
  {
    id: 'fr_mira',
    username: 'mira_audio',
    displayName: 'Mira',
    status: 'idle',
    activity: 'Listening to Spotify • Midnight City',
    relation: 'friend',
    channelTarget: 'general',
    avatarColor: '#ec4899',
  },
  {
    id: 'fr_cipher',
    username: 'cipher_ops',
    displayName: 'Cipher',
    status: 'dnd',
    activity: 'In Visual Studio Code • Equicord Plugins',
    relation: 'friend',
    channelTarget: 'scripts-and-webhooks',
    avatarColor: '#f59e0b',
  },
  {
    id: 'fr_echo',
    username: 'echo_flux',
    displayName: 'EchoFlux',
    status: 'offline',
    relation: 'friend',
    channelTarget: 'general',
    avatarColor: '#64748b',
  },
  {
    id: 'fr_req_1',
    username: 'ryzen_blade',
    displayName: 'RyzenBlade',
    status: 'online',
    activity: 'Sent incoming friend request',
    relation: 'pending_in',
    channelTarget: 'general',
    avatarColor: '#10b981',
  },
];

const DEFAULT_INBOX: InboxEntry[] = [
  {
    id: 'inb_1',
    title: 'Discord Bridge Sync Active',
    sender: 'Discord Gateway Bridge',
    channelName: 'general',
    body: '@andrex Bidirectional profile, quests, and channel sync is online.',
    kind: 'discord',
    timestamp: Date.now() - 1000 * 60 * 4,
    read: false,
  },
  {
    id: 'inb_2',
    title: 'Equicord Plugin Update',
    sender: 'Equicord Runtime',
    channelName: 'general',
    body: 'Quest Completer & Call Timer plugins loaded cleanly with 0 errors.',
    kind: 'system',
    timestamp: Date.now() - 1000 * 60 * 18,
    read: false,
  },
  {
    id: 'inb_3',
    title: 'Mention in #gaming-lounge',
    sender: 'Nova',
    channelName: 'general',
    body: '@andrex Hop in Minecraft SMP voice whenever you finish testing Co-Browse!',
    kind: 'mention',
    timestamp: Date.now() - 1000 * 60 * 42,
    read: true,
  },
];

const DEFAULT_DISCOVER_SERVERS: DiscoverGuildItem[] = [
  {
    id: 'disc_protutech_hub',
    name: 'Protutech Gaming & Voice Hub',
    category: 'Gaming',
    description: 'Official self-hosted + Discord bridged hub for ultra-low latency 48kHz calls and co-op.',
    memberCount: 1420,
    onlineCount: 318,
    defaultChannel: 'general',
    isBridged: true,
    joined: true,
    accent: '#00f2fe',
  },
  {
    id: 'disc_equicord_lab',
    name: 'Equicord Plugin Workshop',
    category: 'Tech & Dev',
    description: 'Share custom Equicord JS plugins, CSS themes, and runtime message hooks.',
    memberCount: 890,
    onlineCount: 164,
    defaultChannel: 'general',
    isBridged: true,
    joined: false,
    accent: '#818cf8',
  },
  {
    id: 'disc_minecraft_smp',
    name: 'Minecraft Bridged SMP',
    category: 'Gaming',
    description: 'Live two-way DiscordSRV & Protutech webhook chat connected to Minecraft 1.21.',
    memberCount: 640,
    onlineCount: 95,
    defaultChannel: 'minecraft-bridge',
    isBridged: true,
    joined: false,
    accent: '#10b981',
  },
  {
    id: 'disc_cobrowse_cinema',
    name: 'Co-Browse Cinema & Study Lounge',
    category: 'Community',
    description: 'Watch videos together, search docs, and browse live pages inside synced voice rooms.',
    memberCount: 512,
    onlineCount: 74,
    defaultChannel: 'general',
    isBridged: false,
    joined: false,
    accent: '#f43f5e',
  },
  {
    id: 'disc_selfhosted_ops',
    name: 'Self-Hosted Infrastructure Ops',
    category: 'Self-Hosted',
    description: 'Matrix federation, LiveKit SFU tuning, and high-speed chunked file transfer relays.',
    memberCount: 380,
    onlineCount: 61,
    defaultChannel: 'general',
    isBridged: false,
    joined: false,
    accent: '#f59e0b',
  },
];

const BANNER_SWATCHES = [
  '#0e7490',
  '#5865f2',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
  '#dc2626',
  '#111827',
];

const NITRO_BADGES = [
  'Nitro Booster',
  'Equicord Supporter',
  'Quest Champion',
  'Early Supporter',
];

function resolveBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:4175';
  const proto = window.location.protocol;
  return proto === 'file:' || proto === 'tauri:' ? 'http://127.0.0.1:4175' : '';
}

function getDiscordAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('protutech_discord_token')?.trim();
    if (token) headers['X-Discord-Token'] = token;
  } catch {
    // ignore
  }
  return headers;
}

function normalizeQuestRecord(raw: Record<string, unknown>, idx: number): DiscordQuestItem {
  const fallback = DEFAULT_QUESTS[idx % DEFAULT_QUESTS.length];
  const rawCategory = String(raw.category || raw.type || fallback.category).toLowerCase();
  const category: DiscordQuestItem['category'] =
    rawCategory === 'stream' ||
    rawCategory === 'play' ||
    rawCategory === 'orbs' ||
    rawCategory === 'decoration'
      ? rawCategory
      : fallback.category;

  const rawDec = String(raw.rewardDecoration || raw.decoration || fallback.rewardDecoration);
  const decorationValid = AVATAR_DECORATIONS.some((d) => d.id === rawDec);
  const progressNum =
    typeof raw.progress === 'number' && Number.isFinite(raw.progress)
      ? Math.max(0, Math.min(100, Math.round(raw.progress)))
      : fallback.progress;

  return {
    id: String(raw.id || fallback.id),
    title: String(raw.title || raw.name || fallback.title),
    game: String(raw.game || raw.target || fallback.game),
    category,
    description: String(raw.description || fallback.description),
    progress: progressNum,
    accepted: typeof raw.accepted === 'boolean' ? raw.accepted : progressNum > 0,
    claimed: typeof raw.claimed === 'boolean' ? raw.claimed : false,
    rewardLabel: String(raw.rewardLabel || raw.reward || fallback.rewardLabel),
    rewardDecoration: decorationValid
      ? (rawDec as AvatarDecorationId)
      : fallback.rewardDecoration,
    rewardBadge: String(raw.rewardBadge || raw.badge || fallback.rewardBadge),
  };
}

export const DiscordHubModal: React.FC<DiscordHubModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'quests',
  onSelectChannelByName,
  onJumpToChannel,
  onApplyReward,
  onStartVoiceCall,
}) => {
  const openTabKey = `${isOpen}:${initialTab}`;
  const [tabOverride, setTabOverride] = useState<{ key: string; tab: DiscordHubTab } | null>(null);
  const activeTab =
    tabOverride && tabOverride.key === openTabKey ? tabOverride.tab : initialTab;
  const setActiveTab = (tab: DiscordHubTab) => {
    setTabOverride({ key: openTabKey, tab });
  };
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Quests state
  const [quests, setQuests] = useState<DiscordQuestItem[]>(() => {
    try {
      const saved = localStorage.getItem(QUESTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DiscordQuestItem[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_QUESTS;
  });
  const [questsLoading, setQuestsLoading] = useState(false);

  // Friends state
  const [friendsSubTab, setFriendsSubTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friends, setFriends] = useState<FriendItem[]>(() => {
    try {
      const saved = localStorage.getItem(FRIENDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FriendItem[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_FRIENDS;
  });
  const [addFriendInput, setAddFriendInput] = useState('');

  // Nitro / Profile state
  const [profile, setProfile] = useState<UserProfileCustomizations>(() =>
    userProfileService.getProfile()
  );
  const [syncSettings, setSyncSettings] = useState<SyncedDiscordSettings>(() =>
    discordSettingsSync.getSettings()
  );
  const [fakeNitroEnabled, setFakeNitroEnabled] = useState(() =>
    vencord.isPluginEnabled('fakeNitro')
  );

  // Inbox state
  const [inboxFilter, setInboxFilter] = useState<'all' | 'mention' | 'discord' | 'system'>('all');
  const [inboxItems, setInboxItems] = useState<InboxEntry[]>(() => {
    try {
      const saved = localStorage.getItem(INBOX_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as InboxEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_INBOX;
  });

  // Discover state
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverCategory, setDiscoverCategory] = useState<string>('All');
  const [discoverServers, setDiscoverServers] = useState<DiscoverGuildItem[]>(() => {
    let joinedIds: string[] = [];
    try {
      const saved = localStorage.getItem(DISCOVER_JOINED_KEY);
      if (saved) joinedIds = JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return DEFAULT_DISCOVER_SERVERS.map((s) => ({
      ...s,
      joined: s.joined || joinedIds.includes(s.id),
    }));
  });

  const showBanner = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => {
      setStatusBanner((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  useEffect(() => {
    const unsubProfile = userProfileService.subscribe(setProfile);
    const unsubSync = discordSettingsSync.subscribe(setSyncSettings);
    return () => {
      unsubProfile();
      unsubSync();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Fetch quests from backend when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadQuests = async () => {
      setQuestsLoading(true);
      try {
        const res = await fetch(`${resolveBaseUrl()}/api/discord/quests`, {
          headers: getDiscordAuthHeaders(),
        });
        if (res.ok) {
          const data = (await res.json()) as
            | { quests?: Array<Record<string, unknown>> }
            | Array<Record<string, unknown>>;
          const list = Array.isArray(data) ? data : data.quests;
          if (!cancelled && Array.isArray(list) && list.length > 0) {
            const normalized = list.map((item, idx) => normalizeQuestRecord(item, idx));
            setQuests((prev) => {
              const prevById = new Map(prev.map((q) => [q.id, q]));
              const merged = normalized.map((serverQ) => {
                const localQ = prevById.get(serverQ.id);
                if (!localQ) return serverQ;
                return {
                  ...serverQ,
                  progress: Math.max(serverQ.progress, localQ.progress),
                  accepted: serverQ.accepted || localQ.accepted,
                  claimed: serverQ.claimed || localQ.claimed,
                };
              });
              try {
                localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(merged));
              } catch {
                // ignore
              }
              return merged;
            });
          }
        }
      } catch {
        // Silent fallback to local defaults
      } finally {
        if (!cancelled) setQuestsLoading(false);
      }
    };
    void loadQuests();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Aggregate live Matrix/Discord cached mentions into Inbox when opened
  const unifiedInbox = useMemo(() => {
    const items: InboxEntry[] = [...inboxItems];
    try {
      const cached = matrix.getCachedRooms();
      const seenIds = new Set(items.map((i) => i.id));
      cached.rooms.slice(0, 12).forEach((room) => {
        const msgs = matrix.getCachedMessages(room.id);
        msgs.slice(-8).forEach((m) => {
          const isMention = m.body.includes('@') || m.source === 'discord';
          if (isMention && !seenIds.has(`msg_${m.id}`)) {
            seenIds.add(`msg_${m.id}`);
            items.push({
              id: `msg_${m.id}`,
              title: m.source === 'discord' ? `Discord Bridge • #${room.name}` : `Message in #${room.name}`,
              sender: m.senderName,
              channelName: room.name,
              body: m.body,
              kind: m.body.includes('@') ? 'mention' : 'discord',
              timestamp: m.timestamp,
              read: false,
            });
          }
        });
      });
    } catch {
      // ignore if matrix cache unpopulated
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [inboxItems]);

  if (!isOpen) return null;

  const jumpToChannel = (target: string) => {
    onSelectChannelByName?.(target);
    onJumpToChannel?.(target);
    onClose();
  };

  const persistQuests = (next: DiscordQuestItem[]) => {
    setQuests(next);
    try {
      localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const postQuestProgress = async (
    quest: DiscordQuestItem,
    updates: Partial<DiscordQuestItem>,
    options?: { autoComplete?: boolean }
  ) => {
    const nextProgress =
      updates.progress !== undefined
        ? Math.max(0, Math.min(100, updates.progress))
        : quest.progress;
    const nextAccepted = updates.accepted !== undefined ? updates.accepted : quest.accepted;
    const nextClaimed = updates.claimed !== undefined ? updates.claimed : quest.claimed;

    const updatedList = quests.map((q) =>
      q.id === quest.id
        ? { ...q, progress: nextProgress, accepted: nextAccepted, claimed: nextClaimed }
        : q
    );
    persistQuests(updatedList);

    try {
      const res = await fetch(`${resolveBaseUrl()}/api/discord/quests/progress`, {
        method: 'POST',
        headers: getDiscordAuthHeaders(),
        body: JSON.stringify({
          questId: quest.id,
          progress: nextProgress,
          accepted: nextAccepted,
          claimed: nextClaimed,
          autoComplete: Boolean(options?.autoComplete),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          quest?: Record<string, unknown>;
          quests?: Array<Record<string, unknown>>;
        };
        if (data.quest) {
          const normalized = normalizeQuestRecord(data.quest, 0);
          persistQuests(
            updatedList.map((q) =>
              q.id === quest.id
                ? {
                    ...q,
                    progress: Math.max(q.progress, normalized.progress),
                    accepted: q.accepted || normalized.accepted,
                    claimed: q.claimed || normalized.claimed,
                  }
                : q
            )
          );
        }
      }
    } catch {
      // Local progress already saved seamlessly
    }
  };

  const handleClaimQuestReward = async (quest: DiscordQuestItem) => {
    await postQuestProgress(quest, { progress: 100, accepted: true, claimed: true });

    const currentProfile = userProfileService.getProfile();
    const nextBadges = Array.from(new Set([...currentProfile.badges, quest.rewardBadge]));
    userProfileService.updateProfile({
      avatarDecoration: quest.rewardDecoration,
      badges: nextBadges,
    });

    onApplyReward?.({
      type: 'decoration',
      value: quest.rewardDecoration,
      label: quest.rewardLabel,
    });
    showBanner(`Claimed "${quest.rewardLabel}" — equipped on your profile! ✓`);
  };

  const persistFriends = (next: FriendItem[]) => {
    setFriends(next);
    try {
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleSendFriendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = addFriendInput.trim();
    if (!clean) return;
    const newFriend: FriendItem = {
      id: `fr_${Date.now()}`,
      username: clean.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      displayName: clean.split('#')[0],
      status: 'online',
      activity: 'Pending outgoing request',
      relation: 'pending_out',
      channelTarget: 'general',
      avatarColor: '#38bdf8',
    };
    persistFriends([newFriend, ...friends]);
    setAddFriendInput('');
    setFriendsSubTab('pending');
    showBanner(`Friend request sent to ${clean} ✓`);
  };

  const handleJoinFriendCall = async (friend: FriendItem) => {
    const roomTarget = friend.voiceChannel || `Call • ${friend.displayName}`;
    const currentProfile = userProfileService.getProfile();
    const identity = matrix.getUserId() || '@andrex:local.protutech';
    const displayName =
      currentProfile.displayName.trim() || currentProfile.username || 'Andrex';

    await livekit.joinVoice(roomTarget, identity, displayName);
    onStartVoiceCall?.(roomTarget);
    showBanner(`Joined voice call "${roomTarget}" with ${friend.displayName} ✓`);
  };

  const handleJoinDiscoverServer = async (srv: DiscoverGuildItem) => {
    try {
      await fetch(`${resolveBaseUrl()}/api/discord/bridge`, {
        method: 'POST',
        headers: getDiscordAuthHeaders(),
        body: JSON.stringify({
          type: 'server',
          guild_id: srv.id,
          name: srv.name,
          entire: true,
        }),
      });
    } catch {
      // ignore network error and still mark joined locally
    }

    const updated = discoverServers.map((item) =>
      item.id === srv.id ? { ...item, joined: true, isBridged: true } : item
    );
    setDiscoverServers(updated);
    try {
      const joinedIds = updated.filter((s) => s.joined).map((s) => s.id);
      localStorage.setItem(DISCOVER_JOINED_KEY, JSON.stringify(joinedIds));
    } catch {
      // ignore
    }
    showBanner(`Joined & bridged "${srv.name}" ✓`);
  };

  const filteredFriends = friends.filter((f) => {
    if (friendsSubTab === 'online') return f.relation === 'friend' && f.status !== 'offline';
    if (friendsSubTab === 'all') return f.relation === 'friend';
    if (friendsSubTab === 'pending') {
      return f.relation === 'pending_in' || f.relation === 'pending_out';
    }
    return false;
  });

  const activeFriendsNow = friends.filter(
    (f) => f.relation === 'friend' && f.status !== 'offline' && f.activity
  );

  const filteredInbox = unifiedInbox.filter((item) =>
    inboxFilter === 'all' ? true : item.kind === inboxFilter
  );

  const filteredDiscover = discoverServers.filter((srv) => {
    if (discoverCategory !== 'All' && srv.category !== discoverCategory) return false;
    if (discoverSearch.trim()) {
      const q = discoverSearch.toLowerCase();
      return (
        srv.name.toLowerCase().includes(q) ||
        srv.description.toLowerCase().includes(q) ||
        srv.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const previewDecorationClass = userProfileService.getDecorationClass(profile.avatarDecoration);

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-5xl h-[700px] max-h-[92vh] bg-[#0a0f1d] border border-indigo-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header & Navigation Tabs */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-950/80 via-[#0e1529] to-cyan-950/70 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5865F2] to-cyan-500 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">Discord Interactive Hub</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                  {syncSettings.discordTokenConnected ? 'Live API + Bridge' : 'Hybrid Bridge'}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Quests, Friends &amp; Active Now, Nitro Decorations, Unified Inbox, and Server Discovery.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Discord Hub"
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-nav Tabs */}
        <div className="px-6 py-2.5 bg-[#080d19] border-b border-white/10 flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'quests', label: 'Quests', icon: Trophy, badge: `${quests.filter((q) => !q.claimed).length}` },
              {
                id: 'friends',
                label: 'Friends & Active Now',
                icon: Users,
                badge: `${friends.filter((f) => f.relation === 'friend' && f.status !== 'offline').length}`,
              },
              { id: 'nitro', label: 'Nitro & Decorations', icon: Gem },
              {
                id: 'inbox',
                label: 'Inbox & Mentions',
                icon: Inbox,
                badge: `${unifiedInbox.filter((i) => !i.read).length || ''}`,
              },
              { id: 'discover', label: 'Discover Servers', icon: Compass },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#5865F2]/30 to-cyan-500/20 text-white border border-indigo-400/40 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-cyan-300' : ''}`} />
                <span>{tab.label}</span>
                {'badge' in tab && tab.badge && tab.badge !== '0' && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toast Banner */}
        {statusBanner && (
          <div className="mx-6 mt-3 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 1. QUESTS TAB */}
          {activeTab === 'quests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span>Discord &amp; Equicord Quests</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Complete Stream, Play, Orbs, or Decoration quests manually or with 1-click Equicord Auto-Complete.
                  </p>
                </div>
                {questsLoading && (
                  <span className="text-xs text-cyan-300 font-mono">Syncing quests...</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quests.map((quest) => {
                  const isComplete = quest.progress >= 100;
                  return (
                    <div
                      key={quest.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all ${
                        quest.claimed
                          ? 'bg-emerald-950/15 border-emerald-500/30'
                          : isComplete
                          ? 'bg-amber-950/15 border-amber-500/40'
                          : 'bg-[#11182c] border-white/10'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white">{quest.title}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {quest.category}
                              </span>
                            </div>
                            <div className="text-[11px] text-cyan-300 font-semibold mt-0.5">
                              {quest.game}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              quest.claimed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isComplete
                                ? 'bg-amber-500/20 text-amber-300'
                                : quest.accepted
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-white/10 text-gray-400'
                            }`}
                          >
                            {quest.claimed
                              ? 'Claimed'
                              : isComplete
                              ? 'Ready to Claim'
                              : quest.accepted
                              ? 'In Progress'
                              : 'Available'}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed">{quest.description}</p>

                        <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center gap-2 text-xs text-amber-200">
                          <Gift className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>Reward: {quest.rewardLabel}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400 font-semibold">Progress</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {quest.progress}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-black/50 overflow-hidden border border-white/10">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isComplete
                                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                                  : 'bg-gradient-to-r from-[#5865F2] to-cyan-400'
                              }`}
                              style={{ width: `${quest.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quest Action Buttons */}
                      <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-white/10">
                        {!quest.accepted && !isComplete && (
                          <button
                            type="button"
                            onClick={() => {
                              void postQuestProgress(quest, { accepted: true, progress: Math.max(quest.progress, 5) });
                              showBanner(`Accepted "${quest.title}" ✓`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold cursor-pointer"
                          >
                            Accept Quest
                          </button>
                        )}

                        {!isComplete && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(100, quest.progress + 25);
                              void postQuestProgress(quest, { accepted: true, progress: next });
                              showBanner(`Updated "${quest.title}" to ${next}%`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
                          >
                            +25% Progress
                          </button>
                        )}

                        {!isComplete && (
                          <button
                            type="button"
                            onClick={() => {
                              void postQuestProgress(
                                quest,
                                { accepted: true, progress: 100 },
                                { autoComplete: true }
                              );
                              showBanner(`Equicord Auto-Completed "${quest.title}" to 100% ⚡`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Equicord Auto-Complete Quest</span>
                          </button>
                        )}

                        {isComplete && (
                          <button
                            type="button"
                            disabled={quest.claimed}
                            onClick={() => void handleClaimQuestReward(quest)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                              quest.claimed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 cursor-pointer shadow-md'
                            }`}
                          >
                            {quest.claimed ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Reward Claimed</span>
                              </>
                            ) : (
                              <>
                                <Gift className="w-3.5 h-3.5" />
                                <span>Claim Reward</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. FRIENDS & ACTIVE NOW TAB */}
          {activeTab === 'friends' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {(
                    [
                      { id: 'online', label: 'Online' },
                      { id: 'all', label: 'All' },
                      { id: 'pending', label: 'Pending' },
                      { id: 'add', label: 'Add Friend' },
                    ] as const
                  ).map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setFriendsSubTab(sub.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        friendsSubTab === sub.id
                          ? sub.id === 'add'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/15 text-white'
                          : 'text-gray-400 hover:text-white bg-white/5'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {friendsSubTab === 'add' ? (
                  <form
                    onSubmit={handleSendFriendRequest}
                    className="p-5 rounded-xl bg-[#11182c] border border-white/10 space-y-3"
                  >
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-emerald-400" />
                      <span>Add Discord or Protutech Friend</span>
                    </h4>
                    <p className="text-xs text-gray-400">
                      Enter a Discord username or Protutech handle to send a bridged friend request.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={addFriendInput}
                        onChange={(e) => setAddFriendInput(e.target.value)}
                        placeholder="e.g. cyber_alex or alex#1337"
                        className="flex-1 bg-black/40 border border-white/10 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-white outline-none"
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold cursor-pointer"
                      >
                        Send Friend Request
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2.5">
                    {filteredFriends.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/10 text-xs text-gray-400">
                        No friends in this view.
                      </div>
                    ) : (
                      filteredFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className="p-3.5 rounded-xl bg-[#11182c] border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative flex-shrink-0">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm"
                                style={{ backgroundColor: friend.avatarColor }}
                              >
                                {friend.displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[#11182c] ${
                                  friend.status === 'online'
                                    ? 'bg-emerald-500'
                                    : friend.status === 'idle'
                                    ? 'bg-amber-500'
                                    : friend.status === 'dnd'
                                    ? 'bg-red-500'
                                    : 'bg-slate-500'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white truncate">
                                  {friend.displayName}
                                </span>
                                <span className="text-[11px] text-gray-500 font-mono">
                                  @{friend.username}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 truncate">
                                {friend.activity || friend.status}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {friend.relation === 'friend' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => jumpToChannel(friend.channelTarget)}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
                                  <span>Message</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleJoinFriendCall(friend)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>Join Call</span>
                                </button>
                              </>
                            ) : friend.relation === 'pending_in' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    persistFriends(
                                      friends.map((f) =>
                                        f.id === friend.id
                                          ? { ...f, relation: 'friend', activity: 'Recently added' }
                                          : f
                                      )
                                    );
                                    showBanner(`Accepted ${friend.displayName}'s friend request ✓`);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    persistFriends(friends.filter((f) => f.id !== friend.id));
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-gray-300 text-xs cursor-pointer"
                                >
                                  Ignore
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => persistFriends(friends.filter((f) => f.id !== friend.id))}
                                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-gray-300 text-xs cursor-pointer"
                              >
                                Cancel Request
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Active Now Column */}
              <div className="bg-[#0d1323] border border-white/10 rounded-xl p-4 space-y-3 h-fit">
                <h4 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-4 h-4" />
                  <span>Active Now</span>
                </h4>
                {activeFriendsNow.map((f) => (
                  <div
                    key={`active_${f.id}`}
                    className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{f.displayName}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
                    </div>
                    <p className="text-[11px] text-gray-400">{f.activity}</p>
                    <button
                      type="button"
                      onClick={() => void handleJoinFriendCall(f)}
                      className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-bold cursor-pointer"
                    >
                      Join Voice / Watch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. NITRO & DECORATIONS TAB */}
          {activeTab === 'nitro' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 space-y-5">
                {/* Avatar Decorations */}
                <div className="p-4 rounded-xl bg-[#11182c] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>Avatar Decorations</span>
                      </h3>
                      <p className="text-xs text-gray-400">
                        Equicord Nitro Perks unlocked — apply any decoration ring immediately.
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 font-bold">
                      Nitro Unlocked
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {AVATAR_DECORATIONS.map((dec) => {
                      const active = profile.avatarDecoration === dec.id;
                      return (
                        <button
                          key={dec.id}
                          type="button"
                          onClick={() => {
                            userProfileService.updateProfile({ avatarDecoration: dec.id });
                            showBanner(`Equipped "${dec.name}" avatar decoration ✓`);
                          }}
                          className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                            active
                              ? 'border-cyan-400 bg-cyan-500/15 text-white'
                              : 'border-white/10 bg-black/30 text-gray-300 hover:border-white/25'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 ${dec.cssClass}`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: dec.previewColor }}
                            />
                          </div>
                          <span className="text-xs font-bold">{dec.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Profile Banner Colors & Perks */}
                <div className="p-4 rounded-xl bg-[#11182c] border border-white/10 space-y-4">
                  <h4 className="text-sm font-bold text-white">
                    Custom Profile Banner &amp; Nitro Overrides
                  </h4>

                  <div className="flex items-center gap-3 flex-wrap">
                    {BANNER_SWATCHES.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          userProfileService.updateProfile({ bannerColor: col });
                          if (syncSettings.syncEnabled) {
                            void discordSettingsSync.updateSetting('bannerColor', col);
                          }
                          showBanner(`Applied banner color ${col} ✓`);
                        }}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                          profile.bannerColor === col
                            ? 'border-white scale-110'
                            : 'border-white/20'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                    <label className="flex items-center gap-1.5 text-xs text-gray-300 ml-2">
                      <span>Custom:</span>
                      <input
                        type="color"
                        value={profile.bannerColor || '#0e7490'}
                        onChange={(e) => {
                          const col = e.target.value;
                          userProfileService.updateProfile({ bannerColor: col });
                          if (syncSettings.syncEnabled) {
                            void discordSettingsSync.updateSetting('bannerColor', col);
                          }
                        }}
                        className="w-8 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Perks Switches */}
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white">
                          4K60 Streaming &amp; FakeNitro Override
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Enables Equicord FakeNitro + Ultra 1080p60/4K60 screen share encoding.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !fakeNitroEnabled;
                          setFakeNitroEnabled(next);
                          vencord.togglePlugin('fakeNitro', next);
                          vencord.togglePlugin('nitroBypass', next);
                          showBanner(
                            `4K60 FakeNitro Override ${next ? 'enabled' : 'disabled'} ✓`
                          );
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                          fakeNitroEnabled ? 'bg-fuchsia-500' : 'bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            fakeNitroEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white">
                          Animated Emojis &amp; Stickers
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Synced bidirectionally via Discord Settings Sync.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !syncSettings.animateEmoji;
                          void discordSettingsSync.updateSetting('animateEmoji', next);
                          showBanner(`Animated Emoji ${next ? 'enabled' : 'disabled'} ✓`);
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                          syncSettings.animateEmoji ? 'bg-cyan-500' : 'bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            syncSettings.animateEmoji ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Nitro Badges */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="text-[11px] font-bold text-gray-400 uppercase">
                      Profile Badges
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {NITRO_BADGES.map((badge) => {
                        const owned = profile.badges.includes(badge);
                        return (
                          <button
                            key={badge}
                            type="button"
                            onClick={() => {
                              const nextBadges = owned
                                ? profile.badges.filter((b) => b !== badge)
                                : [...profile.badges, badge];
                              userProfileService.updateProfile({ badges: nextBadges });
                              showBanner(
                                owned ? `Removed badge "${badge}"` : `Equipped badge "${badge}" ✓`
                              );
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                              owned
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                            }`}
                          >
                            {owned ? `✓ ${badge}` : `+ ${badge}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Nitro Card Preview */}
              <div className="lg:col-span-2">
                <div
                  className="rounded-2xl overflow-hidden bg-[#11182c] border shadow-xl"
                  style={{ borderColor: profile.accentColor || '#00f2fe' }}
                >
                  <div
                    className="h-24 w-full"
                    style={{ backgroundColor: profile.bannerColor || '#0e7490' }}
                  />
                  <div className="p-5 -mt-10">
                    <div className={`w-20 h-20 rounded-full p-0.5 inline-block ${previewDecorationClass}`}>
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt="Avatar Preview"
                          className="w-full h-full rounded-full object-cover border-4 border-[#11182c]"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full border-4 border-[#11182c] bg-[#5865F2] flex items-center justify-center text-white text-xl font-extrabold">
                          {(profile.displayName || profile.username || 'AN')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <h4 className="text-base font-extrabold text-white">
                        {profile.displayName || profile.username || 'Andrex'}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">
                        {profile.bio || 'Equicord Nitro Perks & Custom Decorations active.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {profile.badges.map((b) => (
                        <span
                          key={b}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-cyan-300"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. INBOX & MENTIONS TAB */}
          {activeTab === 'inbox' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All Activity' },
                      { id: 'mention', label: 'Mentions' },
                      { id: 'discord', label: 'Discord Bridge' },
                      { id: 'system', label: 'System' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setInboxFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        inboxFilter === f.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const marked = inboxItems.map((i) => ({ ...i, read: true }));
                    setInboxItems(marked);
                    try {
                      localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(marked));
                    } catch {
                      // ignore
                    }
                    showBanner('Marked all inbox items as read ✓');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-gray-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <BellOff className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mark All Read</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {filteredInbox.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                      entry.read
                        ? 'bg-[#0e1424] border-white/10'
                        : 'bg-[#121c33] border-cyan-500/35'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{entry.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-cyan-300 font-semibold">
                          #{entry.channelName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">{entry.body}</p>
                      <div className="text-[11px] text-gray-500">From: {entry.sender}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => jumpToChannel(entry.channelName)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1 flex-shrink-0 cursor-pointer"
                    >
                      <span>Jump</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. DISCOVER SERVERS TAB */}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={discoverSearch}
                    onChange={(e) => setDiscoverSearch(e.target.value)}
                    placeholder="Discover public & self-hosted community servers..."
                    className="w-full bg-[#11182c] border border-white/10 focus:border-cyan-400 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {['All', 'Gaming', 'Tech & Dev', 'Community', 'Self-Hosted'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDiscoverCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        discoverCategory === cat
                          ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDiscover.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-xl bg-[#11182c] border border-white/10 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-950 font-extrabold"
                            style={{ backgroundColor: srv.accent }}
                          >
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-white">{srv.name}</h4>
                            <div className="text-[11px] text-gray-400">
                              {srv.category} • {srv.onlineCount} online / {srv.memberCount} members
                            </div>
                          </div>
                        </div>

                        {srv.isBridged && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                            Bridged
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed">{srv.description}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                      {srv.joined ? (
                        <button
                          type="button"
                          onClick={() => jumpToChannel(srv.defaultChannel)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Joined • Open Channel</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleJoinDiscoverServer(srv)}
                          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#5865F2] to-cyan-600 hover:from-[#4752c4] hover:to-cyan-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Join / Bridge Server
                        </button>
                      )}
                    </div>
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
