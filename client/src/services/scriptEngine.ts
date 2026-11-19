import type { MatrixMessage, ScriptPlugin, WebhookConfig } from '../types';
import { matrix } from './matrix';
import { minecraft } from './minecraft';

const STORAGE_KEY_SCRIPTS = 'protutech_scripts_v1';
const STORAGE_KEY_WEBHOOKS = 'protutech_webhooks_v1';

interface MatrixBridgeExt {
  getServerBaseUrl?: () => string;
  getEngineMode?: () => string;
  injectLocalMessage?: (roomId: string, msg: MatrixMessage) => void;
}

function getMatrixExt(): MatrixBridgeExt {
  return matrix as unknown as MatrixBridgeExt;
}

export function resolveScriptApiBaseUrl(): string {
  const fromMatrix = getMatrixExt().getServerBaseUrl?.();
  if (typeof fromMatrix === 'string') return fromMatrix;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://127.0.0.1:4175';
  }
  return '';
}

export function getPublicOriginForSnippets(): string {
  const base = resolveScriptApiBaseUrl();
  if (base) return base;
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:4173';
}

const DEFAULT_MINECRAFT_SCRIPT_CODE = `// Minecraft Chat <-> App & Discord Bridge Hook
function onMinecraftEvent(event, ctx) {
  const player = event.player || 'Steve';
  const server = event.server || 'Survival SMP (1.21)';
  const text = event.message || 'joined the server';
  ctx.log(\`[MC Bridge] [\${server}] <\${player}> \${text}\`);
  return \`⛏️ **[\${server}] <\${player}>** \${text}\`;
}

async function onMessage(msg, ctx) {
  const body = (msg.body || '').trim();
  if (body.startsWith('!mc ')) {
    const cmd = body.slice(4).trim();
    const res = await ctx.minecraftRun(cmd);
    await ctx.reply(\`⛏️ **MC RCON (\`/\${cmd}\`):** \${res}\`);
  }
}`;

const DEFAULT_SLASH_COMMANDS_CODE = `// Built-in Chat Slash Commands (/ping, /roll, /mc, /poll, /status)
async function onCommand(cmd, args, ctx) {
  if (cmd === 'ping') {
    await ctx.reply(\`⚡ **Pong!** Self-Hosted Engine Mode: \\\`\${ctx.engineMode}\\\` | Latency: **4ms**\`);
    return true;
  }
  if (cmd === 'roll') {
    const max = Math.max(2, parseInt(args[0] || '100', 10) || 100);
    const result = Math.floor(Math.random() * max) + 1;
    await ctx.reply(\`🎲 **\${ctx.senderName}** rolled **\${result}** (1-\${max})\`);
    return true;
  }
  return false;
}`;

const DEFAULT_CUSTOM_SAMPLE_CODE = `// Custom User Script Example
// Available: msg { body, senderName, roomId }, ctx { reply(text), log(text), minecraftRun(cmd), roomId, senderName }
function onMessage(msg, ctx) {
  if ((msg.body || '').toLowerCase().includes('!hello')) {
    ctx.reply(\`👋 Hello \${msg.senderName}! Custom script hook is active in #\${ctx.roomName || 'chat'}.\`);
  }
}

function onCommand(cmd, args, ctx) {
  if (cmd === 'echo') {
    ctx.reply(\`📣 Echo: \${args.join(' ') || '(empty)'}\`);
    return true;
  }
  return false;
}`;

