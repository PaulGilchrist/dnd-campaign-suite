// @maintained-by-ai
// Roadmap Item 10 (sensory cues): deterministic synthesizer for the whole
// audio-cue pack in public/audio/. Rerunning reproduces BYTE-IDENTICAL files —
// every "random" number comes from a seeded LCG (no Math.random), every
// oscillator is plain math, and the wind loop is a sum of T-periodic
// harmonics so its seam is exact. Owner ruling 2026-11-19: locally-served
// synthesized cues, no licensing/network dependency.
//
// Format recipe (kept tiny on purpose): mono, 16-bit PCM, 22050 Hz, one WAV
// per cue, ≤1 s per one-shot (≤1.5 s for the two ceremonial cues — levelup
// and player-death; ~6 s for the weather loop only). All output is
// peak-normalized per cue with a headroom target, so relative cue loudness is
// set by the target column below, not by luck.
//
// Cue inventory (also documented in public/audio/README.md):
//   crit.wav          heavy DOUBLE thud — two stacked hit-style impacts, 2×
//                     the duration of hit and the pack's loudest one-shot
//   hit.wav           short low thud (150→55 Hz pitch-drop + noise transient,
//                     normalized under crit so a crit reads louder)
//   miss.wav          dull descending filtered-noise whoosh (quiet)
//   fumble.wav        dissonant low buzz wobble (110/116.5 Hz beat pair)
//   heal.wav          soft high bell shimmer (G5/B5/D6 staggered decay)
//   levelup.wav       brass fanfare — fast C5-E5-G5 run into a sustained,
//                     vibrato'd C-major chord with a high sparkle tail
//   save-success.wav  bright quick two-note ping (C6→G6 bell, quiet)
//   save-failure.wav  dull low descending thud (180→70 Hz slide, quiet)
//   monster-death.wav collapsing drop — saw growl 180→35 Hz + noise wash
//   player-down.wav   soft falling minor-fourth bells (D5→A4, quiet/sad)
//   player-death.wav  slow funeral knell — A3/C4 minor-third bell tolls
//   weather-wind.wav  seamless wind-bed loop (harmonics of exactly 6 s)
//
// Usage: node scripts/generate-audio-cues.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');

// ── Deterministic PRNG (mulberry32) — seeded per cue so noise content is
// reproducible byte-for-byte across runs and platforms (pure fround math).
function makeRng(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── WAV encoder: RIFF header + 16-bit PCM mono, little-endian.
function encodeWav(samples) {
    const bytesPerSample = 2;
    const dataSize = samples.length * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);              // fmt chunk size
    buffer.writeUInt16LE(1, 20);               // PCM
    buffer.writeUInt16LE(1, 22);               // mono
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
    buffer.writeUInt16LE(bytesPerSample, 32);  // block align
    buffer.writeUInt16LE(16, 34);              // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < samples.length; i++) {
        const clamped = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
    }
    return buffer;
}

// Peak-normalize to `target` so each cue lands at its authored loudness.
function normalize(samples, target) {
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    if (peak === 0) return samples;
    const gain = target / peak;
    return samples.map(s => s * gain);
}

function seconds(n) {
    return Math.round(SAMPLE_RATE * n);
}

// One-pole low-pass over a noise source (stateful — fine for our one-pass use).
function lowpassNoise(rng, count, cutoffFn) {
    const out = new Float64Array(count);
    let y = 0;
    for (let i = 0; i < count; i++) {
        const a = cutoffFn(i / SAMPLE_RATE);
        y += a * ((rng() * 2 - 1) - y);
        out[i] = y;
    }
    return out;
}

// ── Cue builders ──────────────────────────────────────────────────────────

// hit: short thud — fast pitch-drop low sine plus a 40 ms noise transient.
// Normalized at 0.7 (was 0.9) so crit can read as a genuine 2× louder
// impact without clipping.
function buildHit() {
    const n = seconds(0.22);
    const rng = makeRng(0x4817);
    const out = new Float64Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 55 + 95 * Math.exp(-t * 18);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env = Math.exp(-t * 20);
        const noiseEnv = t < 0.04 ? Math.exp(-t * 90) : 0;
        out[i] = Math.sin(phase) * env * 0.85 + (rng() * 2 - 1) * noiseEnv * 0.5;
    }
    return normalize(out, 0.7);
}

