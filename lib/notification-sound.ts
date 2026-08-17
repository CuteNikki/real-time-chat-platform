import type { NotificationCategory } from '@/lib/types';

// Distinct short chimes per event type, synthesized with the Web Audio API so
// there are no audio assets to load. Each entry is a small sequence of notes
// (frequency in Hz + start offset + duration in seconds).
type Note = { freq: number; start: number; dur: number };

const TONES: Record<NotificationCategory, Note[]> = {
  // Rising two-note "ta-da" for incoming friend requests.
  friendRequest: [
    { freq: 587.33, start: 0, dur: 0.12 },
    { freq: 880, start: 0.1, dur: 0.18 },
  ],
  // Bright major third for an accepted request.
  friendAccept: [
    { freq: 659.25, start: 0, dur: 0.12 },
    { freq: 987.77, start: 0.1, dur: 0.2 },
  ],
  // Soft single blip for a new direct message.
  directMessage: [{ freq: 740, start: 0, dur: 0.14 }],
  // Lower double-blip for a room message, so it's distinct from a DM.
  roomMessage: [
    { freq: 523.25, start: 0, dur: 0.1 },
    { freq: 622.25, start: 0.11, dur: 0.13 },
  ],
  // Gentle high tick for a like.
  like: [{ freq: 1046.5, start: 0, dur: 0.1 }],
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

// Play the chime for a category at the given master volume (0..1). Safe to call
// anywhere; silently no-ops when Web Audio is unavailable or volume is 0.
export function playNotificationSound(
  category: NotificationCategory,
  volume: number,
) {
  const context = getContext();
  if (!context || volume <= 0) return;
  // Browsers may start the context suspended until a user gesture occurs.
  if (context.state === 'suspended') void context.resume();

  const notes = TONES[category];
  const now = context.currentTime;
  for (const note of notes) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.freq;
    const peak = Math.min(1, Math.max(0, volume)) * 0.22;
    const startAt = now + note.start;
    const endAt = startAt + note.dur;
    // Quick attack, smooth exponential release so it doesn't click.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.connect(gain).connect(context.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }
}
