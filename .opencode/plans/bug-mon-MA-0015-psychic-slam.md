# Bug MA-0015 — Aberrant Spirit (Mind Flayer) · Psychic Slam

## Verdict: FAIL — inert-token data (MV-12 fingerprint, monster-specific instance)

## Monster
- `aberrant-spirit-mind-flayer` — "Aberrant Spirit (Mind Flayer)" (2024 PHB, Summon Aberration form)
- Action: **Psychic Slam** — Melee Spell Attack, reach 5 ft., Psychic

## Data (public/data/monsters.json)
- `attack_bonus`: **null** → no numeric to-hit; card shows only "+spell attack modifier" prose, **no to-hit link**
- `damage_dice_primary`: **"1d8+3+spell level"** → "+spell level" token unparseable → rollExpression null
- Other numeric fields (CR 0, proficiency_bonus null, HP 40) contain no fallback bonus.

## E2E evidence (localhost:5173, test-campaign)
1. Encounters → search "Aberrant Spirit" → checkbox Mind Flayer → Join Encounter → initiative round 1 with token "Aberrant Spirit (Mind Flayer) 1" (HP 40/40).
2. Armed PC target **AasimarTest** (HP baseline 143) via monster card Target dropdown.
3. Opened `.mc-overlay` (MonsterCardModal) via avatar click. Psychic Slam row DOM:
   `<span class="mc-dice-link" role="button">🎲 1d8+3+spell level</span>` — the **only** interactive element; **no to-hit link**.
4. Clicked damage chip → **no popup, no campaign log entry, HP unchanged 143**. Console: no new errors (pre-existing warnings only). **Silent no-op.**

## Conclusion
Identical inert-token behavior as MV-12 / MA-0014: authored data carries literal "+spell attack modifier"/"+spell level" tokens instead of numbers; chip renders clickable but resolves nothing. Data drift + inert chip. Monster-specific: same Summon Aberration family bug (beholderkin Eye Ray, slaad Claw share the pattern).

## Fix suggestion
Templated spell-attack monsters need caster-derived bonus resolution (spell attack mod, spell level slot) at card build time, or sanitization of unparseable chips (render disabled, not a dead button).
