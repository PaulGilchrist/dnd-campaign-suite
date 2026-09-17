# MA-0275 — Animal Lord "Animal Spirit": Fortify / Marked as Prey / Pesky Swarm variant clauses inert

## Overview
Animal Spirit (monster animal-lord, actionIndex 3, attack+save, DC 20 Dexterity, 4d10+6 Radiant, half on success) resolves its core save branch exactly, but the row's differentiating mechanic — "Failure or Success: One of the following effects occurs" (Fortify / Marked as Prey / Pesky Swarm) — has zero consumers. No variant chooser is offered to the GM on chip click, and none of the three clauses materializes any state after either save outcome. This upgrades the MA-0272 "variant clauses advisory" note to a formal FAIL flavor (b) per MV-7/MV-9/MV-21/MV-30 precedent (named mechanic inert = FAIL, not incomplete, not soft-pass).

## Expected (quoted row)
> Failure or Success: One of the following effects occurs:
> **Fortify (Forager Only).** The animal lord gains 20 Temporary Hit Points.
> **Marked as Prey (Hunter Only).** The animal lord has Advantage on attack rolls against the target until the start of the animal lord's next turn.
> **Pesky Swarm (Sage Only).** The target has Disadvantage on attack rolls and ability checks until the end of its next turn.

## Actual
- Chip click opens only the generic single-target save prompt ("DC 20 / Half damage on successful save / Roll Save / Dismiss"). No variant chooser, no Forager/Hunter/Sage selection, ever — across 6 resolutions plus a final Dismiss probe.
- Live zero-delta after both branches (curl change-data as truth):
  - Failed save (nat 6 +8 = 14 vs DC20): full 4d10+6 = 20 rolled; no tempHp key on `Animal Lord 1`, no te/advantage flag on lord vs target.
  - Successful saves (nat 20/13/14/15 +8): no te `disadvantage_next_attack` (or any te) on ElderPaladin, `pendingExpirations: []`, no swarm state.
  - `Animal Lord 1` store key carries only `lastSaveRoll` + `_lastRollContext`; the words fortify/prey/swarm appear in change-data ONLY inside the cached row `description`/`save_effect` text under `combat-ui-viewingMonster`.
- `lastAttack.saveConditions: []`; extraction vocabulary never yields anything for these clauses.

## Static grep (producers/consumers — all zero)
- `fortify` → PC Power Word Fortify path only (`powerWordFortifyHandler/Service`); nothing on the monster save row path.
- `pesky`, `marked as prey`, `animal spirit` → grep-zero in src/ and server/ (only unrelated random-event flavor and PC Ranger Hunter's Prey).
- `advantage_next_attack` te → NOT registered in `targetEffectDefinitions.js` at all (`disadvantage_next_attack` exists but has no producer from a monster save row).
- `MonsterCardHelpers.extractConditionsFromSaveEffect` matches canonical CONDITIONS only; none of the three clauses matches → [] (MV-31 family).
- Clause parsers (`parseSlowedClauses`, `parseConcentrationDisadvantageClause`, `parseSubtractDieClause`, `parseWeakeningBreathClause`, …) — no regex matches "Fortify", "Marked as Prey", or "Pesky Swarm".
- tempHp on monsters: MonsterCardModal only READS tempHp for display (:927); no save-row producer grants THP to the monster.

## Steps (2026-09-17, test-campaign, :5173)
1. EB Join Animal Lord ×1 → cs idx 0 (AC19, DEX save +7); victim ElderPaladin (AC17, DEX save +8 shown incl. +5 aura rig, radiant-resist rig live in runtime — noted, MA-0272 precedent).
2. Arm via AL initiative-row target-select (cs creature targetName=ElderPaladin).
3. Click "DC 20 Dexterity" chip → generic save prompt (no chooser) → Roll Save → Done ×6.
4. Logs: `save_result` dc 20 / Dexterity enforced; damage rolls vs applied:
   - success nat20: full 28 → floor-half 14 → resist→7 (hp 224→217)
   - success nat13: full 19 → floor-half 9 → resist→4 (217→213)
   - success nat14: full 28 → half 14 → resist→7 (213→206)
   - FAIL nat6: full 20 applied (resist→10, 206→196) — save math exact both branches, Radiant breakdown in `save-damage` logs.
5. change-data sweep after failed AND successful saves: zero Fortify THP, zero Prey advantage, zero Swarm disadvantage, no expirations, no chooser popup.
6. Final chip click → Dismiss: no variant affordance ever appears.

## Likely Location
- `src/components/encounter/MonsterCardModal.jsx` — `handleSaveRoll` save path offers no variant chooser; `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:194) vocabulary can't see the clauses.
- `src/components/encounter/MonsterCardHelpers.js` — needs clause parsers (like the MA-0087 slowed-trio / MA-0093 subtract-die precedents) for THP-to-self, attacker-advantage-vs-target, target-disadvantage.
- `src/services/combat/conditions/targetEffectDefinitions.js` — no `advantage_next_attack` te registered; needs a "marked as prey"-style te and a swarm te with consumers + expiry clock.

## Notes
- Core save math EXACT: DC 20 and Dexterity enforced in every `save_result`; failed save applies full 4d10+6; successful saves apply exact floor-half (19→9, 28→14); Radiant breakdown present. Only the variant clauses are unimplemented — they are the row's differentiating mechanic, hence FAIL flavor (b), core evidence recorded here.
- ElderPaladin carried a runtime radiant-resistance rig (auto-halves applied damage); raw-row math verified from `save-damage` roll totals vs pre-resistance halves quoted in the resistance logs.
- Consistency check vs monsters.json: row authors save_dc 20, save_type Dexterity, 4d10+6 Radiant, save_effect half-on-success — matches live prompt exactly.
