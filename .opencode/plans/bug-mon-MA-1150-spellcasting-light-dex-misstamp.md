# BUG MA-1150 — Merfolk Wavebender Spellcasting: Light cast log mis-stamps ability as DEX (VERDICT: FAIL)

Date: 2026-09-25 · Campaign: test-campaign · Row: monsters.json merfolk-wavebender actions[2] (Spellcasting, save_dc 15, save_type Wisdom, attack_bonus 0)

## Defect 1 (FAIL-driver): advisory cast log prints spell-side dc_type over row-authored save_type
Live, clicking the `Light` chip on the Spellcasting row logged:
> Merfolk Wavebender casts Light via Spellcasting (spell save DC 15, DEX). Spell effect is recorded; GM-enforced for monsters.

CLA-325 shape + the row's authored "using Wisdom … (spell save DC 15)" demand `DC 15, Wisdom`.

Root cause (two-lane):
- DATA: `public/data/spells.json` (5e) "Light" carries `dc: {"dc_type":"DEX","dc_success":"none"}` — a save that never fires (Light RAW has no save; 2024/spells.json Light has dc:null).
- CODE: `MonsterCardModal.jsx:1229` `const saveAbility = spell?.dc?.dc_type || action?.save_type || null;` prefers spell-side dc_type over the row's authored Wisdom. MA-0012's stated intent (:1225-1227) is "print the row's authored save_dc/save_type"; the `||`-order contradicts it whenever the spell entry has spurious dc noise.

Contrast (same row, same lane, correct): Elementalism ×2 and re-test each logged `(spell save DC 15, Wisdom)` — Elementalism resolves via findMonsterSpell 2024 fallback (2024-only, dc:null) → row fallback works; only the both-file 5e Light carries the noise.
Fix candidates (dev lane): drop `dc_success:"none"` dc noise from 5e Light data, and/or gate `spell?.dc?.dc_type` on `dc_success !== 'none'` at :1229.

## Defect 2 (recorded): Control Water spend-before-refusal; refusal popup lies "nothing spent"
Disk twist: Control Water (both-file lv4, `damage Bludgeoning 4:2d8`, `dc STR/half`, aoe cube 100) → `spellHasDamage` true → `handleSpellCast` routesToSave (:2105-2106), NOT advisory (§57/§69 lane).
Live click fired, in order:
1. ability_use (:2110, skipLog=false): `Merfolk Wavebender casts Control Water via Spellcasting. 1/Day use spent — 0 remaining today (resets at a long rest, GM-enforced for monsters).)` — 1/Day use SPENT.
2. `breathAoeShape` returns null for spellInfo casts (:121) → MA-0049 no-target refusal (:374-379): automation log `Merfolk Wavebender Control Water refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no save prompt.` + `.mc-no-target-refusal` popup (recorded; the only popup in the scenario).
Popup/log text "nothing spent"/"Zero spend" is FALSE for the 1/Day counter — already paid upstream at :2110. Chip correctly went `mc-dice-link-spell-spent` "(1/Day · 0 left)".
Fix candidates (dev lane): move the no-target check above the spend, or refund uses on MA-0049 refusal, or honest popup text.

## PASS-subset axes (verified live, clean)
- Disk byte-check actions[2]: 4 `<strong>` spells, save_dc 15, Wisdom, attack_bonus 0. ✓
- Row chips: exactly 4 `.mc-dice-link-spell`; At-Will pair counterless; 1/Day pair "(1/Day · 1 left)"; ZERO `.mc-dice-link-save` in-row (§532 selector-proof; the "DC 15 Strength" chip belongs to separate row "Watery Rebuke"); stray §440 `+0` chip (attack_bonus:0) present, unpressed. ✓
- §57 At-Will ungated: Elementalism ×2 → one ability_use each, CLA-325 `DC 15, Wisdom`, zero popup (§69). ✓
- 1/Day gate LIVE: spent Control Water re-click → `automation blocked`: "Merfolk Wavebender has already cast Control Water today (1/Day) — Control Water refused. Uses reset at a long rest; GM-enforced for monsters." Zero extra ability_use. ✓
- §158 clean: zero console "Spell not found"; findMonsterSpell 5e→2024 fallback resolves 2024-only Elementalism (fresh-console repro pass, 0 errors). The one session-404 `/api/log?campaign=test-campaign` = stale console buffer from pre-session pages (/admin,/encounters warnings same vintage; no caller in src/server, no request in this run's network log) — NOT row behavior. ✓
- Utility casts = ability_use log only, no popup (§69): true for Elementalism/Light/Create-lane. Control Water popup recorded above.

## Log ledger (7 entries, this test)
1-2. Elementalism ability_use ×2 (Wisdom ✓) · 3. Light ability_use (DEX mis-stamp ← Defect 1) · 4. Control Water spend ability_use · 5. Control Water refused (no target) automation · 6. Control Water already-cast refusal (automation blocked) · 7. Elementalism ability_use (fresh-console repro, Wisdom ✓)

## Cleanup
Admin-panel Clear Change Data + Clear Campaign Log; Wavebender removed from initiative; judged by post-GET (log 0, change-data cleared).
