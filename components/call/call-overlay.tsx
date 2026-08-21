'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Phone,
  PhoneOff,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { UserAvatar } from '@/components/user/user-avatar';
import type { WebRTCCall } from '@/hooks/use-webrtc-call';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// Attaches a MediaStream to a <video>. Always muted here — audio is played by
// the dedicated RemoteAudio sink so it keeps playing on voice calls (no remote
// video element) and doesn't double up on video calls.
function StreamVideo({
  stream,
  mirror,
  className,
}: {
  stream: MediaStream | null;
  mirror?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn(mirror && '-scale-x-100', className)}
    />
  );
}

// The single sink for the remote party's audio. Kept mounted for the whole call
// regardless of whether they're sending video, so voice calls are audible. The
// call is always started/accepted from a user gesture, so autoplay is allowed.
// `volume` (0–1) is applied imperatively since <audio> has no volume attribute.
function RemoteAudio({
  stream,
  volume,
}: {
  stream: MediaStream | null;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);
  useEffect(() => {
    const el = ref.current;
    if (el) el.volume = volume;
  }, [volume]);
  return <audio ref={ref} autoPlay className='hidden' />;
}

// A best-effort ringtone synthesized with the Web Audio API (no asset needed).
// Plays a repeating two-tone ring while `active`. Autoplay policies may keep the
// context suspended until the user has interacted with the page — the visual
// ringing UI still conveys the call either way.
function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let stopped = false;

    const ring = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      for (const offset of [0, 0.4]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 480;
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.1, now + offset + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + offset + 0.32);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.34);
      }
    };

    void ctx.resume?.();
    ring();
    const id = setInterval(ring, 2200);
    return () => {
      stopped = true;
      clearInterval(id);
      void ctx.close();
    };
  }, [active]);
}

function RoundButton({
  onClick,
  variant = 'surface',
  large,
  label,
  children,
}: {
  onClick: () => void;
  variant?: 'surface' | 'active' | 'danger' | 'accept';
  large?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      className={cn(
        'grid place-items-center rounded-full text-white transition-colors',
        large ? 'size-14' : 'size-11',
        variant === 'danger'
          ? 'bg-red-500 hover:bg-red-600'
          : variant === 'accept'
            ? 'bg-green-500 hover:bg-green-600'
            : variant === 'active'
              ? 'bg-white/20 hover:bg-white/30'
              : 'bg-white/40 hover:bg-white/50',
      )}
    >
      {children}
    </button>
  );
}

