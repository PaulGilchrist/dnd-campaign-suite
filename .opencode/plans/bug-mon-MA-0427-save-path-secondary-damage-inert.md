# BUG MA-0427 — Brazen Gorgon Smelting Charge: save-path secondary 3d8 Fire never rolled (dual-damage inert)

## Verdict: FAIL — damage wrong (dual-damage on save fail not adjudicated)

## What works (verified live, test-campaign, localhost:5173)
- DC16 DEX save prompt LIVE: "HexWarlock must make a DEXTERITY saving throw. DC 16" (saveBonus −1 correct: DEX 8+1=9, no DEX save prof).
- Fire 2 SAVE FAILURE lands: d20(15) + −1 = 14 < 16 → full primary: save-damage log formula "2d8 + 4" rolls [8,3] total 15, finalDamage 15, hp Δ−15 exact; chip consumed "(Recharge 5-6 — unavailable)" + ability_use spend log.
- Fire 1 SAVE SUCCESS half: d20(19)+−1=18 ≥ 16 → raw [8,3]=dice 4+mod 4=8 → finalDamage 4 = floor(8/2), Δ−4 exact (primary-only half).
- Grappled/Restrained structured LAND on save fail: activeConditions ["grappled","prone","restrained"], activeConditionMeta per-cond {source:"Brazen Gorgon 1", durationNote:"Until the grapple ends…(GM-enforced)"}; condition:applied + condition_clauses_advisory logs. No conditions on save success ✓.
- Recharge 5-6 economy COMPLETE: READY "(5-6)" → spend → refuse click "Not Recharged … No save rolled, nothing spent" + smelting_charge_refused, zero save prompts → own-turn-start d6: r2 d6=5 recharged (chip back "(5-6)") → refire → r3 d6=2 recharge_failed honest.
- Log audit (19): ability_use×2, save_result×2, save×4, save-damage×2, hp_change×2 (−4,−15), recharge, recharge_failed, refused, condition×2, encounter, initiative.

## THE BUG — secondary damage inert on monster SAVE action path
- Data row carries damage_dice_secondary "3d8" Fire + damage_type_secondary Fire (monsters.json brazen-gorgon actions[2] — untouched).
- Live: NEITHER fire rolled the secondary. Zero 3d8/Fire save-damage entries across both fires; failure popup "15 damage applied — HP 69 → 54" = primary only. RAW failure = 2d8+4 Piercing PLUS 3d8 Fire.
- Root cause (read-only inspection, no edits):
  - MonsterCardModal.jsx:289 save chip → handleSaveRoll(action, extractDamageDiceFromDescription(action.description, action.damage_dice_primary), …) — primary formula only.
  - buildSaveOptions (MonsterCardModal.jsx:547+) carries saveDc/saveType/dcSuccess/saveConditions/soulTomeTrap/repeatSave — NO secondary formula field at all.
  - Secondary transport exists ONLY on the attack path: buildAutoDamageOptions → autoDamageSecondaryFormula (MonsterCardModal.jsx:540, :1050) consumed by handlePlainDamage/attack chain (MA-0426 Gore secondary 3d6 worked via that path same day).
  - saveProcessing.js has zero "secondary" handling (grep: no matches).
- Contrast: MA-0426 Gore (attack row) secondary 3d6 Fire rolled+logged exact — dual-damage support exists only for ATTACK, not SAVE chips.

## Secondary findings (adjacent, honest-recorded)
1. Prone false-positive: extractConditionsFromSaveEffect \bprone\b matches the "Prone condition INSTEAD" alternate wording → Prone applied on EVERY save fail alongside Grappled+Restrained, even when alternate branch shouldn't fire. No "already-grappled→prone-alternate" consumer (grep: only player Grapple base-action advisory popup; inert here).
2. escape_dc 14 NOT in condition meta: save-fail seam stampConditionMetaAndLogClauses stamps source+durationNote only; escape_dc consumed only by MA-0010 attack hit-clause (handlePlainDamage.js:504). Escape DC 14 = GM-enforced prose.
3. Cosmetic: duplicate "roll save" log attributed to attacker ("Brazen Gorgon 1", rolls [16,8]/[13,9], bonus 0) alongside authoritative target roll ([19]/[15], bonus −1).

## Grep-honest inert (permitted carve-outs, not the fail driver)
- Pull-into-space: no consumer (grep "pulled into|pull into the" src → 0 non-test matches) — §7 GM prose.
- Move-with-grappled/no-extra-movement: no consumer — GM prose.
- (These alone would still be PASS-subset; FAIL is driven solely by the missing secondary 3d8 Fire on save fail.)

## Suggested fix surface (no edits made)
- Thread damage_dice_secondary through buildSaveOptions → save prompt context → saveProcessing full/half adjudication (second save-damage entry, half-on-success floor per leg or combined-half per RAW choice).

## Cleanup
- Admin → Clear Change Data + Clear Campaign Log, native confirms both named "test-campaign", accepted. curl: change-data {} ✓ log [] ✓.

VERIFIED: FAIL
