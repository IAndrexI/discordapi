import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  AlertTriangle,
  ShieldAlert,
  PhoneOff,
  PhoneCall,
  Server,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  Activity,
  Info,
} from 'lucide-react';
import { voiceProxy } from '../services/voiceProxy';
import type { VoiceProxyConfig, VoiceProxySession } from '../types';

interface VoiceProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableChannels?: Array<{ id: string; name: string; type?: string; guildId?: string }>;
}

export const VoiceProxyModal: React.FC<VoiceProxyModalProps> = ({
  isOpen,
  onClose,
  availableChannels = [],
}) => {
  const [activeTab, setActiveTab] = useState<'discord' | 'stoat' | 'logs'>('discord');
  const [config, setConfig] = useState<VoiceProxyConfig>(voiceProxy.getConfig());
  const [session, setSession] = useState<VoiceProxySession>(voiceProxy.getSession());
  const [logs, setLogs] = useState<Array<{ level: 'info' | 'warn' | 'error' | 'success'; message: string; timestamp: number }>>([]);

  // Form states - Discord
  const [discordToken, setDiscordToken] = useState(config.discord.token);
  const [discordGuildId, setDiscordGuildId] = useState(config.discord.guildId);
  const [discordChannelId, setDiscordChannelId] = useState(config.discord.channelId);
  const [showToken, setShowToken] = useState(false);
  const [discordBitrate, setDiscordBitrate] = useState(config.discord.bitrate || 96000);
  const [proxyRelayUrl, setProxyRelayUrl] = useState(config.discord.proxyRelayUrl);

  // Form states - Stoat
  const [stoatServerUrl, setStoatServerUrl] = useState(config.stoat.serverUrl || 'https://vortex.revolt.chat');
  const [stoatRoomId, setStoatRoomId] = useState(config.stoat.roomId);
  const [stoatToken, setStoatToken] = useState(config.stoat.token);

  // Disclaimer agreement state
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(config.disclaimerAccepted);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubSession = voiceProxy.subscribe(s => {
      setSession(s);
      setIsConnecting(s.status === 'connecting' || s.status === 'authenticating' || s.status === 'handshaking');
    });
    const unsubLogs = voiceProxy.subscribeLogs(entry => {
      setLogs(prev => [...prev.slice(-49), entry]);
    });

    return () => {
      unsubSession();
      unsubLogs();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleDisclaimer = (checked: boolean) => {
    setDisclaimerAgreed(checked);
    if (checked) {
      voiceProxy.acceptDisclaimer();
      voiceProxy.updateConfig({ disclaimerAccepted: true, enabled: true });
    } else {
      voiceProxy.revokeDisclaimer();
    }
    setConfig(voiceProxy.getConfig());
  };

  const handleConnectDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!disclaimerAgreed) {
      setActionError('You must acknowledge and accept the Discord TOS disclaimer before using the voice proxy.');
      return;
    }

    if (!discordToken.trim()) {
      setActionError('Discord token / gateway session secret is required.');
      return;
    }

    if (!discordChannelId.trim()) {
      setActionError('Target Discord Voice Channel ID is required.');
      return;
    }

    voiceProxy.updateConfig({
      discord: {
        token: discordToken,
        guildId: discordGuildId,
        channelId: discordChannelId,
        proxyRelayUrl,
        bitrate: discordBitrate,
        autoMuteOnJoin: false,
      },
      activeProvider: 'discord_proxy',
    });

    setIsConnecting(true);
    try {
      const channelObj = availableChannels.find(c => c.id === discordChannelId);
      const channelName = channelObj ? `#${channelObj.name}` : undefined;

      const ok = await voiceProxy.connectDiscordCall({
        token: discordToken,
        guildId: discordGuildId,
        channelId: discordChannelId,
        channelName,
        proxyRelayUrl,
      });

      if (!ok) {
        setActionError('Failed to connect to Discord voice gateway. Check credentials & logs.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectStoat = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!stoatRoomId.trim()) {
      setActionError('Stoat Room / Call ID is required.');
      return;
    }

    voiceProxy.updateConfig({
      stoat: {
        serverUrl: stoatServerUrl,
        roomId: stoatRoomId,
        token: stoatToken,
        transport: 'webrtc',
      },
      activeProvider: 'stoat_hosted',
    });

    setIsConnecting(true);
    try {
      const ok = await voiceProxy.connectStoatCall({
        serverUrl: stoatServerUrl,
        roomId: stoatRoomId,
        token: stoatToken,
      });

      if (!ok) {
        setActionError('Failed to connect to Stoat voice room. Check logs.');
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await voiceProxy.disconnect();
    setActionError(null);
  };

  const isDiscordInCall = session.provider === 'discord_proxy' && session.status === 'connected';
  const isStoatInCall = session.provider === 'stoat_hosted' && session.status === 'connected';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-proxy-title"
        className="w-[min(42rem,100%)] max-w-full max-h-full bg-[var(--bg-chat)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-userpanel)] flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-channels)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--status-idle)] flex-shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 id="voice-proxy-title" className="text-base font-bold text-[var(--text-header)]">
                External Call Bridge
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Bridge voice audio to external Discord or Stoat / Revolt rooms.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close External Call Bridge"
            className="w-8 h-8 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOS & Security Warning Banner */}
        <div className="p-3.5 sm:p-4 bg-amber-500/10 border-b border-amber-500/25 flex-shrink-0">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[var(--status-idle)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1.5">
              <div className="font-bold text-[var(--status-idle)]">
                External Bridge Notice
              </div>
              <p className="text-[var(--text-normal)] leading-relaxed">
                Bridging external voice gateways runs outside official client software; use at your own discretion.
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="disclaimer-checkbox"
                  checked={disclaimerAgreed}
                  onChange={e => handleToggleDisclaimer(e.target.checked)}
                  className="rounded border-[var(--border-subtle)] text-amber-500 focus:ring-amber-400 cursor-pointer"
                />
                <label
                  htmlFor="disclaimer-checkbox"
                  className="text-[var(--text-header)] font-semibold cursor-pointer select-none"
                >
                  Enable external voice bridge
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Status Callout if currently connected */}
        {session.status === 'connected' && (
          <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between text-xs text-[var(--text-header)] flex-shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] animate-ping flex-shrink-0" />
              <span className="font-bold text-[var(--status-online)]">
                Active ({session.provider === 'discord_proxy' ? 'Bridge' : 'Stoat'}):
              </span>
              <span className="text-[var(--text-normal)] font-mono truncate">{session.targetName}</span>
              <span className="bg-emerald-500/20 text-[var(--status-online)] px-1.5 py-0.2 rounded font-mono text-[10px]">
                {session.ping}ms RTC
              </span>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[var(--border-subtle)] px-4 bg-[var(--bg-channels)] text-xs flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('discord')}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'discord'
                ? 'border-[var(--discord-blurple)] text-[var(--text-header)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-header)]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Bridge</span>
            {isDiscordInCall && (
              <span className="w-2 h-2 rounded-full bg-[var(--status-online)]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stoat')}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'stoat'
                ? 'border-[var(--discord-blurple)] text-[var(--text-header)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-header)]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Stoat / Revolt</span>
            {isStoatInCall && (
              <span className="w-2 h-2 rounded-full bg-[var(--status-online)]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`py-2.5 px-3 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ml-auto ${
              activeTab === 'logs'
                ? 'border-[var(--discord-blurple)] text-[var(--text-header)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-header)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs ({logs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
          {actionError && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/35 text-[var(--status-dnd)] text-xs flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* TAB 1: BRIDGE */}
          {activeTab === 'discord' && (
            <form onSubmit={handleConnectDiscord} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-xs font-bold text-[var(--text-header)] flex items-center justify-between">
                  <span>Voice Gateway Bridge</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">48kHz Opus</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Streams local Opus audio to an external voice gateway channel.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Bridge Token <span className="text-[var(--status-idle)]">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={discordToken}
                    onChange={e => setDiscordToken(e.target.value)}
                    placeholder="Enter token or voice session secret"
                    disabled={!disclaimerAgreed}
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-10 py-2.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    aria-label={showToken ? 'Hide token' : 'Show token'}
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Stored locally in your browser session only.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Server ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={discordGuildId}
                    onChange={e => setDiscordGuildId(e.target.value)}
                    placeholder="e.g. 1029384756..."
                    disabled={!disclaimerAgreed}
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] transition-colors disabled:opacity-50 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Voice Channel ID <span className="text-[var(--status-idle)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={discordChannelId}
                    onChange={e => setDiscordChannelId(e.target.value)}
                    placeholder="e.g. 987654321..."
                    disabled={!disclaimerAgreed}
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] transition-colors disabled:opacity-50 font-mono"
                  />
                </div>
              </div>

              {/* Channel helper presets if bridged channels exist */}
              {availableChannels.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] block mb-1">
                    Synced Channels:
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {availableChannels.slice(0, 5).map(ch => (
                      <button
                        type="button"
                        key={ch.id}
                        onClick={() => {
                          setDiscordChannelId(ch.id);
                          if (ch.guildId) setDiscordGuildId(ch.guildId);
                        }}
                        className="px-2.5 py-1 rounded bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] border border-[var(--border-subtle)] text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        #{ch.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Audio Bitrate
                  </label>
                  <select
                    value={discordBitrate}
                    onChange={e => setDiscordBitrate(Number(e.target.value))}
                    disabled={!disclaimerAgreed}
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] disabled:opacity-50"
                  >
                    <option value={64000}>64 kbps (Eco)</option>
                    <option value={96000}>96 kbps (Standard)</option>
                    <option value={128000}>128 kbps (Studio 48kHz)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Relay Endpoint
                  </label>
                  <input
                    type="text"
                    value={proxyRelayUrl}
                    onChange={e => setProxyRelayUrl(e.target.value)}
                    disabled={!disclaimerAgreed}
                    placeholder="https://chat.protutech.vip/api/voice-proxy/discord"
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] disabled:opacity-50 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[var(--text-link)]" />
                  <span>WebRTC RTP &amp; Opus</span>
                </div>

                <div className="flex items-center gap-2">
                  {isDiscordInCall && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/35 text-[var(--status-dnd)] border border-red-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={!disclaimerAgreed || isConnecting}
                    className="px-5 py-2.5 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isConnecting ? 'Connecting...' : isDiscordInCall ? 'Reconnect Call' : 'Connect Bridge'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: STOAT / REVOLT */}
          {activeTab === 'stoat' && (
            <form onSubmit={handleConnectStoat} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-xs font-bold text-[var(--text-link)] flex items-center justify-between">
                  <span>Stoat / Revolt Voice Node</span>
                  <span className="text-[10px] font-mono">WebRTC SFU</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Connect to public Revolt/Vortex voice nodes or self-hosted Stoat instances.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Server URL <span className="text-[var(--text-link)]">*</span>
                </label>
                <div className="relative">
                  <Server className="w-4 h-4 text-[var(--text-link)] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={stoatServerUrl}
                    onChange={e => setStoatServerUrl(e.target.value)}
                    placeholder="https://vortex.revolt.chat"
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-3 py-2.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] transition-colors font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Room ID <span className="text-[var(--text-link)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={stoatRoomId}
                    onChange={e => setStoatRoomId(e.target.value)}
                    placeholder="e.g. room-alpha"
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] transition-colors font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Access Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={stoatToken}
                    onChange={e => setStoatToken(e.target.value)}
                    placeholder="Participant Token"
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)] transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-[var(--text-link)]" />
                  <span>Low-latency WebRTC transport</span>
                </div>

                <div className="flex items-center gap-2">
                  {isStoatInCall && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/35 text-[var(--status-dnd)] border border-red-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Leave Room</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="px-5 py-2.5 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isConnecting ? 'Connecting...' : isStoatInCall ? 'Reconnect Stoat' : 'Connect Stoat'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-header)] font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[var(--text-link)]" />
                  <span>Signaling &amp; Gateway Logs</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-[var(--text-muted)] hover:text-[var(--text-header)] text-[11px] hover:underline cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              <div className="p-3 bg-[var(--bg-popout)] rounded-xl border border-[var(--border-subtle)] font-mono text-[11px] h-56 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <div className="text-[var(--text-muted)] italic py-6 text-center">
                    No gateway traffic yet.
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={`leading-relaxed ${
                        log.level === 'error'
                          ? 'text-[var(--status-dnd)]'
                          : log.level === 'warn'
                          ? 'text-[var(--status-idle)]'
                          : log.level === 'success'
                          ? 'text-[var(--status-online)]'
                          : 'text-[var(--text-link)]'
                      }`}
                    >
                      <span className="text-[var(--text-muted)]">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{' '}
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
