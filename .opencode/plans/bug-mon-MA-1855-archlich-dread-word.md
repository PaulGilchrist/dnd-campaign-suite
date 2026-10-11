# BUG MA-1855 — Archlich Dread Word (legendary_actions[3]) — FAIL(a) core save-shell stranded

## Row
MA-1855 / Archlich / "Dread Word" / legendary_actions / save / DC 22 Wisdom / frightened / "takes 22 (5d8) Psychic damage".

## Verdict: FAIL(a) — failed save pays ZERO damage and grants ZERO condition (MA-0090-class stranded save shell)

## Evidence (live, :80 dist, test-campaign, 2026-10-11)
Scenario: EB join Archlich 1 (cs init 5, hp 475/475) + party; victim AberrantSorcerer (WIS 9, mod −1, res []) staged hitPoints=100 full-store POST. Legendary economy honest: LA counter 3→2→1, ability_use spends "after AasimarTest's turn"/"after AberrantSorcerer's turn".

- FAIL leg: chip "DC 22 Wisdom" (single on card, owning `.mc-action` `<strong>` = "Dread Word." — decoy audit clean). Prompt: "AberrantSorcerer must make a WISDOM saving throw. DC 22. Half damage on successful save." Roll 12 −1 = 11 vs DC 22 → SAVE FAILURE. `saveResult-AberrantSorcerer` {success:false, roll:12, total:11, saveBonus:−1, mode:normal}; lastAttack {saveDc:22, saveType:"Wisdom", saveResult:"failure", attackName:"Dread Word", rollType:"save"}; log save_result "failed Wisdom save (DC 22, rolled 12 +-1 = 11)".
  **BUT: zero `roll damage` entry, ZERO hp_change (100→100), NO condition applied log, `activeConditions` absent, `lastAttack.saveConditions: []`.** Expected RAW: 5d8 Psychic full (5–40) + Frightened until end of target's next turn.
- SUCCESS leg (rig: warding_bond saveBonus:23 → nat 4 + 22 = 26 ≥ 22, bonusDetail "+23 [Warding Bond]"): "SAVE SUCCESS ... — full success"; hp 100→100, zero damage, no condition. Half-on-success math VACUOUS — half of never-rolled 0. DC enforcement + adv/bonus folding on PC prompt seam work honestly.

## Root cause (disk + code)
1. DAMAGE: row authors NO `damage_dice_primary`/`damage_type_primary`; prose "takes 22 (5d8) Psychic damage" carries no `Hit|Failure|Success:` anchor, and `extractDamageDiceFromDescription` (MonsterCardModal.jsx:797-802) regex `/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+...)\)/i` → null → zero-damage save leg.
2. CONDITION: legendary save route (resolveLegendaryRowMechanic, MonsterCardModal.jsx:693) reads conditions ONLY via `extractConditionsFromSaveEffect(action.save_effect)`; row has no `save_effect`, and row-level `conditions:["frightened"]` is not consumed on the save lane (MV-31: save_effect prose must byte-carry canonical condition word) → saveConditions:[].

## Suggested DATA fix (one-row, byte-surgical per §15 anchors)
Add to Archlich legendary_actions[3]: `"damage_dice_primary":"5d8"`, `"damage_type_primary":"Psychic"`, `"save_effect":"Frightened. Half damage on a successful save."` (or equivalent canonical wording; DC default half already prints correctly). No CODE change needed — both lanes live for anchored rows (MV-27; MA-0427).

## Residuals / notes
- Range 30 ft prose-only, no structured `range` → picker never opens, single-target inline (MA-1843 fingerprint) — advisory.
- Undead victim immunities N/A (no psychic immunity authored anywhere relevant); Archlich Magic Resistance untouched by this lane.
- Console: 0 row-related errors; only pre-existing findFeat sheet-mount noise.
- Cleanup: admin clear change-data + log verified; board cleared.