// crit: a HIT, hit harder — the same thud body as hit.wav stacked as a
// DOUBLE impact (second blow 60 ms later, heavier and deeper: the audible
// twin of doubled damage dice). Exactly 2× hit's length, normalized to full
// scale (the pack's loudest cue), so it is longer AND louder than a plain hit.
function buildCrit() {
    const n = seconds(0.44);
    const rng = makeRng(0xc112);
    const out = new Float64Array(n);
    const impacts = [
        { start: 0, f0: 165, f1: 55, drop: 18, decay: 16, noise: 0.6, gain: 1.0 },
        { start: 0.06, f0: 150, f1: 48, drop: 16, decay: 12, noise: 0.55, gain: 1.15 },
    ];
    for (const imp of impacts) {
        let phase = 0;
        for (let i = Math.floor(imp.start * SAMPLE_RATE); i < n; i++) {
            const t = i / SAMPLE_RATE - imp.start;
            const freq = imp.f1 + (imp.f0 - imp.f1) * Math.exp(-t * imp.drop);
            phase += (2 * Math.PI * freq) / SAMPLE_RATE;
            const env = Math.exp(-t * imp.decay) * (1 - Math.exp(-t * 300));
            const noiseEnv = t < 0.05 ? Math.exp(-t * 80) : 0;
            out[i] += (Math.sin(phase) * env
                + (rng() * 2 - 1) * noiseEnv * imp.noise) * imp.gain * 0.6;
        }
    }
    return normalize(out, 1.0);
}

// miss: dull descending whoosh — low-passed noise whose cutoff slides down,
// quiet on purpose (a miss should never out-shout a hit).
function buildMiss() {
    const n = seconds(0.3);
    const rng = makeRng(0x055);
    const noise = lowpassNoise(rng, n, t => Math.max(0.03, 0.35 - t * 0.9));
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.sin(Math.PI * (t / 0.3)) ** 2;
        out[i] = noise[i] * env * 3;
    }
    return normalize(out, 0.45);
}

// fumble: dissonant low buzz — a slightly detuned pair beating against its
// own fifth, with a 6 Hz wobble.
function buildFumble() {
    const n = seconds(0.45);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const tremolo = 1 - 0.35 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * t));
        const env = Math.exp(-t * 5.5) * (1 - Math.exp(-t * 200));
        const body = Math.sin(2 * Math.PI * 110 * t)
            + Math.sin(2 * Math.PI * 116.5 * t)
            + 0.6 * Math.sin(2 * Math.PI * 165.3 * t)
            + 0.25 * Math.sin(2 * Math.PI * 220 * t);
        out[i] = body * tremolo * env * 0.4;
    }
    return normalize(out, 0.75);
}

// heal: soft shimmer — three staggered high bell tones (G5/B5/D6), slow-ish
// attack, long decay, quiet shimmer harmonic.
function buildHeal() {
    const notes = [784, 987.77, 1174.66];
    const n = seconds(0.7);
    const out = new Float64Array(n);
    notes.forEach((freq, idx) => {
        const start = idx * 0.12;
        for (let i = Math.floor(start * SAMPLE_RATE); i < n; i++) {
            const t = i / SAMPLE_RATE - start;
            if (t > 0.55) break;
            const env = Math.exp(-t * 5) * (1 - Math.exp(-t * 80));
            out[i] += (Math.sin(2 * Math.PI * freq * t)
                + 0.25 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t * 10)) * env * 0.6;
        }
    });
    return normalize(out, 0.55);
}

