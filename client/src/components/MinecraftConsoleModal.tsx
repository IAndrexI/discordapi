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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="minecraft-console-title"
        className="w-[min(56rem,100%)] max-w-full h-[min(620px,100%)] max-h-full bg-[var(--bg-chat)] rounded-2xl flex flex-col sm:flex-row overflow-hidden shadow-2xl border border-[var(--border-subtle)] relative"
      >
        {/* Left Server Sidebar */}
        <div className="w-full sm:w-60 bg-[var(--bg-channels)] p-3 sm:p-4 border-b sm:border-b-0 sm:border-r border-[var(--border-subtle)] flex flex-col justify-between min-h-0 max-h-40 sm:max-h-none flex-shrink-0 select-none">
          <div className="flex flex-col min-h-0 flex-1 space-y-3">
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  ⛏️
                </div>
                <div>
                  <h3 id="minecraft-console-title" className="text-sm font-bold text-[var(--text-header)] leading-tight">
                    Minecraft RCON
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Remote server console</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddServer(!showAddServer)}
                aria-label="Add Minecraft server"
                className="p-1.5 rounded-lg bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-emerald-400 cursor-pointer"
                title="Add Server"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Server List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2">
                Servers ({servers.length})
              </div>
              {servers.map(srv => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => setSelectedServerId(srv.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                    srv.id === currentServer?.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{srv.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{srv.host}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-pulse flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:block mt-3 w-full py-2 bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[var(--text-normal)] rounded-lg text-xs font-semibold transition-colors cursor-pointer flex-shrink-0"
          >
            Close Terminal
          </button>
        </div>

        {/* Right Main Console View */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--bg-chat)]">
          {/* Header */}
          <div className="h-12 border-b border-[var(--border-subtle)] px-4 flex items-center justify-between bg-[var(--bg-userpanel)] flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-bold text-[var(--text-header)] text-xs truncate">{currentServer?.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex-shrink-0">
                {currentServer?.playerCount}/{currentServer?.maxPlayers} Online
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Minecraft Console"
              className="w-7 h-7 rounded-full hover:bg-[var(--bg-item-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Add Server Form Overlay */}
          {showAddServer && (
            <form onSubmit={handleAddServer} className="p-3 sm:p-4 bg-[var(--bg-popout)] border-b border-[var(--border-subtle)] space-y-3 animate-fadeIn flex-shrink-0">
              <div className="text-xs font-bold text-[var(--text-header)] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Server Connection</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Server Name (e.g. Factions)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-header)] outline-none focus:border-emerald-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Host / Domain (mc.domain.com)"
                  value={newHost}
                  onChange={e => setNewHost(e.target.value)}
                  className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-header)] outline-none focus:border-emerald-400"
                  required
                />
                <input
                  type="number"
                  placeholder="RCON Port (25575)"
                  value={newPort}
                  onChange={e => setNewPort(Number(e.target.value))}
                  className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-header)] outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  Save &amp; Connect
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddServer(false)}
                  className="px-3 py-1 rounded-lg bg-[var(--bg-userpanel)] hover:bg-[var(--bg-item-hover)] text-[var(--text-normal)] text-xs cursor-pointer border border-[var(--border-subtle)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Console Output Screen */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 font-mono text-xs space-y-1 bg-[var(--bg-popout)] text-[var(--text-normal)] select-text">
            {logs.map(log => (
              <div
                key={log.id}
                className={`leading-relaxed break-all ${
                  log.message.startsWith('>')
                    ? 'text-[var(--text-link)] font-bold'
                    : log.message.includes('ERROR')
                    ? 'text-[var(--status-dnd)]'
                    : log.message.includes('WARN')
                    ? 'text-[var(--status-idle)]'
                    : 'text-[var(--status-online)]'
                }`}
              >
                <span className="text-[var(--text-muted)] text-[10px] select-none mr-2">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Quick Command Pills */}
          <div className="px-3 py-1.5 bg-[var(--bg-channels)] border-t border-[var(--border-subtle)] flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Quick:</span>
            {QUICK_COMMANDS.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setCommandInput(q)}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-userpanel)] hover:bg-emerald-500/20 text-[var(--text-normal)] hover:text-emerald-300 border border-[var(--border-subtle)] font-mono cursor-pointer transition-colors"
              >
                /{q}
              </button>
            ))}
          </div>

          {/* Command Prompt Input */}
          <form onSubmit={handleRunCommand} className="p-2.5 sm:p-3 bg-[var(--bg-userpanel)] border-t border-[var(--border-subtle)] flex items-center gap-2 flex-shrink-0">
            <span className="text-[var(--status-online)] font-mono font-bold text-sm">{'>'}</span>
            <input
              type="text"
              aria-label="Minecraft RCON command"
              placeholder="Type server command (e.g. /say Hello, /time set day, /tps)..."
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              className="flex-1 min-w-0 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] font-mono outline-none focus:border-emerald-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={isExecuting}
              className="px-4 py-1.5 bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 flex-shrink-0"
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
