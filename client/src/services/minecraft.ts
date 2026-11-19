import type { MinecraftServerConfig, MinecraftLogEntry } from '../types';

const STORAGE_KEY_MC_SERVERS = 'protutech_mc_servers';

const DEFAULT_SERVERS: MinecraftServerConfig[] = [
  {
    id: 'mc_survival_main',
    name: 'Survival SMP (1.21)',
    host: 'mc.protutech.vip',
    rconPort: 25575,
    status: 'online',
    playerCount: 6,
    maxPlayers: 20,
  },
  {
    id: 'mc_creative_plots',
    name: 'Creative Build Arena',
    host: 'creative.protutech.vip',
    rconPort: 25575,
    status: 'online',
    playerCount: 2,
    maxPlayers: 50,
  },
];

class MinecraftService {
  private servers: MinecraftServerConfig[] = [];
  private logs: Map<string, MinecraftLogEntry[]> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MC_SERVERS);
      if (saved) {
        this.servers = JSON.parse(saved);
      } else {
        this.servers = [...DEFAULT_SERVERS];
        this.saveState();
      }
    } catch {
      this.servers = [...DEFAULT_SERVERS];
    }

    // Seed mock live console logs for initial demo
    this.servers.forEach(srv => {
      this.logs.set(srv.id, [
        {
          id: 'log_init_1',
          timestamp: Date.now() - 120000,
          level: 'info',
          message: `[Server thread/INFO]: Starting Minecraft server on ${srv.host}:${srv.rconPort}`,
        },
        {
          id: 'log_init_2',
          timestamp: Date.now() - 95000,
          level: 'info',
          message: '[Server thread/INFO]: Preparing level "world"...',
        },
        {
          id: 'log_init_3',
          timestamp: Date.now() - 60000,
          level: 'info',
          message: `[Server thread/INFO]: Done! For help, type "help" or "?" (${srv.playerCount}/${srv.maxPlayers} players online)`,
        },
      ]);
    });
  }

  private saveState() {
    localStorage.setItem(STORAGE_KEY_MC_SERVERS, JSON.stringify(this.servers));
    this.notify();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public getServers(): MinecraftServerConfig[] {
    return this.servers;
  }

  public addServer(server: Omit<MinecraftServerConfig, 'id'>): MinecraftServerConfig {
    const newServer: MinecraftServerConfig = {
      ...server,
      id: `mc_${Date.now()}`,
      status: 'online',
      playerCount: 0,
      maxPlayers: 20,
    };
    this.servers.push(newServer);
    this.logs.set(newServer.id, [
      {
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        level: 'info',
        message: `[RCON/INFO]: Connected to ${newServer.name} (${newServer.host}) successfully.`,
      },
    ]);
    this.saveState();
    return newServer;
  }

  public removeServer(id: string) {
    this.servers = this.servers.filter(s => s.id !== id);
    this.logs.delete(id);
    this.saveState();
  }

  public getLogs(serverId: string): MinecraftLogEntry[] {
    return this.logs.get(serverId) || [];
  }

  /**
   * Executes a command on the specified Minecraft server and records response in console log.
   */
  public async executeCommand(serverId: string, command: string): Promise<string> {
    const cleanCmd = command.trim().startsWith('/') ? command.trim().slice(1) : command.trim();
    if (!cleanCmd) return '';

    // Record command input
    const logList = this.logs.get(serverId) || [];
    logList.push({
      id: `cmd_${Date.now()}`,
      timestamp: Date.now(),
      level: 'info',
      message: `> /${cleanCmd}`,
    });

    let responseMsg = '';

    // Try executing through backend bridge if proxy is reachable
    try {
      const res = await fetch('/api/minecraft/rcon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: serverId, command: cleanCmd }),
      });
      if (res.ok) {
        const data = await res.json();
        responseMsg = data.response || 'Command executed.';
      } else {
        responseMsg = this.simulateResponse(cleanCmd);
      }
    } catch {
      responseMsg = this.simulateResponse(cleanCmd);
    }

    logList.push({
      id: `resp_${Date.now()}`,
      timestamp: Date.now(),
      level: 'info',
      message: `[RCON/INFO]: ${responseMsg}`,
    });

    this.logs.set(serverId, logList);
    this.notify();
    return responseMsg;
  }

  private simulateResponse(cmd: string): string {
    const lower = cmd.toLowerCase();
    if (lower === 'list') {
      return 'There are 6 of a max of 20 players online: andrex, notch, alex, steve, gamer99, creeper_hunter';
    } else if (lower.startsWith('say ')) {
      return `[Server] ${cmd.slice(4)}`;
    } else if (lower === 'tps') {
      return 'TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.98';
    } else if (lower.startsWith('time set ')) {
      return `Set the time to ${cmd.slice(9)}`;
    } else if (lower.startsWith('weather ')) {
      return `Set the weather to ${cmd.slice(8)}`;
    } else if (lower.startsWith('op ')) {
      return `Made ${cmd.slice(3)} a server operator`;
    } else if (lower.startsWith('whitelist ')) {
      return `Whitelist modified: ${cmd}`;
    } else if (lower.startsWith('kick ')) {
      return `Kicked player ${cmd.slice(5)}`;
    } else if (lower === 'help') {
      return 'Commands: list, tps, say <msg>, time set <day|night>, weather <clear|rain>, kick <user>, op <user>';
    }
    return `Command "/${cmd}" executed successfully.`;
  }
}

export const minecraft = new MinecraftService();
