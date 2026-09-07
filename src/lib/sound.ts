// Synthesized sound effects via the Web Audio API — no audio files, so
// nothing to license or ship. Playing anything requires a live AudioContext,
// which browsers only let a page create/resume from a genuine user gesture,
// so `unlockAudio` must be called synchronously inside a click/submit
// handler before any `await`. Once resumed, the context stays usable for
// the rest of the page's life, even from later async callbacks.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function playTone(
  ctx: AudioContext,
  time: number,
  freq: number,
  { type = "sine" as OscillatorType, gain = 0.2, attack = 0.01, decay = 0.15 } = {},
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + attack + decay + 0.02);
}

// A wheel-of-fortune "click" per peg the pointer passes — bunched up while
// the wheel spins fast, spreading out as it decelerates. Tick k lands at
// t = duration * (1 - sqrt(1 - k/N)), the time-inverse of an ease-out
// angular-velocity curve, so the clicks slow down exactly like the wheel.
export function playSpinSound(durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  const duration = durationMs / 1000;
  const ticks = 28;
  for (let k = 1; k <= ticks; k++) {
    const t = start + duration * (1 - Math.sqrt(1 - k / ticks));
    playTone(ctx, t, 780 + Math.random() * 80, {
      type: "square",
      gain: 0.12,
      attack: 0.002,
      decay: 0.035,
    });
  }
}

// A short rising chime for a win, timed to land alongside the confetti burst.
export function playWinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    playTone(ctx, start + i * 0.1, freq, {
      type: "triangle",
      gain: 0.22,
      attack: 0.015,
      decay: 0.35,
    });
  });
}

// A scraping sound mimicking a coin scratching a silver coating
export function playScratchSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    playTone(ctx, start + i * 0.04, 130 + Math.random() * 70, {
      type: "triangle",
      gain: 0.12,
      attack: 0.01,
      decay: 0.03,
    });
  }
}

// An upbeat rolling arcade chiptune clatter simulating slot machine reels spinning
export function playSlotSpinSound(durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  const duration = durationMs / 1000;
  const steps = 18;
  const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00]; // C4 D4 E4 F4 G4 A4
  for (let i = 0; i < steps; i++) {
    const t = start + (i * duration) / steps;
    const freq = scale[i % scale.length];
    playTone(ctx, t, freq, {
      type: "sawtooth",
      gain: 0.07,
      attack: 0.004,
      decay: 0.07,
    });
  }
}

// A metallic high-frequency ding simulating Plinko peg impacts
export function playPlinkoBounceSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, ctx.currentTime, 850 + Math.random() * 250, {
    type: "sine",
    gain: 0.15,
    attack: 0.002,
    decay: 0.06,
  });
}

// A sliding pitch when dropping the plinko ball
export function playPlinkoDropSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, ctx.currentTime, 380, {
    type: "sine",
    gain: 0.12,
    attack: 0.01,
    decay: 0.22,
  });
}

// A soft knock, as if tapping the lid of the picked box.
export function playBoxTapSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  playTone(ctx, start, 180, { type: "sine", gain: 0.2, attack: 0.004, decay: 0.09 });
  playTone(ctx, start + 0.01, 90, { type: "triangle", gain: 0.14, attack: 0.004, decay: 0.14 });
}

// Rising suspense while the lid works itself loose — a stepped sweep up a
// pentatonic scale that lands right as the box opens, so the wait has a
// shape instead of the wheel's ratchet clicks that used to play here.
export function playBoxSuspenseSound(durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  const duration = durationMs / 1000;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    // Accelerating: each step lands closer to the last than the one before.
    const progress = (i / steps) ** 1.6;
    playTone(ctx, start + duration * progress, 300 * 2 ** (i / 7), {
      type: "triangle",
      gain: 0.08,
      attack: 0.004,
      decay: 0.06,
    });
  }
}

// The lid coming off: a low pop followed by a shimmer, played on every
// reveal so a no-win still sounds like something happened.
export function playBoxOpenSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  playTone(ctx, start, 140, { type: "sine", gain: 0.24, attack: 0.003, decay: 0.12 });
  for (let i = 0; i < 5; i++) {
    playTone(ctx, start + 0.06 + i * 0.035, 1200 + Math.random() * 900, {
      type: "sine",
      gain: 0.06,
      attack: 0.002,
      decay: 0.09,
    });
  }
}

// Two gentle descending notes for a reveal that isn't a win — soft enough
// not to read as an error, since the player did nothing wrong.
export function playNoWinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  playTone(ctx, start, 392.0, { type: "triangle", gain: 0.14, attack: 0.015, decay: 0.22 }); // G4
  playTone(ctx, start + 0.16, 311.13, { type: "triangle", gain: 0.13, attack: 0.015, decay: 0.3 }); // Eb4
}

// A paper-friction like slide sound for flipping cards
export function playCardFlipSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, ctx.currentTime, 170, {
    type: "sine",
    gain: 0.12,
    attack: 0.02,
    decay: 0.06,
  });
}

// A reel clunking into place. Called once per reel as they stop in turn,
// so a spin ends with three distinct hits instead of silence.
export function playReelStopSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  playTone(ctx, start, 220, { type: "square", gain: 0.1, attack: 0.002, decay: 0.05 });
  playTone(ctx, start + 0.015, 110, { type: "sine", gain: 0.16, attack: 0.003, decay: 0.1 });
}

// A flat double-tap when two flipped cards do not match.
export function playMismatchSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  playTone(ctx, start, 233.08, { type: "triangle", gain: 0.12, attack: 0.01, decay: 0.1 }); // Bb3
  playTone(ctx, start + 0.12, 207.65, { type: "triangle", gain: 0.11, attack: 0.01, decay: 0.14 }); // Ab3
}

// A positive dual-chime when matching card pairs successfully
export function playMatchSuccessSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  playTone(ctx, start, 523.25, { type: "triangle", gain: 0.16, attack: 0.01, decay: 0.12 }); // C5
  playTone(ctx, start + 0.1, 783.99, { type: "triangle", gain: 0.16, attack: 0.01, decay: 0.18 }); // G5
}

