# BUG MA-0179 — Ancient Brass Dragon Multiattack (FAIL)

**Row:** MA-0179 · ancient-brass-dragon · actions[0] Multiattack (multiattack)
**Verdict:** FAIL — Rend component PASS; replace-(A) Sleep Breath staging inert; replace-(B) Scorching Ray attack leg inert (ungated refusal).
**Date:** 2026-09-15 (live rig: test-campaign, EB join "Ancient Brass Dragon 1" hp 332 ac 20 init 20 cs idx 0)

## Component evidence

### (0) Multiattack row — accepted GM-model
Row renders text-only (no dice link; MonsterAction.jsx links only attack_bonus/save_dc/dice — MV-3). Replace-clause adjudicated by manual component clicks per MV-8 bar.

### (A) Rend ×3 — PASS (exact)
6 total clicks (vs EvasiveFighter effAc 10, then Knight 1 AC 18):
- vs AC 10: d20 raw 2→16 HIT (2d10[2,10]+8=20 Slashing + 2d6=3 Fire, hp delta −23); raw 18→32 HIT (11+7, delta −18); raw 20 nat20 CRIT — formula "2d10*2+8" (30) + Fire 4, delta −34.
- vs AC 18 (Knight 1): raw 16→30 HIT (2d10[6,9]+8=23 + 2d6=4, hp_change delta −27 exact); raw 3→17 MISS; raw 2→16 MISS (zero damage entries).
- To-hit = d20+14 exact at HIT/MISS boundary; secondary Fire damage authored + applied. Cosmetic: lastAttack.secondaryDamageType mislabels Fire as Slashing (MV-10 family; hp_change breakdown authoritative).

### (B) Sleep Breath replace-clause — FAIL (staging inert, data gap)
Row authors save_dc 21 CON + 90-ft Cone + prose staged save_effect, but **no `staged_sleep`, no `dc_success:"none"`, no recharge** (vs MA-0068 authored shape used by Green/Copper).
- `sleepStagingForAction` (MonsterCardModal.jsx:141) gates on `action?.staged_sleep` → null → picker opens WITHOUT staged copy ("On a failed save, target is Incapacitated, Unconscious" = generic extracted-conditions boilerplate).
- Live (Knight 1, CON save rolled 13, FAIL DC 21): activeConditions = `["incapacitated","unconscious"]` applied SIMULTANEOUSLY on FIRST fail. `targetEffects` null — **no `sleep_staged` te**, no turn-END repeat-save registrant, no 10-minute Unconscious clock.
- RAW requires: fail 1 → Incapacitated + sleep_staged te + repeat save at end of next turn; fail 2 → Unconscious 10 min. App over-applies Unconscious immediately and has no escalation/staged state. = data gap → inert staging (MA-0068 fingerprint: readd `dc_success:"none"` + `staged_sleep:{unconscious_minutes:10}` to the row; no code change needed — SaveAttackAoeModal sleepStaging seam already live+tested).

### (C) Scorching Ray replace-clause — FAIL (ungated refusal, MA-0065 fingerprint)
Spellcasting row names Scorching Ray (level 3 version) At Will; per-spell `.mc-dice-link-spell` renders. But row authors **no `spell_attack_bonus`** and no "+N to hit with spell attacks" prose → `monsterSpellAttackBonus` (MonsterCardHelpers.js:262-263) null → `resolveSpellAttackPlan` refuses BEFORE spend.
- Live click → popup "Spell Cast Refused: no spell attack bonus authored on the row. Nothing spent, no roll." + `automation blocked` log 05:08:45Z (zero spend, no roll, lastAttack unchanged).
- 5e spells.json Scorching Ray IS attack-shaped (attack_type "ranged", damage_at_slot_level "3":"2d6") — only the row-side bonus is missing. Fix = author `spell_attack_bonus: 12` (8+CHA 6+PB 6) on the Spellcasting row (MA-0033/MA-0065/MA-0098 pattern). Multi-ray stays GM-click-per-ray (accepted).

## Accepted gaps (enumerated, do not chase)
- No multiattack count enforcement / no chooser — GM model (MV-8).
- Multi-ray = one click per ray (MA-0065).
- Gridless cone coverage advisory (MA-0031 picker title text).
- Scorching Ray damage_at_slot_level is per-ray 2d6 in app data (ray-count scaling itself not modeled — GM clicks per ray).
- 5-ft shake-awake has no UI producer (§7 Sleep residual).

## Fix summary (data-only, both gaps)
monsters.json ancient-brass-dragon:
1. Sleep Breath row: add `"dc_success":"none", "staged_sleep":{"unconscious_minutes":10}`.
2. Spellcasting row: add `"spell_attack_bonus":12`.
