# BUG MA-0271 — Androsphinx "Cast a Spell (Costs 3 Actions)" — FAIL (inert)

**Date:** 2026-09-16 · **Campaign:** test-campaign (header verified) · **Monster:** Androsphinx 1 (initiative, init 2, HP 199/199)

## Verdict: FAIL — row is inert display prose; cast has no mechanic, no spells, no consumer.

## Evidence

### Live (Playwright, :5173)
- Card opened via tracker token click. Row DOM is exactly:
  `<strong>Cast a Spell (Costs 3 Actions).</strong> <span>The sphinx casts a spell from its list of prepared spells…</span>`
- Affordance query `button,[role="button"],.mc-dice-link,a,select,input` scoped to row: **[]** (zero affordances; no LegendarySpendLink, no SpellCastLinks).
- 2 programmatic clicks (row + inner span): zero overlay spawned, log `/api/campaigns/test-campaign/log` len **271 → 271 (delta 0)**.
- Control (same card, same session): Claw `+12` chip click → log len 271 → **272**, new entry `roll/attack/Androsphinx 1/Claw rolls[12,4] bonus +12` — click plumbing alive; the legendary row alone is dead.

### Static / grep
- `public/data/monsters.json` androsphinx `legendary_actions[2]` = bare `{name, description}` — no `attack_bonus`/`save_dc`/`delegates_to`/`ability_check`/spell fields (cast-prose legendary family MA-0219/0228/0251/0261/0270 all inert; this is 0270's sibling).
- `legendary_actions[0]` "Claw Attack" has **no `uses`** → `legendaryHeaderAction()` (monsterLegendaryUses.js:153) returns null → `MonsterCardBody.jsx:54` renders legendary section **without `legendaryGate`** → `LegendarySpendLink` returns null (MonsterAction.jsx:150) → all 3 legendary rows zero-affordance (confirms MA-0269/0270 enumeration extends to row [2]).
- Androsphinx stat block: **zero spell keys** (`spell keys: []`); actions = Multiattack/Claw/Roar — "prepared spells" list does not exist in app data (secondary gap: even a working picker would have nothing to show).
- `grep "Cast a Spell" src/` → **zero** consumer matches; only gate is `isSpellcastingRow = /^spellcasting$/i` (MonsterAction.jsx:170) which never matches this name.
- `grep '"delegates_to"' public/data/monsters.json` near any "Cast a Spell" row → **0** — no monster routes a legendary cast to a delegate/picker.

## Root cause
DATA: bare row + no Spellcasting container authored for androsphinx + no consumer routes legendary "Cast a Spell" names to a spell picker.

## Fix (recommended)
Author a Spellcasting action container (prepared list + slot ledger) for androsphinx and give the legendary row `delegates_to: "Spellcasting"` (or equivalent) so the existing `delegates_to` seam (MonsterCardModal.jsx:304) resolves a picker; minimal interim = advisory-record refusal log on click. No economy header (`uses:3`) exists either — header fix required for gating.
