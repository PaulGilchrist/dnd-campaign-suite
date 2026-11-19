# Audio cue pack (roadmap Item 10 — sensory cues)

Every file here is **generated** — never hand-edit a WAV. Regenerate the whole
pack with:

```bash
node scripts/generate-audio-cues.mjs
```

The generator is deterministic (seeded PRNG, pure math, no `Math.random`):
reruns reproduce **byte-identical** files. Recipe: mono, 16-bit PCM, 22050 Hz,
peak-normalized per cue; one-shots ≤ 1 s, the weather bed is the only loop.
All synthesis, no samples, no licensing/network dependency (owner ruling
2026-11-19).

| File | Length | Role (played by `src/services/ui/audioCues.js`) | Recipe |
|---|---|---|---|
| `crit.wav` | 0.72 s | critical hit — bright ascending flourish | 4 overlapping decaying sine notes 660→880→1320→1760 Hz + octave harmonic |
| `hit.wav` | 0.22 s | attack hit — short thud | 150→55 Hz pitch-drop low sine, fast decay, 40 ms noise transient |
| `miss.wav` | 0.30 s | attack miss — dull descending whoosh (intentionally quiet) | one-pole low-passed noise, cutoff slides down, sin² envelope |
| `fumble.wav` | 0.45 s | natural-1 — dissonant low buzz | detuned 110/116.5 Hz beat pair + fifth, 6 Hz tremolo |
| `heal.wav` | 0.70 s | HP gain floater — soft shimmer | staggered G5/B5/D6 bell tones, slow attack |
| `levelup.wav` | 0.95 s | level-up banner mount — fanfare | C5–E5–G5–C6 ascending bell arpeggio, sustained final note |
| `weather-wind.wav` | 6.00 s | hex-map weather ambience (loops) | sum of sinusoids at integer harmonics of 1/6 s → exactly periodic, seamless loop, no crossfade needed; 1/f^0.9 pink tilt + T-periodic gust modulation |

These cues are the floaters' audio twins and play **per client** (local files,
per-client volume — see `audioCues.js`). They mix over the YouTube ambience
lane (`MusicPlayer`) without ducking.
