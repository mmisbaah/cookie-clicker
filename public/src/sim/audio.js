/**
 * Sound.
 *
 * Synthesised, not sampled: the whole sound set is five tones and a noise burst,
 * so it is under a hundred lines and weighs nothing. A game like this is played in
 * short bursts, often muted, and shipping audio files for it would be the
 * largest thing in the repository.
 *
 * The AudioContext is created lazily on the first user gesture. Browsers refuse
 * to start one before that, and a rejected promise here would be an unhandled
 * rejection in the console during every page load.
 */

const VOICES = {
  click: { type: 'triangle', from: 520, to: 380, duration: 0.07, gain: 0.05 },
  buy: { type: 'square', from: 620, to: 880, duration: 0.11, gain: 0.045 },
  sell: { type: 'square', from: 880, to: 620, duration: 0.11, gain: 0.045 },
  ability: { type: 'sawtooth', from: 420, to: 900, duration: 0.22, gain: 0.05 },
  golden: { type: 'triangle', from: 700, to: 1500, duration: 0.35, gain: 0.06 },
  harvest: { type: 'triangle', from: 480, to: 720, duration: 0.16, gain: 0.05 },
  plant: { type: 'sine', from: 300, to: 420, duration: 0.12, gain: 0.04 },
  deny: { type: 'sawtooth', from: 200, to: 150, duration: 0.14, gain: 0.04 },
  ascend: { type: 'sine', from: 300, to: 1200, duration: 0.7, gain: 0.07 },
};

let ctx = null;
let enabled = true;

function context() {
  if (!enabled) return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    enabled = false;
    return null;
  }
  return ctx;
}

/**
 * Play a named voice.
 * @param {keyof typeof VOICES} name
 */
export function play(name) {
  const voice = VOICES[name];
  if (!voice) return;

  const audio = context();
  if (!audio) return;

  // Autoplay policy: a context created before the first gesture starts suspended.
  if (audio.state === 'suspended') audio.resume().catch(() => {});

  const t0 = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = voice.type;
  osc.frequency.setValueAtTime(voice.from, t0);
  osc.frequency.exponentialRampToValueAtTime(voice.to, t0 + voice.duration);

  // A short attack and an exponential decay. The attack matters more than it
  // sounds: without it, a square wave starts at full amplitude and clicks.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(voice.gain, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + voice.duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + voice.duration + 0.02);
}

export function setSoundEnabled(on) {
  enabled = !!on;
  if (!enabled && ctx) {
    ctx.close().catch(() => {});
    ctx = null;
  }
}

/**
 * Rate-limit one particular voice.
 *
 * Clicking the cookie ten times a second produces ten overlapping triangle waves,
 * which is not a sound effect, it is a tone. Clicks are the only voice that needs
 * this; everything else is already rare enough.
 */
let lastClickAt = 0;

export function playClickThrottled(now, minGapMs = 45) {
  if (now - lastClickAt < minGapMs) return;
  lastClickAt = now;
  play('click');
}
