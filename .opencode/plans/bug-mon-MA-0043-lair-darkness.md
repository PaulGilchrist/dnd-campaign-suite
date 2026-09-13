# Bug MA-0043 — Adult Black Dragon "Unnamed lair actions 3" (lair_actions) is inert

**Row**: monster "Adult Black Dragon" · lair_actions[2] · category other · magical darkness zone lair action (no numeric fields).

## Observed (E2E 2026-09-13, test-campaign, MV-18 header)
- `.mc-overlay` row 12 renders the darkness text but exposes **zero affordance**: 0 `mc-dice-link`, 0 button/input/role=button, 0 pointer-cursor children, row cursor=auto.
- Forced pointerdown/mousedown/mouseup/click/dblclick → **zero-delta**: no save prompt, no zone created, dragon HP 195/195, change-data has zero dark/light/zone/lair keys, no log entry.

## Root cause
1. **MV-21 shape gap**: `lair_actions[2]` is a plain string in `public/data/monsters.json` (unlike object `lair_actions[0]` with save_dc/save_type/damage) — "Unnamed lair actions N", no machine-readable range/duration/dispel rule.
2. **MV-24 no consumers**: no lair-action click/adjudication path; no darkness/light/dispel targetEffect in `targetEffectDefinitions.js`; the only "Magical Darkness … dispelled" strings are sorcerer log text (warpingImplosionHandler.js:165, saveAttackHandler.js:416), unrelated to lair.
3. **§7 no light model**: app has no zone/light state — darkvision-blocking, radius 15 sphere, ≤2nd-level-light dispel, concentration-free duration, and turn-end re-use cannot be represented or adjudicated at all.

## Expected
Lair action row offers an affordance, creates a tracked darkness zone (radius/duration), dispels qualifying light spells, and logs to campaign log.

## Verdict
FAIL (expected inert per MV-21/MV-24 fingerprint).
