# Bug MA-0007 — Aarakocra Skirmisher · Talons: conditional 3d4+2 charge-damage clause unimplemented (inert)

## Overview
Row MA-0007 (monster "Aarakocra Skirmisher", action "Talons", attack). Base attack is fully live and exact, but the documented conditional clause — "or 9 (3d4 + 2) Slashing damage if the aarakocra moved 30+ feet straight toward the target immediately before the hit" — has no data field, no consumer, and no live offer/grant mechanism anywhere in the app. It is inert description text. Per verdict policy (inert documented clause with grep-zero consumers + live control-probe zero-delta), this is FAIL flavor (b) unimplemented.

## Expected
On a hit after moving 30+ ft straight toward the target, the attack should deal 9 (3d4 + 2) Slashing (or at minimum offer a GM-adjudicated bonus-damage option / use a `bonus_damage`/conditional metadata field consumed at damage resolution).

## Actual
- Damage is always the base formula `1d4 + 2` Slashing. No popup ever offers the conditional bonus (enumerated popup buttons across 3 rolls: only `Advantage/Disadvantage` reroll toggles + `button.dice-roll-reroll-btn` "Done").
- Live: roll1 d20 14 +4 = 18 vs AC 12 HIT → dmg `1d4 + 2` rolls[4]=6, hp_change −6; roll2 d20 6 +4 = 10 vs AC 12 MISS; roll3 d20 12 +4 = 16 vs AC 12 HIT → dmg rolls[1]=3, hp_change −3. Zero 3d4 tokens in entire campaign log (`any 3d4 anywhere: False`); zero bonus delta beyond base formula.
- No movement-distance model exists for monsters (playbook §7: gridless lenient, no move consumer). No te/lastAttack field records monster movement; nothing could gate the clause even if coded.

## Repro
1. localhost:5173 → test-campaign → Encounters → search "Aarakocra Skirmisher" → tick → Join Encounter (lands cs-idx 0, AC 12).
2. Initiative page: arm skirmisher card target-select → AasimarTest.
3. Click avatar → `.mc-overlay` → Talons ` +4` `.mc-dice-link` (row startsWith "Talons."; mouse.click bbox center per MV-1) → HIT popup → Done (`button.dice-roll-reroll-btn`) → flush second-stage popup via overlay `el.click()` (MV-2).
4. Observe damage popup/log: formula is always `1d4 + 2`; no charge-bonus offer ever appears.

## Likely Location
- `public/data/monsters.json` `aarakocra-skirmisher.actions[0]`: no conditional/bonus_damage field; clause is description-text only.
- `src/components/encounter/MonsterCardModal.jsx:29-34` `extractDamageDiceFromDescription` short-circuits on existing `damage_dice_primary` → "1d4 + 2"; the 3d4+2 variant in the description can never be extracted.
- Grep-zero consumers: `straight.?toward|moved.?30|charge.?bonus|bonus_damage|conditional_damage` → no matches on any monster path. `movedDistanceFt` exists only as PC push/telekinesis te mirrors (telekineticShoveHandler / wrathOfTheSeaHandler / telekineticMovementHandler), unrelated to monster attacks.

## Notes
- Base attack mechanics VERIFIED EXACT: to-hit d20+4 vs AC with correct HIT/MISS boundary (10 vs 12 miss, 18/16 vs 12 hit), `targetAc/effectiveAc 12`, damage type Slashing, hp_change matches dice+mod exactly, all rolls logged (roll/attack + roll/damage + hp_change).
- Implementing the clause requires a monster movement-distance subsystem (grid positions + straight-line distance tracking) — does not exist app-wide; a minimal fix could add `bonus_damage` metadata + a GM-adjudicated offer on the HIT popup (CLA-325 advisory precedent shape).
- Gridless rig (activeMapName null); even on a mapped rig there is no monster move producer, so the clause is unmodellable today (live zero-delta control confirms).
