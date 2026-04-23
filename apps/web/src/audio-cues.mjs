const DEFAULT_THROTTLE_MS = {
  'headline-alert': 1100,
  'prime-armed': 1800,
  'prime-captured': 2200,
  'kill-sting': 700,
  'match-end': 5000
};

function isPrimeObjective(objectiveId) {
  return objectiveId === 'prime-relay' || objectiveId === 'primeRelay';
}

export function mapEventToAudioCue(event) {
  if (!event?.type) {
    return null;
  }

  if (event.type === 'prime_relay_activated') {
    return 'prime-armed';
  }

  if (event.type === 'objective_captured' && isPrimeObjective(event.payload?.objectiveId)) {
    return 'prime-captured';
  }

  if (event.type === 'unit_eliminated') {
    return 'kill-sting';
  }

  if (event.type === 'match_ended') {
    return 'match-end';
  }

  return null;
}

function getCueEnvelope(cue) {
  if (cue === 'prime-armed') {
    return { frequency: 392, durationSec: 0.18, type: 'triangle', gain: 0.024 };
  }
  if (cue === 'prime-captured') {
    return { frequency: 523, durationSec: 0.24, type: 'sine', gain: 0.03 };
  }
  if (cue === 'match-end') {
    return { frequency: 330, durationSec: 0.34, type: 'triangle', gain: 0.03 };
  }
  return { frequency: 466, durationSec: 0.12, type: 'square', gain: 0.016 };
}

function defaultPlay(cue) {
  const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const { frequency, durationSec, type, gain } = getCueEnvelope(cue);
  const now = context.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSec);
  oscillator.onended = () => {
    void context.close().catch(() => {});
  };
}

export function createAudioCueController({ play = defaultPlay } = {}) {
  const lastPlayedAt = new Map();
  let muted = false;

  return {
    setMuted(nextMuted) {
      muted = Boolean(nextMuted);
    },
    isMuted() {
      return muted;
    },
    playCue(cue, nowMs = Date.now()) {
      if (!cue || muted) {
        return false;
      }

      const throttleMs = DEFAULT_THROTTLE_MS[cue] ?? 1000;
      const previousAt = lastPlayedAt.get(cue) ?? -Infinity;
      if (nowMs - previousAt < throttleMs) {
        return false;
      }

      lastPlayedAt.set(cue, nowMs);
      play(cue);
      return true;
    },
    handleEvent(event, nowMs = Date.now()) {
      return this.playCue(mapEventToAudioCue(event), nowMs);
    }
  };
}