// levelup: triumphant brass fanfare — a fast C5–E5–G5 run landing on a
// sustained, vibrato'd C-major chord (C4 C5 E5 G5 C6) with a high sparkle
// shimmer. Deliberately brass-voiced (harmonic stack, fast attack) to keep it
// a world away from heal.wav's soft staggered sine bells.
function buildLevelUp() {
    const n = seconds(1.3);
    const out = new Float64Array(n);
    // Weighted harmonic stack ≈ muted brass.
    const brass = (freq, t, vib) => {
        const f = freq * (1 + vib * Math.sin(2 * Math.PI * 5.5 * t));
        const partials = [1, 0.55, 0.38, 0.26, 0.16, 0.1];
        let s = 0;
        for (let h = 0; h < partials.length; h++) {
            s += partials[h] * Math.sin(2 * Math.PI * f * (h + 1) * t);
        }
        return s;
    };
    const run = [523.25, 659.25, 783.99];
    const runStarts = [0, 0.09, 0.18];
    run.forEach((freq, idx) => {
        for (let i = Math.floor(runStarts[idx] * SAMPLE_RATE); i < n; i++) {
            const t = i / SAMPLE_RATE - runStarts[idx];
            if (t > 0.16) break;
            const env = Math.exp(-t * 22) * (1 - Math.exp(-t * 400));
            out[i] += brass(freq, t, 0) * env * 0.5;
        }
    });
    const chordStart = 0.3;
    const chord = [261.63, 523.25, 659.25, 783.99, 1046.5];
    const fade = seconds(0.03);
    for (let i = Math.floor(chordStart * SAMPLE_RATE); i < n; i++) {
        const t = i / SAMPLE_RATE - chordStart;
        const env = (1 - Math.exp(-t * 18)) * Math.exp(-t * 3.5)
            * Math.min(1, (n - i) / fade);
        let s = 0;
        for (const freq of chord) s += brass(freq, t, 0.004);
        out[i] += s * env * 0.16;
        out[i] += Math.sin(2 * Math.PI * 2093 * t) * env * 0.05
            * (0.5 + 0.5 * Math.sin(2 * Math.PI * 7 * t));
    }
    return normalize(out, 0.95);
}

// save-success: bright quick ping — two fast rising bell notes (C6→G6) with
// a shimmer partial, short and quiet so a failed-save AoE volley of pings
// never shouts over the attack lane.
function buildSaveSuccess() {
    const notes = [1046.5, 1568];
    const n = seconds(0.28);
    const out = new Float64Array(n);
    notes.forEach((freq, idx) => {
        const start = idx * 0.07;
        for (let i = Math.floor(start * SAMPLE_RATE); i < n; i++) {
            const t = i / SAMPLE_RATE - start;
            if (t > 0.2) break;
            const env = Math.exp(-t * 16) * (1 - Math.exp(-t * 500));
            out[i] += (Math.sin(2 * Math.PI * freq * t)
                + 0.3 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t * 25)) * env * 0.6;
        }
    });
    return normalize(out, 0.6);
}

// save-failure: dull low descending thud — a short pitch-slide (180→70 Hz)
// with a beating detuned twin, heavily damped. Quiet per the miss doctrine:
// it marks the moment without out-shouting the damage that follows.
function buildSaveFailure() {
    const n = seconds(0.35);
    const out = new Float64Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 70 + 110 * Math.exp(-t * 14);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env = Math.exp(-t * 9) * (1 - Math.exp(-t * 250));
        out[i] = (Math.sin(phase) + 0.7 * Math.sin(phase * 1.03)) * env * 0.7;
    }
    return normalize(out, 0.55);
}

// monster-death: a collapsing drop — a harmonically-rich growl sliding
// 180→35 Hz while a low-passed noise wash drains away under it. Reads as the
// body hitting the ground.
function buildMonsterDeath() {
    const n = seconds(0.6);
    const rng = makeRng(0xd347);
    const noise = lowpassNoise(rng, n, t => Math.max(0.05, 0.3 - t * 0.45));
    const out = new Float64Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        const freq = 35 + 145 * Math.exp(-t * 7);
        phase += (2 * Math.PI * freq) / SAMPLE_RATE;
        const env = Math.exp(-t * 5) * (1 - Math.exp(-t * 150));
        const wobble = 1 + 0.25 * Math.sin(2 * Math.PI * 9 * t);
        const growl = (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase)) * wobble;
        out[i] = growl * env * 0.55 + noise[i] * env * 1.6;
    }
    return normalize(out, 0.85);
}

// player-down: soft, sad — two gentle low bells falling a fourth (D5→A4),
// slow-attack and quiet: an alarm the table should feel, not flinch at.
function buildPlayerDown() {
    const notes = [587.33, 440];
    const n = seconds(0.7);
    const out = new Float64Array(n);
    notes.forEach((freq, idx) => {
        const start = idx * 0.22;
        for (let i = Math.floor(start * SAMPLE_RATE); i < n; i++) {
            const t = i / SAMPLE_RATE - start;
            if (t > 0.45) break;
            const env = Math.exp(-t * 6) * (1 - Math.exp(-t * 60));
            out[i] += (Math.sin(2 * Math.PI * freq * t)
                + 0.2 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t * 12)) * env * 0.55;
        }
    });
    return normalize(out, 0.45);
}