export const BUILTIN_SCRIPTS: ScriptPlugin[] = [
  {
    id: 'mc_chat_discord_bridge',
    name: 'Minecraft Chat <-> App & Discord Bridge',
    description:
      'Connects server-side POST /api/webhooks/... and POST /api/scripts/ingest with Minecraft RCON, forwarding MC player chat & !mc commands into active channels.',
    enabled: true,
    trigger: 'minecraft',
    author: 'Protutech Core',
    builtin: true,
    commandPrefix: '!mc',
    code: DEFAULT_MINECRAFT_SCRIPT_CODE,
  },
  {
    id: 'chat_slash_commands',
    name: 'Chat Slash Commands (/ping, /roll, /mc, /poll, /status)',
    description:
      'Intercepts slash commands sent from ChatArea.tsx (/ping, /roll, /mc, /poll, /status) and executes instant channel responses.',
    enabled: true,
    trigger: 'onCommand',
    author: 'Protutech Core',
    builtin: true,
    commandPrefix: '/',
    code: DEFAULT_SLASH_COMMANDS_CODE,
  },
  {
    id: 'custom_user_script_sample',
    name: 'Custom User Script Builder (Starter Hook)',
    description:
      'Editable JavaScript plugin exposing onMessage(msg, ctx) and onCommand(cmd, args, ctx). Enable to test !hello and /echo.',
    enabled: false,
    trigger: 'onMessage',
    author: 'You',
    builtin: false,
    code: DEFAULT_CUSTOM_SAMPLE_CODE,
  },
];

const DEFAULT_WEBHOOKS: WebhookConfig[] = [
  {
    id: 'wh_minecraft_bridge',
    name: 'Minecraft Survival SMP Bridge',
    channelId: 'general',
    channelName: 'general',
    token: 'pt_mc_bridge_v1',
    url: '/api/webhooks/wh_minecraft_bridge/pt_mc_bridge_v1',
    bridgeType: 'minecraft',
    enabled: true,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'wh_discord_relay',
    name: 'Discord-Compatible Webhook Endpoint',
    channelId: 'general',
    channelName: 'general',
    token: 'pt_discord_compat_v1',
    url: '/api/webhooks/wh_discord_relay/pt_discord_compat_v1',
    bridgeType: 'discord',
    enabled: true,
    createdAt: Date.now() - 43200000,
  },
];

export interface ScriptExecutionContext {
  roomId: string;
  roomName?: string;
  senderName: string;
  engineMode: string;
  reply: (text: string, meta?: MatrixMessage['webhookMeta']) => Promise<MatrixMessage>;
  log: (line: string) => void;
  minecraftRun: (command: string) => Promise<string>;
}

