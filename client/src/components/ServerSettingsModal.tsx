import React, { useState } from 'react';
import { X, Server, Moon, Shield, Bell } from 'lucide-react';
import type { DiscordGuild } from '../types';

interface ServerSettingsModalProps {
  guild: DiscordGuild;
  onClose: () => void;
  onSave: (guildId: string, updates: Partial<DiscordGuild>) => Promise<void> | void;
}

const AFK_TIMEOUTS = [
  { label: 'Disabled', value: 0 },
  { label: '1 Minute', value: 60 },
  { label: '5 Minutes', value: 300 },
  { label: '15 Minutes', value: 900 },
  { label: '30 Minutes', value: 1800 },
  { label: '1 Hour', value: 3600 },
];

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  guild,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(guild.name);
  const [afkChannelId, setAfkChannelId] = useState<string>(guild.afkChannelId || '');
  const [afkTimeoutSeconds, setAfkTimeoutSeconds] = useState<number>(guild.afkTimeoutSeconds ?? 300);
  const [systemChannelId, setSystemChannelId] = useState<string>(guild.systemChannelId || '');
  const [verificationLevel, setVerificationLevel] = useState<'none' | 'low' | 'medium' | 'high'>(
    guild.verificationLevel || 'low'
  );
  const [defaultNotifications, setDefaultNotifications] = useState<'all' | 'mentions'>(
    guild.defaultNotifications || 'mentions'
  );
  const [saving, setSaving] = useState(false);

  const voiceChannels = guild.channels.filter((c) => c.isVoice);
  const textChannels = guild.channels.filter((c) => !c.isVoice);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(guild.id, {
        name: name.trim(),
        afkChannelId: afkChannelId || null,
        afkTimeoutSeconds,
        systemChannelId: systemChannelId || null,
        verificationLevel,
        defaultNotifications,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#2d323e] bg-[#181b22] text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#252932] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Server className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Server Settings</h2>
              <p className="text-xs text-[#949ba4]">{guild.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-[#252932] hover:text-white"
            aria-label="Close server settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="max-h-[75vh] overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
              Server Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div className="rounded-xl border border-[#252932] bg-[#12151c] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Moon className="h-3.5 w-3.5" />
              Inactive / AFK Sleep Channel
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#949ba4] mb-1">AFK Voice Channel</label>
                <select
                  value={afkChannelId}
                  onChange={(e) => setAfkChannelId(e.target.value)}
                  className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">None (Disabled)</option>
                  {voiceChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#949ba4] mb-1">Inactivity Timeout</label>
                <select
                  value={afkTimeoutSeconds}
                  onChange={(e) => setAfkTimeoutSeconds(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {AFK_TIMEOUTS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#252932] bg-[#12151c] p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
                System Messages Channel
              </label>
              <select
                value={systemChannelId}
                onChange={(e) => setSystemChannelId(e.target.value)}
                className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">None</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Verification
                </label>
                <select
                  value={verificationLevel}
                  onChange={(e) =>
                    setVerificationLevel(e.target.value as 'none' | 'low' | 'medium' | 'high')
                  }
                  className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="low">Low (Verified Email)</option>
                  <option value="medium">Medium (5m)</option>
                  <option value="high">High (10m)</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
                  <Bell className="h-3.5 w-3.5 text-indigo-400" />
                  Notifications
                </label>
                <select
                  value={defaultNotifications}
                  onChange={(e) => setDefaultNotifications(e.target.value as 'all' | 'mentions')}
                  className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Messages</option>
                  <option value="mentions">Only @mentions</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#252932]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-[#b5bac1] hover:bg-[#252932]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Server Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
