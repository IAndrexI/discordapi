import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Zap,
  Search,
  Code,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Play,
  Sparkles,
  Globe,
  FileCode2,
} from 'lucide-react';
import { vencord, EQUICORD_CATALOG } from '../services/vencord';
import type { VencordPlugin } from '../types';

export interface EquicordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ManagerTab = 'library' | 'editor';
type SourceFilter = 'all' | 'equicord' | 'vencord' | 'user';
type CategoryFilter = 'all' | 'chat' | 'media' | 'ui' | 'privacy' | 'utility';

const STARTER_TEMPLATES: Array<{
  label: string;
  name: string;
  description: string;
  category: NonNullable<VencordPlugin['category']>;
  code: string;
}> = [
  {
    label: 'Outgoing Tag Hook (onMessageSend)',
    name: 'Signature Tag Hook',
    description: 'Appends a sleek Equicord signature or transforms shortcuts before sending.',
    category: 'chat',
    code: `export default definePlugin({
  name: "Signature Tag Hook",
  description: "Expands /shrug and cleans whitespace before send.",
  start() {
    Equicord.Util.logger.log("Signature Tag Hook started");
  },
  onMessageSend(body) {
    return body.replace(/\\/shrug/g, "¯\\\\_(ツ)_/¯");
  },
  stop() {
    Equicord.Util.logger.log("Signature Tag Hook stopped");
  }
});`,
  },
  {
    label: 'Incoming Highlighter (onMessageReceive)',
    name: 'Keyword Ping Booster',
    description: 'Highlights important keywords on incoming messages via Equicord receive hook.',
    category: 'chat',
    code: `export default definePlugin({
  name: "Keyword Ping Booster",
  description: "Marks urgent incoming messages with a lightning badge.",
  onMessageReceive(msg) {
    if (msg && typeof msg.body === "string" && /urgent|deploy/i.test(msg.body)) {
      return { ...msg, body: "⚡ " + msg.body };
    }
    return msg;
  }
});`,
  },
  {
    label: 'Custom CSS Injector (DOM API)',
    name: 'Cyber Glow Scrollbars',
    description: 'Injects custom neon cyan scrollbar and subtle accent glow styles via Equicord.Api.DOM.',
    category: 'ui',
    code: `export default definePlugin({
  name: "Cyber Glow Scrollbars",
  description: "Adds subtle cyan glow styling to chat scrollbars.",
  start() {
    Equicord.Api.DOM.addStyle(
      "equicord-cyber-scroll",
      "::-webkit-scrollbar-thumb { background: rgba(0, 242, 254, 0.35); border-radius: 999px; }"
    );
  },
  stop() {
    Equicord.Api.DOM.removeStyle("equicord-cyber-scroll");
  }
});`,
  },
];

