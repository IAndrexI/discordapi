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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#1e222d] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">External Voice Call Proxy &amp; Gateway</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase tracking-wider">
                  Optional Tool
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Connect your audio stream to Discord Voice calls or open-source Stoat-hosted instances.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOS & Security Warning Banner */}
        <div className="p-4 bg-amber-950/40 border-b border-amber-500/30">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1.5">
              <div className="font-bold text-amber-300 flex items-center gap-2">
                <span>THIRD-PARTY VOICE GATEWAY DISCLAIMER &amp; WARNING</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Operating as a third-party proxy to connect directly into <b>Discord Voice servers</b> runs outside the official client. Discord's Terms of Service restrict non-official client voice gateways. Connecting your account may trigger security challenges or risk account standing.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="disclaimer-checkbox"
                  checked={disclaimerAgreed}
                  onChange={e => handleToggleDisclaimer(e.target.checked)}
                  className="rounded border-gray-600 text-amber-500 focus:ring-amber-400 cursor-pointer"
                />
                <label
                  htmlFor="disclaimer-checkbox"
                  className="text-amber-200 font-semibold cursor-pointer select-none"
                >
                  I understand and accept the risks. Enable the external voice proxy tool.
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Status Callout if currently connected */}
        {session.status === 'connected' && (
          <div className="p-3 bg-emerald-950/50 border-b border-emerald-500/30 flex items-center justify-between text-xs text-white">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-emerald-300">
                Active Call ({session.provider === 'discord_proxy' ? 'Discord Proxy' : 'Stoat Hosted'}):
              </span>
              <span className="text-gray-300 font-mono">{session.targetName}</span>
              <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono text-[10px]">
                {session.ping}ms RTC
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Leave Call</span>
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/10 px-4 bg-black/20 text-xs">
          <button
            onClick={() => setActiveTab('discord')}
            className={`py-3 px-3 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'discord'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Discord Call Proxy</span>
            {isDiscordInCall && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('stoat')}
            className={`py-3 px-3 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'stoat'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Stoat-Hosted Calls (Revolt/Vortex)</span>
            {isStoatInCall && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-3 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ml-auto ${
              activeTab === 'logs'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Gateway Diagnostics ({logs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {actionError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* TAB 1: DISCORD CALL PROXY */}
          {activeTab === 'discord' && (
            <form onSubmit={handleConnectDiscord} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                <div className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>Discord Gateway Proxy Configuration</span>
                  <span className="text-[10px] text-gray-500 font-mono">Client-Side Sandbox</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Acts as a voice proxy between your local client and Discord's voice servers. Audio is encoded locally in 48kHz Opus and transmitted via the gateway.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                  Discord User / Voice Token <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={discordToken}
                    onChange={e => setDiscordToken(e.target.value)}
                    placeholder="Enter your Discord user token or voice session secret"
                    disabled={!disclaimerAgreed}
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-10 py-2.5 text-xs text-white outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  🔒 Kept strictly in your local browser sandbox; never logged or saved to the Matrix homeserver.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Guild / Server ID (Optional for DMs)
                  </label>
                  <input
                    type="text"
                    value={discordGuildId}
                    onChange={e => setDiscordGuildId(e.target.value)}
                    placeholder="e.g. 1029384756..."
                    disabled={!disclaimerAgreed}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 transition-colors disabled:opacity-50 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Target Voice Channel ID <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={discordChannelId}
                    onChange={e => setDiscordChannelId(e.target.value)}
                    placeholder="e.g. 987654321..."
                    disabled={!disclaimerAgreed}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 transition-colors disabled:opacity-50 font-mono"
                  />
                </div>
              </div>

              {/* Channel helper presets if bridged channels exist */}
              {availableChannels.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">
                    Quick-Select From Synced Channels:
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
                        className="px-2.5 py-1 rounded bg-black/40 hover:bg-white/10 text-gray-300 border border-white/10 text-[11px] whitespace-nowrap cursor-pointer"
                      >
                        #{ch.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Audio Bitrate
                  </label>
                  <select
                    value={discordBitrate}
                    onChange={e => setDiscordBitrate(Number(e.target.value))}
                    disabled={!disclaimerAgreed}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 disabled:opacity-50"
                  >
                    <option value={64000}>64 kbps (Eco / Gaming)</option>
                    <option value={96000}>96 kbps (Standard Discord)</option>
                    <option value={128000}>128 kbps (Nitro Studio 48kHz)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Proxy Relay Endpoint
                  </label>
                  <input
                    type="text"
                    value={proxyRelayUrl}
                    onChange={e => setProxyRelayUrl(e.target.value)}
                    disabled={!disclaimerAgreed}
                    placeholder="https://chat.protutech.vip/api/voice-proxy/discord"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400 disabled:opacity-50 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>Uses WebRTC RTP &amp; Opus encoding.</span>
                </div>

                <div className="flex items-center gap-2">
                  {isDiscordInCall && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-4 py-2 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={!disclaimerAgreed || isConnecting}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isConnecting ? 'Connecting Proxy...' : isDiscordInCall ? 'Reconnect Discord Call' : 'Connect via Discord Proxy'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: STOAT-HOSTED CALLS */}
          {activeTab === 'stoat' && (
            <form onSubmit={handleConnectStoat} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-2">
                <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                  <span>Open-Source Stoat Voice Node (Revolt / Vortex)</span>
                  <span className="text-[10px] text-cyan-400 font-mono">WebRTC SFU</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Stoat is an open-source decentralized voice server utilizing WebRTC SFU technology. Connect to Revolt voice instances, community Stoat nodes, or your own self-hosted Stoat instance.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                  Stoat Voice Server URL <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <Server className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={stoatServerUrl}
                    onChange={e => setStoatServerUrl(e.target.value)}
                    placeholder="https://vortex.revolt.chat or https://stoat.yourserver.com"
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-cyan-400 transition-colors font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Enter the WebSocket or HTTP URL of the Stoat / Vortex voice gateway instance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Channel / Room ID <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={stoatRoomId}
                    onChange={e => setStoatRoomId(e.target.value)}
                    placeholder="e.g. 01G8Z... or room-alpha"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 transition-colors font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
                    Access Token (Optional for public rooms)
                  </label>
                  <input
                    type="password"
                    value={stoatToken}
                    onChange={e => setStoatToken(e.target.value)}
                    placeholder="Participant Token"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sub-30ms low-latency WebRTC peer transport.</span>
                </div>

                <div className="flex items-center gap-2">
                  {isStoatInCall && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-4 py-2 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Leave Room</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isConnecting ? 'Connecting Stoat...' : isStoatInCall ? 'Reconnect Stoat Call' : 'Connect to Stoat Call'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: LIVE GATEWAY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span>Live Signaling &amp; Gateway Packet Console</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-gray-400 hover:text-white text-[11px] hover:underline cursor-pointer"
                >
                  Clear Console
                </button>
              </div>

              <div className="p-3 bg-black/60 rounded-xl border border-white/10 font-mono text-[11px] h-60 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <div className="text-gray-500 italic py-6 text-center">
                    No gateway traffic yet. Initiate a connection to inspect signaling frames.
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={`leading-relaxed ${
                        log.level === 'error'
                          ? 'text-red-400'
                          : log.level === 'warn'
                          ? 'text-amber-400'
                          : log.level === 'success'
                          ? 'text-emerald-400'
                          : 'text-cyan-300'
                      }`}
                    >
                      <span className="text-gray-500">
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
