# BUG MA-1000 — Homunculus Bite: save rider structurally unreachable (FAIL)

## Row (disk truth, public/data/monsters.json, index=homunculus actions[0])
Bite: attack_bonus 4, damage_dice_primary "1" Piercing, save_dc 12, save_type Constitution,
save_effect carries both bands incl. "…ends early if the target takes any **damage**."
NO `save_margin` structured key authored.

## Live ledger (test-campaign, :5173, Homunculus 1 vs Bandit 1 AC12 192/999)
- EB exact join OK (cs: Homunculus 1 ac13). Attack chip "+4" landed first click.
- HIT nat15 +4=19 vs AC12: popup "✓ HIT (19 vs AC 12)", Done (real pointer) → stage-2
  "1 damage applied — HP: 192 → 191"; log roll/attack total:15 bonus:4 ac:12 effectiveAc:12 hit:true;
  roll/damage total:1 finalDamage:1 Piercing; hp_change Δ−1 breakdown Piercing 1. fd1==|hpΔ| ✓.
- DC 12 Constitution save chip: clicked 3× at verified elementFromPoint==chip → ZERO popup,
  ZERO .sp-modal, ZERO log delta (whole post-join log: 0 save/save-damage entries).
  Bandit 1 activeConditions [] / activeConditionMeta {} unchanged. Save prompt (§100) NEVER fires.
- Console errors 0; popups 0 after flush; card stayed open. Rig intact (Homunculus armed Bandit 1; HP drift 191/999). No clears, no manifest/git writes.

## Defect 1 (PRIMARY): save chip renders INERT — MA-0560 rider-only discriminator misfires
`saveLegIsConditionRider` (src/components/encounter/MonsterCardModal.jsx:935-941) requires the
save_effect prose to contain NO /\bdamage\b/i. Homunculus' RAW clause "which ends early if the
target takes any damage" matches → riderOnly=false → plan.clickable=false
(saveChipPlan :946-951) → `onClick={undefined}` (MonsterAction.jsx:125, non-clickable branch).
Reproduced verbatim in node against disk row: composite=true, riderOnly=false, damage-word hit at index 265.
Meanwhile the attack chip's MA-0551 fork nulls saveDc/saveType/dcSuccess on the attack roll
(buildAttackChipSaveOptions ~MonsterCardModal.jsx:955-964), so NO seam adjudicates the save.
Net: DC chip is cosmetic; Poisoned/Unconscious have zero live producers on this row.

## Defect 2 (latent): no band discrimination even if chip were armed
- Fail-margin machinery (applySaveMarginRider, src/hooks/combat/saveProcessing.js:665) arms ONLY via
  structured `save_margin:{fails_by,also}` (parseSaveMarginClause, MonsterCardHelpers.js:333 —
  "STRUCTURED-KEY-ONLY … never prose-parsed"). Row authors none → fail-by-5+ band has zero producer.
- buildSaveOptions (:984) saveConditions = extractConditionsFromSaveEffect(save_effect) →
  ["poisoned","unconscious"] (both canonical words present) → ANY fail would over-grant Unconscious
  regardless of margin (MA-0904 over-grant family; §214 discriminator).

## Fix design (adjudication owed)
Code: refine saveLegIsConditionRider to key on damage-BEARING tokens (dice pattern/damage_dice_secondary)
rather than bare word "damage"; and/or DATA: author `save_margin:{fails_by:5,also:"unconscious"}`
(MA-0639/0642 byte-shape) so deep band rides the live margin rider with its merged 1-min→rounds clock,
plus suppress the shallow-band over-grant (extractConditionsFromSaveEffect sprays both words).
Wake-on-damage early-end stays §70 advisory (no consumer; note-only, confirmed not required live).

## Verdict
FAIL — save leg never seen live (both bands unobservable; chip inert by construction).