// The global call surface. Renders as a compact picture-in-picture card pinned
// bottom-right so the rest of the app stays interactive (you can keep chatting
// while on a call). A video call can be expanded to full screen and collapsed
// back to the card.
export function CallOverlay({ call }: { call: WebRTCCall }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [expanded, setExpanded] = useState(false);
  // Free-drag position of the compact card. `null` = anchored to its default
  // bottom-right corner; once dragged it becomes an explicit top-left offset.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // Explicit width (px) once the card has been resized; `null` = default w-72.
  // Height follows from the 16:9 stage + fixed footer, so width is enough.
  const [size, setSize] = useState<number | null>(null);
  // Speaker volume (0–1) applied to the remote audio sink. Purely local UI
  // state — the remote keeps sending at full level; we just attenuate playback.
  const [volume, setVolume] = useState(1);
  const lastVolumeRef = useRef(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    w: number;
    h: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startW: number;
    left: number;
  } | null>(null);

  const {
    status,
    peer,
    micOn,
    camOn,
    screenOn,
    localStream,
    remoteStream,
    remoteHasVideo,
    elapsed,
    endReason,
    accept,
    decline,
    hangUp,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    dismiss,
  } = call;

  useRingtone(status === 'incoming' || status === 'outgoing');

  if (!mounted || status === 'idle' || !peer) return null;

  const isIncoming = status === 'incoming';
  const isEnded = status === 'ended';
  const isActive = status === 'connecting' || status === 'connected';
  const hasRemoteVideo = remoteHasVideo;
  // Our own outbound video — the camera or a shared screen. Either one should
  // light up the self-preview and the stage, independent of the remote feed.
  const localSending = (camOn || screenOn) && !!localStream;
  // Show the 16:9 video stage whenever there's *any* video to display — the
  // remote party's feed and/or our own camera/screen. (Our self-preview must not
  // be gated on the remote sending video, or turning our camera on would show
  // nothing until they turned theirs on too.)
  const showStage = hasRemoteVideo || localSending;
  // Only mirror the self-view for the camera — a shared screen must read the
  // right way round.
  const mirrorSelf = camOn && !screenOn;
  // Only meaningful to go full-screen once there's remote video to fill it.
  const isFull = expanded && hasRemoteVideo && isActive;

  const statusText =
    status === 'outgoing'
      ? 'Ringing…'
      : status === 'incoming'
        ? call.isVideoCall
          ? 'Incoming video call'
          : 'Incoming call'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'connected'
            ? formatDuration(elapsed)
            : (endReason ?? 'Call ended');

  const activeControls = (large: boolean) => (
    <>
      <RoundButton
        onClick={toggleMic}
        variant={micOn ? 'active' : 'surface'}
        large={large}
        label={micOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        {micOn ? (
          <Mic className={large ? 'size-6' : 'size-5'} aria-hidden />
        ) : (
          <MicOff className={large ? 'size-6' : 'size-5'} aria-hidden />
        )}
      </RoundButton>
      <RoundButton
        onClick={toggleCam}
        variant={camOn ? 'active' : 'surface'}
        large={large}
        label={camOn ? 'Turn camera off' : 'Turn camera on'}
      >
        {camOn ? (
          <VideoIcon className={large ? 'size-6' : 'size-5'} aria-hidden />
        ) : (
          <VideoOff className={large ? 'size-6' : 'size-5'} aria-hidden />
        )}
      </RoundButton>
      <RoundButton
        onClick={toggleScreenShare}
        variant={screenOn ? 'active' : 'surface'}
        large={large}
        label={screenOn ? 'Stop sharing screen' : 'Share screen'}
      >
        <MonitorUp className={large ? 'size-6' : 'size-5'} aria-hidden />
      </RoundButton>
      <RoundButton onClick={hangUp} variant='danger' large={large} label='Hang up'>
        <PhoneOff className={large ? 'size-6' : 'size-5'} aria-hidden />
      </RoundButton>
    </>
  );

  // Drag the compact card anywhere on screen. The card's top region is the grab
  // handle; pointer-downs that start on a button are ignored so the controls and
  // expand toggle keep working. The resulting position is clamped to the
  // viewport so it can't be dragged off-screen.
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      w: rect.width,
      h: rect.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const x = clamp(
      d.originX + (e.clientX - d.startX),
      8,
      window.innerWidth - d.w - 8,
    );
    const y = clamp(
      d.originY + (e.clientY - d.startY),
      8,
      window.innerHeight - d.h - 8,
    );
    setPos({ x, y });
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };
  const dragHandlers = {
    onPointerDown: onDragStart,
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  };
  const dragHandleClass =
    'cursor-grab touch-none select-none active:cursor-grabbing';

  // Resize the compact card from its bottom-right corner. Width is the only free
  // dimension (height follows the 16:9 stage), so we track horizontal drag. On
  // the first resize we pin the card to an explicit top-left position so it grows
  // predictably rightward instead of fighting the default bottom-right anchor.
  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (!pos) setPos({ x: rect.left, y: rect.top });
    resizeRef.current = { startX: e.clientX, startW: rect.width, left: rect.left };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const maxW = Math.max(240, window.innerWidth - 16 - r.left);
    const w = clamp(r.startW + (e.clientX - r.startX), 240, Math.min(560, maxW));
    setSize(w);
  };
  const onResizeEnd = () => {
    resizeRef.current = null;
  };

  const toggleMute = () => {
    setVolume((v) => {
      if (v === 0) return lastVolumeRef.current || 1;
      lastVolumeRef.current = v;
      return 0;
    });
  };

  // A slim speaker + slider row shown while a call is live. Lives outside any
  // drag handle so the slider stays interactive.
  const volumeRow = (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        onClick={toggleMute}
        aria-label={volume === 0 ? 'Unmute speaker' : 'Mute speaker'}
        className='shrink-0 text-white/70 transition-colors hover:text-white'
      >
        {volume === 0 ? (
          <VolumeX className='size-4' aria-hidden />
        ) : (
          <Volume2 className='size-4' aria-hidden />
        )}
      </button>
      <input
        type='range'
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label='Speaker volume'
        className='h-1 flex-1 cursor-pointer accent-white'
      />
    </div>
  );

  // ---- Full-screen (expanded video call) --------------------------------
  if (isFull) {
    return createPortal(
      <div className='pointer-events-auto fixed inset-0 z-[120] flex flex-col bg-neutral-950 text-white'>
        <RemoteAudio stream={remoteStream} volume={volume} />
        <div className='relative flex flex-1 items-center justify-center overflow-hidden'>
          <StreamVideo
            stream={remoteStream}
            className='h-full w-full object-cover'
          />
          <div className='absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent p-4'>
            <UserAvatar name={peer.name} image={peer.image} className='size-9' />
            <div className='min-w-0 leading-tight'>
              <p className='truncate font-semibold'>{peer.name}</p>
              <p className='text-white/70 text-xs' suppressHydrationWarning>
                {statusText}
              </p>
            </div>
            <button
              type='button'
              onClick={() => setExpanded(false)}
              aria-label='Collapse to picture-in-picture'
              className='ml-auto grid size-9 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25'
            >
              <Minimize2 className='size-5' aria-hidden />
            </button>
          </div>
          {localSending ? (
            <div className='absolute right-4 bottom-4 aspect-video w-40 overflow-hidden rounded-xl border border-white/20 shadow-lg sm:w-48'>
              <StreamVideo
                stream={localStream}
                mirror={mirrorSelf}
                className='h-full w-full object-cover'
              />
            </div>
          ) : null}
        </div>
        <div className='flex flex-col items-center gap-3 p-6 pb-10'>
          <div className='w-full max-w-xs'>{volumeRow}</div>
          <div className='flex items-center justify-center gap-4'>
            {activeControls(true)}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ---- Compact picture-in-picture card ----------------------------------
  return createPortal(
    <div
      ref={cardRef}
      style={{
        ...(pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {}),
        ...(size ? { width: size } : {}),
      }}
      className='pointer-events-auto fixed right-4 bottom-4 z-[120] w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-white shadow-2xl'
    >
      <RemoteAudio stream={remoteStream} volume={volume} />

      {showStage ? (
        <div
          {...dragHandlers}
          className={cn(
            'relative aspect-video bg-neutral-950',
            dragHandleClass,
          )}
        >
          {hasRemoteVideo ? (
            <StreamVideo
              stream={remoteStream}
              className='h-full w-full object-cover'
            />
          ) : (
            // Our camera is on but the remote isn't sending video yet — show
            // their avatar as the backdrop behind our self-preview.
            <div className='flex h-full w-full items-center justify-center'>
              <UserAvatar
                name={peer.name}
                image={peer.image}
                className='size-16'
              />
            </div>
          )}
          {hasRemoteVideo ? (
            <button
              type='button'
              onClick={() => setExpanded(true)}
              aria-label='Expand to full screen'
              className='absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60'
            >
              <Maximize2 className='size-4' aria-hidden />
            </button>
          ) : null}
          <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pr-24'>
            <p className='truncate text-sm font-semibold'>{peer.name}</p>
            <p className='text-white/70 text-xs' suppressHydrationWarning>
              {statusText}
            </p>
          </div>
          {localSending ? (
            <div className='absolute right-2 bottom-2 aspect-video w-20 overflow-hidden rounded-md border border-white/20 shadow'>
              <StreamVideo
                stream={localStream}
                mirror={mirrorSelf}
                className='h-full w-full object-cover'
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          {...dragHandlers}
          className={cn('flex items-center gap-3 p-3', dragHandleClass)}
        >
          <UserAvatar
            name={peer.name}
            image={peer.image}
            className='size-11 shrink-0'
          />
          <div className='min-w-0 leading-tight'>
            <p className='truncate font-semibold'>{peer.name}</p>
            <p className='text-white/70 text-xs' suppressHydrationWarning>
              {statusText}
            </p>
          </div>
        </div>
      )}

      <div className='flex flex-col gap-2 p-3'>
        {isActive ? <div className='px-1'>{volumeRow}</div> : null}
        <div className='flex items-center justify-center gap-2'>
          {isIncoming ? (
            <>
              <RoundButton onClick={decline} variant='danger' label='Decline'>
                <PhoneOff className='size-5' aria-hidden />
              </RoundButton>
              <RoundButton onClick={accept} variant='accept' label='Accept'>
                <Phone className='size-5' aria-hidden />
              </RoundButton>
            </>
          ) : isEnded ? (
            <button
              type='button'
              onClick={dismiss}
              className='rounded-full bg-white/15 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25'
            >
              Close
            </button>
          ) : (
            activeControls(false)
          )}
        </div>
      </div>

      {/* Resize grip — drag the bottom-right corner to scale the card. */}
      <div
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        aria-hidden
        className='absolute right-0 bottom-0 z-10 grid size-5 cursor-nwse-resize touch-none place-items-center'
      >
        <span className='size-2 rounded-br-sm border-r-2 border-b-2 border-white/40' />
      </div>
    </div>,
    document.body,
  );
}
