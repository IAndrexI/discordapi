import React, { useEffect, useRef } from 'react';
import {
  MicOff,
  Maximize2,
  Tv,
} from 'lucide-react';
import type { VoiceParticipant } from '../types';

interface VoiceStageProps {
  participants: VoiceParticipant[];
  roomName: string;
}

export const VoiceStage: React.FC<VoiceStageProps> = ({
  participants,
  roomName,
}) => {
  const screenShareParticipant = participants.find(p => p.hasScreenShare && p.screenTrack);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (screenVideoRef.current && screenShareParticipant?.screenTrack) {
      const stream = new MediaStream([screenShareParticipant.screenTrack]);
      screenVideoRef.current.srcObject = stream;
    }
  }, [screenShareParticipant?.screenTrack]);

  return (
    <div className="bg-[var(--bg-servers)] border-b border-black/30 p-4 flex flex-col gap-4">
      {/* Stage Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] animate-pulse" />
          <span className="font-semibold text-white text-sm">{roomName}</span>
          <span className="bg-[var(--discord-blurple)] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider">
            SFU LIVE
          </span>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          {participants.length} connected
        </div>
      </div>

      {/* Screen Share Spotlight (if active) */}
      {screenShareParticipant && (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-[460px] flex items-center justify-center border border-white/10 shadow-2xl group">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />

          {/* Screen Share Badges */}
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-md flex items-center gap-2 text-white text-xs font-semibold">
            <Tv className="w-3.5 h-3.5 text-[var(--discord-blurple)]" />
            <span>{screenShareParticipant.name}'s Screen</span>
            <span className="bg-[var(--status-dnd)] text-white text-[10px] font-bold px-1 rounded uppercase">
              60 FPS
            </span>
          </div>

          <button
            onClick={() => {
              if (screenVideoRef.current?.requestFullscreen) {
                screenVideoRef.current.requestFullscreen();
              }
            }}
            className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 p-2 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Full Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Participants Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {participants.map(p => {
          return (
            <ParticipantTile key={p.identity} participant={p} />
          );
        })}
      </div>
    </div>
  );
};

const ParticipantTile: React.FC<{ participant: VoiceParticipant }> = ({ participant: p }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && p.hasVideo && p.videoTrack) {
      const stream = new MediaStream([p.videoTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [p.hasVideo, p.videoTrack]);

  return (
    <div
      className={`relative aspect-video rounded-lg bg-[var(--bg-channels)] flex flex-col items-center justify-center overflow-hidden border transition-all duration-150 ${
        p.isSpeaking
          ? 'border-[var(--status-online)] shadow-[0_0_12px_rgba(35,165,90,0.4)]'
          : 'border-white/[0.06]'
      }`}
    >
      {p.hasVideo && p.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm transition-all duration-150 ${
            p.isSpeaking
              ? 'bg-[var(--discord-blurple)] ring-4 ring-[var(--status-online)]'
              : 'bg-neutral-700'
          }`}
        >
          {p.name.slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* Name Tag & Mute Status */}
      <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center justify-between text-white text-[11px] font-medium truncate">
        <span className="truncate">{p.name}</span>
        {p.isMuted && <MicOff className="w-3 h-3 text-[var(--status-dnd)] ml-1 flex-shrink-0" />}
      </div>
    </div>
  );
};
