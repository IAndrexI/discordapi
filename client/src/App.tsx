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

  // UI toggles
  const [showMemberList, setShowMemberList] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  // Initialize data on auth
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      const data = await matrix.loadInitialRooms();
      setRooms(data.rooms);
      setGuilds(data.guilds);

      // Select first room if available
      if (data.rooms.length > 0 && !activeRoomId) {
        setActiveRoomId(data.rooms[0].id);
      }
    };

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-chat)]">
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
      </div>
    </div>
  );
};

export default App;
