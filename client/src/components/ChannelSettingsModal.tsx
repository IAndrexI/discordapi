import React, { useState } from 'react';
import { X, Volume2, Hash, Shield, Trash2, Clock, Users, Radio, Moon } from 'lucide-react';
import type { MatrixRoom } from '../types';

interface ChannelSettingsModalProps {
  channel: MatrixRoom;
  onClose: () => void;
  onSave: (roomId: string, updates: Partial<MatrixRoom>) => Promise<void> | void;
  onDelete?: (roomId: string) => Promise<void> | void;
}

const SLOWMODE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '15m', value: 900 },
  { label: '30m', value: 1800 },
  { label: '1h', value: 3600 },
];

const RTC_REGIONS = [
  { label: 'Automatic', value: 'auto' },
  { label: 'US West', value: 'us-west' },
  { label: 'US East', value: 'us-east' },
  { label: 'Europe Central', value: 'eu-central' },
  { label: 'Asia Pacific', value: 'ap-southeast' },
];

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
  channel,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic || '');
  const [bitrate, setBitrate] = useState(channel.bitrate ?? 96);
  const [userLimit, setUserLimit] = useState(channel.userLimit ?? 0);
  const [isAfkChannel, setIsAfkChannel] = useState(Boolean(channel.isAfkChannel));
  const [rtcRegion, setRtcRegion] = useState(channel.rtcRegion || 'auto');
  const [videoQualityMode, setVideoQualityMode] = useState<'auto' | '720p'>(
    channel.videoQualityMode || 'auto'
  );
  const [slowmodeSeconds, setSlowmodeSeconds] = useState(channel.slowmodeSeconds ?? 0);
  const [nsfw, setNsfw] = useState(Boolean(channel.nsfw));
  const [isPrivate, setIsPrivate] = useState(Boolean(channel.isPrivate));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(channel.id, {
        name: name.trim(),
        topic: topic.trim(),
        ...(channel.isVoice
          ? {
              bitrate,
              userLimit,
              isAfkChannel,
              rtcRegion,
              videoQualityMode,
            }
          : {
              slowmodeSeconds,
              nsfw,
              isPrivate,
            }),
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
            {channel.isVoice ? (
              <Volume2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Hash className="h-5 w-5 text-indigo-400" />
            )}
            <div>
              <h2 className="text-base font-bold">Channel Settings</h2>
              <p className="text-xs text-[#949ba4]">{channel.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#949ba4] hover:bg-[#252932] hover:text-white"
            aria-label="Close channel settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="max-h-[75vh] overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
              Channel Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Let everyone know how to use this channel"
              className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {channel.isVoice ? (
            <>
              <div className="rounded-xl border border-[#252932] bg-[#12151c] p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                      <Radio className="h-3.5 w-3.5 text-emerald-400" />
                      Bitrate
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{bitrate} kbps</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={384}
                    step={8}
                    value={bitrate}
                    onChange={(e) => setBitrate(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#72767d] mt-1">
                    <span>8 kbps</span>
                    <span>64 kbps (Default)</span>
                    <span>384 kbps (Max)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                      <Users className="h-3.5 w-3.5 text-indigo-400" />
                      User Limit
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-300">
                      {userLimit === 0 ? 'No limit' : `${userLimit} members`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={99}
                    step={1}
                    value={userLimit}
                    onChange={(e) => setUserLimit(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#72767d] mt-1">
                    <span>Unlimited (0)</span>
                    <span>25</span>
                    <span>99 max</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
                      Region Override
                    </label>
                    <select
                      value={rtcRegion}
                      onChange={(e) => setRtcRegion(e.target.value)}
                      className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {RTC_REGIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#949ba4] mb-1.5">
                      Video Quality
                    </label>
                    <select
                      value={videoQualityMode}
                      onChange={(e) => setVideoQualityMode(e.target.value as 'auto' | '720p')}
                      className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-2.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="auto">Auto (Adaptive)</option>
                      <option value="720p">720p HD</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-lg border border-[#252932] bg-[#161922] px-3 py-2.5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Moon className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="text-sm font-medium text-white">AFK / Sleep Channel</div>
                      <div className="text-[11px] text-[#949ba4]">
                        Auto-mute & route idle voice members here
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAfkChannel}
                    onChange={(e) => setIsAfkChannel(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-[#252932] bg-[#12151c] p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    Slowmode Cooldown
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    {SLOWMODE_OPTIONS.find((o) => o.value === slowmodeSeconds)?.label || `${slowmodeSeconds}s`}
                  </span>
                </div>
                <select
                  value={slowmodeSeconds}
                  onChange={(e) => setSlowmodeSeconds(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#2d323e] bg-[#101218] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {SLOWMODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-[#252932] bg-[#161922] px-3 py-2.5 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">Age-Restricted Channel (18+)</div>
                  <div className="text-[11px] text-[#949ba4]">
                    Require confirmation before viewing channel content
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={nsfw}
                  onChange={(e) => setNsfw(e.target.checked)}
                  className="h-4 w-4 accent-rose-500"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-[#252932] bg-[#161922] px-3 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  <div>
                    <div className="text-sm font-medium text-white">Private Channel</div>
                    <div className="text-[11px] text-[#949ba4]">
                      Only selected roles and members can view
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#252932]">
            {onDelete ? (
              <button
                type="button"
                onClick={async () => {
                  await onDelete(channel.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Channel
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
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
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
