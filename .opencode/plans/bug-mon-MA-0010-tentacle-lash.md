# Bug MA-0010 — Aberrant Cultist · Tentacle Lash: Grappled/Restrained clause never applied

**Verdict: FAIL** (condition application gap; to-hit + dual damage exact)

## Row
monster "Aberrant Cultist" · actionName "Tentacle Lash" · attack · +7 · 1d6+4 Slashing + 4d6 Psychic · reach 10 ft. · conditions ["grappled","restrained"] · escape DC 14.

## What works (verified live 2026-09-13, test-campaign, Aberrant Cultist 1 → FeyRanger)
- Attack roll: log `roll/attack` "Tentacle Lash" rolls [18] kept (d20 18), bonus +7, total 25 vs AC 12 → HIT. Matches "+7".
- Dual damage exact: damage log `1d6 + 4` rolls [4] = 8 Slashing + secondary `4d6` rolls [5,3,3,3] = 14 Psychic (`secondaryDamageType:"Psychic"`, `secondaryFinalDamage:14`).
- hp_change FeyRanger 89→67, delta −22, `damageBreakdown` = Slashing 8 + Psychic 14 ✓.
- Target size gate trivially satisfied (Humanoid Medium); no size logic exists but nothing to enforce on Medium.

## The bug
1. **Grappled + Restrained never applied on hit.** The clause is description-only:
   - `monsters.json` Tentacle Lash has NO `save_effect`/condition field (its `save_dc:15` belongs to Mind Rot).
   - `extractConditionsFromSaveEffect` (src/components/encounter/MonsterCardHelpers.js:38) is the ONLY description→condition extractor in the monster path, and it reads `action.save_effect` only (MonsterCardModal.jsx:213 `buildSaveOptions`, MonsterAction.jsx:33) — Tentacle Lash yields `saveConditions: []`.
   - Condition application lives solely in the SAVE-fail seam (`applyFailedSaveConditions`, src/hooks/combat/saveProcessing.js); the weapon-attack hit path (`hitResolution.js`, `attackPostProcessing.js`) has ZERO grapple/restrained writers.
   - Live decisive: hit popup → Done → FeyRanger change-data `activeConditions: None` + initiative card zero badges.
   - Confirms MV-7 (MA-0009) observation: same attack, same inert clause.
2. **Escape DC 14 seam absent.** `escape_dc` grep-zero app-wide; no grapple te keys in `targetEffectDefinitions.js` (only stone-prison/webs flavor entries); no escape check UI/consumer for a monster-grapple.
3. Cosmetic: `lastAttack.secondaryDamageType` records "Slashing" (should be Psychic) and `weaponType:"ranged"` mislabel on this melee reach attack; `lastAttack.actualDamage:8` vs real applied 22 (hp_change is truth). Damage log itself is correct.

## Fix sketch
On monster attack hit, parse `description` grapple clause (or add structured `hit_conditions: ["grappled","restrained"], escape_dc:14` to monsters.json), gate on target size (Medium-or-Small here), write `activeConditions` + `activeConditionMeta {dc:14}` on target + `condition applied` log; add escape-save consumer at target turn start.

## Cleanup
change-data + log cleared via admin endpoints (Host: localhost); browser closed. No manifest/playbook edits.
