'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_DATA_DIR = path.resolve(__dirname, '../server-data');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Discord-Token, X-Requested-With, X-File-Id, X-Chunk-Index',
};

function setCorsHeaders(res) {
  for (const [key, val] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, val);
  }
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) return;
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  if (res.writableEnded) return;
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function sanitizeUsername(raw) {
  const cleaned = String(raw || 'andrex')
    .trim()
    .replace(/^@/, '')
    .split(':')[0]
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned || 'andrex';
}

function sanitizeFileName(name) {
  const base = path.basename(String(name || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'upload.bin';
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf8');
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readRawBody(req);
  if (!buf || buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return {};
  }
}

function createSeedDatabase() {
  const now = Date.now();

  const members = [
    {
      userId: '@andrex:local.protutech',
      displayName: 'andrex',
      presence: 'online',
      statusMsg: 'Self-Hosted Hybrid Active',
      pronouns: 'he/him',
      bio: 'Protutech Self-Hosted + Hybrid Architect',
      badges: ['Self-Hosted Admin', 'Hybrid Bridge'],
      isDiscordBridged: false,
    },
    {
      userId: '@protutech_bot:local.protutech',
      displayName: 'Protutech Core',
      presence: 'online',
      statusMsg: 'Node v24 Self-Hosted Engine',
      badges: ['System'],
      isDiscordBridged: false,
    },
    {
      userId: '@_discord_1001:local.protutech',
      displayName: 'Alex (Bridge)',
      presence: 'online',
      statusMsg: 'External Hybrid Bridge',
      badges: ['Bridge'],
      isDiscordBridged: true,
    },
    {
      userId: '@_discord_1002:local.protutech',
      displayName: 'Nova (Bridge)',
      presence: 'idle',
      statusMsg: 'In Bridged Lounge',
      badges: ['Bridge'],
      isDiscordBridged: true,
    },
    {
      userId: '@mc_bridge:local.protutech',
      displayName: 'Minecraft SMP Bridge',
      presence: 'online',
      statusMsg: 'Survival SMP (1.21)',
      badges: ['Minecraft Bridge'],
      isDiscordBridged: false,
    },
  ];

  const rooms = [
    // Proprietary Server: Protutech HQ
    {
      id: '!proto_general:local.protutech',
      name: 'general',
      topic: 'Protutech HQ — Self-Hosted Node v24 chat, slash commands (/ping, /roll, /mc, /poll), and real-time SSE',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 120000,
    },
    {
      id: '!proto_announcements:local.protutech',
      name: 'announcements',
      topic: 'Self-hosted engine status, updates, and release notes',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 300000,
    },
    {
      id: '!proto_scripts:local.protutech',
      name: 'scripts-and-webhooks',
      topic: 'Compatible webhooks, custom JS script hooks, and automated relays',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 240000,
    },
    {
      id: '!proto_minecraft:local.protutech',
      name: 'minecraft-chat',
      topic: 'Live Minecraft SMP <-> Protutech & Bridge chat (!mc list, webhook ingest)',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 180000,
    },
    {
      id: '!proto_files:local.protutech',
      name: 'large-file-drops',
      topic: 'Zero-size-cap chunked uploads & P2P direct file transfers',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 400000,
    },
    {
      id: '!proto_voice:local.protutech',
      name: '🔊 Protutech Voice Lounge',
      topic: 'Ultra-low latency 48kHz voice, HD camera, 60fps screen share & Co-Browse Together',
      isDirect: false,
      isGroupChat: false,
      isVoice: true,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 500000,
    },
    {
      id: '!proto_stage:local.protutech',
      name: '🎙️ Studio 48kHz Stage',
      topic: 'Watch Together & Co-Browse Web Search Stage',
      isDirect: false,
      isGroupChat: false,
      isVoice: true,
      guildId: 'guild_protutech_hq',
      guildName: 'Protutech HQ',
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 550000,
    },

    // Hybrid Bridged Server: Bridged Lounge
    {
      id: '!disc_general:local.protutech',
      name: 'bridge-general',
      topic: 'Bidirectional Bridge <-> Protutech hybrid channel',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_discord_bridged',
      guildName: 'Bridged Lounge',
      isSynced: true,
      syncSource: 'discord',
      serverKind: 'discord',
      discordGuildId: '987654321098765432',
      discordChannelId: '111000111000111001',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 90000,
    },
    {
      id: '!disc_quests:local.protutech',
      name: 'quests-and-drops',
      topic: 'Community Quests tracker, plugin perks, and reward claims',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_discord_bridged',
      guildName: 'Bridged Lounge',
      isSynced: true,
      syncSource: 'discord',
      serverKind: 'discord',
      discordGuildId: '987654321098765432',
      discordChannelId: '111000111000111002',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 200000,
    },
    {
      id: '!disc_memes:local.protutech',
      name: 'media-and-clips',
      topic: 'Bridged media, embeds, and clips',
      isDirect: false,
      isGroupChat: false,
      isVoice: false,
      guildId: 'guild_discord_bridged',
      guildName: 'Bridged Lounge',
      isSynced: true,
      syncSource: 'discord',
      serverKind: 'discord',
      discordGuildId: '987654321098765432',
      discordChannelId: '111000111000111003',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 250000,
    },
    {
      id: '!disc_voice:local.protutech',
      name: '🔊 Bridged VC',
      topic: 'Hybrid Bridge & Local WebRTC Voice Channel',
      isDirect: false,
      isGroupChat: false,
      isVoice: true,
      guildId: 'guild_discord_bridged',
      guildName: 'Bridged Lounge',
      isSynced: true,
      syncSource: 'discord',
      serverKind: 'discord',
      discordGuildId: '987654321098765432',
      discordChannelId: '111000111000111004',
      members: [...members],
      unreadCount: 0,
      lastMessageTimestamp: now - 280000,
    },

    // DMs & Group Chats
    {
      id: '!dm_protutech_bot:local.protutech',
      name: 'Protutech Core',
      topic: 'Direct line to your self-hosted Protutech server',
      isDirect: true,
      isGroupChat: false,
      isVoice: false,
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'proprietary',
      members: [members[0], members[1]],
      unreadCount: 0,
      lastMessageTimestamp: now - 60000,
    },
    {
      id: '!dm_alex_discord:local.protutech',
      name: 'Alex (Bridge)',
      topic: 'Bridged Direct Message',
      isDirect: true,
      isGroupChat: false,
      isVoice: false,
      isSynced: true,
      syncSource: 'discord',
      serverKind: 'discord',
      members: [members[0], members[2]],
      unreadCount: 0,
      lastMessageTimestamp: now - 150000,
    },
    {
      id: '!grp_squad_ops:local.protutech',
      name: 'Squad Ops',
      topic: 'Private squad group chat + voice & co-browse',
      isDirect: false,
      isGroupChat: true,
      isVoice: false,
      isSynced: false,
      syncSource: 'matrix',
      serverKind: 'hybrid',
      members: [members[0], members[2], members[3]],
      unreadCount: 0,
      lastMessageTimestamp: now - 170000,
    },
  ];

  const guilds = [
    {
      id: 'guild_protutech_hq',
      name: 'Protutech HQ',
      hasVoice: true,
      isAlwaysSynced: false,
      isProprietary: true,
      serverKind: 'proprietary',
      bridgedChannelCount: 0,
    },
    {
      id: 'guild_discord_bridged',
      name: 'Bridged Lounge',
      hasVoice: true,
      isAlwaysSynced: true,
      isProprietary: false,
      serverKind: 'discord',
      discordGuildId: '987654321098765432',
      bridgedChannelCount: 4,
    },
  ];

  const messages = {
    '!proto_general:local.protutech': [
      {
        id: 'msg_seed_1',
        roomId: '!proto_general:local.protutech',
        sender: '@protutech_bot:local.protutech',
        senderName: 'Protutech Core',
        body: '🚀 **Self-Hosted + Hybrid Engine Online!** Running locally with zero external dependencies, instant SSE live updates, large chunked file transfers, Co-Browse search, and bidirectional bridge sync.',
        timestamp: now - 120000,
        source: 'app',
      },
      {
        id: 'msg_seed_2',
        roomId: '!proto_general:local.protutech',
        sender: '@andrex:local.protutech',
        senderName: 'andrex',
        body: 'Try `/ping`, `/roll 20`, `/mc list`, `/poll Game Night? | Minecraft | Valorant`, or open **Scripts & Bots** & **Large Files** in Tools!',
        timestamp: now - 60000,
        source: 'app',
      },
    ],
    '!proto_minecraft:local.protutech': [
      {
        id: 'msg_mc_seed_1',
        roomId: '!proto_minecraft:local.protutech',
        sender: '@mc_bridge:local.protutech',
        senderName: '⛏️ Minecraft SMP Bridge',
        body: '⛏️ **[MC • Survival SMP (1.21)]** Bridge connected and listening on `/api/scripts/ingest` and `/api/webhooks/wh_minecraft_bridge/pt_mc_bridge_v1`.',
        timestamp: now - 180000,
        source: 'app',
        webhookMeta: {
          username: 'Survival SMP',
          bridge: 'minecraft',
          serverName: 'Survival SMP (1.21)',
        },
      },
    ],
    '!proto_scripts:local.protutech': [
      {
        id: 'msg_scr_seed_1',
        roomId: '!proto_scripts:local.protutech',
        sender: '@protutech_bot:local.protutech',
        senderName: 'Protutech Core',
        body: '⚙️ Send webhook `{ content, username, embeds }` or Minecraft `{ server, player, message, eventType }` payloads to `/api/scripts/ingest` to inject real-time messages here.',
        timestamp: now - 240000,
        source: 'app',
      },
    ],
    '!disc_general:local.protutech': [
      {
        id: 'msg_disc_seed_1',
        roomId: '!disc_general:local.protutech',
        sender: '@_discord_1001:local.protutech',
        senderName: 'Alex (Bridge)',
        body: 'Hey! Bridged from Bridged Lounge — messages, edits, reactions, and settings sync both ways seamlessly.',
        timestamp: now - 90000,
        source: 'discord',
        reactions: { '⚡': ['@andrex:local.protutech'] },
      },
    ],
    '!disc_quests:local.protutech': [
      {
        id: 'msg_quest_seed_1',
        roomId: '!disc_quests:local.protutech',
        sender: '@_discord_1002:local.protutech',
        senderName: 'Nova (Bridge)',
        body: '🏆 Open **Hub & Quests** in the top bar to progress or auto-complete active quests and claim avatar decorations!',
        timestamp: now - 200000,
        source: 'discord',
      },
    ],
    '!dm_protutech_bot:local.protutech': [
      {
        id: 'msg_dm_seed_1',
        roomId: '!dm_protutech_bot:local.protutech',
        sender: '@protutech_bot:local.protutech',
        senderName: 'Protutech Core',
        body: 'Welcome `andrex`! Your self-hosted database is persisted in `server-data/db.json`.',
        timestamp: now - 60000,
        source: 'app',
      },
    ],
    '!dm_alex_discord:local.protutech': [
      {
        id: 'msg_dm_alex_1',
        roomId: '!dm_alex_discord:local.protutech',
        sender: '@_discord_1001:local.protutech',
        senderName: 'Alex (Bridge)',
        body: 'Want to co-browse or hop into Voice Lounge? Camera and 1080p60 screen share work instantly.',
        timestamp: now - 150000,
        source: 'discord',
      },
    ],
    '!grp_squad_ops:local.protutech': [
      {
        id: 'msg_grp_1',
        roomId: '!grp_squad_ops:local.protutech',
        sender: '@_discord_1002:local.protutech',
        senderName: 'Nova (Bridge)',
        body: 'Squad Ops ready — drop large files or launch Co-Browse Search anytime.',
        timestamp: now - 170000,
        source: 'discord',
      },
    ],
  };

  const quests = [
    {
      id: 'quest_stream_squad_15',
      title: 'Stream 15 Minutes to Friends',
      gameName: 'Protutech Live Screen Share',
      description: 'Go live at 1080p60 in any Voice Lounge or Bridged VC for 15 minutes.',
      category: 'stream',
      progress: 40,
      target: 100,
      accepted: true,
      completed: false,
      claimed: false,
      rewardName: 'Cyber Ring Avatar Decoration',
      rewardDecoration: 'cyber_ring',
      rewardBadge: 'Quest Streamer',
      expiresAt: '2026-12-31',
    },
    {
      id: 'quest_minecraft_smp',
      title: 'Minecraft SMP Survival Session',
      gameName: 'Minecraft (1.21)',
      description: 'Connect your Minecraft SMP bridge or run a /mc command in chat.',
      category: 'play',
      progress: 50,
      target: 100,
      accepted: true,
      completed: false,
      claimed: false,
      rewardName: 'Neon Pulse Aura',
      rewardDecoration: 'neon_pulse',
      rewardBadge: 'Block Architect',
      expiresAt: '2026-12-31',
    },
    {
      id: 'quest_cobrowse_orbs',
      title: 'Co-Browse & Watch Together',
      gameName: 'Protutech Co-Browser',
      description: 'Search and launch a synchronized web page or video in Co-Browse.',
      category: 'orbs',
      progress: 0,
      target: 100,
      accepted: false,
      completed: false,
      claimed: false,
      rewardName: '500 Protutech Orbs + Plasma Aura',
      rewardDecoration: 'plasma_aura',
      rewardBadge: 'Co-Browse Explorer',
      expiresAt: '2026-12-31',
    },
    {
      id: 'quest_discord_crown',
      title: 'Hybrid Bridge Master',
      gameName: 'Bridged Lounge',
      description: 'Sync bidirectional settings between App and External Bridge.',
      category: 'decoration',
      progress: 75,
      target: 100,
      accepted: true,
      completed: false,
      claimed: false,
      rewardName: 'Bridge Crown Decoration',
      rewardDecoration: 'discord_crown',
      rewardBadge: 'Hybrid Pioneer',
      expiresAt: '2026-12-31',
    },
  ];

  const settings = {
    syncEnabled: true,
    discordTokenConnected: false,
    status: 'online',
    customStatusText: 'Self-Hosted Hybrid Active',
    customStatusEmoji: '⚡',
    displayName: 'andrex',
    pronouns: '',
    bio: 'Self-hosted + Hybrid Protutech user',
    accentColor: '#00f2fe',
    bannerColor: '#0e7490',
    theme: 'dark',
    messageDisplayCompact: false,
    developerMode: true,
    animateEmoji: true,
    gifAutoPlay: true,
    noiseSuppression: 'krisp',
    echoCancellation: true,
    automaticGainControl: true,
    inputVolume: 100,
    outputVolume: 100,
    dmSpamFilter: true,
    allowDmsFromServerMembers: true,
    syncedAt: now,
    discordForwarded: false,
  };

  const webhooks = [
    {
      id: 'wh_minecraft_bridge',
      name: 'Minecraft Survival SMP Bridge',
      channelId: '!proto_minecraft:local.protutech',
      channelName: 'minecraft-chat',
      token: 'pt_mc_bridge_v1',
      url: '/api/webhooks/wh_minecraft_bridge/pt_mc_bridge_v1',
      bridgeType: 'minecraft',
      enabled: true,
      createdAt: now - 86400000,
    },
    {
      id: 'wh_discord_relay',
      name: 'Bridge Webhook Endpoint',
      channelId: '!disc_general:local.protutech',
      channelName: 'bridge-general',
      token: 'pt_discord_compat_v1',
      url: '/api/webhooks/wh_discord_relay/pt_discord_compat_v1',
      bridgeType: 'discord',
      enabled: true,
      createdAt: now - 43200000,
    },
  ];

  const discordCatalog = {
    guilds: [
      {
        id: '987654321098765432',
        name: 'Bridged Lounge',
        avatar: null,
        avatar_url: null,
        bridged: true,
      },
      {
        id: '987654321098765433',
        name: 'Equicord & Vencord Lab',
        avatar: null,
        avatar_url: null,
        bridged: false,
      },
      {
        id: '987654321098765434',
        name: 'Minecraft SMP Community',
        avatar: null,
        avatar_url: null,
        bridged: false,
      },
    ],
    channelsByGuild: {
      '987654321098765432': [
        { id: 'cat_text', name: 'Text Channels', type: 'category', type_id: 4, is_bridged: true },
        {
          id: '111000111000111001',
          name: 'bridge-general',
          type: 'text',
          type_id: 0,
          category_id: 'cat_text',
          category_name: 'Text Channels',
          is_bridged: true,
          mxid: '!disc_general:local.protutech',
        },
        {
          id: '111000111000111002',
          name: 'quests-and-drops',
          type: 'text',
          type_id: 0,
          category_id: 'cat_text',
          category_name: 'Text Channels',
          is_bridged: true,
          mxid: '!disc_quests:local.protutech',
        },
        {
          id: '111000111000111004',
          name: 'Bridged VC',
          type: 'voice',
          type_id: 2,
          is_bridged: true,
          mxid: '!disc_voice:local.protutech',
        },
      ],
      '987654321098765433': [
        { id: '2220001', name: 'plugins-chat', type: 'text', type_id: 0, is_bridged: false },
        { id: '2220002', name: 'custom-css', type: 'text', type_id: 0, is_bridged: false },
        { id: '2220003', name: 'Dev Stage', type: 'voice', type_id: 2, is_bridged: false },
      ],
      '987654321098765434': [
        { id: '3330001', name: 'smp-chat', type: 'text', type_id: 0, is_bridged: false },
        { id: '3330002', name: 'trading-post', type: 'text', type_id: 0, is_bridged: false },
        { id: '3330003', name: 'SMP Voice', type: 'voice', type_id: 2, is_bridged: false },
      ],
    },
    dms: [
      {
        id: 'dm_dc_101',
        name: 'Alex (Bridge)',
        type: 'dm',
        type_id: 1,
        other_user_id: '1001',
        is_bridged: true,
        mxid: '!dm_alex_discord:local.protutech',
      },
      {
        id: 'dm_dc_102',
        name: 'Nova (Bridge)',
        type: 'dm',
        type_id: 1,
        other_user_id: '1002',
        is_bridged: false,
      },
      {
        id: 'grp_dc_201',
        name: 'Late Night Co-Browse Squad',
        type: 'group',
        type_id: 3,
        is_bridged: false,
      },
    ],
  };

  return {
    mode: 'hybrid',
    users: Object.fromEntries(members.map((m) => [m.userId, m])),
    guilds,
    rooms,
    messages,
    quests,
    settings,
    webhooks,
    discordCatalog,
    files: [],
    media: {},
    soundboard: [],
    cobrowse: {
      url: '',
      videoUrl: '',
      isPlaying: false,
      currentTime: 0,
      searchQuery: '',
      updatedBy: 'andrex',
      updatedAt: now,
    },
  };
}

function hydrateGuildsWithRooms(db) {
  return (db.guilds || []).map((guild) => {
    const channels = (db.rooms || []).filter((r) => r.guildId === guild.id);
    return {
      ...guild,
      channels,
    };
  });
}

function createDatabaseStore(dataDir) {
  const resolvedDir = path.resolve(dataDir || DEFAULT_DATA_DIR);
  const uploadsDir = path.join(resolvedDir, 'uploads');
  const stagingDir = path.join(uploadsDir, '.staging');
  const soundboardDir = path.join(resolvedDir, 'soundboard');
  const dbPath = path.join(resolvedDir, 'db.json');

  fs.mkdirSync(resolvedDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(soundboardDir, { recursive: true });

  const defaults = createSeedDatabase();
  let db = defaults;

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(raw);
      db = {
        ...defaults,
        ...parsed,
        settings: { ...defaults.settings, ...(parsed.settings || {}) },
        cobrowse: { ...defaults.cobrowse, ...(parsed.cobrowse || {}) },
        discordCatalog: {
          ...defaults.discordCatalog,
          ...(parsed.discordCatalog || {}),
        },
        messages: parsed.messages || defaults.messages,
        users: { ...defaults.users, ...(parsed.users || {}) },
      };
      if (!Array.isArray(db.guilds) || db.guilds.length === 0) db.guilds = defaults.guilds;
      if (!Array.isArray(db.rooms) || db.rooms.length === 0) db.rooms = defaults.rooms;
      if (!Array.isArray(db.quests) || db.quests.length === 0) db.quests = defaults.quests;
      if (!Array.isArray(db.webhooks) || db.webhooks.length === 0) db.webhooks = defaults.webhooks;
      if (!Array.isArray(db.files)) db.files = [];
      if (!Array.isArray(db.soundboard)) db.soundboard = [];
      if (!db.media || typeof db.media !== 'object') db.media = {};
    } catch {
      db = defaults;
    }
  }

  function save() {
    try {
      const tmpPath = `${dbPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
      fs.renameSync(tmpPath, dbPath);
    } catch {
      try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      } catch {
        // Ignore transient write failures
      }
    }
  }

  save();

  return {
    resolvedDir,
    uploadsDir,
    stagingDir,
    soundboardDir,
    dbPath,
    get db() {
      return db;
    },
    save,
  };
}

async function fetchJsonWithTimeout(targetUrl, options = {}, timeoutMs = 3500) {
  const res = await fetch(targetUrl, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchDiscordApi(endpoint, token, options = {}) {
  if (!token) return { ok: false, status: 401, data: null };
  try {
    const res = await fetch(`https://discord.com/api/v9${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function proxyLocalBridgeApi(reqPath, method = 'GET', bodyObj = null, extraHeaders = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    const res = await fetch(`http://127.0.0.1:8089${reqPath}`, {
      method,
      headers,
      body: bodyObj !== null && method !== 'GET' ? JSON.stringify(bodyObj) : undefined,
      signal: AbortSignal.timeout(900),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function buildCuratedAndVideoResults(query, type) {
  const q = query.trim();
  const encoded = encodeURIComponent(q);
  const lower = q.toLowerCase();

  const videoCatalog = [
    {
      title: `Watch Together: "${q}" (Sample HD Stream — Big Buck Bunny)`,
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      snippet: `Instant synchronized HTML5 HD video stream ready for Watch Together (${q}).`,
      type: 'video',
      source: 'Protutech Media',
      videoEmbedUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    },
    {
      title: `YouTube Search Embed: ${q}`,
      url: `https://www.youtube.com/results?search_query=${encoded}`,
      snippet: `Browse and watch "${q}" videos inside the Co-Browser.`,
      type: 'video',
      source: 'YouTube',
      videoEmbedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encoded}`,
    },
  ];

  if (lower.includes('elephants') || lower.includes('blender') || lower.includes('animation')) {
    videoCatalog.unshift({
      title: 'Sintel (Open Movie 1080p Stream)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      snippet: 'Open-source Blender Foundation short film stream for synchronized watch parties.',
      type: 'video',
      source: 'Open Media',
      videoEmbedUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    });
  }

  const webFallback = [
    {
      title: `${q} — Wikipedia Encyclopedia`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(q.replace(/\s+/g, '_'))}`,
      snippet: `Encyclopedia article and references for "${q}". Opens cleanly in Co-Browser.`,
      type: 'wiki',
      source: 'Wikipedia',
      videoEmbedUrl: null,
    },
    {
      title: `${q} — DuckDuckGo Web Search`,
      url: `https://html.duckduckgo.com/html/?q=${encoded}`,
      snippet: `Explore web pages, documentation, and discussions matching "${q}".`,
      type: 'web',
      source: 'DuckDuckGo',
      videoEmbedUrl: null,
    },
    {
      title: `${q} — MDN & Developer Reference`,
      url: `https://developer.mozilla.org/en-US/search?q=${encoded}`,
      snippet: `Technical documentation, guides, and API specifications related to "${q}".`,
      type: 'web',
      source: 'Web Reference',
      videoEmbedUrl: null,
    },
  ];

  if (type === 'video') return videoCatalog;
  if (type === 'wiki') return [webFallback[0]];
  return [...videoCatalog.slice(0, 1), ...webFallback];
}

async function performBuiltInSearch(query, type = 'all') {
  const cleanQuery = String(query || '').trim() || 'Protutech';
  const normalizedType = ['all', 'video', 'wiki'].includes(type) ? type : 'all';

  const wikiPromise = fetchJsonWithTimeout(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      cleanQuery
    )}&limit=6&format=json`,
    {
      headers: {
        'User-Agent': 'ProtutechChat/1.0 (https://chat.protutech.vip)',
        Accept: 'application/json',
      },
    },
    3200
  );

  const ddgPromise =
    normalizedType === 'wiki'
      ? Promise.resolve(null)
      : fetchJsonWithTimeout(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(
            cleanQuery
          )}&format=json&no_html=1&skip_disambig=1`,
          {
            headers: {
              'User-Agent': 'ProtutechChat/1.0',
              Accept: 'application/json',
            },
          },
          3200
        );

  const [wikiRes, ddgRes] = await Promise.allSettled([wikiPromise, ddgPromise]);
  const results = [];
  const seenUrls = new Set();

  const pushResult = (item) => {
    if (!item || !item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    results.push({
      title: item.title || item.url,
      url: item.url,
      snippet: item.snippet || '',
      type: item.type || 'web',
      source: item.source || 'Web',
      videoEmbedUrl: item.videoEmbedUrl || undefined,
    });
  };

  // 1. Parse Wikipedia OpenSearch [query, titles[], descriptions[], urls[]]
  if (wikiRes.status === 'fulfilled' && Array.isArray(wikiRes.value)) {
    const titles = Array.isArray(wikiRes.value[1]) ? wikiRes.value[1] : [];
    const snippets = Array.isArray(wikiRes.value[2]) ? wikiRes.value[2] : [];
    const urls = Array.isArray(wikiRes.value[3]) ? wikiRes.value[3] : [];
    for (let i = 0; i < titles.length; i += 1) {
      if (urls[i]) {
        pushResult({
          title: titles[i],
          url: urls[i],
          snippet: snippets[i] || `Wikipedia entry for ${titles[i]}`,
          type: 'wiki',
          source: 'Wikipedia',
        });
      }
    }
  }

  // 2. Parse DuckDuckGo Instant Answer
  if (
    normalizedType !== 'wiki' &&
    ddgRes.status === 'fulfilled' &&
    ddgRes.value &&
    typeof ddgRes.value === 'object'
  ) {
    const ddg = ddgRes.value;
    if (ddg.AbstractURL && ddg.Heading) {
      pushResult({
        title: ddg.Heading,
        url: ddg.AbstractURL,
        snippet: ddg.AbstractText || ddg.Abstract || `DuckDuckGo summary for ${ddg.Heading}`,
        type: 'web',
        source: ddg.AbstractSource || 'DuckDuckGo',
      });
    }
    if (Array.isArray(ddg.Results)) {
      for (const item of ddg.Results.slice(0, 4)) {
        if (item.FirstURL && item.Text) {
          pushResult({
            title: item.Text,
            url: item.FirstURL,
            snippet: item.Text,
            type: 'web',
            source: 'DuckDuckGo',
          });
        }
      }
    }
    if (Array.isArray(ddg.RelatedTopics)) {
      for (const topic of ddg.RelatedTopics.slice(0, 5)) {
        if (topic && topic.FirstURL && topic.Text) {
          pushResult({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 64),
            url: topic.FirstURL,
            snippet: topic.Text,
            type: 'web',
            source: 'DuckDuckGo',
          });
        }
      }
    }
  }

  // 3. Video / curated fallback results
  const curated = buildCuratedAndVideoResults(cleanQuery, normalizedType);
  for (const c of curated) {
    if (normalizedType === 'video') {
      pushResult(c);
    } else if (results.length < 6 || c.type === 'video') {
      pushResult(c);
    }
  }

  const filtered =
    normalizedType === 'wiki'
      ? results.filter((r) => r.type === 'wiki')
      : normalizedType === 'video'
      ? results.filter((r) => r.type === 'video')
      : results;

  return {
    query: cleanQuery,
    type: normalizedType,
    results: filtered.length > 0 ? filtered : curated,
  };
}

function isDisallowedProxyHost(hostname) {
  const host = (hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return true;
  }
  if (host === '169.254.169.254') return true;
  return false;
}

function rewriteHtmlForCoBrowse(html, finalUrl) {
  let out = String(html || '');
  // Strip restrictive frame / CSP meta tags
  out = out.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?\s*(Content-Security-Policy|X-Frame-Options)\s*["']?[^>]*>/gi,
    ''
  );

  const safeHref = finalUrl.replace(/"/g, '&quot;');
  const baseTag = `<base href="${safeHref}" target="_self">`;

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (match) => `${match}\n${baseTag}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (match) => `${match}\n<head>${baseTag}</head>`);
  } else {
    out = `<head>${baseTag}</head>\n${out}`;
  }

  return out;
}

function simulateMinecraftRcon(command) {
  const cmd = String(command || '').trim().replace(/^\//, '');
  const lower = cmd.toLowerCase();
  if (lower === 'list') {
    return 'There are 6 of a max of 20 players online: andrex, notch, alex, steve, gamer99, creeper_hunter';
  }
  if (lower.startsWith('say ')) {
    return `[Server] ${cmd.slice(4)}`;
  }
  if (lower === 'tps') {
    return 'TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.99';
  }
  if (lower === 'help') {
    return 'Commands: list, tps, say <msg>, time set <day|night>, weather <clear|rain>, op <user>, kick <user>';
  }
  return `Command "/${cmd}" executed on self-hosted Minecraft RCON bridge.`;
}

function createRequestHandler(dataDir) {
  const store = createDatabaseStore(dataDir);
  const sseClients = new Set();
  const activeUploads = new Map();
  let syncBatchCounter = 1;
  const syncWaiters = new Set();

  function broadcastEvent(eventName, data) {
    syncBatchCounter += 1;
    for (const waiter of syncWaiters) {
      waiter(eventName, data);
    }

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        if (!client.res.writableEnded) {
          client.res.write(payload);
        }
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function resolveRoomByIdOrName(roomIdOrName) {
    const db = store.db;
    if (!roomIdOrName) return db.rooms[0] || null;
    const direct = db.rooms.find((r) => r.id === roomIdOrName);
    if (direct) return direct;
    const clean = String(roomIdOrName).replace(/^#/, '').toLowerCase();
    const byName = db.rooms.find((r) => r.name.toLowerCase() === clean);
    return byName || db.rooms[0] || null;
  }

  function appendMessageToRoom(roomId, msgObj) {
    const db = store.db;
    const resolvedRoom = resolveRoomByIdOrName(roomId);
    const targetRoomId = resolvedRoom ? resolvedRoom.id : roomId || '!proto_general:local.protutech';

    if (!Array.isArray(db.messages[targetRoomId])) {
      db.messages[targetRoomId] = [];
    }

    const message = {
      id: msgObj.id || `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      roomId: targetRoomId,
      sender: msgObj.sender || '@andrex:local.protutech',
      senderName: msgObj.senderName || 'andrex',
      avatarUrl: msgObj.avatarUrl,
      body: msgObj.body || '',
      formattedBody: msgObj.formattedBody,
      timestamp: msgObj.timestamp || Date.now(),
      mediaUrl: msgObj.mediaUrl,
      mediaType: msgObj.mediaType,
      replyTo: msgObj.replyTo,
      reactions: msgObj.reactions,
      source: msgObj.source || 'app',
      largeFile: msgObj.largeFile,
      webhookMeta: msgObj.webhookMeta,
      isEdited: false,
      isDeleted: false,
    };

    const existingIdx = db.messages[targetRoomId].findIndex((m) => m.id === message.id);
    if (existingIdx >= 0) {
      db.messages[targetRoomId][existingIdx] = message;
    } else {
      db.messages[targetRoomId].push(message);
    }

    if (db.messages[targetRoomId].length > 500) {
      db.messages[targetRoomId] = db.messages[targetRoomId].slice(-500);
    }

    if (resolvedRoom) {
      resolvedRoom.lastMessageTimestamp = message.timestamp;
    }

    store.save();
    broadcastEvent('message', { roomId: targetRoomId, message });
    return message;
  }

  function formatIngestBody(body) {
    if (body.player || body.server || body.eventType) {
      const server = String(body.server || 'Survival SMP (1.21)');
      const player = String(body.player || 'Steve');
      const eventType = String(body.eventType || 'chat');
      const rawMsg = String(body.message || body.content || 'connected to the server');
      if (body.content && String(body.content).includes('**[MC')) {
        return String(body.content);
      }
      const prefix =
        eventType === 'join'
          ? '🟢'
          : eventType === 'leave'
          ? '🔴'
          : eventType === 'advancement'
          ? '🏆'
          : '⛏️';
      return eventType === 'chat'
        ? `${prefix} **[MC • ${server}] <${player}>** ${rawMsg}`
        : `${prefix} **[MC • ${server}]** **${player}** ${rawMsg}`;
    }

    const parts = [];
    if (body.content) parts.push(String(body.content));
    if (Array.isArray(body.embeds) && body.embeds.length > 0) {
      for (const emb of body.embeds) {
        if (!emb || typeof emb !== 'object') continue;
        const lines = [];
        if (emb.title) lines.push(`**${emb.title}**`);
        if (emb.description) lines.push(String(emb.description));
        if (lines.length > 0) parts.push(lines.join('\n'));
      }
    }
    return parts.join('\n') || 'Webhook event received';
  }

  function toMatrixEvent(msg) {
    const content = {
      msgtype:
        msg.mediaType === 'image'
          ? 'm.image'
          : msg.mediaType === 'video'
          ? 'm.video'
          : msg.mediaType === 'audio'
          ? 'm.audio'
          : msg.mediaType === 'file'
          ? 'm.file'
          : 'm.text',
      body: msg.body,
    };
    if (msg.formattedBody) {
      content.format = 'org.matrix.custom.html';
      content.formatted_body = msg.formattedBody;
    }
    if (msg.mediaUrl) {
      content.url = msg.mediaUrl;
    }
    if (msg.replyTo?.id) {
      content['m.relates_to'] = {
        'm.in_reply_to': { event_id: msg.replyTo.id },
      };
    }
    return {
      type: 'm.room.message',
      event_id: msg.id,
      room_id: msg.roomId,
      sender: msg.sender,
      origin_server_ts: msg.timestamp,
      content,
    };
  }

  return async function requestHandler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const rawUrl = req.originalUrl || req.url || '/';
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl, 'http://127.0.0.1');
    } catch {
      sendJson(res, 400, { error: 'Invalid request URL' });
      return;
    }

    const pathname = parsedUrl.pathname;
    const method = (req.method || 'GET').toUpperCase();
    const discordToken = String(req.headers['x-discord-token'] || '').trim();
    const db = store.db;

    // ---------------------------------------------------------
    // 1. Health & Voice Token / Minecraft RCON Compatibility
    // ---------------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        engine: 'protutech-self-hosted-node24',
        mode: db.mode,
        roomsCount: db.rooms.length,
        guildsCount: db.guilds.length,
        timestamp: Date.now(),
      });
      return;
    }

    if (pathname === '/api/voice/token') {
      const body = method === 'POST' ? await readJsonBody(req) : null;
      const bridgeRes = await proxyLocalBridgeApi(
        rawUrl.startsWith('/api/') ? rawUrl : '/api/voice/token',
        method,
        body
      );
      if (bridgeRes.ok && bridgeRes.data && bridgeRes.data.token) {
        sendJson(res, 200, {
          ok: true,
          selfHosted: true,
          ...bridgeRes.data,
          url: bridgeRes.data.url || 'wss://chat.protutech.vip/rtc',
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        selfHosted: true,
        mode: 'local_webrtc',
        fallback: true,
      });
      return;
    }

    if (pathname === '/api/minecraft/rcon' && method === 'POST') {
      const body = await readJsonBody(req);
      const bridgeRes = await proxyLocalBridgeApi('/api/minecraft/rcon', 'POST', body);
      if (bridgeRes.ok && bridgeRes.data && bridgeRes.data.status === 'success') {
        sendJson(res, 200, bridgeRes.data);
        return;
      }
      const response = simulateMinecraftRcon(body.command);
      sendJson(res, 200, { ok: true, server_id: body.server_id, response });
      return;
    }

    if (pathname === '/api/auto-setup' || pathname.startsWith('/api/qr/')) {
      const body = method === 'POST' ? await readJsonBody(req) : null;
      const bridgeRes = await proxyLocalBridgeApi(rawUrl, method, body);
      if (bridgeRes.ok && bridgeRes.data) {
        sendJson(res, bridgeRes.status || 200, bridgeRes.data);
        return;
      }
      sendJson(res, 200, {
        status: 'success',
        selfHosted: true,
        mode: db.mode,
        message: 'Self-hosted engine active without requiring remote Matrix setup.',
      });
      return;
    }

    // ---------------------------------------------------------
    // 2. Auth & Bootstrap
    // ---------------------------------------------------------
    if (
      (pathname === '/api/auth/login' || pathname === '/_matrix/client/v3/login') &&
      method === 'POST'
    ) {
      const body = await readJsonBody(req);
      const username = sanitizeUsername(
        body.username || body.user || body.identifier?.user || 'andrex'
      );
      const requestedMode = body.mode;
      if (
        requestedMode &&
        ['hybrid', 'proprietary', 'discord_proxy'].includes(String(requestedMode))
      ) {
        db.mode = String(requestedMode);
      }

      const userId = `@${username}:local.protutech`;
      if (!db.users[userId]) {
        db.users[userId] = {
          userId,
          username,
          displayName: username,
          presence: 'online',
          statusMsg: 'Connected to Self-Hosted Protutech',
          isDiscordBridged: false,
        };
      } else {
        db.users[userId].presence = 'online';
      }
      store.save();

      const accessToken = `syt_local_${username}_${crypto.randomBytes(12).toString('hex')}`;
      sendJson(res, 200, {
        user_id: userId,
        access_token: accessToken,
        home_server: 'local.protutech',
        device_id: 'PROTUTECH_SELFHOSTED',
        username,
        mode: db.mode,
      });
      return;
    }

    if (pathname === '/api/bootstrap' && method === 'GET') {
      const modeParam = parsedUrl.searchParams.get('mode');
      const activeMode =
        modeParam && ['hybrid', 'proprietary', 'discord_proxy'].includes(modeParam)
          ? modeParam
          : db.mode || 'hybrid';

      const allGuilds = hydrateGuildsWithRooms(db);
      const filteredGuilds =
        activeMode === 'proprietary'
          ? allGuilds.filter((g) => g.serverKind !== 'discord' && !g.isAlwaysSynced)
          : allGuilds;
      const filteredRooms =
        activeMode === 'proprietary'
          ? db.rooms.filter((r) => r.syncSource !== 'discord' || r.isDirect)
          : db.rooms;

      sendJson(res, 200, {
        mode: activeMode,
        rooms: filteredRooms,
        guilds: filteredGuilds,
        settings: db.settings,
        quests: db.quests,
        webhooks: db.webhooks,
        cobrowse: db.cobrowse,
      });
      return;
    }

    // ---------------------------------------------------------
    // 3. SSE Live Events Stream
    // ---------------------------------------------------------
    if (pathname === '/api/events' && method === 'GET') {
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      const clientEntry = { res };
      sseClients.add(clientEntry);

      res.write(
        `event: hello\ndata: ${JSON.stringify({
          ok: true,
          mode: db.mode,
          timestamp: Date.now(),
        })}\n\n`
      );

      const keepAlive = setInterval(() => {
        if (res.writableEnded) {
          clearInterval(keepAlive);
          sseClients.delete(clientEntry);
          return;
        }
        try {
          res.write(`: keepalive ${Date.now()}\n\n`);
        } catch {
          clearInterval(keepAlive);
          sseClients.delete(clientEntry);
        }
      }, 20000);

      req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(clientEntry);
      });
      return;
    }

    // ---------------------------------------------------------
    // 4. Matrix v3 & Media Compatibility Routes
    // ---------------------------------------------------------
    if (pathname === '/_matrix/client/v3/sync' && method === 'GET') {
      const sinceParam = parsedUrl.searchParams.get('since');
      const timeoutMs = Math.min(
        25000,
        Math.max(0, Number(parsedUrl.searchParams.get('timeout') || 0))
      );
      const sinceBatch = sinceParam ? Number(sinceParam.replace(/^s_/, '')) : 0;

      if (sinceParam && sinceBatch >= syncBatchCounter && timeoutMs > 0) {
        await new Promise((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            syncWaiters.delete(onWake);
            resolve();
          };
          const onWake = () => done();
          const timer = setTimeout(done, timeoutMs);
          syncWaiters.add(onWake);
          req.on('close', done);
        });
      }

      const joinMap = {};
      for (const room of db.rooms) {
        const roomMsgs = (db.messages[room.id] || []).slice(-25);
        joinMap[room.id] = {
          state: {
            events: [
              { type: 'm.room.name', content: { name: room.name }, state_key: '' },
              ...(room.topic
                ? [{ type: 'm.room.topic', content: { topic: room.topic }, state_key: '' }]
                : []),
            ],
          },
          timeline: {
            events: sinceParam ? roomMsgs.slice(-5).map(toMatrixEvent) : roomMsgs.map(toMatrixEvent),
          },
        };
      }

      sendJson(res, 200, {
        next_batch: `s_${syncBatchCounter}`,
        presence: {
          events: Object.values(db.users).map((u) => ({
            type: 'm.presence',
            sender: u.userId,
            content: { presence: u.presence || 'online', status_msg: u.statusMsg || '' },
          })),
        },
        rooms: { join: joinMap },
      });
      return;
    }

    if (pathname === '/_matrix/client/v3/joined_rooms' && method === 'GET') {
      const spaceIds = db.guilds.map((g) => g.id);
      const roomIds = db.rooms.map((r) => r.id);
      sendJson(res, 200, { joined_rooms: [...spaceIds, ...roomIds] });
      return;
    }

    if (
      /^\/_matrix\/client\/v3\/user\/[^/]+\/account_data\/m\.direct$/.test(pathname) &&
      method === 'GET'
    ) {
      const dmMap = {};
      for (const r of db.rooms) {
        if (r.isDirect) {
          const peer = r.members?.[1]?.userId || '@protutech_bot:local.protutech';
          dmMap[peer] = dmMap[peer] || [];
          dmMap[peer].push(r.id);
        }
      }
      sendJson(res, 200, dmMap);
      return;
    }

    const matrixStateMatch = pathname.match(/^\/_matrix\/client\/v3\/rooms\/([^/]+)\/state$/);
    if (matrixStateMatch && method === 'GET') {
      const targetId = decodeURIComponent(matrixStateMatch[1]);
      const guild = db.guilds.find((g) => g.id === targetId);
      if (guild) {
        sendJson(res, 200, [
          { type: 'm.room.create', state_key: '', content: { type: 'm.space' } },
          { type: 'm.room.name', state_key: '', content: { name: guild.name } },
          ...(guild.isAlwaysSynced
            ? [
                {
                  type: 'm.bridge',
                  state_key: 'discord',
                  content: {
                    protocol: { id: 'discord' },
                    network: { id: guild.discordGuildId || guild.id },
                  },
                },
              ]
            : []),
        ]);
        return;
      }

      const room = db.rooms.find((r) => r.id === targetId);
      if (!room) {
        sendJson(res, 404, { errcode: 'M_NOT_FOUND', error: 'Room not found' });
        return;
      }
      const events = [
        { type: 'm.room.create', state_key: '', content: {} },
        { type: 'm.room.name', state_key: '', content: { name: room.name } },
        { type: 'm.room.topic', state_key: '', content: { topic: room.topic || '' } },
      ];
      if (room.guildId) {
        events.push({ type: 'm.space.parent', state_key: room.guildId, content: {} });
      }
      if (room.syncSource === 'discord' || room.isSynced) {
        events.push({
          type: 'm.bridge',
          state_key: 'discord',
          content: {
            protocol: { id: 'discord' },
            channel: { id: room.discordChannelId || room.id },
            network: { id: room.discordGuildId || room.guildId },
          },
        });
      }
      for (const member of room.members || []) {
        events.push({
          type: 'm.room.member',
          state_key: member.userId,
          content: {
            membership: 'join',
            displayname: member.displayName,
            avatar_url: member.avatarUrl,
          },
        });
      }
      sendJson(res, 200, events);
      return;
    }

    const matrixMsgsMatch = pathname.match(/^\/_matrix\/client\/v3\/rooms\/([^/]+)\/messages$/);
    if (matrixMsgsMatch && method === 'GET') {
      const roomId = decodeURIComponent(matrixMsgsMatch[1]);
      const limit = Math.max(1, Math.min(200, Number(parsedUrl.searchParams.get('limit') || 50)));
      const msgs = (db.messages[roomId] || []).slice(-limit);
      sendJson(res, 200, {
        start: 's_0',
        end: `s_${syncBatchCounter}`,
        chunk: msgs.slice().reverse().map(toMatrixEvent),
        state: [],
      });
      return;
    }

    const matrixSendMatch = pathname.match(
      /^\/_matrix\/client\/v3\/rooms\/([^/]+)\/send\/([^/]+)\/([^/]+)$/
    );
    if (matrixSendMatch && method === 'PUT') {
      const roomId = decodeURIComponent(matrixSendMatch[1]);
      const eventType = decodeURIComponent(matrixSendMatch[2]);
      const body = await readJsonBody(req);

      if (eventType === 'm.reaction') {
        const relates = body['m.relates_to'] || {};
        const targetId = relates.event_id;
        const emoji = relates.key;
        const sender = '@andrex:local.protutech';
        const list = db.messages[roomId] || [];
        const target = list.find((m) => m.id === targetId);
        if (target && emoji) {
          if (!target.reactions) target.reactions = {};
          const users = target.reactions[emoji] || [];
          if (!users.includes(sender)) {
            target.reactions[emoji] = [...users, sender];
            store.save();
            broadcastEvent('reaction', { roomId, eventId: targetId, emoji, sender });
          }
        }
        sendJson(res, 200, { event_id: `$rx_${Date.now()}` });
        return;
      }

      const relates = body['m.relates_to'] || {};
      if (relates.rel_type === 'm.replace' && relates.event_id) {
        const newBody = body['m.new_content']?.body ?? String(body.body || '').replace(/^\*\s?/, '');
        const list = db.messages[roomId] || [];
        const target = list.find((m) => m.id === relates.event_id);
        if (target) {
          target.body = newBody;
          target.isEdited = true;
          store.save();
          broadcastEvent('edit', { roomId, eventId: target.id, body: newBody });
        }
        sendJson(res, 200, { event_id: `$ed_${Date.now()}` });
        return;
      }

      const replyId = relates['m.in_reply_to']?.event_id;
      let replyTo;
      if (replyId) {
        const orig = (db.messages[roomId] || []).find((m) => m.id === replyId);
        replyTo = {
          id: replyId,
          sender: orig?.senderName || 'User',
          body: orig?.body || '',
        };
      }

      const msg = appendMessageToRoom(roomId, {
        sender: '@andrex:local.protutech',
        senderName: db.settings.displayName || 'andrex',
        body: String(body.body || ''),
        formattedBody: body.formatted_body,
        mediaUrl: body.url ? `/_matrix/media/v3/download/${String(body.url).replace(/^mxc:\/\//, '')}` : undefined,
        mediaType:
          body.msgtype === 'm.image'
            ? 'image'
            : body.msgtype === 'm.video'
            ? 'video'
            : body.msgtype === 'm.audio'
            ? 'audio'
            : body.msgtype === 'm.file'
            ? 'file'
            : undefined,
        replyTo,
        source: 'app',
      });
      sendJson(res, 200, { event_id: msg.id });
      return;
    }

    const matrixRedactMatch = pathname.match(
      /^\/_matrix\/client\/v3\/rooms\/([^/]+)\/redact\/([^/]+)\/([^/]+)$/
    );
    if (matrixRedactMatch && method === 'PUT') {
      const roomId = decodeURIComponent(matrixRedactMatch[1]);
      const eventId = decodeURIComponent(matrixRedactMatch[2]);
      if (Array.isArray(db.messages[roomId])) {
        db.messages[roomId] = db.messages[roomId].filter((m) => m.id !== eventId);
        store.save();
        broadcastEvent('redaction', { roomId, eventId });
      }
      sendJson(res, 200, { event_id: `$red_${Date.now()}` });
      return;
    }

    if (pathname === '/_matrix/client/v3/createRoom' && method === 'POST') {
      const body = await readJsonBody(req);
      const newRoomId = `!room_${Date.now()}_${crypto.randomBytes(3).toString('hex')}:local.protutech`;
      const newRoom = {
        id: newRoomId,
        name: String(body.name || 'new-room'),
        topic: String(body.topic || ''),
        isDirect: Boolean(body.is_direct),
        isGroupChat: Boolean(!body.is_direct && body.is_group),
        isVoice: Boolean(body.is_voice),
        isSynced: false,
        syncSource: 'matrix',
        serverKind: 'proprietary',
        members: [db.users['@andrex:local.protutech']].filter(Boolean),
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      };
      db.rooms.push(newRoom);
      db.messages[newRoomId] = [];
      store.save();
      broadcastEvent('rooms_updated', { room: newRoom });
      sendJson(res, 200, { room_id: newRoomId, room: newRoom });
      return;
    }

    const profileUpdateMatch = pathname.match(
      /^\/_matrix\/client\/v3\/profile\/([^/]+)\/(displayname|avatar_url)$/
    );
    if (profileUpdateMatch && method === 'PUT') {
      const userId = decodeURIComponent(profileUpdateMatch[1]);
      const field = profileUpdateMatch[2];
      const body = await readJsonBody(req);
      const user = db.users[userId];
      if (user) {
        if (field === 'displayname' && body.displayname !== undefined) {
          user.displayName = String(body.displayname);
          db.settings.displayName = user.displayName;
        } else if (field === 'avatar_url' && body.avatar_url !== undefined) {
          user.avatarUrl = String(body.avatar_url);
        }
        store.save();
      }
      sendJson(res, 200, {});
      return;
    }

    const presenceMatch = pathname.match(/^\/_matrix\/client\/v3\/presence\/([^/]+)\/status$/);
    if (presenceMatch && method === 'PUT') {
      const userId = decodeURIComponent(presenceMatch[1]);
      const body = await readJsonBody(req);
      const presence = String(body.presence || 'online');
      if (db.users[userId]) {
        db.users[userId].presence = presence;
        if (body.status_msg !== undefined) {
          db.users[userId].statusMsg = String(body.status_msg);
        }
        store.save();
      }
      broadcastEvent('presence', { userId, presence, statusMsg: body.status_msg });
      sendJson(res, 200, {});
      return;
    }

    if (pathname === '/_matrix/media/v3/upload' && method === 'POST') {
      const rawBuf = await readRawBody(req);
      const filename = sanitizeFileName(parsedUrl.searchParams.get('filename') || 'media.bin');
      const mediaId = `m_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
      const diskName = `${mediaId}_${filename}`;
      fs.writeFileSync(path.join(store.uploadsDir, diskName), rawBuf);
      db.media[mediaId] = {
        mediaId,
        filename,
        diskName,
        mimeType: req.headers['content-type'] || 'application/octet-stream',
        size: rawBuf.length,
        createdAt: Date.now(),
      };
      store.save();
      sendJson(res, 200, { content_uri: `mxc://local.protutech/${mediaId}` });
      return;
    }

    if (pathname.startsWith('/_matrix/media/v3/download/') && method === 'GET') {
      const parts = pathname.replace('/_matrix/media/v3/download/', '').split('/').filter(Boolean);
      const mediaId = parts[parts.length - 1];
      const meta = db.media[mediaId];
      if (!meta) {
        sendJson(res, 404, { errcode: 'M_NOT_FOUND', error: 'Media not found' });
        return;
      }
      const filePath = path.join(store.uploadsDir, meta.diskName);
      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { errcode: 'M_NOT_FOUND', error: 'Media file missing' });
        return;
      }
      setCorsHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', fs.statSync(filePath).size);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // ---------------------------------------------------------
    // 5. Messages, Rooms & Guilds (/api/rooms*, /api/guilds)
    // ---------------------------------------------------------
    if (pathname === '/api/rooms' && method === 'GET') {
      sendJson(res, 200, {
        rooms: db.rooms,
        guilds: hydrateGuildsWithRooms(db),
      });
      return;
    }

    if (pathname === '/api/rooms' && method === 'POST') {
      const body = await readJsonBody(req);
      const roomId =
        body.id || `!room_${Date.now()}_${crypto.randomBytes(3).toString('hex')}:local.protutech`;
      const guild = body.guildId ? db.guilds.find((g) => g.id === body.guildId) : null;
      const room = {
        id: roomId,
        name: String(body.name || 'new-channel'),
        topic: String(body.topic || ''),
        isDirect: Boolean(body.isDirect),
        isGroupChat: Boolean(body.isGroupChat),
        isVoice: Boolean(body.isVoice),
        guildId: guild ? guild.id : body.guildId,
        guildName: guild ? guild.name : body.guildName,
        isSynced: Boolean(guild?.isAlwaysSynced || body.isSynced),
        syncSource: guild?.serverKind === 'discord' ? 'discord' : body.syncSource || 'matrix',
        serverKind: guild?.serverKind || body.serverKind || 'proprietary',
        members: [db.users['@andrex:local.protutech']].filter(Boolean),
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      };
      db.rooms.push(room);
      db.messages[roomId] = [];
      store.save();
      broadcastEvent('rooms_updated', { room });
      sendJson(res, 201, { room });
      return;
    }

    if (pathname === '/api/guilds' && method === 'POST') {
      const body = await readJsonBody(req);
      const guildId = `guild_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const isDiscord = body.serverKind === 'discord' || body.isAlwaysSynced === true;
      const guild = {
        id: guildId,
        name: String(body.name || 'New Server'),
        iconUrl: body.iconUrl,
        hasVoice: true,
        isAlwaysSynced: isDiscord,
        isProprietary: !isDiscord,
        serverKind: isDiscord ? 'discord' : 'proprietary',
      };
      const textRoom = {
        id: `!${guildId}_general:local.protutech`,
        name: 'general',
        topic: `Welcome to ${guild.name}`,
        isDirect: false,
        isGroupChat: false,
        isVoice: false,
        guildId,
        guildName: guild.name,
        isSynced: isDiscord,
        syncSource: isDiscord ? 'discord' : 'matrix',
        serverKind: guild.serverKind,
        members: [db.users['@andrex:local.protutech']].filter(Boolean),
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      };
      const voiceRoom = {
        id: `!${guildId}_voice:local.protutech`,
        name: '🔊 Voice Lounge',
        topic: 'Ultra-Low Latency Voice & Screen Share',
        isDirect: false,
        isGroupChat: false,
        isVoice: true,
        guildId,
        guildName: guild.name,
        isSynced: isDiscord,
        syncSource: isDiscord ? 'discord' : 'matrix',
        serverKind: guild.serverKind,
        members: [db.users['@andrex:local.protutech']].filter(Boolean),
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      };
      db.guilds.push(guild);
      db.rooms.push(textRoom, voiceRoom);
      db.messages[textRoom.id] = [];
      store.save();
      const hydrated = { ...guild, channels: [textRoom, voiceRoom] };
      broadcastEvent('rooms_updated', { guild: hydrated });
      sendJson(res, 201, { guild: hydrated, rooms: [textRoom, voiceRoom] });
      return;
    }

    const roomMsgsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
    if (roomMsgsMatch) {
      const roomId = decodeURIComponent(roomMsgsMatch[1]);
      if (method === 'GET') {
        const limit = Math.max(1, Math.min(300, Number(parsedUrl.searchParams.get('limit') || 100)));
        const list = (db.messages[roomId] || []).slice(-limit);
        sendJson(res, 200, { roomId, messages: list });
        return;
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const msg = appendMessageToRoom(roomId, body);
        sendJson(res, 201, { ok: true, event_id: msg.id, message: msg });
        return;
      }
    }

    const roomSingleMsgMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages\/([^/]+)$/);
    if (roomSingleMsgMatch) {
      const roomId = decodeURIComponent(roomSingleMsgMatch[1]);
      const msgId = decodeURIComponent(roomSingleMsgMatch[2]);
      const list = db.messages[roomId] || [];

      if (method === 'PUT' || method === 'PATCH') {
        const body = await readJsonBody(req);
        const target = list.find((m) => m.id === msgId);
        if (!target) {
          sendJson(res, 404, { error: 'Message not found' });
          return;
        }
        target.body = String(body.body ?? target.body);
        target.isEdited = true;
        store.save();
        broadcastEvent('edit', { roomId, eventId: msgId, body: target.body });
        sendJson(res, 200, { ok: true, message: target });
        return;
      }

      if (method === 'DELETE') {
        db.messages[roomId] = list.filter((m) => m.id !== msgId);
        store.save();
        broadcastEvent('redaction', { roomId, eventId: msgId });
        sendJson(res, 200, { ok: true, eventId: msgId });
        return;
      }
    }

    const roomReactMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/reactions$/);
    if (roomReactMatch && method === 'POST') {
      const roomId = decodeURIComponent(roomReactMatch[1]);
      const body = await readJsonBody(req);
      const targetId = body.messageId || body.eventId;
      const emoji = String(body.emoji || '');
      const sender = String(body.sender || '@andrex:local.protutech');

      const list = db.messages[roomId] || [];
      const target = list.find((m) => m.id === targetId);
      if (!target || !emoji) {
        sendJson(res, 404, { error: 'Target message or emoji missing' });
        return;
      }
      if (!target.reactions) target.reactions = {};
      const existing = target.reactions[emoji] || [];
      if (!existing.includes(sender)) {
        target.reactions[emoji] = [...existing, sender];
        store.save();
        broadcastEvent('reaction', { roomId, eventId: targetId, emoji, sender });
      }
      sendJson(res, 200, { ok: true, message: target });
      return;
    }

    // ---------------------------------------------------------
    // 6. Discord Proxy, Quests & Bidirectional Settings
    // ---------------------------------------------------------
    if (pathname === '/api/discord/guilds' && method === 'GET') {
      if (discordToken) {
        const remote = await fetchDiscordApi('/users/@me/guilds', discordToken);
        if (remote.ok && Array.isArray(remote.data)) {
          const mapped = remote.data.map((g) => ({
            id: String(g.id),
            name: String(g.name || 'Discord Guild'),
            avatar: g.icon || null,
            avatar_url: g.icon
              ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
              : null,
            bridged: db.guilds.some((local) => local.discordGuildId === String(g.id)),
          }));
          sendJson(res, 200, { guilds: mapped, source: 'discord_api' });
          return;
        }
      }

      const bridgeRes = await proxyLocalBridgeApi('/api/discord/guilds', 'GET');
      if (bridgeRes.ok && Array.isArray(bridgeRes.data?.guilds) && bridgeRes.data.guilds.length > 0) {
        const bridgeMap = new Map(bridgeRes.data.guilds.map((g) => [String(g.id), g]));
        for (const g of db.discordCatalog.guilds) {
          if (!bridgeMap.has(String(g.id))) bridgeMap.set(String(g.id), g);
        }
        sendJson(res, 200, {
          guilds: Array.from(bridgeMap.values()),
          source: 'proxmox_mautrix_hybrid',
        });
        return;
      }

      sendJson(res, 200, { guilds: db.discordCatalog.guilds, source: 'hybrid_local' });
      return;
    }

    if (pathname === '/api/discord/channels' && method === 'GET') {
      const guildId = parsedUrl.searchParams.get('guild_id') || '';
      if (discordToken && guildId) {
        const remote = await fetchDiscordApi(`/guilds/${encodeURIComponent(guildId)}/channels`, discordToken);
        if (remote.ok && Array.isArray(remote.data)) {
          const cats = new Map();
          for (const ch of remote.data) {
            if (ch.type === 4) cats.set(ch.id, ch.name);
          }
          const mapped = remote.data.map((ch) => ({
            id: String(ch.id),
            name: String(ch.name || 'channel'),
            type: ch.type === 2 || ch.type === 13 ? 'voice' : ch.type === 4 ? 'category' : 'text',
            type_id: Number(ch.type || 0),
            category_id: ch.parent_id || null,
            category_name: ch.parent_id ? cats.get(ch.parent_id) || null : null,
            is_bridged: db.rooms.some((r) => r.discordChannelId === String(ch.id)),
          }));
          sendJson(res, 200, { channels: mapped, source: 'discord_api' });
          return;
        }
      }

      if (guildId) {
        const bridgeRes = await proxyLocalBridgeApi(
          `/api/discord/channels?guild_id=${encodeURIComponent(guildId)}`,
          'GET'
        );
        if (bridgeRes.ok && Array.isArray(bridgeRes.data?.channels) && bridgeRes.data.channels.length > 0) {
          sendJson(res, 200, {
            channels: bridgeRes.data.channels,
            source: 'proxmox_mautrix_hybrid',
          });
          return;
        }
      }

      const channels = db.discordCatalog.channelsByGuild[guildId] || [];
      sendJson(res, 200, { channels, source: 'hybrid_local' });
      return;
    }

    if (pathname === '/api/discord/dms' && method === 'GET') {
      if (discordToken) {
        const remote = await fetchDiscordApi('/users/@me/channels', discordToken);
        if (remote.ok && Array.isArray(remote.data)) {
          const mapped = remote.data.map((ch) => {
            const isGroup = ch.type === 3;
            const recipients = Array.isArray(ch.recipients) ? ch.recipients : [];
            const name =
              ch.name ||
              recipients.map((r) => r.global_name || r.username).filter(Boolean).join(', ') ||
              'Discord DM';
            return {
              id: String(ch.id),
              name,
              type: isGroup ? 'group' : 'dm',
              type_id: Number(ch.type || 1),
              other_user_id: recipients[0]?.id ? String(recipients[0].id) : null,
              is_bridged: db.rooms.some((r) => r.discordChannelId === String(ch.id)),
            };
          });
          sendJson(res, 200, { dms: mapped, source: 'discord_api' });
          return;
        }
      }

      const bridgeRes = await proxyLocalBridgeApi('/api/discord/dms', 'GET');
      if (bridgeRes.ok && Array.isArray(bridgeRes.data?.dms) && bridgeRes.data.dms.length > 0) {
        const dmMap = new Map(bridgeRes.data.dms.map((d) => [String(d.id), d]));
        for (const d of db.discordCatalog.dms) {
          if (!dmMap.has(String(d.id))) dmMap.set(String(d.id), d);
        }
        sendJson(res, 200, {
          dms: Array.from(dmMap.values()),
          source: 'proxmox_mautrix_hybrid',
        });
        return;
      }

      sendJson(res, 200, { dms: db.discordCatalog.dms, source: 'hybrid_local' });
      return;
    }

    if (pathname === '/api/discord/bridge' && method === 'POST') {
      const body = await readJsonBody(req);
      const bridgeRes = await proxyLocalBridgeApi('/api/discord/bridge', 'POST', body);
      const bridgeType = body.type || 'server';
      const bridgedItems = Array.isArray(bridgeRes.data?.bridged_items)
        ? [...bridgeRes.data.bridged_items]
        : [];

      if (bridgeType === 'dm' || bridgeType === 'group') {
        const targetId = String(body.target_id || body.channel_ids?.[0] || `dm_${Date.now()}`);
        const catalogDm = db.discordCatalog.dms.find((d) => d.id === targetId);
        const existing = db.rooms.find(
          (r) => r.discordChannelId === targetId || (catalogDm?.mxid && r.id === catalogDm.mxid)
        );
        if (!existing) {
          const roomId = `!disc_${targetId}:local.protutech`;
          const newRoom = {
            id: roomId,
            name: catalogDm?.name || `Discord ${bridgeType === 'group' ? 'Group' : 'DM'}`,
            topic: 'Bridged Discord Conversation',
            isDirect: bridgeType === 'dm',
            isGroupChat: bridgeType === 'group',
            isVoice: false,
            isSynced: true,
            syncSource: 'discord',
            serverKind: 'discord',
            discordChannelId: targetId,
            members: [db.users['@andrex:local.protutech']].filter(Boolean),
            unreadCount: 0,
            lastMessageTimestamp: Date.now(),
          };
          db.rooms.push(newRoom);
          db.messages[roomId] = [
            {
              id: `msg_bridge_${Date.now()}`,
              roomId,
              sender: '@protutech_bot:local.protutech',
              senderName: 'Discord Hybrid Bridge',
              body: `Connected ${newRoom.name} via Protutech Hybrid Bridge.`,
              timestamp: Date.now(),
              source: 'discord',
            },
          ];
          if (catalogDm) {
            catalogDm.is_bridged = true;
            catalogDm.mxid = roomId;
          }
          bridgedItems.push(roomId);
        } else {
          bridgedItems.push(existing.id);
        }
        store.save();
        broadcastEvent('rooms_updated', { bridged_items: bridgedItems });
        sendJson(res, 200, { status: 'ok', bridged_items: bridgedItems });
        return;
      }

      const guildId = String(body.guild_id || '987654321098765432');
      let guildInfo = db.discordCatalog.guilds.find((g) => g.id === guildId);
      let channelList = db.discordCatalog.channelsByGuild[guildId] || [];

      if (discordToken) {
        const [gRemote, cRemote] = await Promise.all([
          fetchDiscordApi(`/guilds/${encodeURIComponent(guildId)}`, discordToken),
          fetchDiscordApi(`/guilds/${encodeURIComponent(guildId)}/channels`, discordToken),
        ]);
        if (gRemote.ok && gRemote.data) {
          guildInfo = {
            id: String(gRemote.data.id),
            name: String(gRemote.data.name || 'Discord Server'),
            avatar_url: gRemote.data.icon
              ? `https://cdn.discordapp.com/icons/${gRemote.data.id}/${gRemote.data.icon}.png`
              : null,
            bridged: true,
          };
        }
        if (cRemote.ok && Array.isArray(cRemote.data)) {
          channelList = cRemote.data
            .filter((c) => c.type !== 4)
            .map((c) => ({
              id: String(c.id),
              name: String(c.name || 'channel'),
              type: c.type === 2 || c.type === 13 ? 'voice' : 'text',
              type_id: Number(c.type || 0),
              is_bridged: true,
            }));
        }
      }

      const localGuildId = `guild_dc_${guildId}`;
      let localGuild = db.guilds.find(
        (g) => g.id === localGuildId || g.discordGuildId === guildId
      );
      if (!localGuild) {
        localGuild = {
          id: localGuildId,
          name: guildInfo?.name || `Discord Guild ${guildId.slice(-4)}`,
          iconUrl: guildInfo?.avatar_url || undefined,
          hasVoice: true,
          isAlwaysSynced: true,
          isProprietary: false,
          serverKind: 'discord',
          discordGuildId: guildId,
        };
        db.guilds.push(localGuild);
      }

      const selectedIds = Array.isArray(body.channel_ids) ? body.channel_ids.map(String) : [];
      const toBridge =
        body.entire === false && selectedIds.length > 0
          ? channelList.filter((c) => selectedIds.includes(c.id) && c.type !== 'category')
          : channelList.filter((c) => c.type !== 'category');

      for (const ch of toBridge) {
        const exists = db.rooms.find((r) => r.discordChannelId === ch.id);
        if (!exists) {
          const roomId = `!dc_${guildId}_${ch.id}:local.protutech`;
          db.rooms.push({
            id: roomId,
            name: ch.name,
            topic: `Bridged from Discord (${localGuild.name})`,
            isDirect: false,
            isGroupChat: false,
            isVoice: ch.type === 'voice',
            guildId: localGuild.id,
            guildName: localGuild.name,
            isSynced: true,
            syncSource: 'discord',
            serverKind: 'discord',
            discordGuildId: guildId,
            discordChannelId: ch.id,
            members: [db.users['@andrex:local.protutech']].filter(Boolean),
            unreadCount: 0,
            lastMessageTimestamp: Date.now(),
          });
          db.messages[roomId] = [];
          ch.is_bridged = true;
          ch.mxid = roomId;
          bridgedItems.push(roomId);
        } else {
          bridgedItems.push(exists.id);
        }
      }

      if (guildInfo) guildInfo.bridged = true;
      store.save();
      broadcastEvent('rooms_updated', { guildId: localGuild.id, bridged_items: bridgedItems });
      sendJson(res, 200, {
        status: 'ok',
        bridged_items: bridgedItems,
        guild: localGuild,
        discordForwarded: Boolean(discordToken),
      });
      return;
    }

    if (pathname === '/api/discord/create-local-room' && method === 'POST') {
      const body = await readJsonBody(req);
      const bridgeRes = await proxyLocalBridgeApi('/api/discord/create-local-room', 'POST', body);
      const roomId =
        bridgeRes.data?.room_id ||
        `!local_${Date.now()}_${crypto.randomBytes(3).toString('hex')}:local.protutech`;
      const newRoom = {
        id: roomId,
        name: String(body.name || 'new-chat'),
        topic: String(body.topic || ''),
        isDirect: Boolean(body.is_direct),
        isGroupChat: Boolean(body.is_group),
        isVoice: false,
        isSynced: false,
        syncSource: 'matrix',
        serverKind: 'proprietary',
        members: [db.users['@andrex:local.protutech']].filter(Boolean),
        unreadCount: 0,
        lastMessageTimestamp: Date.now(),
      };
      db.rooms.push(newRoom);
      db.messages[roomId] = [];
      store.save();
      broadcastEvent('rooms_updated', { room: newRoom });
      sendJson(res, 200, { status: 'ok', room_id: roomId, room: newRoom });
      return;
    }

    if (pathname === '/api/discord/quests' && method === 'GET') {
      sendJson(res, 200, { quests: db.quests });
      return;
    }

    if (pathname === '/api/discord/quests/progress' && method === 'POST') {
      const body = await readJsonBody(req);
      const questId = String(body.questId || body.id || '');
      const quest = db.quests.find((q) => q.id === questId);
      if (!quest) {
        sendJson(res, 404, { error: 'Quest not found', quests: db.quests });
        return;
      }

      if (body.accept) quest.accepted = true;
      if (typeof body.progress === 'number') {
        quest.progress = Math.max(0, Math.min(quest.target, body.progress));
      } else if (typeof body.increment === 'number') {
        quest.accepted = true;
        quest.progress = Math.max(0, Math.min(quest.target, quest.progress + body.increment));
      } else if (body.autoComplete) {
        quest.accepted = true;
        quest.progress = quest.target;
      }
      if (quest.progress >= quest.target) {
        quest.completed = true;
      }
      if (body.claim && quest.completed) {
        quest.claimed = true;
      }

      store.save();
      broadcastEvent('quest', { quest });
      sendJson(res, 200, { status: 'ok', quest, quests: db.quests });
      return;
    }

    if (pathname === '/api/discord/settings' && method === 'GET') {
      let discordForwarded = false;
      if (discordToken) {
        const remote = await fetchDiscordApi('/users/@me/settings', discordToken);
        if (remote.ok && remote.data && typeof remote.data === 'object') {
          discordForwarded = true;
          const r = remote.data;
          if (r.status) db.settings.status = r.status;
          if (r.theme && ['dark', 'light', 'midnight'].includes(r.theme)) {
            db.settings.theme = r.theme;
          }
          if (typeof r.message_display_compact === 'boolean') {
            db.settings.messageDisplayCompact = r.message_display_compact;
          }
          if (typeof r.developer_mode === 'boolean') {
            db.settings.developerMode = r.developer_mode;
          }
          if (typeof r.animate_emoji === 'boolean') {
            db.settings.animateEmoji = r.animate_emoji;
          }
          if (typeof r.gif_auto_play === 'boolean') {
            db.settings.gifAutoPlay = r.gif_auto_play;
          }
          if (r.custom_status && typeof r.custom_status === 'object') {
            if (typeof r.custom_status.text === 'string') {
              db.settings.customStatusText = r.custom_status.text;
            }
            if (typeof r.custom_status.emoji_name === 'string') {
              db.settings.customStatusEmoji = r.custom_status.emoji_name;
            }
          }
          db.settings.syncedAt = Date.now();
          store.save();
        }
      }
      sendJson(res, 200, {
        settings: db.settings,
        syncedAt: db.settings.syncedAt || Date.now(),
        discordForwarded,
      });
      return;
    }

    if (pathname === '/api/discord/settings' && method === 'PATCH') {
      const body = await readJsonBody(req);
      const allowedKeys = [
        'syncEnabled',
        'status',
        'customStatusText',
        'customStatusEmoji',
        'displayName',
        'pronouns',
        'bio',
        'accentColor',
        'bannerColor',
        'theme',
        'messageDisplayCompact',
        'developerMode',
        'animateEmoji',
        'gifAutoPlay',
        'noiseSuppression',
        'echoCancellation',
        'automaticGainControl',
        'inputVolume',
        'outputVolume',
        'dmSpamFilter',
        'allowDmsFromServerMembers',
      ];
      for (const k of allowedKeys) {
        if (body[k] !== undefined) {
          db.settings[k] = body[k];
        }
      }

      const syncedAt = Date.now();
      db.settings.syncedAt = syncedAt;
      db.settings.discordTokenConnected = Boolean(discordToken);

      let discordForwarded = false;
      if (discordToken) {
        const discordPayload = {};
        if (body.status !== undefined) discordPayload.status = body.status;
        if (body.theme !== undefined) {
          discordPayload.theme = body.theme === 'midnight' ? 'dark' : body.theme;
        }
        if (body.messageDisplayCompact !== undefined) {
          discordPayload.message_display_compact = Boolean(body.messageDisplayCompact);
        }
        if (body.developerMode !== undefined) {
          discordPayload.developer_mode = Boolean(body.developerMode);
        }
        if (body.animateEmoji !== undefined) {
          discordPayload.animate_emoji = Boolean(body.animateEmoji);
        }
        if (body.gifAutoPlay !== undefined) {
          discordPayload.gif_auto_play = Boolean(body.gifAutoPlay);
        }
        if (body.customStatusText !== undefined || body.customStatusEmoji !== undefined) {
          discordPayload.custom_status = {
            text: db.settings.customStatusText || '',
            emoji_name: db.settings.customStatusEmoji || null,
          };
        }
        if (Object.keys(discordPayload).length > 0) {
          const remote = await fetchDiscordApi('/users/@me/settings', discordToken, {
            method: 'PATCH',
            body: discordPayload,
          });
          discordForwarded = remote.ok;
        }
      }

      db.settings.discordForwarded = discordForwarded;
      store.save();
      broadcastEvent('settings', { settings: db.settings, syncedAt, discordForwarded });
      sendJson(res, 200, { settings: db.settings, syncedAt, discordForwarded });
      return;
    }

    // ---------------------------------------------------------
    // 7. Scripts & Discord/Minecraft Webhook API
    // ---------------------------------------------------------
    if (pathname === '/api/scripts/webhooks' && method === 'GET') {
      sendJson(res, 200, { webhooks: db.webhooks });
      return;
    }

    if (pathname === '/api/scripts/webhooks' && method === 'POST') {
      const body = await readJsonBody(req);
      const id = body.id || `wh_${Date.now().toString(36)}`;
      const token = body.token || `pt_${crypto.randomBytes(6).toString('hex')}`;
      const room = resolveRoomByIdOrName(body.channelId || body.roomId);
      const webhook = {
        id,
        name: String(body.name || 'Bridge Webhook'),
        channelId: room ? room.id : String(body.channelId || '!proto_general:local.protutech'),
        channelName: body.channelName || room?.name || 'general',
        token,
        url: `/api/webhooks/${id}/${token}`,
        bridgeType: body.bridgeType || body.type || 'discord',
        enabled: body.enabled ?? true,
        createdAt: body.createdAt || Date.now(),
      };
      const existingIdx = db.webhooks.findIndex((w) => w.id === webhook.id);
      if (existingIdx >= 0) {
        db.webhooks[existingIdx] = webhook;
      } else {
        db.webhooks.push(webhook);
      }
      store.save();
      sendJson(res, 201, { webhook });
      return;
    }

    const deleteWebhookMatch = pathname.match(/^\/api\/scripts\/webhooks\/([^/]+)$/);
    if (deleteWebhookMatch && method === 'DELETE') {
      const whId = decodeURIComponent(deleteWebhookMatch[1]);
      db.webhooks = db.webhooks.filter((w) => w.id !== whId);
      store.save();
      sendJson(res, 200, { ok: true });
      return;
    }

    const webhookPostMatch = pathname.match(/^\/api\/webhooks\/([^/]+)\/([^/]+)$/);
    if (webhookPostMatch && method === 'POST') {
      const webhookId = decodeURIComponent(webhookPostMatch[1]);
      const webhookToken = decodeURIComponent(webhookPostMatch[2]);
      const body = await readJsonBody(req);
      const wh = db.webhooks.find((w) => w.id === webhookId);

      if (wh && wh.token !== webhookToken) {
        sendJson(res, 401, { error: 'Invalid webhook token' });
        return;
      }

      const targetRoomId = body.roomId || body.channelId || wh?.channelId || '!proto_general:local.protutech';
      const isMinecraft = Boolean(body.player || body.server || body.eventType || wh?.bridgeType === 'minecraft');
      const formattedBody = formatIngestBody(body);

      const message = appendMessageToRoom(targetRoomId, {
        sender: isMinecraft ? '@mc_bridge:local.protutech' : `@webhook_${webhookId}:local.protutech`,
        senderName: body.username || body.player || wh?.name || 'Webhook Bot',
        avatarUrl: body.avatar_url,
        body: formattedBody,
        source: isMinecraft ? 'app' : 'discord',
        webhookMeta: {
          username: body.username || body.player || wh?.name,
          avatarUrl: body.avatar_url,
          bridge: isMinecraft ? 'minecraft' : 'discord',
          serverName: body.server,
        },
      });

      if (wh) {
        wh.lastTriggeredAt = Date.now();
        store.save();
      }

      sendJson(res, 200, { ok: true, id: message.id, message });
      return;
    }

    if (pathname === '/api/scripts/ingest' && method === 'POST') {
      const body = await readJsonBody(req);
      const isMinecraft = Boolean(
        body.player || body.server || body.eventType || body.webhookMeta?.bridge === 'minecraft'
      );
      const targetRoomId =
        body.roomId ||
        body.channelId ||
        (isMinecraft ? '!proto_minecraft:local.protutech' : '!proto_scripts:local.protutech');

      const formattedBody = formatIngestBody(body);
      const senderName =
        body.senderName ||
        body.username ||
        (body.player ? `⛏️ ${body.player} (Minecraft)` : 'Script Ingest');

      const message = appendMessageToRoom(targetRoomId, {
        sender: isMinecraft ? '@mc_bridge:local.protutech' : '@script_bot:local.protutech',
        senderName,
        avatarUrl: body.avatar_url,
        body: formattedBody,
        source: body.webhookMeta?.bridge === 'discord' || (!isMinecraft && body.embeds) ? 'discord' : 'app',
        webhookMeta: body.webhookMeta || {
          username: body.username || body.player,
          avatarUrl: body.avatar_url,
          bridge: isMinecraft ? 'minecraft' : 'discord',
          serverName: body.server,
        },
      });

      sendJson(res, 200, { ok: true, id: message.id, message });
      return;
    }

    // ---------------------------------------------------------
    // 8. Large Chunked File Transfer
    // ---------------------------------------------------------
    if (pathname === '/api/files/init' && method === 'POST') {
      const body = await readJsonBody(req);
      const fileId = `file_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
      const name = sanitizeFileName(body.name || body.fileName || 'upload.bin');
      const uploadDir = path.join(store.stagingDir, fileId);
      fs.mkdirSync(uploadDir, { recursive: true });

      activeUploads.set(fileId, {
        fileId,
        name,
        size: Number(body.size || 0),
        mimeType: String(body.mimeType || 'application/octet-stream'),
        totalChunks: Number(body.totalChunks || 1),
        receivedChunks: new Set(),
        uploadDir,
        createdAt: Date.now(),
      });

      sendJson(res, 200, { fileId, uploadId: fileId });
      return;
    }

    if (pathname === '/api/files/chunk' && method === 'POST') {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      let fileId = String(
        parsedUrl.searchParams.get('fileId') || req.headers['x-file-id'] || ''
      ).trim();
      let chunkIndex = Number(
        parsedUrl.searchParams.get('chunkIndex') ?? req.headers['x-chunk-index'] ?? 0
      );
      let chunkBuf;

      if (contentType.includes('application/json')) {
        const body = await readJsonBody(req);
        fileId = String(body.fileId || fileId).trim();
        chunkIndex = Number(body.chunkIndex ?? chunkIndex);
        chunkBuf = Buffer.from(String(body.dataBase64 || ''), 'base64');
      } else {
        chunkBuf = await readRawBody(req);
      }

      if (!fileId || !Number.isFinite(chunkIndex) || chunkIndex < 0) {
        sendJson(res, 400, { error: 'Missing fileId or valid chunkIndex' });
        return;
      }

      const uploadDir = path.join(store.stagingDir, path.basename(fileId));
      fs.mkdirSync(uploadDir, { recursive: true });
      const partPath = path.join(uploadDir, `${String(chunkIndex).padStart(8, '0')}.part`);
      fs.writeFileSync(partPath, chunkBuf);

      const session = activeUploads.get(fileId);
      if (session) {
        session.receivedChunks.add(chunkIndex);
      }

      sendJson(res, 200, {
        ok: true,
        fileId,
        chunkIndex,
        receivedBytes: chunkBuf.length,
      });
      return;
    }

    if (pathname === '/api/files/complete' && method === 'POST') {
      const body = await readJsonBody(req);
      const fileId = path.basename(String(body.fileId || '').trim());
      if (!fileId) {
        sendJson(res, 400, { error: 'Missing fileId' });
        return;
      }

      const session = activeUploads.get(fileId);
      const uploadDir = path.join(store.stagingDir, fileId);
      const fileName = sanitizeFileName(body.name || session?.name || `${fileId}.bin`);
      const mimeType = String(body.mimeType || session?.mimeType || 'application/octet-stream');
      const diskName = `${fileId}_${fileName}`;
      const finalPath = path.join(store.uploadsDir, diskName);

      const hash = crypto.createHash('sha256');
      let totalBytes = 0;

      const partFiles = fs.existsSync(uploadDir)
        ? fs
            .readdirSync(uploadDir)
            .filter((f) => f.endsWith('.part'))
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        : [];

      const outFd = fs.openSync(finalPath, 'w');
      try {
        for (const part of partFiles) {
          const buf = fs.readFileSync(path.join(uploadDir, part));
          fs.writeSync(outFd, buf);
          hash.update(buf);
          totalBytes += buf.length;
        }
      } finally {
        fs.closeSync(outFd);
      }

      try {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      } catch {
        // Ignore staging cleanup failures
      }
      activeUploads.delete(fileId);

      const sha256 = hash.digest('hex');
      const downloadUrl = `/api/files/download/${fileId}`;
      const record = {
        fileId,
        id: fileId,
        name: fileName,
        fileName,
        diskName,
        size: totalBytes || Number(body.size || 0),
        fileSize: totalBytes || Number(body.size || 0),
        mimeType,
        sha256,
        downloadUrl,
        createdAt: Date.now(),
      };

      db.files = db.files.filter((f) => f.fileId !== fileId);
      db.files.push(record);
      store.save();

      sendJson(res, 200, {
        fileId: record.fileId,
        name: record.name,
        size: record.size,
        sha256: record.sha256,
        mimeType: record.mimeType,
        downloadUrl: record.downloadUrl,
      });
      return;
    }

    if (pathname === '/api/files/list' && method === 'GET') {
      sendJson(res, 200, { files: db.files });
      return;
    }

    const fileDownloadMatch = pathname.match(/^\/api\/files\/download\/([^/]+)$/);
    if (fileDownloadMatch && method === 'GET') {
      const fileId = path.basename(decodeURIComponent(fileDownloadMatch[1]));
      let record = db.files.find((f) => f.fileId === fileId || f.id === fileId);
      let filePath = record ? path.join(store.uploadsDir, record.diskName) : '';

      if (!record || !fs.existsSync(filePath)) {
        const matchDisk = fs
          .readdirSync(store.uploadsDir)
          .find((name) => name.startsWith(`${fileId}_`));
        if (matchDisk) {
          filePath = path.join(store.uploadsDir, matchDisk);
          record = {
            name: matchDisk.slice(fileId.length + 1) || matchDisk,
            mimeType: 'application/octet-stream',
          };
        }
      }

      if (!filePath || !fs.existsSync(filePath)) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }

      const stat = fs.statSync(filePath);
      const inline = parsedUrl.searchParams.get('inline') === '1';
      const disposition = inline ? 'inline' : 'attachment';
      const safeHeaderName = String(record.name || 'download.bin').replace(/"/g, '');

      setCorsHeaders(res);
      res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${disposition}; filename="${safeHeaderName}"`);
      res.setHeader('Accept-Ranges', 'bytes');

      const rangeHeader = req.headers.range;
      if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
        const start = startStr ? parseInt(startStr, 10) : 0;
        const end = endStr ? Math.min(stat.size - 1, parseInt(endStr, 10)) : stat.size - 1;
        if (start <= end && start < stat.size) {
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
          res.setHeader('Content-Length', end - start + 1);
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }

      res.statusCode = 200;
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // ---------------------------------------------------------
    // 9. Built-In Search Engine & Co-Browse Web Proxy
    // ---------------------------------------------------------
    if (pathname === '/api/search' && method === 'GET') {
      const q = parsedUrl.searchParams.get('q') || '';
      const type = parsedUrl.searchParams.get('type') || 'all';
      const payload = await performBuiltInSearch(q, type);
      sendJson(res, 200, payload);
      return;
    }

    if (pathname === '/api/proxy-page' && method === 'GET') {
      const targetParam = parsedUrl.searchParams.get('url') || '';
      let targetUrl;
      try {
        targetUrl = new URL(targetParam);
      } catch {
        sendHtml(
          res,
          400,
          '<html><body style="background:#0f172a;color:#e2e8f0;font-family:sans-serif;padding:24px;"><h2>Invalid Co-Browse URL</h2><p>Please enter a valid http:// or https:// URL.</p></body></html>'
        );
        return;
      }

      if (
        (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') ||
        isDisallowedProxyHost(targetUrl.hostname)
      ) {
        sendHtml(
          res,
          400,
          '<html><body style="background:#0f172a;color:#e2e8f0;font-family:sans-serif;padding:24px;"><h2>Unsupported Co-Browse Target</h2><p>Only external http:// and https:// pages are supported.</p></body></html>'
        );
        return;
      }

      try {
        const upstream = await fetch(targetUrl.toString(), {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(5000),
        });

        const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
        if (contentType.toLowerCase().includes('text/html')) {
          const rawHtml = await upstream.text();
          const finalUrl = upstream.url || targetUrl.toString();
          const rewritten = rewriteHtmlForCoBrowse(rawHtml, finalUrl);
          sendHtml(res, 200, rewritten);
          return;
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        setCorsHeaders(res);
        res.statusCode = upstream.status || 200;
        res.setHeader('Content-Type', contentType);
        res.end(buf);
        return;
      } catch (err) {
        const safeUrl = targetUrl.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const msg = err instanceof Error ? err.message : String(err);
        sendHtml(
          res,
          200,
          `<!doctype html><html><body style="background:#090d16;color:#e2e8f0;font-family:system-ui,sans-serif;padding:32px;line-height:1.6;">
            <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid rgba(56,189,248,0.3);border-radius:14px;padding:24px;">
              <h2 style="margin-top:0;color:#38bdf8;">Co-Browse Proxy Notice</h2>
              <p>Could not load <code>${safeUrl}</code> inline (${msg.replace(/</g, '&lt;')}).</p>
              <a href="${safeUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Open Directly in New Tab</a>
            </div>
          </body></html>`
        );
        return;
      }
    }

    if (pathname === '/api/cobrowse/state') {
      if (method === 'GET') {
        sendJson(res, 200, db.cobrowse);
        return;
      }
      if (method === 'POST' || method === 'PUT') {
        const body = await readJsonBody(req);
        db.cobrowse = {
          url: body.url !== undefined ? String(body.url) : db.cobrowse.url,
          videoUrl: body.videoUrl !== undefined ? String(body.videoUrl) : db.cobrowse.videoUrl,
          isPlaying:
            body.isPlaying !== undefined ? Boolean(body.isPlaying) : db.cobrowse.isPlaying,
          currentTime:
            typeof body.currentTime === 'number' ? body.currentTime : db.cobrowse.currentTime,
          searchQuery:
            body.searchQuery !== undefined ? String(body.searchQuery) : db.cobrowse.searchQuery,
          updatedBy: String(body.updatedBy || 'andrex'),
          updatedAt: Date.now(),
        };
        store.save();
        broadcastEvent('cobrowse', db.cobrowse);
        sendJson(res, 200, db.cobrowse);
        return;
      }
    }

    // ---------------------------------------------------------
    // 9b. Soundboard Clips Persistence & Safe Audio Serving
    // ---------------------------------------------------------
    if (pathname === '/api/soundboard' && method === 'GET') {
      sendJson(res, 200, { clips: db.soundboard || [] });
      return;
    }

    if (pathname === '/api/soundboard' && method === 'POST') {
      const body = await readJsonBody(req);
      const rawId = String(body.id || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const clipId = rawId || `sb_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      const name = String(body.name || 'Custom Sound').trim().slice(0, 80) || 'Custom Sound';
      const emoji = String(body.emoji || '🎵').trim().slice(0, 16) || '🎵';
      const volume = Math.max(0, Math.min(200, Math.round(Number(body.volume ?? 100) || 100)));

      let mimeType = String(body.mimeType || 'audio/mpeg').split(';')[0].trim().toLowerCase();
      let base64Data = typeof body.dataBase64 === 'string' ? body.dataBase64.trim() : '';

      if (!base64Data && typeof body.dataUrl === 'string' && body.dataUrl.startsWith('data:')) {
        const commaIdx = body.dataUrl.indexOf(',');
        if (commaIdx > 0) {
          const header = body.dataUrl.slice(5, commaIdx);
          const semiIdx = header.indexOf(';');
          if (semiIdx > 0) {
            mimeType = header.slice(0, semiIdx).trim().toLowerCase() || mimeType;
          }
          base64Data = body.dataUrl.slice(commaIdx + 1).trim();
        }
      }

      const extMap = {
        'audio/mpeg': '.mp3',
        'audio/mp3': '.mp3',
        'audio/wav': '.wav',
        'audio/wave': '.wav',
        'audio/x-wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/webm': '.webm',
        'audio/mp4': '.m4a',
        'audio/x-m4a': '.m4a',
        'audio/aac': '.aac',
        'audio/flac': '.flac',
      };
      const safeMime = extMap[mimeType] ? mimeType : 'application/octet-stream';
      const safeExt = extMap[mimeType] || '.bin';

      let diskName;
      let audioUrl;
      let size = 0;

      if (base64Data) {
        const buf = Buffer.from(base64Data, 'base64');
        const MAX_CLIP_BYTES = 15 * 1024 * 1024;
        if (buf.length > MAX_CLIP_BYTES) {
          sendJson(res, 413, { error: 'Soundboard clip exceeds 15MB limit' });
          return;
        }
        if (buf.length > 0) {
          diskName = `${path.basename(clipId)}${safeExt}`;
          const targetPath = path.resolve(store.soundboardDir, diskName);
          if (!targetPath.startsWith(store.soundboardDir + path.sep)) {
            sendJson(res, 400, { error: 'Invalid clip identifier' });
            return;
          }
          fs.writeFileSync(targetPath, buf);
          audioUrl = `/api/soundboard/${encodeURIComponent(clipId)}/audio`;
          size = buf.length;
        }
      }

      const existing = (db.soundboard || []).find((c) => c.id === clipId);
      const clipRecord = {
        id: clipId,
        name,
        emoji,
        category: 'custom',
        volume,
        favorite: body.favorite !== undefined ? Boolean(body.favorite) : Boolean(existing?.favorite),
        hotkey: body.hotkey !== undefined ? String(body.hotkey || '').slice(0, 16) : existing?.hotkey,
        durationMs: typeof body.durationMs === 'number' ? body.durationMs : existing?.durationMs || 1500,
        mimeType: safeMime,
        diskName: diskName || existing?.diskName,
        audioUrl: audioUrl || existing?.audioUrl,
        size: size || existing?.size || 0,
        createdAt: existing?.createdAt || Date.now(),
      };

      db.soundboard = (db.soundboard || []).filter((c) => c.id !== clipId);
      db.soundboard.push(clipRecord);
      store.save();

      sendJson(res, 201, { ok: true, clip: clipRecord });
      return;
    }

    const soundboardAudioMatch = pathname.match(/^\/api\/soundboard\/([^/]+)\/audio$/);
    if (soundboardAudioMatch && method === 'GET') {
      const clipId = path.basename(decodeURIComponent(soundboardAudioMatch[1]));
      const clip = (db.soundboard || []).find((c) => c.id === clipId);
      if (!clip || !clip.diskName) {
        sendJson(res, 404, { error: 'Soundboard clip audio not found' });
        return;
      }
      const safeFile = path.basename(String(clip.diskName));
      const filePath = path.resolve(store.soundboardDir, safeFile);
      if (!filePath.startsWith(store.soundboardDir + path.sep) || !fs.existsSync(filePath)) {
        sendJson(res, 404, { error: 'Soundboard clip file missing' });
        return;
      }
      const stat = fs.statSync(filePath);
      setCorsHeaders(res);
      res.statusCode = 200;
      res.setHeader('Content-Type', clip.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const soundboardDeleteMatch = pathname.match(/^\/api\/soundboard\/([^/]+)$/);
    if ((soundboardDeleteMatch || pathname === '/api/soundboard') && method === 'DELETE') {
      const clipId = soundboardDeleteMatch
        ? decodeURIComponent(soundboardDeleteMatch[1])
        : String(parsedUrl.searchParams.get('id') || '').trim();
      if (!clipId) {
        sendJson(res, 400, { error: 'Missing soundboard clip id' });
        return;
      }
      const existing = (db.soundboard || []).find((c) => c.id === clipId);
      if (existing && existing.diskName) {
        const safeFile = path.basename(String(existing.diskName));
        const filePath = path.resolve(store.soundboardDir, safeFile);
        if (filePath.startsWith(store.soundboardDir + path.sep) && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // Ignore unlink error
          }
        }
      }
      db.soundboard = (db.soundboard || []).filter((c) => c.id !== clipId);
      store.save();
      sendJson(res, 200, { ok: true, id: clipId });
      return;
    }

    // ---------------------------------------------------------
    // 10. Not Found Fallback
    // ---------------------------------------------------------
    sendJson(res, 404, {
      error: `Route not found: ${method} ${pathname}`,
    });
  };
}

function startStandaloneServer(port = 4175, dataDir = DEFAULT_DATA_DIR, host = '127.0.0.1') {
  const handler = createRequestHandler(dataDir);
  const server = http.createServer((req, res) => {
    void Promise.resolve(handler(req, res)).catch((err) => {
      console.error('[selfHostedServer] Unhandled request error:', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' });
      }
    });
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`[selfHostedServer] Port ${port} already in use; reusing existing server.`);
    } else {
      console.error('[selfHostedServer] Server error:', err);
    }
  });

  server.listen(port, host, () => {
    console.log(`[selfHostedServer] Listening on http://${host}:${port} (dataDir=${dataDir})`);
  });

  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4175);
  const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  const host = process.env.HOST || '0.0.0.0';
  startStandaloneServer(port, dataDir, host);
}

module.exports = {
  createRequestHandler,
  startStandaloneServer,
};