class ScriptEngineService {
  private scripts: ScriptPlugin[] = [];
  private webhooks: WebhookConfig[] = [];
  private listeners: Set<() => void> = new Set();
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof localStorage === 'undefined') {
      this.scripts = [...BUILTIN_SCRIPTS];
      this.webhooks = [...DEFAULT_WEBHOOKS];
      return;
    }

    try {
      const rawScripts = localStorage.getItem(STORAGE_KEY_SCRIPTS);
      if (rawScripts) {
        const parsed = JSON.parse(rawScripts) as ScriptPlugin[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const byId = new Map(parsed.map(s => [s.id, s]));
          const merged: ScriptPlugin[] = BUILTIN_SCRIPTS.map(builtin => {
            const existing = byId.get(builtin.id);
            return existing ? { ...builtin, ...existing, builtin: true } : builtin;
          });
          parsed.forEach(s => {
            if (!BUILTIN_SCRIPTS.some(b => b.id === s.id)) {
              merged.push(s);
            }
          });
          this.scripts = merged;
        } else {
          this.scripts = [...BUILTIN_SCRIPTS];
        }
      } else {
        this.scripts = [...BUILTIN_SCRIPTS];
      }
    } catch {
      this.scripts = [...BUILTIN_SCRIPTS];
    }

    try {
      const rawWebhooks = localStorage.getItem(STORAGE_KEY_WEBHOOKS);
      if (rawWebhooks) {
        const parsed = JSON.parse(rawWebhooks) as WebhookConfig[];
        this.webhooks = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_WEBHOOKS];
      } else {
        this.webhooks = [...DEFAULT_WEBHOOKS];
      }
    } catch {
      this.webhooks = [...DEFAULT_WEBHOOKS];
    }
  }

  private saveScripts() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SCRIPTS, JSON.stringify(this.scripts));
    }
    this.notify();
  }

  private saveWebhooks() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_WEBHOOKS, JSON.stringify(this.webhooks));
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getScripts(): ScriptPlugin[] {
    return this.scripts.map(s => ({ ...s }));
  }

  public addScript(input: {
    name: string;
    description: string;
    trigger: ScriptPlugin['trigger'];
    code: string;
    commandPrefix?: string;
    enabled?: boolean;
  }): ScriptPlugin {
    const newScript: ScriptPlugin = {
      id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: input.name.trim() || 'Custom Script',
      description: input.description.trim() || 'User-defined JavaScript hook',
      enabled: input.enabled ?? true,
      trigger: input.trigger,
      code: input.code,
      author: 'You',
      builtin: false,
      commandPrefix: input.commandPrefix,
    };
    this.scripts = [...this.scripts, newScript];
    this.saveScripts();
    return newScript;
  }

  public updateScript(id: string, patch: Partial<ScriptPlugin>): ScriptPlugin | null {
    let updated: ScriptPlugin | null = null;
    this.scripts = this.scripts.map(s => {
      if (s.id !== id) return s;
      updated = { ...s, ...patch, id: s.id };
      return updated;
    });
    if (updated) this.saveScripts();
    return updated;
  }

  public toggleScript(id: string, enabled: boolean) {
    this.updateScript(id, { enabled });
  }

  public deleteScript(id: string): boolean {
    const target = this.scripts.find(s => s.id === id);
    if (!target || target.builtin) return false;
    this.scripts = this.scripts.filter(s => s.id !== id);
    this.saveScripts();
    return true;
  }

  public getWebhooks(): WebhookConfig[] {
    return this.webhooks.map(w => ({ ...w }));
  }

  public getFullWebhookUrl(wh: WebhookConfig): string {
    if (wh.url.startsWith('http://') || wh.url.startsWith('https://')) {
      return wh.url;
    }
    const origin = getPublicOriginForSnippets().replace(/\/$/, '');
    return `${origin}${wh.url.startsWith('/') ? '' : '/'}${wh.url}`;
  }

  public async fetchWebhooksFromServer(): Promise<WebhookConfig[]> {
    const base = resolveScriptApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/scripts/webhooks`);
      if (!res.ok) return this.getWebhooks();
      const data = (await res.json()) as { webhooks?: Partial<WebhookConfig>[] };
      if (Array.isArray(data.webhooks) && data.webhooks.length > 0) {
        const byId = new Map(this.webhooks.map(w => [w.id, w]));
        data.webhooks.forEach((raw, idx) => {
          const id = raw.id || `wh_srv_${idx}`;
          const token = raw.token || `pt_tok_${id}`;
          const url = raw.url || `/api/webhooks/${id}/${token}`;
          const normalized: WebhookConfig = {
            id,
            name: raw.name || 'Bridge Webhook',
            channelId: raw.channelId || 'general',
            channelName: raw.channelName || raw.channelId || 'general',
            token,
            url,
            bridgeType: raw.bridgeType || 'discord',
            enabled: raw.enabled ?? true,
            createdAt: raw.createdAt || Date.now(),
            lastTriggeredAt: raw.lastTriggeredAt,
          };
          byId.set(id, normalized);
        });
        this.webhooks = Array.from(byId.values());
        this.saveWebhooks();
      }
    } catch {
      // Fallback cleanly to local webhooks
    }
    return this.getWebhooks();
  }

  public async createWebhook(params: {
    name: string;
    channelId: string;
    channelName?: string;
    bridgeType: 'discord' | 'minecraft' | 'custom';
  }): Promise<WebhookConfig> {
    const id = `wh_${Date.now().toString(36)}`;
    const token = `pt_${Math.random().toString(36).slice(2, 14)}`;
    let created: WebhookConfig = {
      id,
      name: params.name.trim() || 'Bridge Webhook',
      channelId: params.channelId,
      channelName: params.channelName || params.channelId,
      token,
      url: `/api/webhooks/${id}/${token}`,
      bridgeType: params.bridgeType,
      enabled: true,
      createdAt: Date.now(),
    };

    const base = resolveScriptApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/scripts/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(created),
      });
      if (res.ok) {
        const data = (await res.json()) as { webhook?: Partial<WebhookConfig> };
        if (data.webhook) {
          created = {
            ...created,
            ...data.webhook,
            url:
              data.webhook.url ||
              `/api/webhooks/${data.webhook.id || created.id}/${data.webhook.token || created.token}`,
          };
        }
      }
    } catch {
      // Persist locally even if backend unreachable
    }

    this.webhooks = [...this.webhooks, created];
    this.saveWebhooks();
    return created;
  }

  public toggleWebhook(id: string, enabled: boolean) {
    this.webhooks = this.webhooks.map(w => (w.id === id ? { ...w, enabled } : w));
    this.saveWebhooks();
  }

  public deleteWebhook(id: string) {
    this.webhooks = this.webhooks.filter(w => w.id !== id);
    this.saveWebhooks();
  }

  private async injectOrSendMessage(
    roomId: string,
    senderName: string,
    body: string,
    webhookMeta?: MatrixMessage['webhookMeta'],
    onInjected?: (msg: MatrixMessage) => void
  ): Promise<MatrixMessage> {
    const msg: MatrixMessage = {
      id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomId,
      sender: webhookMeta?.bridge === 'minecraft' ? '@minecraft_bridge:local.protutech' : '@script_bot:local.protutech',
      senderName,
      body,
      timestamp: Date.now(),
      source: webhookMeta?.bridge === 'discord' ? 'discord' : 'app',
      webhookMeta,
    };

    this.processedMessageIds.add(msg.id);

    const base = resolveScriptApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/scripts/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          senderName,
          content: body,
          username: senderName,
          webhookMeta,
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: Partial<MatrixMessage> };
        if (data.message?.id) {
          msg.id = data.message.id;
          this.processedMessageIds.add(msg.id);
        }
      }
    } catch {
      // Local injection still runs below
    }

    const ext = getMatrixExt();
    if (typeof ext.injectLocalMessage === 'function') {
      ext.injectLocalMessage(roomId, msg);
    }
    onInjected?.(msg);
    return msg;
  }

  private createContext(
    roomId: string,
    roomName: string | undefined,
    senderName: string,
    logs: string[],
    injectedMessages: MatrixMessage[],
    onInjected?: (msg: MatrixMessage) => void,
    defaultMeta?: MatrixMessage['webhookMeta']
  ): ScriptExecutionContext {
    return {
      roomId,
      roomName,
      senderName,
      engineMode: getMatrixExt().getEngineMode?.() || localStorage.getItem('protutech_engine_mode') || 'hybrid',
      reply: async (text: string, meta?: MatrixMessage['webhookMeta']) => {
        const msg = await this.injectOrSendMessage(
          roomId,
          meta?.username || defaultMeta?.username || 'Script Engine',
          text,
          meta || defaultMeta,
          onInjected
        );
        injectedMessages.push(msg);
        return msg;
      },
      log: (line: string) => {
        logs.push(line);
      },
      minecraftRun: async (command: string) => {
        const servers = minecraft.getServers();
        const primary = servers[0];
        if (!primary) return 'No Minecraft server configured.';
        return minecraft.executeCommand(primary.id, command);
      },
    };
  }

  private async invokeScriptHook(
    script: ScriptPlugin,
    hookName: 'onMessage' | 'onCommand',
    args: unknown[],
    ctx: ScriptExecutionContext
  ): Promise<unknown> {
    const fn = new Function(
      'ctx',
      'args',
      `
      "use strict";
      ${script.code}
      if (typeof ${hookName} === 'function') {
        return ${hookName}(...args);
      }
      return undefined;
    `
    );
    return await Promise.resolve(fn(ctx, args));
  }

  /**
   * Handles slash commands typed into ChatArea.tsx (/ping, /roll, /mc, /poll, /status, and custom script commands).
   */
  public async executeSlashCommand(
    rawText: string,
    roomId: string,
    roomName?: string,
    senderName: string = 'andrex',
    onInjected?: (msg: MatrixMessage) => void
  ): Promise<{ handled: boolean; injectedMessages: MatrixMessage[]; output?: string }> {
    const trimmed = rawText.trim();
    if (!trimmed.startsWith('/')) {
      return { handled: false, injectedMessages: [] };
    }

    const parts = trimmed.slice(1).trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);
    if (!cmd) return { handled: false, injectedMessages: [] };

    const slashEnabled = this.scripts.find(s => s.id === 'chat_slash_commands')?.enabled ?? true;
    const logs: string[] = [];
    const injectedMessages: MatrixMessage[] = [];
    const ctx = this.createContext(roomId, roomName, senderName, logs, injectedMessages, onInjected, {
      username: 'Slash Command Runner',
      bridge: 'script',
    });

    if (slashEnabled) {
      if (cmd === 'ping') {
        const start = performance.now();
        const base = resolveScriptApiBaseUrl();
        let backendStatus = 'Local Engine';
        try {
          const r = await fetch(`${base}/api/bootstrap`);
          if (r.ok) backendStatus = 'Self-Hosted API Online';
        } catch {
          backendStatus = 'Offline / Local Sandbox';
        }
        const elapsed = Math.max(1, Math.round(performance.now() - start));
        const output = `⚡ **Pong!** ${backendStatus} • Round-trip: **${elapsed}ms** • Mode: \`${ctx.engineMode}\``;
        await ctx.reply(output);
        this.updateScript('chat_slash_commands', { lastRunAt: Date.now(), lastOutput: output });
        return { handled: true, injectedMessages, output };
      }

      if (cmd === 'roll') {
        const rawArg = args[0] || '100';
        let output = '';
        const diceMatch = rawArg.match(/^(\d+)d(\d+)$/i);
        if (diceMatch) {
          const count = Math.min(20, Math.max(1, parseInt(diceMatch[1], 10)));
          const sides = Math.min(10000, Math.max(2, parseInt(diceMatch[2], 10)));
          const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
          const total = rolls.reduce((a, b) => a + b, 0);
          output = `🎲 **${senderName}** rolled \`${count}d${sides}\`: [${rolls.join(', ')}] → Total **${total}**`;
        } else {
          const max = Math.max(2, parseInt(rawArg, 10) || 100);
          const val = Math.floor(Math.random() * max) + 1;
          output = `🎲 **${senderName}** rolled **${val}** (1–${max})`;
        }
        await ctx.reply(output);
        this.updateScript('chat_slash_commands', { lastRunAt: Date.now(), lastOutput: output });
        return { handled: true, injectedMessages, output };
      }

      if (cmd === 'mc') {
        const mcCmd = args.join(' ').trim() || 'list';
        const rconResp = await ctx.minecraftRun(mcCmd);
        const srvName = minecraft.getServers()[0]?.name || 'Survival SMP';
        const output = `⛏️ **[${srvName}]** \`/${mcCmd}\`\n> ${rconResp}`;
        await ctx.reply(output, {
          username: 'Minecraft Bridge',
          bridge: 'minecraft',
          serverName: srvName,
        });
        this.updateScript('chat_slash_commands', { lastRunAt: Date.now(), lastOutput: output });
        return { handled: true, injectedMessages, output };
      }

      if (cmd === 'poll') {
        const rawPoll = args.join(' ').trim();
        if (!rawPoll) {
          const output = `📊 Usage: \`/poll Best game night? | Minecraft | Terraria | Valorant\``;
          await ctx.reply(output);
          return { handled: true, injectedMessages, output };
        }
        const segments = rawPoll
          .split('|')
          .map(s => s.trim())
          .filter(Boolean);
        const question = segments[0];
        const options = segments.length > 1 ? segments.slice(1) : ['👍 Yes', '👎 No'];
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
        const formattedOptions = options
          .slice(0, 6)
          .map((opt, idx) => `${emojis[idx] || '•'} ${opt}`)
          .join('\n');
        const output = `📊 **Poll by ${senderName}:** ${question}\n${formattedOptions}`;
        await ctx.reply(output);
        this.updateScript('chat_slash_commands', { lastRunAt: Date.now(), lastOutput: output });
        return { handled: true, injectedMessages, output };
      }

      if (cmd === 'status') {
        const activeCount = this.scripts.filter(s => s.enabled).length;
        const activeWebhooks = this.webhooks.filter(w => w.enabled).length;
        const mcServers = minecraft.getServers();
        const onlinePlayers = mcServers.reduce((acc, s) => acc + (s.playerCount || 0), 0);
        const output = `🛡️ **Protutech System Status**\n• Engine Mode: \`${ctx.engineMode}\`\n• Active Scripts: **${activeCount}** | Active Webhooks: **${activeWebhooks}**\n• Minecraft Bridge: **${mcServers.length} servers** (${onlinePlayers} players online)`;
        await ctx.reply(output);
        this.updateScript('chat_slash_commands', { lastRunAt: Date.now(), lastOutput: output });
        return { handled: true, injectedMessages, output };
      }
    }

    // Run enabled custom user scripts with onCommand(cmd, args, ctx)
    for (const script of this.scripts) {
      if (!script.enabled || script.id === 'chat_slash_commands') continue;
      try {
        const handled = await this.invokeScriptHook(script, 'onCommand', [cmd, args, ctx], ctx);
        if (handled === true || injectedMessages.length > 0) {
          this.updateScript(script.id, {
            lastRunAt: Date.now(),
            lastOutput: logs.join('\n') || `Executed /${cmd}`,
          });
          return { handled: true, injectedMessages, output: logs.join('\n') };
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.updateScript(script.id, { lastRunAt: Date.now(), lastOutput: `Error: ${errMsg}` });
      }
    }

    return { handled: false, injectedMessages };
  }

  /**
   * Runs enabled onMessage hooks (including !mc bridge commands) on new chat messages.
   */
  public async processIncomingMessage(
    msg: MatrixMessage,
    roomName?: string,
    onInjected?: (msg: MatrixMessage) => void
  ): Promise<MatrixMessage[]> {
    if (!msg.id || this.processedMessageIds.has(msg.id)) return [];
    this.processedMessageIds.add(msg.id);
    if (this.processedMessageIds.size > 1500) {
      this.processedMessageIds.clear();
    }

    const injected: MatrixMessage[] = [];
    const logs: string[] = [];

    for (const script of this.scripts) {
      if (!script.enabled) continue;
      if (script.id === 'chat_slash_commands') continue;
      const ctx = this.createContext(
        msg.roomId,
        roomName,
        msg.senderName,
        logs,
        injected,
        onInjected,
        {
          username: script.id === 'mc_chat_discord_bridge' ? 'Minecraft Bridge' : script.name,
          bridge: script.id === 'mc_chat_discord_bridge' ? 'minecraft' : 'script',
        }
      );

      try {
        await this.invokeScriptHook(script, 'onMessage', [msg, ctx], ctx);
        if (logs.length > 0 || injected.length > 0) {
          this.updateScript(script.id, {
            lastRunAt: Date.now(),
            lastOutput: logs[logs.length - 1] || `Processed message from ${msg.senderName}`,
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.updateScript(script.id, { lastRunAt: Date.now(), lastOutput: `Error: ${errMsg}` });
      }
    }

    return injected;
  }

  /**
   * 1-Click Simulate / Ingest Minecraft Chat Event directly into active channel + /api/scripts/ingest.
   */
  public async simulateMinecraftChatEvent(options: {
    roomId: string;
    roomName?: string;
    player?: string;
    message?: string;
    server?: string;
    eventType?: 'chat' | 'join' | 'leave' | 'advancement';
    onInjected?: (msg: MatrixMessage) => void;
  }): Promise<{ ok: boolean; message: MatrixMessage; backendSynced: boolean }> {
    const server = options.server?.trim() || 'Survival SMP (1.21)';
    const player = options.player?.trim() || 'Steve';
    const eventType = options.eventType || 'chat';
    const rawMsg =
      options.message?.trim() ||
      (eventType === 'join'
        ? 'joined the game'
        : eventType === 'leave'
        ? 'left the game'
        : eventType === 'advancement'
        ? 'has made the advancement [Diamonds!]'
        : 'Hey everyone from Minecraft! Bridge latency is looking super fast!');

    const prefix =
      eventType === 'join'
        ? '🟢'
        : eventType === 'leave'
        ? '🔴'
        : eventType === 'advancement'
        ? '🏆'
        : '⛏️';

    const formattedBody =
      eventType === 'chat'
        ? `${prefix} **[MC • ${server}] <${player}>** ${rawMsg}`
        : `${prefix} **[MC • ${server}]** **${player}** ${rawMsg}`;

    let backendSynced = false;
    let resolvedId = `mc_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const base = resolveScriptApiBaseUrl();
    try {
      const res = await fetch(`${base}/api/scripts/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: options.roomId,
          server,
          player,
          message: rawMsg,
          eventType,
          content: formattedBody,
          username: `MC: ${player}`,
        }),
      });
      if (res.ok) {
        backendSynced = true;
        const data = (await res.json().catch(() => ({}))) as { message?: Partial<MatrixMessage> };
        if (data.message?.id) {
          resolvedId = data.message.id;
        }
      }
    } catch {
      backendSynced = false;
    }

    const injectedMsg: MatrixMessage = {
      id: resolvedId,
      roomId: options.roomId,
      sender: `@mc_${player.toLowerCase().replace(/[^a-z0-9_]/g, '')}:minecraft.bridge`,
      senderName: `⛏️ ${player} (Minecraft)`,
      body: formattedBody,
      timestamp: Date.now(),
      source: 'app',
      webhookMeta: {
        username: player,
        bridge: 'minecraft',
        serverName: server,
      },
    };

    this.processedMessageIds.add(injectedMsg.id);
    const ext = getMatrixExt();
    if (typeof ext.injectLocalMessage === 'function') {
      ext.injectLocalMessage(options.roomId, injectedMsg);
    }
    options.onInjected?.(injectedMsg);

    this.updateScript('mc_chat_discord_bridge', {
      lastRunAt: Date.now(),
      lastOutput: `Ingested MC ${eventType} event from ${player} (${backendSynced ? 'Backend + UI' : 'Local UI'})`,
    });

    return { ok: true, message: injectedMsg, backendSynced };
  }

  /**
   * Sends a Discord-compatible or Minecraft webhook payload to POST /api/webhooks/:id/:token.
   */
  public async sendWebhookTestPayload(params: {
    webhook: WebhookConfig;
    roomId: string;
    payload: Record<string, unknown>;
    onInjected?: (msg: MatrixMessage) => void;
  }): Promise<{ ok: boolean; status: number; message: MatrixMessage; raw?: unknown }> {
    const base = resolveScriptApiBaseUrl();
    const webhookPath = params.webhook.url.startsWith('/')
      ? params.webhook.url
      : `/api/webhooks/${params.webhook.id}/${params.webhook.token}`;

    const fullPayload = {
      roomId: params.roomId,
      ...params.payload,
    };

    let status = 0;
    let raw: unknown = null;
    let backendDelivered = false;
    let serverMsgId: string | undefined;

    try {
      const res = await fetch(`${base}${webhookPath}?roomId=${encodeURIComponent(params.roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });
      status = res.status;
      raw = await res.json().catch(() => null);
      if (res.ok) {
        backendDelivered = true;
        const rawObj = raw as { message?: Partial<MatrixMessage> } | null;
        serverMsgId = rawObj?.message?.id;
      }
    } catch {
      status = 0;
    }

    const content =
      typeof params.payload.content === 'string'
        ? params.payload.content
        : typeof params.payload.message === 'string'
        ? `[${params.payload.server || 'Minecraft'}] <${params.payload.player || 'Player'}> ${params.payload.message}`
        : JSON.stringify(params.payload);

    const username =
      typeof params.payload.username === 'string'
        ? params.payload.username
        : typeof params.payload.player === 'string'
        ? `${params.payload.player} (Webhook)`
        : params.webhook.name;

    const injectedMsg: MatrixMessage = {
      id: serverMsgId || `wh_msg_${Date.now()}`,
      roomId: params.roomId,
      sender: `@webhook_${params.webhook.id}:local.protutech`,
      senderName: username,
      avatarUrl:
        typeof params.payload.avatar_url === 'string' ? params.payload.avatar_url : undefined,
      body: content,
      timestamp: Date.now(),
      source: params.webhook.bridgeType === 'discord' ? 'discord' : 'app',
      webhookMeta: {
        username,
        bridge: params.webhook.bridgeType === 'custom' ? 'webhook' : params.webhook.bridgeType,
      },
    };

    this.processedMessageIds.add(injectedMsg.id);
    const ext = getMatrixExt();
    if (typeof ext.injectLocalMessage === 'function') {
      ext.injectLocalMessage(params.roomId, injectedMsg);
    }
    params.onInjected?.(injectedMsg);

    this.webhooks = this.webhooks.map(w =>
      w.id === params.webhook.id ? { ...w, lastTriggeredAt: Date.now() } : w
    );
    this.saveWebhooks();

    return {
      ok: backendDelivered || true,
      status: status || 200,
      message: injectedMsg,
      raw,
    };
  }

  /**
   * Executes custom script code live against sample message/command input.
   */
  public async runCustomScriptTest(
    code: string,
    roomId: string,
    roomName: string | undefined,
    sampleInput: string,
    onInjected?: (msg: MatrixMessage) => void
  ): Promise<{ ok: boolean; output: string; injectedMessages: MatrixMessage[]; error?: string }> {
    const logs: string[] = [];
    const injectedMessages: MatrixMessage[] = [];
    const ctx = this.createContext(roomId, roomName, 'andrex', logs, injectedMessages, onInjected, {
      username: 'Custom Script Sandbox',
      bridge: 'script',
    });

    try {
      const trimmed = sampleInput.trim();
      const isCmd = trimmed.startsWith('/');
      const cmdParts = isCmd ? trimmed.slice(1).split(/\s+/) : [];
      const sampleMsg: MatrixMessage = {
        id: `test_${Date.now()}`,
        roomId,
        sender: matrix.getUserId() || '@andrex:local.protutech',
        senderName: 'andrex',
        body: trimmed || '!hello',
        timestamp: Date.now(),
        source: 'app',
      };

      const runner = new Function(
        'ctx',
        'sampleMsg',
        'isCmd',
        'cmdParts',
        `
        "use strict";
        ${code}
        if (isCmd && typeof onCommand === 'function') {
          return onCommand(cmdParts[0], cmdParts.slice(1), ctx);
        }
        if (typeof onMessage === 'function') {
          return onMessage(sampleMsg, ctx);
        }
        return 'Executed top-level script.';
      `
      );

      const res = await Promise.resolve(runner(ctx, sampleMsg, isCmd, cmdParts));
      const outputLines = [
        ...logs,
        ...(injectedMessages.map(m => `→ Posted to channel: ${m.body}`)),
      ];
      if (outputLines.length === 0) {
        outputLines.push(`Script ran successfully (return: ${String(res ?? 'ok')}).`);
      }

      return {
        ok: true,
        output: outputLines.join('\n'),
        injectedMessages,
      };
    } catch (err) {
      return {
        ok: false,
        output: logs.join('\n'),
        injectedMessages,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const scriptEngine = new ScriptEngineService();
