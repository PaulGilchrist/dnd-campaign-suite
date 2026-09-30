# BUG MA-1689 — Water Elemental Whelm (actions[2], save) — FAIL(a) HALF-LEAK

## Verdict
FAIL(a) — UNAUTHORISED half-damage on a RAW-zero successful save. Family: MA-1673/MA-1674/MA-0781 (whirlwind MA-0610 fixed-shape precedent).

## Evidence (live, test-campaign, own evaluate/curl truth)
- Disk actions[2] KEYS: ['damage_dice_primary','description','name','save_dc','save_effect','save_type'] — **dc_success ABSENT**; description byte has NO "Success:" clause → RAW success = ZERO damage, no grapple.
- App default `action.dc_success ?? 'half'` (MonsterCardModal.jsx:268 resolveBlockSaveDcSuccess; stamped at :1145/:2150) arms half.
- SUCCESS face (d20 2 + saving_throws.str 19 = 21 ≥ DC 15, saveResult "success"): save-damage log formula "4d8 + 4", rolls [8,6,3,2]Σ19+4 raw 23, **finalDamage 11 = floor(23/2)** — HALF PAID without dc_success:"half" sanction → FAIL(a). hp_change −11 928→917 byte-agrees. dcSuccess:"half" stamp in save-roll log byte-confirms authoring of the leak.
- PASS elements retained for record: DC 15 enforced both faces; FAIL face FULL 27 (d20 5+0 <15; [8,7,7,1]+4) + §52 grant activeConditions ['grappled','restrained'] + meta source + condition applied log "Grappled, Restrained" source Whelm; success-face zero-condition grant §1116 ✓ (cd [], meta {}).

## Registry delta owed (DO NOT EDIT — report only)
monsters.json water-elemental actions[2]: add `"dc_success": "none"` (MA-0610 whirlwind fix shape; successSaveSentence 'none' = "no damage", computeDamageAfterSave → zero on success).

## Lane notes
- Single-target block-save lane (no range → executeBlockSaveRoll :403, auto-fire vs cs tn).
- Bonus feed = getSaveModifierForSaveType → getCreatureSaveModifier reads `saving_throws.str.modifier` / `ability_score_modifiers.str` (Helpers:610-633) — cs `saveBonuses` (abbr AND full-word) are BYTE-INERT on this lane (§MA-1670 full-word rig is picker-lane-only). Bare-int saving_throws.str → NaN total + React NaN console error (rig shape contract: {modifier:N}).
