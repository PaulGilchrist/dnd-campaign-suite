# MN-003 Commander's Strike — FAIL (inert: no UI seam, never offered, die never spent)

**Verdict: FAIL** — verified live in `test-campaign` on EvasiveFighter (lv18 2024 Battle Master, supDice d12 max 6), 2026-10-04.

## Data row (quoted from `public/data/2024/maneuvers.json`)

```json
{
  "name": "Commander's Strike",
  "description": "When you take the Attack action on your turn, you can replace one of your attacks to direct one of your companions to strike. Choose a willing creature who can see or hear you and expend one Superiority Die. That creature can immediately use its Reaction to make one attack with a weapon or an Unarmed Strike, adding the Superiority Die to the attack's damage roll on a hit.",
  "actionType": "grant_attack",
  "trigger": "replace_attack",
  "dieExpression": "superiority_die",
  "range": "30_ft"
}
```

## Live evidence

- Selection armed: ticked "Commander's Strike" in "Combat Superiority — Select Maneuvers" (1/9 selected) → runtime `EvasiveFighter.BattleMasterManeuvers_selection = ["Commander's Strike"]` persisted; `superiorityDice = 6`.
- On EvasiveFighter's ACTIVE turn (server `combatSummary.activeCreatureName === "EvasiveFighter"`, vs Bandit 1, AC 12):
  - Full-page sweep `button/b.clickable/[role=button]` for `/commander|replace|grant/i` → **zero matches** (x2 sweeps). No replace-attack affordance, no named row, no die cost shown.
  - Press "Combat Superiority:" row → re-opens **"Combat Superiority — Select Maneuvers"** with only `Confirm Selection` / `Cancel`. No "Use Maneuver" button, no Manage-gear, no Grant Attack use group.
  - Press Scimitar (Attack action): normal resolution `d20 14 +7 = 21 HIT vs AC 12`, damage `1d6+1 [slashing]: 1 +1 → 2 dmg, HP 11 → 9`. Only a "Charge Attack" rider prompt then appeared — Commander's Strike is never offered.
  - Post-run: `superiorityDice = 6 → 6` (zero spends), no `commanderStrikeBonus/Active/Source` anywhere, log has rolls/hp_change only — **no Commander's Strike ability_use entry ever**.

## Root causes (static)

1. **No clickable row**: `processManeuvers` pushes the grant_attack feature into `allFeatures` only (`src/services/rules/core/maneuvers.js:77-101`); automationRouter routes `combat_superiority_grant_attack` into the data-only `automation.actions` bucket (`src/services/combat/automation/automationRouter.js:205`). `combat_superiority_grant_attack` is **missing from `INTERACTIVE_HANDLER_TYPES`** (`src/services/combat/automation/automationService.js:86-87` — MN-002 added `combat_superiority_movement`/`combat_superiority_skill_check` rows but never grant_attack), so no Special Actions row renders.
2. **Use-mode modal unreachable**: the only route to `handleCombatSuperiorityGrantAttack` / `executeGrantAttackManeuver` (`dispatchers.js:120`, `executeManeuver.js:130` RUNNER_STEP) is `UseView` → `handleUseManeuver` → `onConfirm(null, singleUseName)`. But `selectionMode = forceSelectionMode || knownManeuvers.length !== allManeuvers.length` (`dispatchers.js:96`) is permanently true (max known 9 < 20 total in maneuvers.json), so `CombatSuperiorityModal` always renders `SelectionView` (`CombatSuperiorityModal.jsx:383-397`). Array-confirm only stores selection (`dispatchers.js:158-159`) — never executes.
3. **Replace trigger never fires**: `replace_attack` predicates exist (`CombatSuperiorityModal.jsx:30`, `combatSuperiorityQueries.js:51`) but **nothing in src/ ever sets `replacingAttack`**; no Attack-action intercept prompts a replacement. Rider pools filter `actionType==='attack_rider'` (`combatSuperiorityQueries.js:37,65`), excluding grant_attack.
4. Downstream consumer chain is fully implemented but dead code from the UI: `executeGrantAttackManeuver` (die roll + spend + `commanderStrikeChoice` modal → SecondaryTargetModals "Commander's Strike — Ally Attack" → `executeCommanderStrikeChoice` arms `commanderStrikeBonus` on ally → consumed hit-only at `attackRollDamageCalc.js:242-250`).

## Secondary gaps (would still apply if seam were built)

- **No auto reaction attack / reaction stamp**: model grants "+N to ally's next attack damage" only; ally attack is manual, no `reactionUsed` stamp, no immediacy, no once-per-Attack-action accounting (`oncePerTurn: true` at `maneuvers.js:92` is decorative — nothing enforces attack replacement or turn bookkeeping).
- **Willing / see-or-hear / 30-ft gates unmodeled**: no willingness, sight/sound, or range check in `executeGrantAttackManeuver`/`executeCommanderStrikeChoice` (grep: no `isWithinRange` on grant path).
- **Formula label**: die folds in as `+ <val> [slashing]` (damage type), not `[Commander's Strike]` (`attackRollDamageCalc.js:218,245`) — maneuver name absent from log formula.
- **Miss hygiene**: `commanderStrikeBonus` survives a miss (cleared only inside hit-only damage step) — armed bonus persists until ally's next hit, vs RAW single reaction attack.

## Fix sketch

Add `combat_superiority_grant_attack` to `INTERACTIVE_HANDLER_TYPES` and surface a clickable "Commander's Strike:" row (needs the feature to land in `specialActions`, as MN-002 movement/skill_check rows do), OR make `CombatSuperiorityModal` offer grant_attack known maneuvers in use-mode (fix `selectionMode` gating), and stamp a reaction/consumption + range/willingness gates in `executeGrantAttackManeuver`.