// player-death: a slow funeral knell — two bell tolls a minor third apart
// (A3, C4) with inharmonic bell partials and a low drone under the second.
// The saddest, heaviest cue in the pack.
function buildPlayerDeath() {
    const n = seconds(1.4);
    const tolls = [
        { start: 0, freq: 220 },
        { start: 0.45, freq: 261.63 },
    ];
    const out = new Float64Array(n);
    for (const toll of tolls) {
        for (let i = Math.floor(toll.start * SAMPLE_RATE); i < n; i++) {
            const t = i / SAMPLE_RATE - toll.start;
            if (t > 0.95) break;
            const env = Math.exp(-t * 3.2) * (1 - Math.exp(-t * 200));
            out[i] += (Math.sin(2 * Math.PI * toll.freq * t)
                + 0.45 * Math.sin(2 * Math.PI * toll.freq * 2.76 * t) * Math.exp(-t * 5)
                + 0.2 * Math.sin(2 * Math.PI * toll.freq * 5.4 * t) * Math.exp(-t * 9)) * env * 0.6;
        }
    }
    const fade = seconds(0.04);
    const droneStart = 0.45;
    for (let i = Math.floor(droneStart * SAMPLE_RATE); i < n; i++) {
        const t = i / SAMPLE_RATE - droneStart;
        const env = Math.exp(-t * 2.8) * (1 - Math.exp(-t * 40))
            * Math.min(1, (n - i) / fade);
        out[i] += Math.sin(2 * Math.PI * 110 * t) * env * 0.35;
    }
    return normalize(out, 0.9);
}

// weather-wind: seamless loop bed. Every component is a sinusoid at an
// INTEGER harmonic of 1/T (T = 6 s), so the waveform is exactly T-periodic —
// the WAV loops with no seam and needs no crossfade. Amplitudes follow a
// 1/f^0.9 pink-ish tilt (wind energy concentrated low), with a slow gust
// modulation built from the same T-periodic family. Seeded LCG → identical
// every run.
function buildWeatherLoop() {
    const T = 6;
    const n = seconds(T);
    const rng = makeRng(0xbeef);
    const harmonics = [];
    const maxK = Math.floor((440 * T)); // k such that k/T ≤ 440 Hz
    for (let k = 1; k <= maxK; k++) {
        const freq = k / T;
        const amp = (1 / Math.pow(freq, 0.9)) * (0.55 + 0.45 * rng());
        harmonics.push({ freq, amp, phase: rng() * 2 * Math.PI });
    }
    // Gust modulators: integer cycles per loop → periodicity preserved.
    const gusts = [
        { cycles: 1, phase: rng() * 2 * Math.PI, depth: 0.22 },
        { cycles: 2, phase: rng() * 2 * Math.PI, depth: 0.12 },
        { cycles: 5, phase: rng() * 2 * Math.PI, depth: 0.07 },
    ];
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        let sum = 0;
        for (const h of harmonics) sum += h.amp * Math.sin(2 * Math.PI * h.freq * t + h.phase);
        let mod = 0.75;
        for (const g of gusts) mod += g.depth * Math.sin(2 * Math.PI * (g.cycles / T) * t + g.phase);
        out[i] = sum * mod;
    }
    return normalize(out, 0.5); // bed sits well under the one-shot cues
}

// ── Emit ───────────────────────────────────────────────────────────────────
const CUES = [
    ['hit.wav', buildHit()],
    ['crit.wav', buildCrit()],
    ['miss.wav', buildMiss()],
    ['fumble.wav', buildFumble()],
    ['heal.wav', buildHeal()],
    ['levelup.wav', buildLevelUp()],
    ['save-success.wav', buildSaveSuccess()],
    ['save-failure.wav', buildSaveFailure()],
    ['monster-death.wav', buildMonsterDeath()],
    ['player-down.wav', buildPlayerDown()],
    ['player-death.wav', buildPlayerDeath()],
    ['weather-wind.wav', buildWeatherLoop()],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, samples] of CUES) {
    const wav = encodeWav(samples);
    writeFileSync(join(OUT_DIR, name), wav);
    console.log(`wrote public/audio/${name} (${(wav.length / 1024).toFixed(1)} KB, ${(samples.length / SAMPLE_RATE).toFixed(2)} s)`);
}
console.log(`Done. ${CUES.length} files in ${OUT_DIR} (deterministic — reruns reproduce byte-identical output).`);
