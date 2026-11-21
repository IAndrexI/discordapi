'use strict';

/**
 * Live Discord REST + Gateway WebSocket bridge for modded-client interaction.
 * Allows Protutech to connect with a user's Discord token, sync guilds/channels/DMs,
 * receive real-time messages/reactions/typing/voice states, send/edit/delete/react,
 * and join Discord voice channels.
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

function normalizeDiscordMessage(raw, roomId) {
  const author = raw.author || {};
  const avatarUrl = author.avatar
    ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`
    : undefined;

  let body = String(raw.content || '');
  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  let mediaUrl;
  let mediaType;

  if (attachments.length > 0) {
    const first = attachments[0];
    mediaUrl = first.url || first.proxy_url;
    const ct = String(first.content_type || '');
    if (ct.startsWith('image/')) mediaType = 'image';
    else if (ct.startsWith('video/')) mediaType = 'video';
    else if (ct.startsWith('audio/')) mediaType = 'audio';
    else mediaType = 'file';
    if (!body && first.filename) {
      body = `📎 ${first.filename}`;
    }
  }

  if (!body && Array.isArray(raw.embeds) && raw.embeds.length > 0) {
    const emb = raw.embeds[0];
    body = [emb.title, emb.description].filter(Boolean).join('\n') || '[Embed]';
  }

  const reactions = {};
  if (Array.isArray(raw.reactions)) {
    for (const r of raw.reactions) {
      const key = r.emoji?.id
        ? `:${r.emoji.name}:`
        : String(r.emoji?.name || '');
      if (!key) continue;
      const count = Math.max(1, Number(r.count || 1));
      reactions[key] = Array.from({ length: count }, (_, idx) =>
        idx === 0 && r.me ? '@andrex:local.protutech' : `discord_reactor_${idx}`
      );
    }
  }

  let replyTo;
  if (raw.referenced_message) {
    replyTo = {
      id: String(raw.referenced_message.id),
      sender: String(
        raw.referenced_message.author?.global_name ||
          raw.referenced_message.author?.username ||
          'Discord User'
      ),
      body: String(raw.referenced_message.content || '[Attachment]').slice(0, 140),
    };
  }

  return {
    id: `dc_${raw.id}`,
    discordMessageId: String(raw.id),
    roomId,
    sender: author.id ? `@dc_${author.id}:discord.bridge` : '@discord_user:discord.bridge',
    senderName: String(author.global_name || author.username || 'Discord User'),
    avatarUrl,
    body: body || '[Message]',
    timestamp: raw.timestamp ? Date.parse(raw.timestamp) || Date.now() : Date.now(),
    isEdited: Boolean(raw.edited_timestamp),
    mediaUrl,
    mediaType,
    replyTo,
    reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
    source: 'discord',
  };
}

function createDiscordClientBridge({ store, broadcastEvent }) {
  let token = '';
  let ws = null;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let seq = null;
  let gatewayStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
  let lastError = null;
  let currentUser = null;
  const voiceStatesByChannel = new Map();

  async function api(endpoint, options = {}) {
    const activeToken = options.token || token;
    if (!activeToken) return { ok: false, status: 401, data: null };
    try {
      const res = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: activeToken,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 204) {
        return { ok: true, status: 204, data: null };
      }
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { message: err?.message || 'Network error' } };
    }
  }

  function clearTimers() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function disconnect() {
    token = '';
    gatewayStatus = 'disconnected';
    lastError = null;
    currentUser = null;
    seq = null;
    voiceStatesByChannel.clear();
    clearTimers();
    if (ws) {
      try {
        ws.close(1000, 'Client disconnect');
      } catch {
        // Ignore close errors
      }
      ws = null;
    }
  }

  function findRoomByDiscordChannelId(channelId) {
    if (!channelId) return null;
    return store.db.rooms.find((r) => String(r.discordChannelId || '') === String(channelId)) || null;
  }

  function handleDispatch(eventName, d) {
    if (!d || typeof d !== 'object') return;

    if (eventName === 'READY') {
      gatewayStatus = 'connected';
      lastError = null;
      if (d.user) {
        currentUser = {
          id: String(d.user.id),
          username: String(d.user.username || ''),
          globalName: String(d.user.global_name || d.user.username || ''),
          avatar: d.user.avatar
            ? `https://cdn.discordapp.com/avatars/${d.user.id}/${d.user.avatar}.png?size=64`
            : null,
        };
      }
      broadcastEvent('discord_status', getStatus());
      return;
    }

    if (eventName === 'MESSAGE_CREATE') {
      const room = findRoomByDiscordChannelId(d.channel_id);
      if (!room) return;
      const msg = normalizeDiscordMessage(d, room.id);
      const list = store.db.messages[room.id] || [];
      if (!list.some((m) => m.id === msg.id)) {
        list.push(msg);
        store.db.messages[room.id] = list.slice(-250);
        room.lastMessageTimestamp = msg.timestamp;
        store.save();
        broadcastEvent('message', { roomId: room.id, message: msg });
      }
      return;
    }

    if (eventName === 'MESSAGE_UPDATE') {
      const room = findRoomByDiscordChannelId(d.channel_id);
      if (!room) return;
      const list = store.db.messages[room.id] || [];
      const target = list.find((m) => m.id === `dc_${d.id}` || m.discordMessageId === String(d.id));
      if (target && d.content !== undefined) {
        target.body = String(d.content);
        target.isEdited = true;
        store.save();
        broadcastEvent('edit', { roomId: room.id, eventId: target.id, body: target.body });
      }
      return;
    }

    if (eventName === 'MESSAGE_DELETE') {
      const room = findRoomByDiscordChannelId(d.channel_id);
      if (!room) return;
      const list = store.db.messages[room.id] || [];
      const targetId = `dc_${d.id}`;
      if (list.some((m) => m.id === targetId)) {
        store.db.messages[room.id] = list.filter((m) => m.id !== targetId);
        store.save();
        broadcastEvent('redaction', { roomId: room.id, eventId: targetId });
      }
      return;
    }

    if (eventName === 'MESSAGE_REACTION_ADD' || eventName === 'MESSAGE_REACTION_REMOVE') {
      const room = findRoomByDiscordChannelId(d.channel_id);
      if (!room) return;
      const emojiName = String(d.emoji?.name || '');
      if (!emojiName) return;
      const list = store.db.messages[room.id] || [];
      const target = list.find((m) => m.id === `dc_${d.message_id}`);
      if (!target) return;
      if (!target.reactions) target.reactions = {};
      const actor =
        currentUser && String(d.user_id) === currentUser.id
          ? '@andrex:local.protutech'
          : `@dc_${d.user_id}:discord.bridge`;
      const cur = target.reactions[emojiName] || [];
      if (eventName === 'MESSAGE_REACTION_ADD') {
        if (!cur.includes(actor)) {
          target.reactions[emojiName] = [...cur, actor];
          store.save();
          broadcastEvent('reaction', { roomId: room.id, eventId: target.id, emoji: emojiName, sender: actor });
        }
      } else {
        target.reactions[emojiName] = cur.filter((u) => u !== actor);
        if (target.reactions[emojiName].length === 0) delete target.reactions[emojiName];
        store.save();
      }
      return;
    }

    if (eventName === 'VOICE_STATE_UPDATE') {
      const chId = d.channel_id ? String(d.channel_id) : null;
      const uid = String(d.user_id || '');
      if (!uid) return;
      for (const [existingCh, map] of voiceStatesByChannel.entries()) {
        if (map.has(uid) && existingCh !== chId) {
          map.delete(uid);
        }
      }
      if (chId) {
        if (!voiceStatesByChannel.has(chId)) voiceStatesByChannel.set(chId, new Map());
        voiceStatesByChannel.get(chId).set(uid, {
          userId: uid,
          username: String(d.member?.user?.global_name || d.member?.user?.username || `User ${uid.slice(-4)}`),
          selfMute: Boolean(d.self_mute || d.mute),
          selfDeaf: Boolean(d.self_deaf || d.deaf),
          selfVideo: Boolean(d.self_video),
          selfStream: Boolean(d.self_stream),
        });
      }
      broadcastEvent('discord_voice_state', { channelId: chId });
    }
  }

  function connectGateway(nextToken) {
    if (!nextToken) return;
    if (typeof WebSocket === 'undefined') {
      gatewayStatus = 'error';
      lastError = 'WebSocket not available in this Node runtime.';
      return;
    }

    clearTimers();
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignore
      }
      ws = null;
    }

    gatewayStatus = 'connecting';
    lastError = null;
    try {
      const socket = new WebSocket(DISCORD_GATEWAY_URL);
      ws = socket;

      socket.addEventListener('message', (evt) => {
        let payload;
        try {
          payload = JSON.parse(String(evt.data));
        } catch {
          return;
        }
        if (payload.s !== null && payload.s !== undefined) {
          seq = payload.s;
        }
        if (payload.op === 10 && payload.d?.heartbeat_interval) {
          const intervalMs = Number(payload.d.heartbeat_interval);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ op: 1, d: seq }));
            }
          }, intervalMs);

          socket.send(
            JSON.stringify({
              op: 2,
              d: {
                token: nextToken,
                capabilities: 16381,
                properties: {
                  os: 'Windows',
                  browser: 'Chrome',
                  device: '',
                },
                presence: { status: 'online', since: 0, activities: [], afk: false },
              },
            })
          );
        } else if (payload.op === 0 && payload.t) {
          handleDispatch(payload.t, payload.d);
        } else if (payload.op === 7 || payload.op === 9) {
          socket.close();
        }
      });

      socket.addEventListener('close', (evt) => {
        clearTimers();
        if (token && evt.code !== 4004 && evt.code !== 1000) {
          gatewayStatus = 'disconnected';
          reconnectTimer = setTimeout(() => {
            if (token) connectGateway(token);
          }, 5000);
        } else if (evt.code === 4004) {
          gatewayStatus = 'error';
          lastError = 'Invalid Discord token (4004).';
        }
      });

      socket.addEventListener('error', () => {
        gatewayStatus = 'error';
        lastError = 'Discord Gateway connection error.';
      });
    } catch (err) {
      gatewayStatus = 'error';
      lastError = err?.message || 'Failed to open Discord Gateway.';
    }
  }

  async function connect(nextToken) {
    const clean = String(nextToken || '').trim();
    if (!clean) {
      disconnect();
      return { ok: false, error: 'Token is required.' };
    }
    const meRes = await api('/users/@me', { token: clean });
    if (!meRes.ok || !meRes.data) {
      return {
        ok: false,
        error: meRes.data?.message || `Discord rejected token (HTTP ${meRes.status})`,
      };
    }
    token = clean;
    currentUser = {
      id: String(meRes.data.id),
      username: String(meRes.data.username || ''),
      globalName: String(meRes.data.global_name || meRes.data.username || ''),
      avatar: meRes.data.avatar
        ? `https://cdn.discordapp.com/avatars/${meRes.data.id}/${meRes.data.avatar}.png?size=64`
        : null,
    };
    connectGateway(clean);
    return { ok: true, user: currentUser };
  }

  function getStatus() {
    return {
      connected: Boolean(token),
      gatewayStatus,
      lastError,
      user: currentUser,
    };
  }

  function sendVoiceStateUpdate(guildId, channelId, selfMute = false, selfDeaf = false) {
    if (!ws || ws.readyState !== 1) return false;
    ws.send(
      JSON.stringify({
        op: 4,
        d: {
          guild_id: guildId || null,
          channel_id: channelId || null,
          self_mute: Boolean(selfMute),
          self_deaf: Boolean(selfDeaf),
        },
      })
    );
    return true;
  }

  return {
    api,
    connect,
    disconnect,
    getStatus,
    getToken: () => token,
    normalizeDiscordMessage,
    sendVoiceStateUpdate,
    getVoiceStatesForChannel: (channelId) =>
      Array.from((voiceStatesByChannel.get(String(channelId)) || new Map()).values()),
  };
}

module.exports = {
  createDiscordClientBridge,
  normalizeDiscordMessage,
};
