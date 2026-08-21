'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { postCallSummary, sendCallSignal } from '@/app/actions/call';
import { EVENTS } from '@/lib/pusher/channels';
import type {
  CallAnswerPayload,
  CallControlPayload,
  CallIcePayload,
  CallOfferPayload,
  CallOutcome,
  CallPeer,
  CallVideoPayload,
} from '@/lib/types';

// The call lifecycle. `outgoing`/`incoming` are the ringing states; `connecting`
// spans "accepted, ICE negotiating"; `connected` is media flowing; `ended` is a
// terminal display state that auto-resets to `idle`.
export type CallStatus =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended';

export type CallDirection = 'outgoing' | 'incoming' | null;

// How long the caller rings before giving up with "No answer".
const RING_TIMEOUT_MS = 30_000;
// How long the "Call ended / declined / …" terminal card lingers before the
// overlay closes itself.
const END_LINGER_MS = 2_500;

// Cache the ICE config for the tab's lifetime — it's per-deployment and fetched
// behind auth, so one fetch is enough.
let iceServersCache: RTCIceServer[] | null = null;
async function loadIceServers(): Promise<RTCIceServer[]> {
  if (iceServersCache) return iceServersCache;
  try {
    const res = await fetch('/api/call/ice-servers');
    if (res.ok) {
      const data = (await res.json()) as { iceServers?: RTCIceServer[] };
      iceServersCache = data.iceServers ?? [];
      return iceServersCache;
    }
  } catch {
    // fall through to the STUN-only default
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}

export type WebRTCCall = ReturnType<typeof useWebRTCCall>;

// A single-call WebRTC state machine driven by Pusher signaling. The provider
// owns one instance, forwards inbound CALL_* signals into `handleSignal`, and
// exposes the returned controls/state to the call overlay.
export function useWebRTCCall(me: CallPeer) {
  const [status, setStatusState] = useState<CallStatus>('idle');
  const [direction, setDirection] = useState<CallDirection>(null);
  const [peer, setPeer] = useState<CallPeer | null>(null);
  // Whether this call was started as a video call (drives the initial camera
  // state + overlay layout). The camera can still be toggled either way.
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  // Whether we're currently sharing our screen (display capture swapped into the
  // outbound video sender in place of the camera).
  const [screenOn, setScreenOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Whether the remote party is actually sending live video right now. Tracked
  // as explicit state (not derived from `remoteStream` at render time) because a
  // track added to an existing stream doesn't change the stream's reference, so
  // React wouldn't otherwise re-render when their video starts/stops.
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [endReason, setEndReason] = useState<string | null>(null);

  // Mirrors of state that the imperative signal handlers need to read fresh.
  const statusRef = useRef<CallStatus>('idle');
  const meRef = useRef(me);
  meRef.current = me;
  const peerRef = useRef<CallPeer | null>(null);
  const callIdRef = useRef<string | null>(null);
  // Where to send our outbound signals back to (the other party + chat).
  const targetRef = useRef<{ chatId: string; toUserId: string } | null>(null);

  // Call-summary bookkeeping. Only the *caller* posts the in-chat summary, and
  // only once per call, so these mirror the facts finishCall needs without
  // depending on React state (which it resets as it tears down):
  //   directionRef   — 'outgoing' means we're the caller (the one who posts).
  //   isVideoCallRef — voice vs. video, for the summary media field.
  //   offerSentRef   — true once our CALL_OFFER actually reached the callee, so
  //                    a failed getUserMedia/offer before any ring posts nothing.
  //   connectedAtRef — wall-clock when media first connected, for the duration
  //                    (null = never connected → a missed/declined call).
  //   summaryPostedRef — guards against a double-post within one call.
  const directionRef = useRef<CallDirection>(null);
  const isVideoCallRef = useRef(false);
  const offerSentRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const summaryPostedRef = useRef(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  // The active screen-capture track while sharing, so we can stop it and revert
  // the outbound video to the camera when sharing ends.
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  // Fresh mirror of `camOn` for the async screen-share teardown (which decides
  // whether to restore the camera track once the screen track goes away).
  const camOnRef = useRef(false);
  // The sender/transceiver for our outbound video, kept so we can swap a real
  // camera track in via replaceTrack() with no renegotiation (the video m-line
  // is negotiated sendrecv up front, even for voice calls).
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  // ICE candidates that arrive before the remote description is applied.
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  // The accepted offer held between the incoming ring and the user pressing
  // Accept (media capture is deferred to the accept gesture).
  const pendingOfferRef = useRef<CallOfferPayload | null>(null);

  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useCallback((s: CallStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const clearTimers = useCallback(() => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    ringTimerRef.current = null;
    elapsedTimerRef.current = null;
  }, []);

  // Relay one outbound signal to the other party. Returns whether it was
  // delivered so callers that care (the initial offer) can react; fire-and-
  // forget signals (ICE, hang-up) just ignore the result.
  const signal = useCallback(
    async (
      event: string,
      payload: Record<string, unknown>,
    ): Promise<{ ok: boolean; error?: string }> => {
      const target = targetRef.current;
      const callId = callIdRef.current;
      if (!target || !callId) return { ok: false, error: 'No active call' };
      try {
        await sendCallSignal({
          chatId: target.chatId,
          toUserId: target.toUserId,
          event: event as never,
          payload: { callId, ...payload },
        });
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Signal failed';
        // Surface the reason — a failed offer otherwise looks like the callee
        // silently never ringing.
        console.error(`[call] signal ${event} failed:`, message);
        return { ok: false, error: message };
      }
    },
    [],
  );

  // Stop media, close the peer connection, and drop all per-call refs. Pure
  // local cleanup — never sends a signal.
  const teardown = useCallback(() => {
    clearTimers();
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    localVideoTrackRef.current = null;
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    camOnRef.current = false;
    videoSenderRef.current = null;
    pendingIceRef.current = [];
    pendingOfferRef.current = null;
  }, [clearTimers]);

  // Move to the terminal `ended` state with a human message, tear down media,
  // and schedule a reset back to idle. `notify` optionally sends a farewell
  // signal (skipped when the remote is the one that ended it).
  const finishCall = useCallback(
    (message: string | null, notify?: { event: string }) => {
      if (notify && targetRef.current && callIdRef.current) {
        void signal(notify.event, {});
      }

      // Post the in-chat call summary — caller side only, exactly once per call,
      // and only if our offer actually reached the callee (so a failed
      // getUserMedia/offer before any ring records nothing). The callee never
      // posts, guaranteeing a single summary. Duration comes from connectedAtRef
      // because `elapsed` state is reset just below during teardown.
      const target = targetRef.current;
      if (
        directionRef.current === 'outgoing' &&
        offerSentRef.current &&
        !summaryPostedRef.current &&
        target
      ) {
        summaryPostedRef.current = true;
        const media = isVideoCallRef.current ? 'VIDEO' : 'VOICE';
        const connectedAt = connectedAtRef.current;
        const outcome: CallOutcome = connectedAt
          ? 'COMPLETED'
          : message === 'Call declined'
            ? 'DECLINED'
            : 'MISSED';
        const durationSec = connectedAt
          ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
          : 0;
        void postCallSummary({
          chatId: target.chatId,
          media,
          outcome,
          durationSec,
        }).catch(() => {});
      }

      teardown();
      setEndReason(message);
      setStatus('ended');
      setLocalStream(null);
      setRemoteStream(null);
      setRemoteHasVideo(false);
      setCamOn(false);
      setScreenOn(false);
      setElapsed(0);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        // Only reset if a new call hasn't started in the meantime.
        if (statusRef.current === 'ended') {
          setStatus('idle');
          setPeer(null);
          peerRef.current = null;
          callIdRef.current = null;
          targetRef.current = null;
          setEndReason(null);
        }
      }, END_LINGER_MS);
    },
    [signal, teardown, setStatus],
  );

  const startElapsed = useCallback(() => {
    if (elapsedTimerRef.current) return;
    const startedAt = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  }, []);

  // Build the RTCPeerConnection, wire its events, add the local audio track, and
  // ensure a sendrecv video m-line exists (via a real track for video calls, or
  // an empty transceiver for voice — so the camera can be enabled later without
  // renegotiation).
  const createPeer = useCallback(
    async (stream: MediaStream) => {
      const iceServers = await loadIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void signal(EVENTS.CALL_ICE, { candidate: e.candidate.toJSON() });
        }
      };
      // Own the remote MediaStream instead of relying on `e.streams`. Tracks
      // injected via replaceTrack on a pre-negotiated transceiver — which is how
      // both our camera toggle and screen share send video — arrive with NO
      // associated stream (empty `e.streams`). Building the stream ourselves and
      // adding every inbound track to it guarantees the remote party's audio,
      // camera, and screen all get captured and rendered.
      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      setRemoteStream(remote);

      // Reflect whether live video frames are actually arriving into reactive
      // state. A received video track starts *muted* and only unmutes once real
      // frames flow (and re-mutes when they drop video, including a mid-call
      // replaceTrack) — none of which changes the stream's object reference, so
      // we drive it off the track's mute/unmute events.
      const syncRemoteVideo = () => {
        const live = remote
          .getVideoTracks()
          .some((t) => t.readyState === 'live' && !t.muted);
        setRemoteHasVideo(live);
      };

      pc.ontrack = (e) => {
        if (!remote.getTracks().includes(e.track)) remote.addTrack(e.track);
        syncRemoteVideo();
        if (e.track.kind === 'video') {
          e.track.addEventListener('unmute', syncRemoteVideo);
          e.track.addEventListener('mute', syncRemoteVideo);
          e.track.addEventListener('ended', syncRemoteVideo);
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          // Stamp the first connect for the call-summary duration (mirrors the
          // elapsed timer's clock, but survives the state reset in finishCall).
          if (!connectedAtRef.current) connectedAtRef.current = Date.now();
          setStatus('connected');
          startElapsed();
        } else if (st === 'failed') {
          finishCall('Connection lost');
        }
      };

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) pc.addTrack(audioTrack, stream);

      const videoTrack = stream.getVideoTracks()[0] ?? null;
      localVideoTrackRef.current = videoTrack;
      if (videoTrack) {
        videoSenderRef.current = pc.addTrack(videoTrack, stream);
      } else {
        // Voice call: still negotiate a sendrecv video slot so the camera can be
        // turned on mid-call by swapping a track into this sender.
        const tx = pc.addTransceiver('video', { direction: 'sendrecv' });
        videoSenderRef.current = tx.sender;
      }
      return pc;
    },
    [signal, setStatus, startElapsed, finishCall],
  );

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // ignore a bad candidate
      }
    }
  }, []);

  // ---- Outbound: start a call -------------------------------------------
  const startCall = useCallback(
    async (chatId: string, partner: CallPeer, opts: { video: boolean }) => {
      if (statusRef.current !== 'idle') return;
      const callId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callIdRef.current = callId;
      targetRef.current = { chatId, toUserId: partner.id };
      peerRef.current = partner;
      setPeer(partner);
      setDirection('outgoing');
      setIsVideoCall(opts.video);
      setEndReason(null);
      setMicOn(true);
      camOnRef.current = opts.video;
      setCamOn(opts.video);
      setStatus('outgoing');
      // Fresh call-summary state for this outgoing call: we're the caller, so we
      // own the summary. offerSent flips true only once the offer is delivered.
      directionRef.current = 'outgoing';
      isVideoCallRef.current = opts.video;
      offerSentRef.current = false;
      connectedAtRef.current = null;
      summaryPostedRef.current = false;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: opts.video,
        });
      } catch {
        finishCall('Microphone/camera unavailable');
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = await createPeer(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sent = await signal(EVENTS.CALL_OFFER, {
        chatId,
        sdp: offer,
        video: opts.video,
      });
      // If the offer never reached the callee, don't ring into the void.
      if (!sent.ok) {
        finishCall(sent.error ? `Couldn't call: ${sent.error}` : 'Could not connect');
        return;
      }
      // The offer landed — from here on the call is worth summarizing (even if
      // it ends unanswered or declined).
      offerSentRef.current = true;

      // Give up if they never pick up.
      ringTimerRef.current = setTimeout(() => {
        if (statusRef.current === 'outgoing') {
          finishCall('No answer', { event: EVENTS.CALL_CANCEL });
        }
      }, RING_TIMEOUT_MS);
    },
    [createPeer, signal, setStatus, finishCall],
  );

  // ---- Inbound: an offer arrived ----------------------------------------
  const ringIncoming = useCallback(
    (payload: CallOfferPayload) => {
      callIdRef.current = payload.callId;
      targetRef.current = { chatId: payload.chatId, toUserId: payload.from.id };
      peerRef.current = payload.from;
      pendingOfferRef.current = payload;
      setPeer(payload.from);
      setDirection('incoming');
      setIsVideoCall(payload.video);
      setEndReason(null);
      setMicOn(true);
      camOnRef.current = payload.video;
      setCamOn(payload.video);
      setStatus('incoming');
      // We're the callee here — the caller owns the summary, so make sure this
      // side never posts one (also matters after glare demotes our outgoing
      // attempt to an incoming ring).
      directionRef.current = 'incoming';
      isVideoCallRef.current = payload.video;
      offerSentRef.current = false;
      connectedAtRef.current = null;
      summaryPostedRef.current = false;
    },
    [setStatus],
  );

  const handleOffer = useCallback(
    (payload: CallOfferPayload) => {
      const st = statusRef.current;
      if (st === 'idle' || st === 'ended') {
        ringIncoming(payload);
        return;
      }
      // Glare: the two of us rang each other at the same moment. Resolve
      // deterministically by user id — the smaller id's offer wins. If mine
      // wins, ignore theirs; otherwise drop my outgoing attempt and ring on
      // their offer instead.
      if (
        st === 'outgoing' &&
        peerRef.current?.id === payload.from.id &&
        callIdRef.current !== payload.callId
      ) {
        const myOfferWins = meRef.current.id < payload.from.id;
        if (myOfferWins) return;
        clearTimers();
        teardown();
        ringIncoming(payload);
        return;
      }
      // Busy with someone (or something) else — let them know.
      void sendCallSignal({
        chatId: payload.chatId,
        toUserId: payload.from.id,
        event: EVENTS.CALL_BUSY as never,
        payload: { callId: payload.callId },
      }).catch(() => {});
    },
    [ringIncoming, clearTimers, teardown],
  );

  const accept = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (!offer || statusRef.current !== 'incoming') return;
    setStatus('connecting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: offer.video,
      });
    } catch {
      finishCall('Microphone/camera unavailable', { event: EVENTS.CALL_DECLINE });
      return;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = await createPeer(stream);
    await pc.setRemoteDescription(offer.sdp);
    await flushPendingIce();

    // Ensure our side of every m-line can both send and receive, so the camera
    // can be enabled later without renegotiation.
    for (const tx of pc.getTransceivers()) {
      if (tx.currentDirection !== 'stopped') tx.direction = 'sendrecv';
      if (tx.receiver.track?.kind === 'video') videoSenderRef.current = tx.sender;
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signal(EVENTS.CALL_ANSWER, { sdp: answer });
    pendingOfferRef.current = null;
  }, [createPeer, flushPendingIce, signal, setStatus, finishCall]);

  const decline = useCallback(() => {
    if (statusRef.current !== 'incoming') return;
    finishCall(null, { event: EVENTS.CALL_DECLINE });
  }, [finishCall]);

  // ---- Inbound: answer / ice / control ----------------------------------
  const handleAnswer = useCallback(
    async (payload: CallAnswerPayload) => {
      if (payload.callId !== callIdRef.current) return;
      const pc = pcRef.current;
      if (!pc) return;
      clearTimers();
      setStatus('connecting');
      try {
        await pc.setRemoteDescription(payload.sdp);
        await flushPendingIce();
      } catch {
        finishCall('Connection failed');
      }
    },
    [clearTimers, flushPendingIce, setStatus, finishCall],
  );

  const handleIce = useCallback(async (payload: CallIcePayload) => {
    if (payload.callId !== callIdRef.current) return;
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current.push(payload.candidate);
      return;
    }
    try {
      await pc.addIceCandidate(payload.candidate);
    } catch {
      // ignore
    }
  }, []);

  const handleRemoteEnd = useCallback(
    (kind: 'decline' | 'cancel' | 'end' | 'busy', payload: CallControlPayload) => {
      if (payload.callId !== callIdRef.current) return;
      const message =
        kind === 'decline'
          ? 'Call declined'
          : kind === 'busy'
            ? 'Unavailable'
            : kind === 'cancel'
              ? 'Missed call'
              : 'Call ended';
      finishCall(message);
    },
    [finishCall],
  );

  // The peer told us their outbound video just started or stopped. Apply it
  // authoritatively so their feed clears the instant they turn off, instead of
  // freezing on the last frame until the receiver track's slow mute fires. On
  // "off" we hide immediately; on "on" we recompute from the track (frames may
  // not be flowing yet — the track's unmute event flips it on when they are).
  const handleVideoState = useCallback((payload: CallVideoPayload) => {
    if (payload.callId !== callIdRef.current) return;
    if (!payload.on) {
      setRemoteHasVideo(false);
      return;
    }
    const remote = remoteStreamRef.current;
    const live =
      remote?.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted) ??
      false;
    setRemoteHasVideo(live);
  }, []);

  // Single entry point the provider binds every CALL_* Pusher event to.
  const handleSignal = useCallback(
    (event: string, payload: unknown) => {
      switch (event) {
        case EVENTS.CALL_OFFER:
          handleOffer(payload as CallOfferPayload);
          break;
        case EVENTS.CALL_ANSWER:
          void handleAnswer(payload as CallAnswerPayload);
          break;
        case EVENTS.CALL_ICE:
          void handleIce(payload as CallIcePayload);
          break;
        case EVENTS.CALL_VIDEO:
          handleVideoState(payload as CallVideoPayload);
          break;
        case EVENTS.CALL_DECLINE:
          handleRemoteEnd('decline', payload as CallControlPayload);
          break;
        case EVENTS.CALL_CANCEL:
          handleRemoteEnd('cancel', payload as CallControlPayload);
          break;
        case EVENTS.CALL_END:
          handleRemoteEnd('end', payload as CallControlPayload);
          break;
        case EVENTS.CALL_BUSY:
          handleRemoteEnd('busy', payload as CallControlPayload);
          break;
      }
    },
    [handleOffer, handleAnswer, handleIce, handleVideoState, handleRemoteEnd],
  );

  // ---- Controls ----------------------------------------------------------
  const hangUp = useCallback(() => {
    const st = statusRef.current;
    if (st === 'idle' || st === 'ended') return;
    // Ringing on our outgoing call → cancel; anything live → end.
    finishCall(null, {
      event: st === 'outgoing' ? EVENTS.CALL_CANCEL : EVENTS.CALL_END,
    });
  }, [finishCall]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  // Turn off whatever local video is currently going out (camera or screen):
  // stop the track, drop it from the local preview, and — critically — replace
  // the sender's track with null. Merely disabling a track keeps it attached, so
  // the sender would keep transmitting *black frames* and the remote would never
  // clear; replaceTrack(null) stops transmission so the remote's receiver mutes.
  const clearLocalVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (stream) stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
    localVideoTrackRef.current?.stop();
    localVideoTrackRef.current = null;
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(null);
    camOnRef.current = false;
    setCamOn(false);
    setScreenOn(false);
    if (stream) setLocalStream(stream);
    // Tell the peer to drop our feed now — don't make them wait for their
    // receiver's mute timeout, which leaves the last frame frozen on screen.
    void signal(EVENTS.CALL_VIDEO, { on: false });
  }, [signal]);

  const stopScreenShare = useCallback(async () => {
    if (!screenTrackRef.current) return;
    await clearLocalVideo();
  }, [clearLocalVideo]);

  const toggleCam = useCallback(async () => {
    // Already showing camera → turn it off.
    if (camOnRef.current && !screenTrackRef.current) {
      await clearLocalVideo();
      return;
    }
    // Capture the camera and swap it into the pre-negotiated video sender (no
    // renegotiation). Only one video source at a time, so drop a screen share
    // first if one is running.
    if (screenTrackRef.current) await clearLocalVideo();
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = vs.getVideoTracks()[0];
      if (!track) return;
      localVideoTrackRef.current = track;
      camOnRef.current = true;
      localStreamRef.current?.addTrack(track);
      if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(track);
      setCamOn(true);
      if (localStreamRef.current) setLocalStream(localStreamRef.current);
      void signal(EVENTS.CALL_VIDEO, { on: true });
    } catch {
      // permission denied — leave camera off
      camOnRef.current = false;
    }
  }, [clearLocalVideo, signal]);

  // Toggle screen sharing. Display capture is swapped into the same pre-
  // negotiated video sender via replaceTrack (no renegotiation), so the remote
  // sees it as ordinary "video". Screen and camera are mutually exclusive (one
  // outbound video source); ending the share turns video off entirely.
  const toggleScreenShare = useCallback(async () => {
    const st = statusRef.current;
    if (st !== 'connecting' && st !== 'connected') return;
    if (screenTrackRef.current) {
      await clearLocalVideo();
      return;
    }
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch {
      // User dismissed the picker or denied — stay as we were.
      return;
    }
    const track = display.getVideoTracks()[0];
    if (!track) return;
    // One video source at a time — drop the camera if it's on.
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.stop();
      localStreamRef.current?.removeTrack(localVideoTrackRef.current);
      localVideoTrackRef.current = null;
      camOnRef.current = false;
      setCamOn(false);
    }
    screenTrackRef.current = track;
    localStreamRef.current?.addTrack(track);
    if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(track);
    // The browser's own "Stop sharing" control ends the track directly.
    track.onended = () => {
      void clearLocalVideo();
    };
    setScreenOn(true);
    if (localStreamRef.current) setLocalStream(localStreamRef.current);
    void signal(EVENTS.CALL_VIDEO, { on: true });
  }, [clearLocalVideo, signal]);

  // Dismiss the terminal "ended" card immediately.
  const dismiss = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setStatus('idle');
    setPeer(null);
    peerRef.current = null;
    callIdRef.current = null;
    targetRef.current = null;
    setEndReason(null);
  }, [setStatus]);

  // Best-effort teardown if the tab is closed mid-call, and on unmount.
  useEffect(() => {
    const onPageHide = () => {
      const st = statusRef.current;
      if (st !== 'idle' && st !== 'ended') {
        void signal(st === 'outgoing' ? EVENTS.CALL_CANCEL : EVENTS.CALL_END, {});
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      teardown();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [signal, teardown]);

  return {
    status,
    direction,
    peer,
    isVideoCall,
    micOn,
    camOn,
    screenOn,
    localStream,
    remoteStream,
    remoteHasVideo,
    elapsed,
    endReason,
    startCall,
    handleSignal,
    accept,
    decline,
    hangUp,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    dismiss,
  };
}
