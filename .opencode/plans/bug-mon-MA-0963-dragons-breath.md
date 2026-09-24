# BUG — MA-0963 Half-Dragon "Dragon's Breath" — FAIL(a): save row damage-less (zero damage both legs)

- id: MA-0963 | stableKey: half-dragon|actions|2 | test-campaign | verified 2026-09-23 via Playwright on :5173 (dev:locked reuse, header verified test-campaign).

## Expected (disk + rules, §3)
- "Dexterity Saving Throw: DC 14, each creature in a 30-foot Cone. Failure: 28 (8d6) damage of the type chosen for the Draconic Origin trait. Success: Half damage."
- Save FAIL → full 8d6 (dynamic type from Draconic Origin); save PASS → floor(8d6/2).
- Recharge 5-6: spent on fire, refuses until d6 5+ at owner turn-start.

## Actual (live ledger, log 202→208 exact +6, console 0 errors)
- Picker (§100 shape, auto-resolve Close-only, no Done): header honest "Dexterity saving throw (DC 14)" BUT damage line renders **"On a failed save, target takes null null damage"** — no dice formula, no type.
- Press1, Bandit 1 nat18+0 vs DC 14 → SUCCESS flag correct; applied damage **0** (HP 263→263). RAW expects half 8d6 [4..24]. Zero save-damage / roll-damage / hp_change entries ("Saved — takes no damage (rolled 18)" = §196/§279 damage-less-picker fingerprint, but this row authors damage prose → fingerprint is the DEFECT here, not a legitimate zero).
- Press3 (post-recovery), Bandit 1 nat6+0 vs DC 14 → FAILURE flag correct; applied damage **0** (HP 263→263). RAW expects full 8d6 [8..48]. Zero damage entries of any kind; damage type never logged (untyped by construction — pool absent, not merely dynamic).
- DC + type enforcement: EXACT (nat18✓/nat6✗ vs 14, raw d20 +0 stamp — picker computeNpcSave full-word key seam §43; boundary-safe margins 4/8).
- Recharge economy: FULLY LIVE — spend at picker-open (ability_use "Recharge 5-6; unavailable until d6 5+"; change-data `Half-Dragon 1.monsterRecharge={"Dragon's Breath":{recharged:false,threshold:5}}`), same-round second press REFUSED (.mc-recharge-refusal "Not Recharged … No save rolled, nothing spent" + `dragon_s_breath_refused`, chip `mc-dice-link-spell-spent` §124), recovery d6 rolled at own turn-start ("Dragon's Breath recharged (d6: 5)" automation/recharge). Consumers: monsterRecharge.js (rechargeUsageOf:35 flat recharge, gate:58, spend:88, rollMonsterRecharges:125), MonsterCardModal.jsx :221/:353/:397, turnStartEffects.js:181. Per §61/§196 flat `recharge:"5-6"` authors correctly — recharge is NOT this row's defect.
- Machine truth: no saveResult-Bandit 1 key (§96 picker-route NPC fingerprint); adjudication = results-modal verdicts + ability_use DC/type stamps. lastAttack NOT stamped by save leg (stale Claw from MA-0962) — noted.

## Root cause
- Disk row authors NO `damage_dice_primary` and NO `damage_type_primary` (type is dynamic "of the type chosen for the Draconic Origin trait"). Save/picker route consumes only structured dice — description "(8d6)" is extracted for auto-damage ATTACK chips (MA-0322 §213) but NEVER for the save/picker leg → picker pool null → both legs zero damage.

## Fix
- DATA: arm a damage pool on the save leg (`damage_dice_primary:"8d6"`) so fail=full / success=floor-half lands (dc_success default half already honored in code — half-mechanism exact elsewhere MA-0618/0916).
- Notes (dynamic-type chooser gap, §116/§9): no origin-type machinery app-wide — grep "draconic origin|draconicOrigin" src/ = ZERO (MA-0962 cite, same session same monster); damage type would log generic/untyped until a Draconic-Origin chooser producer exists (MA-0275 variant-chooser template is the sanctioned pattern). One-field dice fix alone makes numerics exact with honest untyped/generic type; chooser = separate design ticket.

## Cleanup state
- Rig intact: Half-Dragon 1 105/105 (own turn), Bandit 1 263/999 (drift 0), no conditions attached (activeConditions []), recharge recovered (recharged:true), card closed, no clears performed.
