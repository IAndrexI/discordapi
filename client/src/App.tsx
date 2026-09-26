import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { ServerRail } from './components/ServerRail';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { VoicePanel } from './components/VoicePanel';
import { UserBar } from './components/UserBar';
import { VoiceStage } from './components/VoiceStage';
import { MemberList } from './components/MemberList';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';
import { AddConversationModal, type AddModalTab } from './components/AddConversationModal';
import { useAutoUpdater } from './hooks/useAutoUpdater';

import { matrix } from './services/matrix';
import { livekit } from './services/livekit';
import type { MatrixRoom, DiscordGuild, MatrixMessage, VoiceParticipant } from './types';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(matrix.isAuthenticated());
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [activeGuildId, setActiveGuildId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MatrixMessage[]>([]);

  // Voice state
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [rtcPing, setRtcPing] = useState<number>(24);
  const [activeVoiceRoom, setActiveVoiceRoom] = useState<string | null>(null);

  // UI toggles & Modals
  const [showMemberList, setShowMemberList] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState<AddModalTab>('server');

  // Real-time live auto-update sentinel
  const { updateAvailable, newVersion } = useAutoUpdater();

  // Native Electron Shortcuts Listener
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubMute = window.electronAPI.onToggleMute?.(() => {
      // Toggle mute
      livekit.setMute(!livekit.isMuted);
    });
    const unsubDeafen = window.electronAPI.onToggleDeafen?.(() => {
      livekit.setDeafened(!livekit.isDeafened);
    });
    const unsubVoice = window.electronAPI.onJoinVoice?.((roomName: string) => {
      const userId = matrix.getUserId() || '@andrex:chat.protutech.vip';
      const displayName = userId.split(':')[0].replace('@', '');
      livekit.joinVoice(roomName, userId, displayName);
      setActiveVoiceRoom(roomName);
    });

    return () => {
      unsubMute?.();
      unsubDeafen?.();
      unsubVoice?.();
    };
  }, []);

  const loadData = async (targetId?: string) => {
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
    } else if (data.rooms.length > 0 && !activeRoomId) {
      setActiveRoomId(data.rooms[0].id);
    }
  };

  // Initialize data on auth
  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();

    // Subscribe to incoming messages
    const unsubscribeMessages = matrix.onMessage((rId, newMsg) => {
      setMessages(prev => (rId === activeRoomId ? [...prev, newMsg] : prev));
    });

    // Subscribe to LiveKit voice state
    const unsubscribeVoice = livekit.subscribe((participants, ping) => {
      setVoiceParticipants(participants);
      setRtcPing(ping);
      setActiveVoiceRoom(livekit.getActiveRoom());
    });

    return () => {
      unsubscribeMessages();
      unsubscribeVoice();
    };
  }, [isAuthenticated, activeRoomId]);

  // Load messages when active room changes
  useEffect(() => {
    if (!activeRoomId || !isAuthenticated) return;

    const fetchMsgs = async () => {
      const list = await matrix.fetchMessages(activeRoomId);
      setMessages(list);
    };

    fetchMsgs();
  }, [activeRoomId, isAuthenticated]);

  const handleLogin = async (u: string, p: string) => {
    const success = await matrix.login(u, p);
    if (success) {
      setIsAuthenticated(true);
    }
    return success;
  };

  const handleLogout = () => {
    livekit.leaveVoice();
    matrix.logout();
    setIsAuthenticated(false);
    setRooms([]);
    setGuilds([]);
    setActiveRoomId(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeRoomId) return;
    const sent = await matrix.sendMessage(activeRoomId, text);
    if (sent) {
      setMessages(prev => [...prev, sent]);
    }
  };

  const handleJoinVoice = async (room: MatrixRoom) => {
    const userId = matrix.getUserId() || '@andrex:chat.protutech.vip';
    const displayName = userId.split(':')[0].replace('@', '');
    await livekit.joinVoice(room.name, userId, displayName);
    setActiveVoiceRoom(room.name);
  };

  const handleDisconnectVoice = async () => {
    await livekit.leaveVoice();
    setActiveVoiceRoom(null);
  };

  const handleOpenAddModal = (tab: AddModalTab = 'server') => {
    setAddModalTab(tab);
    setIsAddModalOpen(true);
  };

  const handleOpenSyncLater = (room: MatrixRoom) => {
    if (room.isGroupChat) {
      setAddModalTab('group');
    } else if (room.isDirect) {
      setAddModalTab('dm');
    } else {
      setAddModalTab('server');
    }
    setIsAddModalOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d16]">
        <TitleBar />
        <div className="flex-1 overflow-auto">
          <LoginModal onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  const activeGuild = activeGuildId ? guilds.find(g => g.id === activeGuildId) || null : null;
  const currentRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || {
    id: 'placeholder',
    name: 'general',
    isDirect: false,
    isGroupChat: false,
    members: [],
  };

  const isCurrentRoomVoice = activeVoiceRoom !== null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-chat)] relative">
      <TitleBar />
      <div className="flex flex-1 w-full h-[calc(100%-30px)] overflow-hidden">
        {/* 1. Left Guild Rail */}
        <ServerRail
          guilds={guilds}
          activeGuildId={activeGuildId}
          onSelectGuild={id => {
            setActiveGuildId(id);
            if (id === null) {
              const firstDM = rooms.find(r => r.isDirect);
              if (firstDM) setActiveRoomId(firstDM.id);
            } else {
              const guild = guilds.find(g => g.id === id);
              if (guild && guild.channels.length > 0) {
                setActiveRoomId(guild.channels[0].id);
              }
            }
          }}
          onOpenAddModal={() => handleOpenAddModal('server')}
        />

        {/* 2. Channel & DM Sidebar */}
        <div className="flex flex-col h-full flex-shrink-0 z-10">
          <ChannelSidebar
            activeGuild={activeGuild}
            rooms={rooms}
            activeRoomId={activeRoomId}
            onSelectRoom={id => setActiveRoomId(id)}
            onJoinVoice={handleJoinVoice}
            activeVoiceRoomId={activeVoiceRoom}
            onOpenAddModal={handleOpenAddModal}
          />

          {/* Bottom Voice Panel (if connected) */}
          {activeVoiceRoom && (
            <VoicePanel
              roomName={activeVoiceRoom}
              rtcPing={rtcPing}
              onDisconnect={handleDisconnectVoice}
            />
          )}

          {/* Bottom User Controls Bar */}
          <UserBar
            userId={matrix.getUserId() || '@andrex:chat.protutech.vip'}
            displayName={matrix.getUserId()?.split(':')[0].replace('@', '') || 'andrex'}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* 3. Main Chat & Voice Stage Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          {/* Voice Stage when in a voice call */}
          {isCurrentRoomVoice && (
            <VoiceStage
              participants={voiceParticipants}
              roomName={activeVoiceRoom || 'Voice Channel'}
            />
          )}

          {/* Chat Area */}
          <ChatArea
            room={currentRoom}
            messages={messages}
            onSendMessage={handleSendMessage}
            onJoinVoice={handleJoinVoice}
            isVoiceActive={isCurrentRoomVoice}
            onToggleMemberList={() => setShowMemberList(!showMemberList)}
            showMemberList={showMemberList}
            onOpenSyncLater={handleOpenSyncLater}
          />
        </div>

        {/* 4. Right Member Sidebar */}
        {showMemberList && (
          <MemberList members={currentRoom.members} />
        )}

        {/* Settings & Vencord Customization Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          userId={matrix.getUserId() || '@andrex:chat.protutech.vip'}
          onLogout={handleLogout}
        />

        {/* Add / Sync Conversation Modal */}
        <AddConversationModal
          isOpen={isAddModalOpen}
          initialTab={addModalTab}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={targetId => {
            loadData(targetId);
          }}
        />
      </div>

      {/* Real-time live auto-update toast banner */}
      {updateAvailable && (
        <div className="fixed bottom-5 right-5 z-[999999] bg-[#0c132c] border border-cyan-400/80 shadow-2xl rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="text-xs text-white">
            <span className="font-bold text-cyan-300 block">Protutech Update Live</span>
            <span>Version {newVersion || 'latest'} deployed. Refreshing app...</span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-md transition-all cursor-pointer"
          >
            Reload Now
          </button>
        </div>
      )}
    </div>
  );
};

export default App;

