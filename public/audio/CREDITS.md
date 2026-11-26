# Bundled ambience pack (offline-ambience backlog Item 3b, 2026-11-25)

Nine **CC0 1.0 (Public Domain Dedication)** ambience beds committed into the
repo so an offline table has sound on first boot with zero uploads. Every
file was downloaded on **2026-11-25** from OpenGameArt.org and its license was
verified on the FILE's own page — each page carries the license badge
`CC0` linking to <http://creativecommons.org/publicdomain/zero/1.0/>. CC0
requires no attribution; this file is the provenance trail for future audits,
not a license obligation.

## Format law — mp3/m4a only, never Ogg

This app is Safari-sensitive and **Safari cannot decode Ogg Vorbis**. Bundled
beds therefore ship as **mp3 only** (m4a/AAC is also acceptable for future
additions). Several sources below shipped as `.ogg`/`.wav` upstream and were
transcoded with `ffmpeg` (libmp3lame) plus a single-pass
`loudnorm=I=-18:TP=-2:LRA=11` level match so mood switches mid-play do not
jump volume. CC0 permits modification without restriction. These are
long-form beds; the generated one-shot `.wav` cues in this folder
(see `README.md`) are a separate, synthesized lane.

Tracks are the `kind: 'local'` bundled rows (root-absolute `/audio/…` srcs)
at the head of each starter mood in `src/services/ui/musicConfig.js`.

## Provenance (one block per file)

### `town-theme.mp3` — Town mood bed 1
- Source page: <https://opengameart.org/content/town-theme-rpg> ("Town Theme RPG")
- Author: OpenGameArt user **cynicmusic**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "Now CC0 Public Domain License!"
- Upstream file: `TownTheme.mp3` (128 kbps, 97.5 s) — used as-is, loudnorm re-encode to 192 kbps only
- Size: **2,340,332 bytes** · md5 `e6a24b3b1ec39cf1f6e6b32a0a47b3cf`

### `fishing-village.mp3` — Town mood bed 2
- Source page: <https://opengameart.org/content/village1> ("Village_1")
- Author: OpenGameArt user **manofsteel**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "A warm, upbeat atmospheric peice intended for fantasy village settings."
- Upstream file: `Fishing_village.wav` (24-bit PCM, 153.0 s) — transcoded wav→mp3 192 kbps + loudnorm
- Size: **3,673,772 bytes** · md5 `6599e54e1ca02a509e4995e9665689c2`

### `birds-wind.mp3` — Outdoors mood bed 1 (longest bed: ~9.8 min)
- Source page: <https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth>
- Author: OpenGameArt user **spring-spring**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "Ambient tracks made with synthesizers and bird cries available on OGA"
- Upstream file: `Birds, Wind, Synth (Final).ogg` (189 kbps, 586.0 s) — transcoded ogg→mp3 160 kbps + loudnorm
- Size: **11,721,164 bytes** · md5 `4068534ccb8e167a65b3d490522808a6`

### `forest-ambience.mp3` — Outdoors mood bed 2 (seamless loop)
- Source page: <https://opengameart.org/content/forest-ambience>
- Author: OpenGameArt user **tinyworlds**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "It loops seamlessly and is ready to be used in your projects!"
- Upstream file: `Forest_Ambience.mp3` (128 kbps, 44.7 s) — loudnorm re-encode to 192 kbps (upstream was very low-level, max −28 dB)
- Size: **1,074,860 bytes** · md5 `4a19fea8aa83aac03353dcff5e94c678`

### `battle-theme.mp3` — Combat mood bed 1
- Source page: <https://opengameart.org/content/battle-theme-0> ("Battle Theme")
- Author: OpenGameArt user **wolfgang**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "A theme for a battle or otherwise tense moment. Orchestral."
- Upstream file: `Battle.mp3` (320 kbps, 116.1 s) — re-encoded 192 kbps + loudnorm (size hygiene; ambience bitrate)
- Size: **2,788,460 bytes** · md5 `c2323cbe8675117b8054f8d2cec78bbe`

### `determined-pursuit.mp3` — Combat mood bed 2 (loopable)
- Source page: <https://opengameart.org/content/determined-pursuit-epic-orchestra-loop>
- Author: OpenGameArt user **emmama**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "Frantic strings, determined horns and busy drums… Possible uses: battle theme, boss fight… Loopable."
- Upstream file: `determined_pursuit_loop.wav` (16-bit PCM, 108.0 s) — transcoded wav→mp3 192 kbps + loudnorm
- Size: **2,593,196 bytes** · md5 `7b39f4f318d0baf0451b8db8c777f060`

### `dungeon-ambient.mp3` — Dungeon mood bed 1 (loopable)
- Source page: <https://opengameart.org/content/loopable-dungeon-ambience>
- Author: OpenGameArt user **jaggedstone**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "A loopable dungeon/cave ambient track with a low frequency wind effect and water drips"
- Upstream file: `dungeon_ambient_1.ogg` (138 kbps, 94.3 s) — transcoded ogg→mp3 192 kbps + loudnorm
- Size: **2,264,876 bytes** · md5 `e3222a2825acb9f860dbc4f07eef5f95`

### `forgotten-tomb.mp3` — Dungeon mood bed 2
- Source page: <https://opengameart.org/content/forgoten-tomb-ambience> ("Forgoten tomb ambience")
- Author: OpenGameArt user **kindland**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "Works good for tombs, labirynths, etc, with this ambience playing on low volume."
- Upstream file: `Forgoten_tombs_1.mp3` (192 kbps, 214.2 s) — used as-is
- Size: **5,142,572 bytes** · md5 `6f584be8bea0b857192c8bd8b435e8e6`

### `old-tower-inn.mp3` — Tavern mood bed 1
- Source page: <https://opengameart.org/content/medieval-the-old-tower-inn> ("Medieval: The Old Tower Inn")
- Author: OpenGameArt user **randommind**
- CC0 proof: page license badge `CC0` → `creativecommons.org/publicdomain/zero/1.0/`; description: "My CC0 track available in full and loop version, you can freely use for any purpose!"
- Upstream file: `The_Old_Tower_Inn.mp3` (192 kbps, 105.5 s) — loudnorm re-encode (same bitrate)
- Size: **2,533,292 bytes** · md5 `38516b47dd48ad838331369b43a7e676`

## Total

34,132,524 bytes (~32.6 MiB) across 9 beds — inside the 30–50 MB budget.

## Candidates evaluated and rejected

| Candidate | Reason |
|---|---|
| `tavern-0` (yd, OGA) | CC0 badge, but the shipped export is an LMMS soundfont bounce ("Lmms file requires an external Sound Font") — low-fidelity chiptune character, below the ambience bed bar |
| `peaceful-forest` (samza, OGA) | CC0 badge but the author's own description calls the track "quite empty"; a composed song, not an outdoors bed |
| `new-sunrise` (nene, OGA) | CC0, but description self-describes as empty-sounding; film cue, not an outdoors ambience |
| `inn-music` (OGA) | "Use it for whatever you like" is not a CC0 1.0 dedication — license-unclear, refused per sourcing rules |
| `dragon-tail-tavern` (Jan125, OGA) | CC-BY 4.0 — attribution obligation, refused |
| `tavern-background` (OGA) | CC-BY-SA 3.0 — refused |
| Freesound CC0-filter sources | Download requires an account — skipped per dispatch rules (no accounts created) |
| Pixabay / "royalty-free" aggregators | License is not CC0 1.0 — refused |
