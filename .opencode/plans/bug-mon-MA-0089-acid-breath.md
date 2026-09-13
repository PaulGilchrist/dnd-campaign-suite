# bug-mon-MA-0089 — Adult Copper Dragon "Acid Breath (Recharge 5-6)" — MV-21 fingerprint (filed by orchestrator; subagent mislabeled inert-fingerprint as PASS per MV-30)

## Title
MA-0089 Adult Copper Dragon · Acid Breath (Recharge 5-6) · aoe-save · DC 18 DEX · 12d8 Acid · FAIL

## Expected
"DC 18 Dexterity, each creature in a 60-ft line. Failure 12d8 Acid, Success half." Recharge 5-6 gate + recovery die.

## Actual
- No line/AoE picker: `.secondary-target-row`=0 both clicks; single armed target only (MV-21).
- Recharge ungated: immediate 2nd click re-fired full save, no gate/refusal/recovery die.
- Save math exact per target: fail 13 vs DC18 → 12d8=28 full (hp 999→971).

## Steps to Reproduce
1. test-campaign → EB join "Adult Copper Dragon" → arm PC → .mc-overlay → Acid Breath link → save resolves single target; click again same round → re-fires.

## Likely Location
MonsterCardModal save path single-target (MV-21); recharge display-only (MonsterAction.jsx:72).

## Notes
Subagent flagged adjacency: Evasion victim saw full damage on failed save (evasion seam unrelated to this row).