export const EquicordModal: React.FC<EquicordModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ManagerTab>('library');
  const [plugins, setPlugins] = useState<VencordPlugin[]>(() => vencord.getPlugins());
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  // Editor & Importer state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(STARTER_TEMPLATES[0].name);
  const [draftAuthor, setDraftAuthor] = useState('User Developer');
  const [draftDesc, setDraftDesc] = useState(STARTER_TEMPLATES[0].description);
  const [draftCategory, setDraftCategory] = useState<NonNullable<VencordPlugin['category']>>('chat');
  const [draftCode, setDraftCode] = useState(STARTER_TEMPLATES[0].code);
  const [importPayload, setImportPayload] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);

  // Hook tester state
  const [hookTestInput, setHookTestInput] = useState(
    'Hey team /shrug check https://example.com/?utm_source=ref&ref=1'
  );
  const [hookTestOutput, setHookTestOutput] = useState<string | null>(null);

  const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind });
    window.setTimeout(() => {
      setToast((curr) => (curr?.text === text ? null : curr));
    }, 2800);
  };

  useEffect(() => {
    const unsub = vencord.subscribe(() => {
      setPlugins(vencord.getPlugins());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const combinedCatalog = useMemo(() => {
    const byId = new Map<string, VencordPlugin>();
    plugins.forEach((p) => byId.set(p.id, p));
    EQUICORD_CATALOG.forEach((cat) => {
      if (!byId.has(cat.id)) {
        byId.set(cat.id, { ...cat, enabled: false });
      }
    });
    return Array.from(byId.values());
  }, [plugins]);

  const counts = useMemo(() => {
    return {
      all: combinedCatalog.length,
      equicord: combinedCatalog.filter((p) => p.source === 'equicord').length,
      vencord: combinedCatalog.filter((p) => p.source === 'vencord' || !p.source).length,
      user: combinedCatalog.filter((p) => p.source === 'user').length,
      enabled: combinedCatalog.filter((p) => p.enabled).length,
    };
  }, [combinedCatalog]);

  const filteredPlugins = useMemo(() => {
    const q = search.trim().toLowerCase();
    return combinedCatalog.filter((p) => {
      if (sourceFilter === 'equicord' && p.source !== 'equicord') return false;
      if (sourceFilter === 'vencord' && p.source !== 'vencord' && p.source !== undefined) {
        return false;
      }
      if (sourceFilter === 'user' && p.source !== 'user') return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.description} ${p.author} ${(p.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [combinedCatalog, search, sourceFilter, categoryFilter]);

  if (!isOpen) return null;

  const handleToggle = (plugin: VencordPlugin) => {
    const nextEnabled = !plugin.enabled;
    vencord.togglePlugin(plugin.id, nextEnabled);
    setPlugins(vencord.getPlugins());
    showToast(
      `Hot-reloaded: ${plugin.name} ${nextEnabled ? 'enabled' : 'disabled'} ✓`,
      'ok'
    );
  };

  const handleSaveEditorPlugin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim() || !draftCode.trim()) {
      showToast('Plugin name and JavaScript code are required.', 'err');
      return;
    }

    if (editingId) {
      const updated = vencord.updateCustomPlugin(editingId, {
        name: draftName.trim(),
        author: draftAuthor.trim() || 'User Developer',
        description: draftDesc.trim() || 'Custom Equicord user plugin.',
        category: draftCategory,
        code: draftCode,
        enabled: true,
      });
      if (updated) {
        const err = vencord.getLastPluginError(updated.id);
        showToast(
          err
            ? `Saved "${updated.name}" with runtime error: ${err}`
            : `Updated & hot-reloaded "${updated.name}" ✓`,
          err ? 'err' : 'ok'
        );
      }
      setEditingId(null);
    } else {
      const created = vencord.addCustomPlugin({
        name: draftName.trim(),
        author: draftAuthor.trim() || 'User Developer',
        description: draftDesc.trim() || 'Custom Equicord user plugin.',
        category: draftCategory,
        code: draftCode,
        enabled: true,
      });
      const err = vencord.getLastPluginError(created.id);
      showToast(
        err
          ? `Created "${created.name}" with runtime error: ${err}`
          : `Created & activated "${created.name}" ✓`,
        err ? 'err' : 'ok'
      );
    }

    setPlugins(vencord.getPlugins());
    setSourceFilter('user');
    setActiveTab('library');
  };

  const handleStartEdit = (plugin: VencordPlugin) => {
    setEditingId(plugin.id);
    setDraftName(plugin.name);
    setDraftAuthor(plugin.author || 'User Developer');
    setDraftDesc(plugin.description || '');
    setDraftCategory(plugin.category || 'utility');
    setDraftCode(plugin.code || STARTER_TEMPLATES[0].code);
    setActiveTab('editor');
  };

  const handleDeleteCustom = (plugin: VencordPlugin) => {
    vencord.deleteCustomPlugin(plugin.id);
    setPlugins(vencord.getPlugins());
    showToast(`Deleted custom plugin "${plugin.name}"`, 'ok');
  };

  const handleExportCustom = (plugin: VencordPlugin) => {
    const json = vencord.exportCustomPluginJson(plugin.id);
    if (!json) return;
    navigator.clipboard?.writeText(json).catch(() => {});
    showToast(`Copied JSON for "${plugin.name}" to clipboard ✓`, 'ok');
  };

  const handleImportJsonOrJs = () => {
    try {
      const imported = vencord.importCustomPlugin(importPayload);
      setImportPayload('');
      setPlugins(vencord.getPlugins());
      setSourceFilter('user');
      setActiveTab('library');
      showToast(`Imported & enabled "${imported.name}" ✓`, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'err');
    }
  };

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      showToast('Enter a valid JS plugin URL first.', 'err');
      return;
    }
    setImportBusy(true);
    try {
      const urlName = importUrl.split('/').pop()?.replace(/\.js$/i, '') || 'Remote Plugin';
      const installed = await vencord.installUserPlugin({
        name: urlName,
        description: `Loaded from ${importUrl.trim()}`,
        author: 'Remote Script',
        category: 'utility',
        codeUrl: importUrl.trim(),
      });
      setImportUrl('');
      setPlugins(vencord.getPlugins());
      setSourceFilter('user');
      setActiveTab('library');
      showToast(`Fetched & enabled "${installed.name}" ✓`, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setImportBusy(false);
    }
  };

  const handleRunHookTest = () => {
    const out = vencord.executeMessageSendHooks(hookTestInput);
    setHookTestOutput(out);
    showToast('Executed Equicord message send hooks ✓', 'ok');
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="equicord-modal-title"
        className="w-[min(64rem,100%)] max-w-full h-[min(680px,100%)] max-h-full bg-[var(--bg-chat)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-[var(--bg-userpanel)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--discord-blurple)] flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="equicord-modal-title" className="text-base sm:text-lg font-extrabold text-[var(--text-header)] tracking-tight">
                  Equicord Plugins
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-channels)] text-[var(--text-link)] border border-[var(--border-subtle)] font-bold uppercase">
                  {counts.enabled} Active / {counts.all} Total
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Manage Equicord, Vencord, and custom JavaScript plugins.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[var(--bg-channels)] p-1 rounded-xl border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'library'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Library</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'editor'
                    ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Editor &amp; Import</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const active = vencord.hotReloadAll();
                showToast(`Hot-reloaded ${active} active plugins ✓`, 'ok');
              }}
              aria-label="Reload active plugins"
              title="Hot-reload all enabled plugins"
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-header)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[var(--text-link)]" />
              <span>Reload</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Equicord Manager"
              className="w-9 h-9 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-muted)] hover:text-[var(--text-header)] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Instant Hot-Reload Toast */}
        {toast && (
          <div
            className={`mx-4 sm:mx-6 mt-3 px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fadeIn flex-shrink-0 ${
              toast.kind === 'err'
                ? 'bg-red-500/15 border-red-500/40 text-[var(--status-dnd)]'
                : 'bg-emerald-500/15 border-emerald-500/40 text-[var(--status-online)]'
            }`}
          >
            {toast.kind === 'err' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* LIBRARY VIEW */}
        {activeTab === 'library' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 space-y-4">
            {/* Search & Filters */}
            <div className="space-y-3 flex-shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Search plugins"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search plugins..."
                    className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text-header)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Clear plugin search"
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-header)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setActiveTab('editor');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create / Import</span>
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Source Filter */}
                <div className="flex items-center gap-1 bg-[var(--bg-channels)] p-1 rounded-xl border border-[var(--border-subtle)] flex-wrap">
                  {(
                    [
                      { id: 'all', label: `All (${counts.all})` },
                      { id: 'equicord', label: `Equicord (${counts.equicord})` },
                      { id: 'vencord', label: `Vencord (${counts.vencord})` },
                      { id: 'user', label: `Custom (${counts.user})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSourceFilter(tab.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        sourceFilter === tab.id
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--discord-blurple)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'chat', label: 'Chat' },
                      { id: 'media', label: 'Media' },
                      { id: 'ui', label: 'UI' },
                      { id: 'privacy', label: 'Privacy' },
                      { id: 'utility', label: 'Utility' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        categoryFilter === cat.id
                          ? 'bg-[var(--bg-item-active)] text-[var(--text-header)] border border-[var(--border-subtle)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-header)] bg-[var(--bg-userpanel)]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid of Plugins */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
              {filteredPlugins.length === 0 ? (
                <div className="col-span-full p-10 text-center rounded-xl bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] space-y-2">
                  <Code className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                  <p className="text-sm font-bold text-[var(--text-header)]">No plugins match your filter</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSourceFilter('all');
                      setCategoryFilter('all');
                    }}
                    className="text-xs text-[var(--text-link)] hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredPlugins.map((plugin) => {
                  const isUser = plugin.source === 'user';
                  const isEquicord = plugin.source === 'equicord';
                  const runtimeErr = isUser ? vencord.getLastPluginError(plugin.id) : undefined;

                  return (
                    <div
                      key={plugin.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        plugin.enabled
                          ? 'bg-[var(--bg-userpanel)] border-[var(--discord-blurple)]'
                          : 'bg-[var(--bg-channels)] border-[var(--border-subtle)] opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5 mb-1">
                            <span className="font-bold text-sm text-[var(--text-header)]">{plugin.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border border-[var(--border-subtle)] ${
                                isUser
                                  ? 'bg-emerald-500/15 text-[var(--status-online)]'
                                  : isEquicord
                                  ? 'bg-cyan-500/15 text-[var(--text-link)]'
                                  : 'bg-[var(--bg-popout)] text-[var(--text-normal)]'
                              }`}
                            >
                              {isUser ? 'Custom' : isEquicord ? 'Equicord' : 'Vencord'}
                            </span>
                            {plugin.category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-popout)] text-[var(--text-muted)] capitalize">
                                {plugin.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            {plugin.description}
                          </p>
                          <div className="text-[10px] text-[var(--text-muted)] mt-1.5 font-mono">
                            id: {plugin.id} • by {plugin.author}
                          </div>
                          {runtimeErr && (
                            <div className="mt-2 px-2.5 py-1 rounded bg-red-500/15 border border-red-500/30 text-[11px] text-[var(--status-dnd)]">
                              Runtime Error: {runtimeErr}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={plugin.enabled}
                          aria-label={`Toggle ${plugin.name}`}
                          onClick={() => handleToggle(plugin)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer flex-shrink-0 ${
                            plugin.enabled
                              ? 'bg-[var(--status-online)]'
                              : 'bg-[var(--bg-message-input)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${
                              plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {isUser && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(plugin)}
                            className="px-2.5 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-xs text-[var(--text-link)] flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCustom(plugin)}
                            className="px-2.5 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-xs text-[var(--text-normal)] flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export JSON</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(plugin)}
                            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-xs text-[var(--status-dnd)] flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* PLUGIN EDITOR & IMPORTER VIEW */}
        {activeTab === 'editor' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Left: JS Plugin Builder */}
            <form
              onSubmit={handleSaveEditorPlugin}
              className="lg:col-span-3 space-y-3 bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-xl p-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-header)]">
                    {editingId ? 'Edit Custom Plugin' : 'Write Custom Plugin'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Supports <code className="text-[var(--text-link)]">definePlugin()</code>,{' '}
                    <code className="text-[var(--text-link)]">onMessageSend</code>,{' '}
                    <code className="text-[var(--text-link)]">onMessageReceive</code>, and{' '}
                    <code className="text-[var(--text-link)]">Equicord.Api</code>.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {STARTER_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setDraftName(tpl.name);
                        setDraftDesc(tpl.description);
                        setDraftCategory(tpl.category);
                        setDraftCode(tpl.code);
                      }}
                      className="text-[10px] px-2 py-1 rounded bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-[var(--text-link)] border border-[var(--border-subtle)] cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  aria-label="Plugin Name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Plugin Name"
                  className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] outline-none"
                  required
                />
                <input
                  type="text"
                  aria-label="Plugin Author"
                  value={draftAuthor}
                  onChange={(e) => setDraftAuthor(e.target.value)}
                  placeholder="Author"
                  className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] outline-none"
                />
                <select
                  aria-label="Plugin Category"
                  value={draftCategory}
                  onChange={(e) =>
                    setDraftCategory(e.target.value as NonNullable<VencordPlugin['category']>)
                  }
                  className="bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] outline-none"
                >
                  <option value="chat">Chat</option>
                  <option value="media">Media</option>
                  <option value="ui">UI</option>
                  <option value="privacy">Privacy</option>
                  <option value="utility">Utility</option>
                </select>
              </div>

              <input
                type="text"
                aria-label="Plugin Description"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Plugin description..."
                className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] outline-none"
              />

              <textarea
                rows={10}
                aria-label="Plugin JavaScript code"
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                className="w-full bg-[var(--bg-popout)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-lg p-3 text-xs font-mono text-[var(--text-normal)] outline-none resize-y"
                spellCheck={false}
              />

              <div className="flex items-center justify-end gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] text-xs text-[var(--text-normal)] cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Save & Reload' : 'Save & Enable'}</span>
                </button>
              </div>
            </form>

            {/* Right: JSON / JS / URL Importer + Live Hook Tester */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--text-link)]" />
                  <h3 className="text-sm font-bold text-[var(--text-header)]">Import JSON / JS Plugin</h3>
                </div>
                <textarea
                  rows={5}
                  aria-label="Plugin JSON or JS source"
                  value={importPayload}
                  onChange={(e) => setImportPayload(e.target.value)}
                  placeholder='Paste JSON { "name": "...", "code": "..." } or raw JS...'
                  className="w-full bg-[var(--bg-popout)] border border-[var(--border-subtle)] focus:border-[var(--discord-blurple)] rounded-lg p-2.5 text-xs font-mono text-[var(--text-normal)] outline-none"
                />
                <button
                  type="button"
                  onClick={handleImportJsonOrJs}
                  className="w-full py-2 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold cursor-pointer"
                >
                  Import &amp; Enable
                </button>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-[var(--text-link)]" />
                    <span>Load from Raw JS URL</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      aria-label="Raw JS plugin URL"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://raw.githubusercontent.com/.../plugin.js"
                      className="flex-1 min-w-0 bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                    />
                    <button
                      type="button"
                      disabled={importBusy}
                      onClick={() => void handleImportFromUrl()}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-channels)] hover:bg-[var(--bg-item-hover)] border border-[var(--border-subtle)] text-[var(--text-header)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {importBusy ? '...' : 'Fetch'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Send Hook Tester */}
              <div className="bg-[var(--bg-userpanel)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[var(--text-header)] uppercase tracking-wider">
                    Hook Tester
                  </h3>
                  <span className="text-[10px] text-[var(--text-link)] font-mono">onMessageSend</span>
                </div>
                <input
                  type="text"
                  aria-label="Hook test input"
                  value={hookTestInput}
                  onChange={(e) => setHookTestInput(e.target.value)}
                  className="w-full bg-[var(--bg-message-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-header)] outline-none focus:border-[var(--discord-blurple)]"
                />
                <button
                  type="button"
                  onClick={handleRunHookTest}
                  className="w-full py-1.5 rounded-lg bg-[var(--discord-blurple)] hover:bg-[var(--discord-blurple-hover)] text-white text-xs font-bold cursor-pointer"
                >
                  Test Send Hooks
                </button>
                {hookTestOutput !== null && (
                  <div className="p-2.5 rounded-lg bg-[var(--bg-popout)] border border-emerald-500/30 text-xs text-[var(--status-online)] font-mono break-all">
                    {hookTestOutput}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
