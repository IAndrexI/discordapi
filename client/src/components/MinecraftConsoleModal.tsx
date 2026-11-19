import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  Plus,
  Send,
} from 'lucide-react';
import type { MinecraftServerConfig } from '../types';
import { minecraft } from '../services/minecraft';

interface MinecraftConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MinecraftConsoleModal: React.FC<MinecraftConsoleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [servers, setServers] = useState<MinecraftServerConfig[]>(minecraft.getServers());
  const [selectedServerId, setSelectedServerId] = useState<string>(servers[0]?.id || '');
  const [commandInput, setCommandInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);

  // New server form
  const [newName, setNewName] = useState('');
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState(25575);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = minecraft.subscribe(() => {
      setServers([...minecraft.getServers()]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [servers, selectedServerId]);

  if (!isOpen) return null;

  const currentServer = servers.find(s => s.id === selectedServerId) || servers[0];
  const logs = currentServer ? minecraft.getLogs(currentServer.id) : [];

  const handleRunCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !currentServer) return;
    const cmd = commandInput.trim();
    setCommandInput('');
    setIsExecuting(true);
    try {
      await minecraft.executeCommand(currentServer.id, cmd);
    } finally {
      setIsExecuting(false);
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHost.trim()) return;
    const created = minecraft.addServer({
      name: newName.trim(),
      host: newHost.trim(),
      rconPort: newPort || 25575,
    });
    setSelectedServerId(created.id);
    setShowAddServer(false);
    setNewName('');
    setNewHost('');
  };

  const QUICK_COMMANDS = ['list', 'tps', 'time set day', 'weather clear', 'help'];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl h-[620px] bg-[var(--bg-chat)] rounded-2xl flex overflow-hidden shadow-2xl border border-emerald-500/30 relative">
        {/* Left Server Sidebar */}
        <div className="w-64 bg-[var(--bg-channels)] p-4 border-r border-black/30 flex flex-col justify-between select-none">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  ⛏️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">Minecraft RCON</h3>
                  <p className="text-[10px] text-gray-400">Server Remote Console</p>
                </div>
              </div>

              <button
                onClick={() => setShowAddServer(!showAddServer)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 cursor-pointer"
                title="Add Server"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Server List */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2">
                Connected Servers ({servers.length})
              </div>
              {servers.map(srv => (
                <button
                  key={srv.id}
                  onClick={() => setSelectedServerId(srv.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                    srv.id === currentServer?.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{srv.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">{srv.host}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Terminal
          </button>
        </div>

        {/* Right Main Console View */}
        <div className="flex-1 flex flex-col h-full bg-[#0d1117] min-w-0">
          {/* Header */}
          <div className="h-12 border-b border-white/10 px-4 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-xs">{currentServer?.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                {currentServer?.playerCount}/{currentServer?.maxPlayers} Online
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Add Server Form Overlay */}
          {showAddServer && (
            <form onSubmit={handleAddServer} className="p-4 bg-neutral-900 border-b border-emerald-500/30 space-y-3 animate-fadeIn">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Minecraft Server Connection</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Server Name (e.g. Factions)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Host / Domain (mc.domain.com)"
                  value={newHost}
                  onChange={e => setNewHost(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-400"
                  required
                />
                <input
                  type="number"
                  placeholder="RCON Port (25575)"
                  value={newPort}
                  onChange={e => setNewPort(Number(e.target.value))}
                  className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  Save & Connect
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddServer(false)}
                  className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Console Output Screen */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-black/60 text-gray-300 select-text">
            {logs.map(log => (
              <div
                key={log.id}
                className={`leading-relaxed break-all ${
                  log.message.startsWith('>')
                    ? 'text-cyan-400 font-bold'
                    : log.message.includes('ERROR')
                    ? 'text-red-400'
                    : log.message.includes('WARN')
                    ? 'text-amber-400'
                    : 'text-emerald-300/90'
                }`}
              >
                <span className="text-gray-500 text-[10px] select-none mr-2">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Quick Command Pills */}
          <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500 uppercase font-bold">Quick:</span>
            {QUICK_COMMANDS.map(q => (
              <button
                key={q}
                onClick={() => setCommandInput(q)}
                className="text-[11px] px-2 py-0.5 rounded bg-white/5 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-white/5 font-mono cursor-pointer transition-colors"
              >
                /{q}
              </button>
            ))}
          </div>

          {/* Command Prompt Input */}
          <form onSubmit={handleRunCommand} className="p-3 bg-neutral-900 border-t border-white/10 flex items-center gap-2">
            <span className="text-emerald-400 font-mono font-bold text-sm">{'>'}</span>
            <input
              type="text"
              placeholder='Type server command (e.g. /say Hello, /time set day, /tps)...'
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 font-mono outline-none focus:border-emerald-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={isExecuting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Execute</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
