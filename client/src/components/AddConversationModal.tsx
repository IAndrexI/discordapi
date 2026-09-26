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
  Radio,
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
  const [activeTab, setActiveTab] = useState<AddModalTab>(initialTab);

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
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Keep activeTab in sync with initialTab
  useEffect(() => {
    setActiveTab(initialTab);
    setStatusMessage(null);
  }, [initialTab, isOpen]);

  // Load available Discord guilds when Server tab is active
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'server' && guilds.length === 0) {
      setLoadingGuilds(true);
      discordSync.fetchAvailableGuilds().then(list => {
        setGuilds(list);
        setLoadingGuilds(false);
        if (list.length > 0 && !selectedGuildId) {
          setSelectedGuildId(list[0].id);
        }
      });
    }

    if ((activeTab === 'group' || activeTab === 'dm') && availableDMs.length === 0) {
      setLoadingDMs(true);
      discordSync.fetchAvailableDMs().then(list => {
        setAvailableDMs(list);
        setLoadingDMs(false);
      });
    }
  }, [isOpen, activeTab, guilds.length, availableDMs.length, selectedGuildId]);

  // Load channels when a guild is selected in selective mode
  useEffect(() => {
    if (activeTab === 'server' && serverSyncMode === 'selective' && selectedGuildId) {
      setLoadingChannels(true);
      discordSync.fetchGuildChannels(selectedGuildId).then(chs => {
        setGuildChannels(chs);
        setLoadingChannels(false);
        // Default check all text and voice channels
        const nonCats = chs.filter(c => c.type !== 'category').map(c => c.id);
        setSelectedChannelIds(new Set(nonCats));
      });
    }
  }, [activeTab, serverSyncMode, selectedGuildId]);

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
        if (!selectedGuildId) throw new Error('Please select a server to sync.');

        const isEntire = serverSyncMode === 'entire';
        const channelIds = isEntire ? [] : Array.from(selectedChannelIds);

        if (!isEntire && channelIds.length === 0) {
          throw new Error('Please select at least one channel to sync.');
        }

        setStatusMessage({
          type: 'ok',
          text: isEntire
            ? 'Cloning server channels and establishing continuous sync...'
            : `Syncing ${channelIds.length} selective channels...`,
        });

        const res = await discordSync.syncServer(selectedGuildId, isEntire, channelIds);
        if (res.status === 'error') throw new Error(res.error || 'Failed to sync server.');

        setStatusMessage({
          type: 'ok',
          text: 'Server successfully cloned! Refreshing channels...',
        });

        setTimeout(() => {
          onSuccess(selectedGuildId);
          onClose();
        }, 1200);
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
            text: 'Group chat created successfully! You can link with Discord anytime.',
          });

          setTimeout(() => {
            onSuccess(room.id);
            onClose();
          }, 1000);
        } else {
          // Sync existing Discord Group DM
          if (!selectedGroupDMId) throw new Error('Please select a Discord group chat to sync.');

          const res = await discordSync.syncDMOrGroup(selectedGroupDMId, 'group');
          if (res.status === 'error') throw new Error(res.error || 'Failed to sync group DM.');

          setStatusMessage({
            type: 'ok',
            text: 'Discord Group DM synced successfully!',
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
          // Sync Discord friend DM
          if (!selectedDMId) throw new Error('Please select a Discord DM to sync.');

          const res = await discordSync.syncDMOrGroup(selectedDMId, 'dm');
          if (res.status === 'error') throw new Error(res.error || 'Failed to sync DM.');

          setStatusMessage({
            type: 'ok',
            text: 'Discord Direct Message synced successfully!',
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1021] border border-cyan-500/25 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-[#070b18]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Add or Sync Conversation</h2>
              <p className="text-xs text-slate-400">
                Choose between Server cloning, Group chats, or Direct Messages.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Main Segmented Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-white/10 bg-[#090e1f] flex gap-2">
          <button
            onClick={() => {
              setActiveTab('server');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm transition-all ${
              activeTab === 'server'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-cyan-400/40'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Server</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('group');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm transition-all ${
              activeTab === 'group'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-cyan-400/40'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Group Chat</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('dm');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm transition-all ${
              activeTab === 'dm'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-cyan-400/40'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Direct Message</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: SERVER */}
          {activeTab === 'server' && (
            <div className="space-y-4">
              {/* ALWAYS SYNCED GUARANTEE BANNER */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-start gap-3 shadow-inner">
                <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200 leading-relaxed">
                  <strong className="block text-emerald-400 font-bold text-sm mb-0.5">
                    Full Server Mirror &bull; Always Synced
                  </strong>
                  Selecting a Discord server clones the complete channel structure including all
                  categories, text channels, and dedicated voice lounges. This server will remain
                  continuously and automatically synchronized with Discord in real time.
                </div>
              </div>

              {/* Mode Toggle: Entire vs Selective */}
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl p-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setServerSyncMode('entire')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    serverSyncMode === 'entire'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Clone Entire Server (Always Synced)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServerSyncMode('selective')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    serverSyncMode === 'selective'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span>Select Specific Channels Only</span>
                </button>
              </div>

              {/* Server Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search Discord servers by name or ID..."
                  value={guildSearch}
                  onChange={e => setGuildSearch(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Server List */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-black/30">
                <div className="px-3 py-2 bg-black/40 border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Available Discord Servers ({filteredGuilds.length})</span>
                  {selectedGuildId && <span className="text-cyan-400">1 selected</span>}
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
                  {loadingGuilds ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      <span>Loading Discord servers...</span>
                    </div>
                  ) : filteredGuilds.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">
                      No matching servers found.
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
                              ? 'bg-blue-600/25 border-l-4 border-cyan-400 text-white'
                              : 'hover:bg-white/5 text-slate-300'
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
                              <div className="w-8 h-8 rounded-lg bg-blue-900/60 border border-blue-500/40 flex items-center justify-center font-bold text-xs text-white">
                                {guild.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-sm flex items-center gap-2">
                                <span>{guild.name}</span>
                                {guild.bridged && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    Already Synced
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">ID: {guild.id}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Selective Channel Checklist (Only if selective mode chosen) */}
              {serverSyncMode === 'selective' && selectedGuildId && (
                <div className="border border-cyan-500/30 rounded-xl overflow-hidden bg-black/40 space-y-2 p-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                    <span className="font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" />
                      <span>Select Specific Channels to Sync</span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAllChannels(true)}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">&bull;</span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllChannels(false)}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {loadingChannels ? (
                    <div className="py-6 flex justify-center items-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading server channels...</span>
                    </div>
                  ) : guildChannels.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs">
                      No channels found in this server.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {guildChannels.map(ch => {
                        if (ch.type === 'category') {
                          return (
                            <div
                              key={ch.id}
                              className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 pt-2 flex items-center gap-1.5"
                            >
                              <Folder className="w-3 h-3 text-slate-600" />
                              <span>{ch.name}</span>
                            </div>
                          );
                        }

                        const isChecked = selectedChannelIds.has(ch.id);
                        return (
                          <label
                            key={ch.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                              isChecked ? 'bg-blue-900/30 text-white' : 'hover:bg-white/5 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleChannel(ch.id)}
                                className="rounded border-white/20 bg-black/40 text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              {ch.type === 'voice' ? (
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              )}
                              <span className="truncate">{ch.name}</span>
                            </div>
                            {ch.is_bridged && (
                              <span className="text-[10px] text-emerald-400 font-medium ml-2">Synced</span>
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

          {/* TAB 2: GROUP CHAT */}
          {activeTab === 'group' && (
            <div className="space-y-4">
              {/* Group Chat Mode Toggle */}
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setGroupMode('create')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    groupMode === 'create'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Create Protutech Group</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode('sync')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    groupMode === 'sync'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Sync Discord Group DM</span>
                </button>
              </div>

              {groupMode === 'create' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Group Chat Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Squad Tactics, Project Alpha..."
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Topic or Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Voice lounge and strategy chat..."
                      value={groupTopic}
                      onChange={e => setGroupTopic(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* Sync Later Notice */}
                  <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-200">
                    <Radio className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Sync Option Available Later:</strong> This group chat will be created as a native,
                      ultra-low latency Protutech chat. You can link or synchronize this group with any
                      Discord channel later at any time from the chat header.
                    </div>
                  </div>
                </div>
              ) : (
                /* Sync Discord Group DM */
                <div className="space-y-3">
                  <div className="text-xs text-slate-400">
                    Select a multi-person Discord Group DM to synchronize:
                  </div>

                  <div className="border border-white/10 rounded-xl overflow-hidden bg-black/30 max-h-56 overflow-y-auto divide-y divide-white/5">
                    {loadingDMs ? (
                      <div className="py-8 flex justify-center items-center gap-2 text-slate-400 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                        <span>Loading Discord group chats...</span>
                      </div>
                    ) : groupDMs.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        No Discord group DMs detected.
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
                                ? 'bg-blue-600/25 border-l-4 border-cyan-400 text-white'
                                : 'hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Users className="w-4 h-4 text-cyan-400" />
                              <span className="text-sm font-medium">{gdm.name || `Group Chat (${gdm.id.slice(-4)})`}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
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
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDmMode('create')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    dmMode === 'create'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Start Protutech DM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDmMode('sync')}
                  className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    dmMode === 'sync'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Sync Discord Friend DM</span>
                </button>
              </div>

              {dmMode === 'create' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Username or Matrix ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. andrex or @andrex:chat.protutech.vip"
                      value={dmUsername}
                      onChange={e => setDmUsername(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-200">
                    <Radio className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Sync Option Available Later:</strong> Once started, you can link this direct
                      message to any Discord friend or private conversation later from the chat top bar.
                    </div>
                  </div>
                </div>
              ) : (
                /* Sync Discord Friend DM */
                <div className="space-y-3">
                  <div className="text-xs text-slate-400">
                    Select a Discord friend to synchronize directly into your DMs:
                  </div>

                  <div className="border border-white/10 rounded-xl overflow-hidden bg-black/30 max-h-56 overflow-y-auto divide-y divide-white/5">
                    {loadingDMs ? (
                      <div className="py-8 flex justify-center items-center gap-2 text-slate-400 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                        <span>Loading Discord DMs...</span>
                      </div>
                    ) : singleDMs.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        No Discord direct messages found.
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
                                ? 'bg-blue-600/25 border-l-4 border-cyan-400 text-white'
                                : 'hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <MessageSquare className="w-4 h-4 text-blue-400" />
                              <span className="text-sm font-medium">
                                {dm.name || `User (${dm.other_user_id || dm.id.slice(-4)})`}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
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
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                statusMessage.type === 'ok'
                  ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/60 border border-red-500/50 text-red-300'
              }`}
            >
              {statusMessage.type === 'ok' ? (
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#070b18] flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 border border-cyan-400/30 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
            <span>
              {activeTab === 'server'
                ? serverSyncMode === 'entire'
                  ? 'Clone & Sync Server'
                  : `Sync (${selectedChannelIds.size}) Channels`
                : activeTab === 'group'
                ? groupMode === 'create'
                  ? 'Create Group Chat'
                  : 'Sync Group DM'
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
