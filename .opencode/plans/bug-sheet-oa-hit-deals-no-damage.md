# PC sheet Opportunity Attack hits deal no damage — both OA press paths omit the damage formula

## Summary

The character-sheet Reactions lane rolls an Opportunity Attack as an attack-only contest: on a HIT the popup prints "✓ HIT (N vs AC M)", the log writes a `roll` row with `hit:true` — and nothing else ever happens. No damage popup stage, no `roll (damage)` row, no `hp_change`, no applyDamage call. The sheet's OA lanes call `rollAttack(name, hitBonus, {...})` WITHOUT the `autoDamageFormula`/`autoDamageName`/`damageType` trio that every normal sheet attack passes, and the damage pipeline is gated on exactly that parameter, so OA hits can never deal damage.

## Steps to reproduce

1. In test-campaign with enforcement `{mode:'on',actionEconomy:true,opportunityAttacks:true}`, have ElderPaladin and EvasiveFighter both on the board and on the active map, tokens adjacent (e.g. (6,3)/(6,4)).
2. Drag EvasiveFighter away (cell-stepped trusted drags) → ElderPaladin triggers (`enforcement_triggered` row + pendingOAs marker + reaction charged 0→1).
3. Open ElderPaladin's sheet → Reactions → click the `Opportunity Attack:` row (marker-live lane).
4. When the attack popup prints "✓ HIT", click Done. Repeat until at least one hit lands (ElderPaladin OA = +11 vs AC 18, ~65% per roll; the run landed TWO hits in four rolls).

## Expected behavior

An opportunity attack is a full melee weapon attack: a hit rolls and applies weapon damage (same two-stage popup chain + `hp_change` row as any normal sheet attack).

## Actual behavior

- HIT popup closes on Done; no stage-2 damage popup mounts (drain loop polling `[data-testid="popup-overlay"]` sees zero hosts within 1.5 s).
- Log after two witnessed hits: `roll` rows `{name:"Longsword", rollType:"attack", hit:true, targetName:"EvasiveFighter", targetAc:18}` and ZERO `hp_change` rows campaign-wide; no damage `roll` row; victim HP unchanged.
- CONTROL (same sheet, same victim, same tab): pressing the normal Longsword `+11` attack chip on a hit DOES run the damage pipeline — console `[applyDamage]` activity + Heavy Armor Master reduction automation row (the damage was computed, raw 9). Same for the monster-card OA chip, which rides the card `handleAttack` lane where the damage formula is derived from the authored action row.
- Reproduced on BOTH PC OA press paths (they share the defect): the pending-trigger marker lane and the legacy free-press lane.

## Likely location

Confident (code read at both call sites; behavior matches exactly):

- `src/components/char-sheet/CharReactions.jsx` — `rollAttack(attackRoll.name, attackRoll.hitBonus, { targetName: marker.mover, forcedMode: undefined, isOpportunityAttack: true })` (marker lane, ~:608) and `rollAttack(attackRoll.name, attackRoll.hitBonus, { forcedMode: undefined, isOpportunityAttack: true })` (legacy lane, ~:556). Neither passes `autoDamageFormula`.
- Contrast: `src/components/char-sheet/useCharActionsAutomation.js:214` — normal sheet attacks pass `{ targetName, ..., autoDamageFormula, autoDamageName, damageType }`.
- Consumer gate: the damage stage in `useLoggedDiceRoll`/`handlePlainDamage` only runs when a damage formula is present (see `useLoggedDiceRollAttack.potent-cantrip.test.js` "there is no damage formula" leg which pins the no-formula face = no damage application).
- `pickOpportunityAttackRoll(playerStats)` returns `{name, hitBonus}` only — the melee attack entries in `playerStats.attacks` DO carry damage dice (the sheet's own attack rows use them), so the data needed is one lookup away.

## Suggested fix

In `pickOpportunityAttackRoll` (or at both `rollAttack` call sites) also pull the chosen attack's damage fields from `playerStats.attacks` (the same fields `useCharActionsAutomation` forwards: `autoDamageFormula`/`autoDamageName`/`damageType` — mirroring the exact derivation the normal attack-row lane uses) and pass them into `rollAttack` options for BOTH lanes, keeping `isOpportunityAttack:true` so riders/economy stay byte-unchanged. Add a regression pin: marker-live OA press → popup chain reaches the damage stage → one `hp_change` row on hit; miss still writes none.

## Severity

Broken feature / rules correctness: the entire PC defensive-reaction economy charges a reaction (and enforcement toasts direct GMs to "Resolve the Opportunity Attack on <name>'s sheet"), but resolving it through the sheet lane can never deal damage — a free pass for every mover when the defender is a PC. Monster defenders are unaffected (card lane applies damage). Pre-existing (the legacy lane has the same omission), NOT a regression from the pendingOAs fix — the fix test pins the roll options' target/flag but not damage.
