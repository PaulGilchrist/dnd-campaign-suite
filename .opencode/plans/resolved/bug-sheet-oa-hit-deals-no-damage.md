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

## Resolution

FIXED — diagnosis in the bug file confirmed against the live app and the code.

**What was actually wrong:** exactly as guessed. Both PC sheet OA press lanes in `src/components/char-sheet/CharReactions.jsx` called `rollAttack(name, hitBonus, { forcedMode: undefined, isOpportunityAttack: true })` (marker lane) and `{ targetName: marker.mover, ... }` (legacy lane) WITHOUT the `autoDamageFormula`/`autoDamageName`/`damageType` trio, and the auto-damage stage in `useLoggedDiceRollAttack.js buildAutoDamage` is gated on `context.autoDamageFormula` (`if (!context?.autoDamageFormula) return undefined`), so hits could never reach the damage pipeline. The sibling `attack_roll` automation lane in the same file (`handleAutomationReaction`, ~:633) already forwarded the trio — the two press lanes simply omitted it.

**Files changed:**
- `src/components/char-sheet/CharReactions.jsx` — added `buildOpportunityAttackRollOptions(attackRoll)` helper mirroring the automation lane's derivation (`attack.damage || null` / `attack.name` / `attack.damageType || 'Slashing'`, same fields `useCharActionsAutomation.js:211-214` transports) and routed BOTH OA press lanes through it, keeping `isOpportunityAttack: true` and the marker lane's `targetName` pin byte-unchanged. Misses stay damageless (the hit-gate is downstream); a damageless melee row honestly forwards `formula: null`.
- `src/components/char-sheet/CharReactions.opportunityAttackDamage.test.jsx` (NEW) — 5 regression legs: marker-live press forwards the trio with the pinned target + no re-charge + marker consumed; row `damageType` honoured (Piercing not forced to Slashing); damageless row → `autoDamageFormula: null`; legacy free-press lane forwards the trio AND keeps its gate/charge/no-target-pin shape; economy denial still rolls nothing.
- `docs/test-setup-playbook.md` §49 — recorded the rig-face pitfall discovered on the way (victim bucket without `currentHitPoints` → damage computes then `applyPlayerHpDamage` errors with zero `hp_change`; top up via scoped PATCH).

Dual-ruleset note: fix is rules-agnostic — both 5e and 2024 weapon rows in `playerStats.attacks` carry `damage`/`damageType`, single shared component; no 5e/2024 twin needed. Monster card lane already derived damage (unaffected, matches the bug file's control).

**Live re-verification (test-campaign, dev pair :5173/:80, enforcement `{mode:'on', actionEconomy:true, opportunityAttacks:true}` + sandbox map fix-oa, EP(6,3)/EF(6,4), EF defector selectedAllies):**
- Pre-fix repro CONFIRMED: trigger drag → `enforcement_triggered` row + pendingOAs marker + reactionsUsed 0→1; marker-lane press (MISS sample) + legacy free-press HIT popup `✓ HIT (18 vs AC 18)` → Done → ZERO stage-2 hosts, campaign-wide `roll(damage)` = 0, `hp_change` = 0, EF HP unchanged — exact bug-file behavior.
- Post-fix: re-triggered, marker-lane MISS wrote no damage rows; legacy-lane HIT `✓ HIT (18 vs AC 18)` → Done → **stage-2 damage popup mounts**: "Longsword 13 — 1d8+5 [slashing] + 1d8 [radiant]: 6, 2 +5 — 7 damage applied to EvasiveFighter (reduced from 13) — HP: 80 → 73" (OA riders ride the lane honestly); log gained exactly ONE `roll rollType:'damage'` row (total 13, target EvasiveFighter) + exactly ONE `hp_change` row (delta −7, currentHp 73, runtime `currentHitPoints` 73); provenance `automation/opportunity_attack` row unchanged. Mid-chain the Heavy Armor Master reduction row also fired (reduced 13→7), matching the normal-attack control.
- Exit ritual: fix-oa Deactivate (row button) + DELETE (GET 404, maps back to 4 owner fixtures), browser closed, admin clear-change-data + clear-log both 200, GET-verified `{}` / `[]`, enforcement null; `git status --porcelain public/campaigns/` empty (no fixture surgery anywhere in the session).

**Test/lint:** `npx vitest run CharReactions.opportunityAttackDamage.test.jsx` 5/5 PASS → `npx vitest run src/components/char-sheet/` 567 files / 5440 tests PASS (incl. the untouched `opportunityAttackTriggered`/`opportunityAttack` suites — the shared option shape stayed compatible) → `npm run lint` exit 0, zero warnings.

