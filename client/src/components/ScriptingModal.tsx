import React, { useState, useEffect } from 'react';
import {
  X,
  Terminal,
  Play,
  Plus,
  Copy,
  Check,
  Trash2,
  Code,
  Webhook,
  Pickaxe,
  Sparkles,
  Power,
  Send,
  Pencil,
  Save,
} from 'lucide-react';
import type { MatrixMessage, ScriptPlugin, WebhookConfig } from '../types';
import { scriptEngine } from '../services/scriptEngine';

export interface ScriptingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomId: string | null;
  activeRoomName?: string;
  onMessageInjected?: (msg: MatrixMessage) => void;
}

type ModalTab = 'scripts' | 'editor' | 'webhooks';

export const ScriptingModal: React.FC<ScriptingModalProps> = ({
  isOpen,
  onClose,
  activeRoomId,
  activeRoomName,
  onMessageInjected,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('scripts');
  const [scripts, setScripts] = useState<ScriptPlugin[]>(() => scriptEngine.getScripts());
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(() => scriptEngine.getWebhooks());

  // Minecraft Simulation State
  const [mcPlayer, setMcPlayer] = useState('Steve');
  const [mcServer, setMcServer] = useState('Survival SMP (1.21)');
  const [mcMessage, setMcMessage] = useState('Found ancient debris at Y=15! Bridge is live!');
  const [mcEventType, setMcEventType] = useState<'chat' | 'join' | 'leave' | 'advancement'>('chat');
  const [mcStatus, setMcStatus] = useState<string | null>(null);
  const [isSimulatingMc, setIsSimulatingMc] = useState(false);

  // Script Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftTrigger, setDraftTrigger] = useState<ScriptPlugin['trigger']>('onMessage');
  const [draftCode, setDraftCode] = useState(
    `function onMessage(msg, ctx) {\n  if ((msg.body || '').includes('!ping')) {\n    ctx.reply('⚡ Pong from custom script!');\n  }\n}\n\nfunction onCommand(cmd, args, ctx) {\n  if (cmd === 'hi') {\n    ctx.reply('👋 Hello ' + ctx.senderName + '!');\n    return true;\n  }\n  return false;\n}`
  );
  const [testInput, setTestInput] = useState('!hello');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Webhooks & Live Payload Tester State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newWhName, setNewWhName] = useState('');
  const [newWhType, setNewWhType] = useState<'discord' | 'minecraft' | 'custom'>('discord');
  const [selectedWhId, setSelectedWhId] = useState<string>(webhooks[0]?.id || 'wh_minecraft_bridge');
  const [snippetLang, setSnippetLang] = useState<'curl' | 'node' | 'discordsrv'>('curl');
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(
      {
        username: 'Minecraft Bridge',
        content: '⛏️ [Survival SMP] <Alex> Anyone up for the End Dragon fight?',
      },
      null,
      2
    )
  );
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsub = scriptEngine.subscribe(() => {
      setScripts(scriptEngine.getScripts());
      setWebhooks(scriptEngine.getWebhooks());
    });
    if (isOpen) {
      void scriptEngine.fetchWebhooksFromServer();
    }
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const targetRoomId = activeRoomId || 'general';
  const targetRoomLabel = activeRoomName || targetRoomId;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleSimulateMinecraft = async () => {
    setIsSimulatingMc(true);
    setMcStatus(null);
    try {
      const res = await scriptEngine.simulateMinecraftChatEvent({
        roomId: targetRoomId,
        roomName: targetRoomLabel,
        player: mcPlayer,
        server: mcServer,
        message: mcMessage,
        eventType: mcEventType,
        onInjected: onMessageInjected,
      });
      setMcStatus(
        `Injected into #${targetRoomLabel} (${res.backendSynced ? 'Server API + Chat UI' : 'Local Chat UI'})`
      );
    } finally {
      setIsSimulatingMc(false);
    }
  };

  const handleEditScript = (script: ScriptPlugin) => {
    setEditingId(script.id);
    setDraftName(script.name);
    setDraftDesc(script.description);
    setDraftTrigger(script.trigger);
    setDraftCode(script.code);
    setTestOutput(null);
    setTestError(null);
    setActiveTab('editor');
  };

  const handleNewScript = () => {
    setEditingId(null);
    setDraftName('My Custom Script');
    setDraftDesc('Responds to custom keywords or slash commands.');
    setDraftTrigger('onMessage');
    setDraftCode(
      `function onMessage(msg, ctx) {\n  if ((msg.body || '').toLowerCase().includes('!gg')) {\n    ctx.reply(\`🏆 GG \${msg.senderName}!\`);\n  }\n}\n\nfunction onCommand(cmd, args, ctx) {\n  if (cmd === 'custom') {\n    ctx.reply('✨ Custom command executed: ' + args.join(' '));\n    return true;\n  }\n  return false;\n}`
    );
    setTestOutput(null);
    setTestError(null);
    setActiveTab('editor');
  };

  const handleSaveScript = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      scriptEngine.updateScript(editingId, {
        name: draftName.trim() || 'Untitled Script',
        description: draftDesc.trim(),
        trigger: draftTrigger,
        code: draftCode,
      });
    } else {
      const created = scriptEngine.addScript({
        name: draftName.trim() || 'Custom Script',
        description: draftDesc.trim(),
        trigger: draftTrigger,
        code: draftCode,
        enabled: true,
      });
      setEditingId(created.id);
    }
    setTestOutput('Script saved & activated!');
    setTestError(null);
  };

  const handleRunEditorTest = async () => {
    setTestOutput(null);
    setTestError(null);
    const res = await scriptEngine.runCustomScriptTest(
      draftCode,
      targetRoomId,
      targetRoomLabel,
      testInput,
      onMessageInjected
    );
    if (res.ok) {
      setTestOutput(res.output);
    } else {
      setTestError(res.error || 'Execution failed');
    }
  };

  const handleRunBuiltInTest = async (script: ScriptPlugin) => {
    if (script.id === 'mc_chat_discord_bridge') {
      await handleSimulateMinecraft();
      return;
    }
    if (script.id === 'chat_slash_commands') {
      const res = await scriptEngine.executeSlashCommand(
        '/ping',
        targetRoomId,
        targetRoomLabel,
        'andrex',
        onMessageInjected
      );
      setMcStatus(res.output || 'Executed /ping in channel.');
      return;
    }
    const res = await scriptEngine.runCustomScriptTest(
      script.code,
      targetRoomId,
      targetRoomLabel,
      '!hello',
      onMessageInjected
    );
    setMcStatus(res.ok ? res.output : `Error: ${res.error}`);
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim()) return;
    const created = await scriptEngine.createWebhook({
      name: newWhName.trim(),
      channelId: targetRoomId,
      channelName: targetRoomLabel,
      bridgeType: newWhType,
    });
    setSelectedWhId(created.id);
    setNewWhName('');
  };

  const selectedWebhook = webhooks.find(w => w.id === selectedWhId) || webhooks[0];
  const fullWebhookUrl = selectedWebhook
    ? scriptEngine.getFullWebhookUrl(selectedWebhook)
    : 'http://localhost:4173/api/webhooks/wh_minecraft_bridge/pt_mc_bridge_v1';

  const handleTestWebhook = async () => {
    if (!selectedWebhook) return;
    setWebhookTestStatus(null);
    try {
      const parsed = JSON.parse(payloadText) as Record<string, unknown>;
      const res = await scriptEngine.sendWebhookTestPayload({
        webhook: selectedWebhook,
        roomId: targetRoomId,
        payload: parsed,
        onInjected: onMessageInjected,
      });
      setWebhookTestStatus(
        `Delivered to #${targetRoomLabel} (HTTP ${res.status}) — check chat!`
      );
    } catch (err) {
      setWebhookTestStatus(
        `Invalid JSON payload: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const snippetText =
    snippetLang === 'curl'
      ? `curl -X POST "${fullWebhookUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"Minecraft Bridge","content":"⛏️ [SMP] <Steve> Hello from Minecraft!"}'`
      : snippetLang === 'node'
      ? `await fetch("${fullWebhookUrl}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    username: "Protutech Bridge",\n    content: "🚀 Live event from Node.js script!",\n    roomId: "${targetRoomId}"\n  })\n});`
      : `# DiscordSRV config.yml — Drop-in Discord Webhook Compatible!\nDiscordChatChannelWebhookUrl: "${fullWebhookUrl}"\n# Or POST directly to /api/scripts/ingest:\n# { "roomId": "${targetRoomId}", "server": "Survival SMP", "player": "Steve", "message": "Joined!" }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl bg-[var(--bg-chat)] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-white/10 max-h-[88vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[var(--bg-userpanel)] gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white shadow-lg">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Scripts, Webhooks &amp; Minecraft Chat Bridge API</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  #{targetRoomLabel}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Run custom JS hooks, slash commands (/ping, /roll, /mc, /poll), and Discord-compatible Minecraft webhooks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateMinecraft}
              disabled={isSimulatingMc}
              data-testid="simulate-mc-event-btn"
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
            >
              <Pickaxe className="w-3.5 h-3.5" />
              <span>{isSimulatingMc ? 'Sending...' : 'Test / Simulate Minecraft Chat Event'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 bg-[var(--bg-channels)] border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('scripts')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'scripts'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Installed Scripts ({scripts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'editor'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-emerald-400" />
              <span>Custom Script Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('webhooks')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'webhooks'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Webhook className="w-3.5 h-3.5 text-amber-400" />
              <span>API &amp; Webhook Bridge Endpoints</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewScript}
            className="mb-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>New Custom Script</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {mcStatus && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between gap-2">
              <span className="font-medium">{mcStatus}</span>
              <button
                type="button"
                onClick={() => setMcStatus(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'scripts' && (
            <>
              {/* Quick Minecraft Event Simulator Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900/80 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Pickaxe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Minecraft Chat &lt;-&gt; App Bridge Quick Simulator
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                    POST /api/scripts/ingest
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={mcServer}
                    onChange={e => setMcServer(e.target.value)}
                    placeholder="Server Name"
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                  />
                  <input
                    type="text"
                    value={mcPlayer}
                    onChange={e => setMcPlayer(e.target.value)}
                    placeholder="Player Name"
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                  />
                  <select
                    value={mcEventType}
                    onChange={e => setMcEventType(e.target.value as typeof mcEventType)}
                    className="bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                  >
                    <option value="chat">Player Chat</option>
                    <option value="join">Player Join</option>
                    <option value="leave">Player Leave</option>
                    <option value="advancement">Advancement</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSimulateMinecraft}
                    disabled={isSimulatingMc}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Simulate MC Chat</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={mcMessage}
                  onChange={e => setMcMessage(e.target.value)}
                  placeholder="Minecraft chat message text..."
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                />
              </div>

              {/* Installed Scripts Cards */}
              <div className="space-y-3">
                {scripts.map(script => (
                  <div
                    key={script.id}
                    className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{script.name}</span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {script.trigger}
                        </span>
                        {script.builtin && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Pre-Installed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{script.description}</p>
                      {script.lastOutput && (
                        <div className="text-[11px] font-mono text-emerald-300/90 bg-black/30 px-2 py-1 rounded truncate">
                          Last output: {script.lastOutput}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRunBuiltInTest(script)}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Run Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditScript(script)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => scriptEngine.toggleScript(script.id, !script.enabled)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer border ${
                          script.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-white/5 text-gray-400 border-white/10'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{script.enabled ? 'Enabled' : 'Disabled'}</span>
                      </button>

                      {!script.builtin && (
                        <button
                          type="button"
                          onClick={() => scriptEngine.deleteScript(script.id)}
                          title="Delete Custom Script"
                          className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'editor' && (
            <form onSubmit={handleSaveScript} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                    Script Name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="My Custom Automation Hook"
                    className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                    Trigger Hook
                  </label>
                  <select
                    value={draftTrigger}
                    onChange={e => setDraftTrigger(e.target.value as ScriptPlugin['trigger'])}
                    className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="onMessage">onMessage(msg, ctx)</option>
                    <option value="onCommand">onCommand(cmd, args, ctx)</option>
                    <option value="minecraft">Minecraft Bridge</option>
                    <option value="webhook">Webhook Filter</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={draftDesc}
                  onChange={e => setDraftDesc(e.target.value)}
                  placeholder="Describe what your script hook automates..."
                  className="w-full bg-[var(--bg-userpanel)] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                  JavaScript Hook Code
                </label>
                <textarea
                  rows={10}
                  value={draftCode}
                  onChange={e => setDraftCode(e.target.value)}
                  spellCheck={false}
                  className="w-full bg-[#0d1117] border border-white/15 rounded-lg p-3 text-xs font-mono text-cyan-200 outline-none focus:border-cyan-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  placeholder="Sample message or /command (e.g. !hello or /echo hi)"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleRunEditorTest}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Test Script Live</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Save Changes' : 'Save & Enable Script'}</span>
                </button>
              </div>

              {testOutput && (
                <pre className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs font-mono whitespace-pre-wrap">
                  {testOutput}
                </pre>
              )}
              {testError && (
                <pre className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-xs font-mono whitespace-pre-wrap">
                  {testError}
                </pre>
              )}
            </form>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              {/* Create New Webhook */}
              <form
                onSubmit={handleCreateWebhook}
                className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <input
                  type="text"
                  value={newWhName}
                  onChange={e => setNewWhName(e.target.value)}
                  placeholder="New Webhook Name (e.g. Creative Plot Server)"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
                <select
                  value={newWhType}
                  onChange={e => setNewWhType(e.target.value as typeof newWhType)}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="discord">Discord-Compatible Webhook</option>
                  <option value="minecraft">Minecraft Bridge Webhook</option>
                  <option value="custom">Custom JSON Webhook</option>
                </select>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Endpoint</span>
                </button>
              </form>

              {/* Webhook Endpoints List */}
              <div className="space-y-2">
                {webhooks.map(wh => {
                  const fullUrl = scriptEngine.getFullWebhookUrl(wh);
                  const isSelected = selectedWebhook?.id === wh.id;
                  return (
                    <div
                      key={wh.id}
                      onClick={() => setSelectedWhId(wh.id)}
                      className={`p-3 rounded-xl border transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-cyan-950/35 border-cyan-500/40'
                          : 'bg-[var(--bg-userpanel)] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{wh.name}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {wh.bridgeType}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-cyan-300 truncate mt-1">
                          {fullUrl}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            void handleCopy(wh.id, fullUrl);
                          }}
                          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === wh.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === wh.id ? 'Copied' : 'Copy URL'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Integration Snippets */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Integration Code Snippets
                  </span>
                  <div className="flex items-center gap-1">
                    {(['curl', 'node', 'discordsrv'] as const).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSnippetLang(lang)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase cursor-pointer ${
                          snippetLang === lang
                            ? 'bg-cyan-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {lang === 'discordsrv' ? 'Minecraft DiscordSRV' : lang}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void handleCopy('snippet', snippetText)}
                      className="ml-2 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === 'snippet' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3 rounded-lg bg-[#0d1117] border border-white/10 text-xs font-mono text-cyan-200 overflow-x-auto">
                  {snippetText}
                </pre>
              </div>

              {/* Live Payload Tester */}
              <div className="p-4 rounded-xl bg-[var(--bg-userpanel)] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Live Webhook Payload Tester → #{targetRoomLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Payload</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={payloadText}
                  onChange={e => setPayloadText(e.target.value)}
                  className="w-full bg-[#0d1117] border border-white/10 rounded-lg p-3 text-xs font-mono text-amber-200 outline-none focus:border-cyan-400"
                />
                {webhookTestStatus && (
                  <div className="text-xs text-emerald-300 font-medium">{webhookTestStatus}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
