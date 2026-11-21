import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Users,
  MessageSquare,
  ShieldCheck,
  Check,
  Search,
  Hash,
  Volume2,
  Folder,
  Loader2,
  Layers,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { discordSync } from '../services/discordSync';
import { matrix } from '../services/matrix';
import type {
  DiscordAvailableGuild,
  DiscordAvailableChannel,
  DiscordAvailableDM,
} from '../types';

export type AddModalTab = 'server' | 'group' | 'dm';

interface AddConversationModalProps {
  isOpen: boolean;
  initialTab?: AddModalTab;
  onClose: () => void;
  onSuccess: (targetRoomOrGuildId?: string) => void;
}

export const AddConversationModal: React.FC<AddConversationModalProps> = ({
  isOpen,
  initialTab = 'server',
  onClose,
  onSuccess,
}) => {
  const openTabKey = `${isOpen}:${initialTab}`;
  const [tabOverride, setTabOverride] = useState<{ key: string; tab: AddModalTab } | null>(null);
  const activeTab: AddModalTab =
    tabOverride && tabOverride.key === openTabKey ? tabOverride.tab : initialTab;
  const setActiveTab = (tab: AddModalTab) => {
    setTabOverride({ key: openTabKey, tab });
  };

  // Server mode: 'create' = native server/channel, 'sync' = sync external server
  const [serverMode, setServerMode] = useState<'create' | 'sync'>('create');
  const [serverRoomName, setServerRoomName] = useState('');
  const [serverRoomTopic, setServerRoomTopic] = useState('');
  const [serverIsVoice, setServerIsVoice] = useState(false);
  const [serverBitrate, setServerBitrate] = useState(96);
  const [serverUserLimit, setServerUserLimit] = useState(0);
  const [serverIsAfk, setServerIsAfk] = useState(false);
  const [serverSlowmode, setServerSlowmode] = useState(0);
  const [serverNsfw, setServerNsfw] = useState(false);
  const [serverIsPrivate, setServerIsPrivate] = useState(false);

  // Sync mode for server: 'entire' = full clone always synced, 'selective' = pick specific channels
  const [serverSyncMode, setServerSyncMode] = useState<'entire' | 'selective'>('entire');

  // Server state
  const [guilds, setGuilds] = useState<DiscordAvailableGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [guildChannels, setGuildChannels] = useState<DiscordAvailableChannel[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [guildSearch, setGuildSearch] = useState('');
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Group chat state
  const [groupMode, setGroupMode] = useState<'create' | 'sync'>('create');
  const [groupName, setGroupName] = useState('');
  const [groupTopic, setGroupTopic] = useState('');
  const [availableDMs, setAvailableDMs] = useState<DiscordAvailableDM[]>([]);
  const [selectedGroupDMId, setSelectedGroupDMId] = useState<string | null>(null);
  const [loadingDMs, setLoadingDMs] = useState(false);

  // DM state
  const [dmMode, setDmMode] = useState<'create' | 'sync'>('create');
  const [dmUsername, setDmUsername] = useState('');
  const [selectedDMId, setSelectedDMId] = useState<string | null>(null);

  // Action status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusState, setStatusState] = useState<{
    key: string;
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const statusMessage = statusState && statusState.key === openTabKey ? statusState : null;
  const setStatusMessage = (msg: { type: 'ok' | 'err'; text: string } | null) => {
    setStatusState(msg ? { key: openTabKey, ...msg } : null);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Load available external servers when Server sync mode is active
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    if (activeTab === 'server' && serverMode === 'sync' && guilds.length === 0) {
      void Promise.resolve().then(async () => {
        if (cancelled) return;
        setLoadingGuilds(true);
        const list = await discordSync.fetchAvailableGuilds();
        if (cancelled) return;
        setGuilds(list);
        setLoadingGuilds(false);
        if (list.length > 0 && !selectedGuildId) {
          setSelectedGuildId(list[0].id);
        }
      });
    }

    if ((activeTab === 'group' || activeTab === 'dm') && availableDMs.length === 0) {
      void Promise.resolve().then(async () => {
        if (cancelled) return;
        setLoadingDMs(true);
        const list = await discordSync.fetchAvailableDMs();
        if (cancelled) return;
        setAvailableDMs(list);
        setLoadingDMs(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, serverMode, guilds.length, availableDMs.length, selectedGuildId]);

  // Load channels when a guild is selected in selective mode
  useEffect(() => {
    if (activeTab === 'server' && serverMode === 'sync' && serverSyncMode === 'selective' && selectedGuildId) {
      let cancelled = false;
      void Promise.resolve().then(async () => {
        if (cancelled) return;
        setLoadingChannels(true);
        const chs = await discordSync.fetchGuildChannels(selectedGuildId);
        if (cancelled) return;
        setGuildChannels(chs);
        setLoadingChannels(false);
        const nonCats = chs.filter(c => c.type !== 'category').map(c => c.id);
        setSelectedChannelIds(new Set(nonCats));
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [activeTab, serverMode, serverSyncMode, selectedGuildId]);

  if (!isOpen) return null;

  const handleToggleChannel = (cid: string) => {
    const next = new Set(selectedChannelIds);
    if (next.has(cid)) {
      next.delete(cid);
    } else {
      next.add(cid);
    }
    setSelectedChannelIds(next);
  };

  const handleSelectAllChannels = (selectAll: boolean) => {
    if (selectAll) {
      const nonCats = guildChannels.filter(c => c.type !== 'category').map(c => c.id);
      setSelectedChannelIds(new Set(nonCats));
    } else {
      setSelectedChannelIds(new Set());
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (activeTab === 'server') {
        if (serverMode === 'create') {
          if (!serverRoomName.trim()) {
            throw new Error('Please enter a server or channel name.');
          }

          const room = await matrix.createNativeRoom({
            name: serverRoomName.trim(),
            topic: serverRoomTopic.trim(),
            isGroupChat: false,
            isVoice: serverIsVoice,
            ...(serverIsVoice
              ? {
                  bitrate: serverBitrate,
                  userLimit: serverUserLimit,
                  isAfkChannel: serverIsAfk,
                }
              : {
                  slowmodeSeconds: serverSlowmode,
                  nsfw: serverNsfw,
                  isPrivate: serverIsPrivate,
                }),
          } as Parameters<typeof matrix.createNativeRoom>[0]);

          if (!room) {
            throw new Error('Sign in to create a native server or channel.');
          }

          setStatusMessage({
            type: 'ok',
            text: `${serverIsVoice ? 'Voice' : 'Text'} channel "#${room.name}" created!`,
          });

          setTimeout(() => {
            onSuccess(room.guildId || room.id);
            onClose();
          }, 900);
          return;
        }

        if (!selectedGuildId) throw new Error('Please select a server to sync.');

        const isEntire = serverSyncMode === 'entire';
        const channelIds = isEntire ? [] : Array.from(selectedChannelIds);

        if (!isEntire && channelIds.length === 0) {
          throw new Error('Please select at least one channel to sync.');
        }

        setStatusMessage({
          type: 'ok',
          text: isEntire
            ? 'Cloning server channels and establishing sync...'
            : `Syncing ${channelIds.length} selected channels...`,
        });

        const res = await discordSync.syncServer(selectedGuildId, isEntire, channelIds);
        if (res.status === 'error') throw new Error(res.error || 'Failed to sync server.');

        setStatusMessage({
          type: 'ok',
          text: 'Server synced! Refreshing channels...',
        });

        setTimeout(() => {
          onSuccess(selectedGuildId);
          onClose();
        }, 1000);
      } else if (activeTab === 'group') {
        if (groupMode === 'create') {
          if (!groupName.trim()) throw new Error('Please enter a group chat name.');

          const room = await matrix.createNativeRoom({
            name: groupName.trim(),
            topic: groupTopic.trim(),
            isGroupChat: true,
          });

          if (!room) throw new Error('Failed to create group chat.');

          setStatusMessage({
            type: 'ok',
            text: 'Group chat created successfully!',
          });

          setTimeout(() => {
            onSuccess(room.id);
            onClose();
          }, 1000);
        } else {
          // Sync existing Group Chat
          if (!selectedGroupDMId) throw new Error('Please select a group chat to sync.');

          const res = await discordSync.syncDMOrGroup(selectedGroupDMId, 'group');
          if (res.status === 'error') throw new Error(res.error || 'Failed to sync group chat.');

          setStatusMessage({
            type: 'ok',
            text: 'Group chat synced successfully!',
          });

          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        }
      } else if (activeTab === 'dm') {
        if (dmMode === 'create') {
          if (!dmUsername.trim()) throw new Error('Please enter a username.');

          const fullUserId = dmUsername.includes(':')
            ? dmUsername.trim()
            : `@${dmUsername.trim().replace(/^@/, '')}:chat.protutech.vip`;

          const room = await matrix.createNativeRoom({
            name: dmUsername.trim().replace(/^@/, '').split(':')[0],
            isDirect: true,
            invites: [fullUserId],
          });

          if (!room) throw new Error('Failed to start direct message.');

          setStatusMessage({
            type: 'ok',
            text: 'Direct message conversation started!',
          });

          setTimeout(() => {
            onSuccess(room.id);
            onClose();
          }, 1000);
        } else {
          // Sync contact chat
          if (!selectedDMId) throw new Error('Please select a conversation to sync.');

          const res = await discordSync.syncDMOrGroup(selectedDMId, 'dm');
          if (res.status === 'error') throw new Error(res.error || 'Failed to sync conversation.');

          setStatusMessage({
            type: 'ok',
            text: 'Direct conversation synced successfully!',
          });

          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: 'err', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGuilds = guilds.filter(g =>
    g.name.toLowerCase().includes(guildSearch.toLowerCase()) || g.id.includes(guildSearch)
  );

  const groupDMs = availableDMs.filter(d => d.type === 'group');
  const singleDMs = availableDMs.filter(d => d.type === 'dm');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-conversation-title"
        className="bg-[var(--bg-chat)] border border-[var(--border-subtle)] rounded-2xl w-[min(42rem,100%)] max-w-full max-h-full flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 bg-[var(--bg-userpanel)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--discord-blurple)] flex items-center justify-center text-white flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="add-conversation-title" className="text-base sm:text-lg font-bold text-[var(--text-header)] tracking-tight">
                Add or Sync
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Create a native space or sync an external server, group, or DM.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add or Sync dialog"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-item-hover)] rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Main Segmented Tabs */}
        <div className="px-5 pt-3 pb-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-channels)] flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('server');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'server'
                ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                : 'bg-[var(--bg-userpanel)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Server</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('group');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'group'
                ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                : 'bg-[var(--bg-userpanel)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Group</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('dm');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'dm'
                ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                : 'bg-[var(--bg-userpanel)] text-[var(--text-muted)] hover:bg-[var(--bg-item-hover)] hover:text-[var(--text-header)]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Direct Message</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: SERVER */}
          {activeTab === 'server' && (
            <div className="space-y-4">
              {/* Create vs Sync Toggle */}
              <div className="flex items-center gap-2 bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  data-testid="add-server-mode-create"
                  onClick={() => setServerMode('create')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    serverMode === 'create'
                      ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span>Create Native Server / Channel</span>
                </button>
                <button
                  type="button"
                  data-testid="add-server-mode-sync"
                  onClick={() => setServerMode('sync')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    serverMode === 'sync'
                      ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Sync External Server</span>
                </button>
              </div>

              {serverMode === 'create' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Server / Channel Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. engineering, squad-voice..."
                      value={serverRoomName}
                      onChange={e => setServerRoomName(e.target.value)}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Topic (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Short channel description..."
                      value={serverRoomTopic}
                      onChange={e => setServerRoomTopic(e.target.value)}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setServerIsVoice(false)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        !serverIsVoice
                          ? 'bg-[var(--bg-item-active)] border-[var(--discord-blurple)] text-[var(--text-header)]'
                          : 'bg-[var(--bg-userpanel)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>Text Channel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServerIsVoice(true)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        serverIsVoice
                          ? 'bg-[var(--bg-item-active)] border-[var(--discord-blurple)] text-[var(--text-header)]'
                          : 'bg-[var(--bg-userpanel)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Voice Channel</span>
                    </button>
                  </div>

                  {serverIsVoice ? (
                    <div className="space-y-3 bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-xl p-3">
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-[var(--text-normal)] mb-1">
                          <span>Voice Bitrate</span>
                          <span className="font-mono text-emerald-400">{serverBitrate} kbps</span>
                        </div>
                        <input
                          type="range"
                          min={8}
                          max={384}
                          step={8}
                          value={serverBitrate}
                          onChange={(e) => setServerBitrate(Number(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-[var(--text-normal)] mb-1">
                          <span>User Limit</span>
                          <span className="font-mono text-indigo-300">
                            {serverUserLimit === 0 ? 'Unlimited' : `${serverUserLimit} members`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={99}
                          step={1}
                          value={serverUserLimit}
                          onChange={(e) => setServerUserLimit(Number(e.target.value))}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                      <label className="flex items-center justify-between text-xs text-[var(--text-normal)] cursor-pointer">
                        <span>Mark as AFK / Sleep Channel</span>
                        <input
                          type="checkbox"
                          checked={serverIsAfk}
                          onChange={(e) => setServerIsAfk(e.target.checked)}
                          className="h-4 w-4 accent-amber-500"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2.5 bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-normal)]">Slowmode Cooldown</span>
                        <select
                          value={serverSlowmode}
                          onChange={(e) => setServerSlowmode(Number(e.target.value))}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[#101218] px-2 py-1 text-xs text-white"
                        >
                          <option value={0}>Off</option>
                          <option value={5}>5s</option>
                          <option value={15}>15s</option>
                          <option value={30}>30s</option>
                          <option value={60}>1m</option>
                          <option value={300}>5m</option>
                        </select>
                      </div>
                      <label className="flex items-center justify-between text-xs text-[var(--text-normal)] cursor-pointer">
                        <span>Age-Restricted (18+)</span>
                        <input
                          type="checkbox"
                          checked={serverNsfw}
                          onChange={(e) => setServerNsfw(e.target.checked)}
                          className="h-4 w-4 accent-rose-500"
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs text-[var(--text-normal)] cursor-pointer">
                        <span>Private Channel</span>
                        <input
                          type="checkbox"
                          checked={serverIsPrivate}
                          onChange={(e) => setServerIsPrivate(e.target.checked)}
                          className="h-4 w-4 accent-indigo-500"
                        />
                      </label>
                    </div>
                  )}

                  <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-xl p-3">
                    Creates a native room that works in both Local and Hybrid modes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ALWAYS SYNCED BANNER */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-[var(--status-online)] flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-[var(--text-normal)] leading-relaxed">
                      <strong className="block text-[var(--status-online)] font-bold text-xs mb-0.5">
                        Full Server Mirror &bull; Live Sync
                      </strong>
                      Clones categories, text channels, and voice lounges with continuous sync.
                    </div>
                  </div>

                  {/* Mode Toggle: Entire vs Selective */}
                  <div className="flex items-center gap-2 bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setServerSyncMode('entire')}
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        serverSyncMode === 'entire'
                          ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Clone Entire Server</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServerSyncMode('selective')}
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        serverSyncMode === 'selective'
                          ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      <Hash className="w-4 h-4" />
                      <span>Select Channels</span>
                    </button>
                  </div>

                  {/* Server Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
                    <input
                      type="text"
                      aria-label="Search external servers"
                      placeholder="Search servers by name or ID..."
                      value={guildSearch}
                      onChange={e => setGuildSearch(e.target.value)}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  {/* Server List */}
                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-userpanel)]">
                    <div className="px-3 py-2 bg-[var(--bg-channels)] border-b border-[var(--border-subtle)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex justify-between">
                      <span>Available Servers ({filteredGuilds.length})</span>
                      {selectedGuildId && <span className="text-[var(--text-link)]">1 selected</span>}
                    </div>

                    <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                      {loadingGuilds ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] text-sm">
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-link)]" />
                          <span>Loading servers...</span>
                        </div>
                      ) : filteredGuilds.length === 0 ? (
                        <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                          No external servers found.
                        </div>
                      ) : (
                        filteredGuilds.map(guild => {
                          const isSelected = selectedGuildId === guild.id;
                          return (
                            <div
                              key={guild.id}
                              onClick={() => setSelectedGuildId(guild.id)}
                              className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[var(--bg-item-active)] border-l-4 border-[var(--discord-blurple)] text-[var(--text-header)]'
                                  : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {guild.avatar_url ? (
                                  <img
                                    src={guild.avatar_url}
                                    alt={guild.name}
                                    className="w-8 h-8 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-[var(--discord-blurple)] flex items-center justify-center font-bold text-xs text-white">
                                    {guild.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-sm flex items-center gap-2">
                                    <span>{guild.name}</span>
                                    {guild.bridged && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-[var(--status-online)] border border-emerald-500/30">
                                        Synced
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[var(--text-muted)] font-mono">ID: {guild.id}</div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[var(--text-link)]" />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Selective Channel Checklist */}
                  {serverSyncMode === 'selective' && selectedGuildId && (
                    <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-userpanel)] space-y-2 p-3">
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--border-subtle)]">
                        <span className="font-bold text-[var(--text-link)] uppercase tracking-wider flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5" />
                          <span>Select Channels</span>
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAllChannels(true)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-header)] underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-[var(--text-muted)]">&bull;</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllChannels(false)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-header)] underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {loadingChannels ? (
                        <div className="py-6 flex justify-center items-center gap-2 text-[var(--text-muted)] text-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-link)]" />
                          <span>Loading channels...</span>
                        </div>
                      ) : guildChannels.length === 0 ? (
                        <div className="py-4 text-center text-[var(--text-muted)] text-xs">
                          No channels found.
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {guildChannels.map(ch => {
                            if (ch.type === 'category') {
                              return (
                                <div
                                  key={ch.id}
                                  className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 pt-2 flex items-center gap-1.5"
                                >
                                  <Folder className="w-3 h-3" />
                                  <span>{ch.name}</span>
                                </div>
                              );
                            }

                            const isChecked = selectedChannelIds.has(ch.id);
                            return (
                              <label
                                key={ch.id}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                                  isChecked ? 'bg-[var(--bg-item-active)] text-[var(--text-header)]' : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleChannel(ch.id)}
                                    className="rounded border-[var(--border-subtle)] cursor-pointer"
                                  />
                                  {ch.type === 'voice' ? (
                                    <Volume2 className="w-3.5 h-3.5 text-[var(--status-online)] flex-shrink-0" />
                                  ) : (
                                    <Hash className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                  )}
                                  <span className="truncate">{ch.name}</span>
                                </div>
                                {ch.is_bridged && (
                                  <span className="text-[10px] text-[var(--status-online)] font-medium ml-2">Synced</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GROUP CHAT */}
          {activeTab === 'group' && (
            <div className="space-y-4">
              {/* Group Chat Mode Toggle */}
              <div className="flex items-center gap-2 bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setGroupMode('create')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    groupMode === 'create'
                      ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Create Group</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode('sync')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    groupMode === 'sync'
                      ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Sync Group</span>
                </button>
              </div>

              {groupMode === 'create' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Group Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Squad Tactics, Project Alpha..."
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Topic (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Voice lounge and strategy chat..."
                      value={groupTopic}
                      onChange={e => setGroupTopic(e.target.value)}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--discord-blurple)]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--text-muted)]">
                    Select a group chat to sync:
                  </div>

                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-userpanel)] max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                    {loadingDMs ? (
                      <div className="py-8 flex justify-center items-center gap-2 text-[var(--text-muted)] text-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-link)]" />
                        <span>Loading groups...</span>
                      </div>
                    ) : groupDMs.length === 0 ? (
                      <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                        No group chats detected.
                      </div>
                    ) : (
                      groupDMs.map(gdm => {
                        const isSelected = selectedGroupDMId === gdm.id;
                        return (
                          <div
                            key={gdm.id}
                            onClick={() => setSelectedGroupDMId(gdm.id)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[var(--bg-item-active)] border-l-4 border-[var(--discord-blurple)] text-[var(--text-header)]'
                                : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Users className="w-4 h-4 text-[var(--text-link)]" />
                              <span className="text-sm font-medium">{gdm.name || `Group (${gdm.id.slice(-4)})`}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[var(--text-link)]" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT MESSAGE */}
          {activeTab === 'dm' && (
            <div className="space-y-4">
              {/* DM Mode Toggle */}
              <div className="flex items-center gap-2 bg-[var(--bg-channels)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDmMode('create')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    dmMode === 'create'
                      ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Start Direct Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDmMode('sync')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    dmMode === 'sync'
                      ? 'bg-[var(--discord-blurple)] text-white shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Sync Contact</span>
                </button>
              </div>

              {dmMode === 'create' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                      Username or User ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. andrex or @andrex:chat.protutech.vip"
                      value={dmUsername}
                      onChange={e => setDmUsername(e.target.value)}
                      className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-header)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--discord-blurple)] font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--text-muted)]">
                    Select a contact to sync into your DMs:
                  </div>

                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-userpanel)] max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                    {loadingDMs ? (
                      <div className="py-8 flex justify-center items-center gap-2 text-[var(--text-muted)] text-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-link)]" />
                        <span>Loading contacts...</span>
                      </div>
                    ) : singleDMs.length === 0 ? (
                      <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                        No direct messages found.
                      </div>
                    ) : (
                      singleDMs.map(dm => {
                        const isSelected = selectedDMId === dm.id;
                        return (
                          <div
                            key={dm.id}
                            onClick={() => setSelectedDMId(dm.id)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[var(--bg-item-active)] border-l-4 border-[var(--discord-blurple)] text-[var(--text-header)]'
                                : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <MessageSquare className="w-4 h-4 text-[var(--text-link)]" />
                              <span className="text-sm font-medium">
                                {dm.name || `User (${dm.other_user_id || dm.id.slice(-4)})`}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[var(--text-link)]" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Feedback Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                statusMessage.type === 'ok'
                  ? 'bg-emerald-500/15 border border-emerald-500/40 text-[var(--status-online)]'
                  : 'bg-red-500/15 border border-red-500/40 text-[var(--status-dnd)]'
              }`}
            >
              {statusMessage.type === 'ok' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-userpanel)] flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-sm px-5 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
            <span>
              {activeTab === 'server'
                ? serverMode === 'create'
                  ? 'Create Server / Channel'
                  : serverSyncMode === 'entire'
                  ? 'Clone & Sync Server'
                  : `Sync (${selectedChannelIds.size}) Channels`
                : activeTab === 'group'
                ? groupMode === 'create'
                  ? 'Create Group'
                  : 'Sync Group'
                : dmMode === 'create'
                ? 'Start Direct Message'
                : 'Sync Direct Message'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
