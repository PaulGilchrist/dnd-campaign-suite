# Audio cue pack (roadmap Item 10 — sensory cues)

Every file here is **generated** — never hand-edit a WAV. Regenerate the whole
pack with:

```bash
node scripts/generate-audio-cues.mjs
```

The generator is deterministic (seeded PRNG, pure math, no `Math.random`):
reruns reproduce **byte-identical** files. Recipe: mono, 16-bit PCM, 22050 Hz,
peak-normalized per cue; one-shots ≤ 1 s except the two ceremonial cues
(`levelup`, `player-death`) which run ≤ 1.5 s; the weather bed is the only
loop. All synthesis, no samples, no licensing/network dependency (owner ruling
2026-11-19).

| File | Length | Role (played by `src/services/ui/audioCues.js`) | Recipe |
|---|---|---|---|
| `hit.wav` | 0.22 s | attack hit — short thud | 150→55 Hz pitch-drop low sine, fast decay, 40 ms noise transient; normalized to 0.7 so crit reads louder |
| `crit.wav` | 0.44 s | critical hit — a HIT, hit harder: double impact | two stacked hit-style thuds (second 60 ms later, heavier/deeper), 2× hit's length, normalized to full scale |
| `miss.wav` | 0.30 s | attack miss — dull descending whoosh (intentionally quiet) | one-pole low-passed noise, cutoff slides down, sin² envelope |
| `fumble.wav` | 0.45 s | natural-1 — dissonant low buzz | detuned 110/116.5 Hz beat pair + fifth, 6 Hz tremolo |
| `heal.wav` | 0.70 s | HP gain floater — soft shimmer | staggered G5/B5/D6 bell tones, slow attack |
| `levelup.wav` | 1.30 s | level-up banner mount — triumphant fanfare | brass-voiced C5–E5–G5 run landing on a sustained vibrato'd C-major chord + sparkle tail (deliberately unlike heal's sine bells) |
| `save-success.wav` | 0.28 s | saving-throw success — bright quick ping (quiet) | two fast rising bell notes C6→G6 with shimmer partial |
| `save-failure.wav` | 0.35 s | saving-throw failure — dull low thud (quiet) | 180→70 Hz pitch slide with detuned beating twin |
| `monster-death.wav` | 0.60 s | monster reduced to 0 HP — collapsing drop | harmonically-rich growl slide 180→35 Hz + low-passed noise wash |
| `player-down.wav` | 0.70 s | player reduced to 0 HP (dying) — soft, sad bells (quiet) | two gentle slow-attack bells falling a fourth, D5→A4 |
| `player-death.wav` | 1.40 s | third failed death save — funeral knell | slow A3/C4 minor-third bell tolls (inharmonic partials) + low drone |
| `weather-wind.wav` | 6.00 s | hex-map weather ambience (loops) | sum of sinusoids at integer harmonics of 1/6 s → exactly periodic, seamless loop, no crossfade needed; 1/f^0.9 pink tilt + T-periodic gust modulation |

These cues are the floaters' audio twins and play **per client** (local files,
per-client volume — see `audioCues.js`). They mix over the YouTube ambience
lane (`MusicPlayer`) without ducking.
