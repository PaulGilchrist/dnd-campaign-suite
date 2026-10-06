# Bug — CLA-155 Guarded Mind spends Psionic Energy but never ends Charmed/Frightened

## Overview
CLA-155 (Fighter → Psi Warrior lv10, Guarded Mind) was verified E2E on test-campaign with host EvasiveFighter (repointed Battle Master → Psi Warrior lv18 via Edit wizard step 7, disk-verified `class.subclass.name="Psi Warrior"`). The `guarded_mind` lane is live and spends a Psionic Energy Die on click, but it reports "Ended none conditions" and leaves the GM-applied Charmed/Frightened conditions ACTIVE — the core rule effect never fires. A secondary defect: runtime `psionicEnergy` is uninitialized (0) until a manual Short Rest, so the first click is refused ("No Psionic Energy remaining") despite lv18 max 12.

## Expected Behavior (canonical app data, public/data/2024/classes.json)
"Guarded Mind — Resistance to Psychic damage. Can expend Psionic Energy Die to end Charmed/Frightened conditions."
automation: `[{type:'resistance',damageTypes:['Psychic']},{type:'guarded_mind',resource:'psionicEnergy',casting_time:'1 action'}]`

## Actual Behavior
- Click of `b.clickable` "Guarded Mind:" → popup + `ability_use` log: **"EvasiveFighter used Guarded Mind to end none conditions. Psionic Energy: 11/12."** — die SPENT (12→12 after Short Rest → 11), ZERO conditions ended; Charmed/Frightened remained on the sheet afterward.
- First-ever click (before any rest): "Guarded Mind: No Psionic Energy remaining." — runtime counter 0; only Short Rest initialized it to 12/12 (restRules lane itself works, "Resources Restored: Psionic Energy").
- Psychic resistance: sheet renders `Resistances: Psychic` (data lane) but no live psychic-damage lane was reachable in this session (no GM psychic-damage input on sheet; monster attack not staged within budget) → resisted:true `hp_change` NOT proven.

## Steps to Reproduce
1. test-campaign → Characters → EvasiveFighter → Edit → step 7 Subclass → Psi Warrior → Save (lv18).
2. Initiative page → EvasiveFighter card → GM "Add" (ea-overlay) → Conditions tab → tick Charmed (+Frightened) → Apply. Log entry `condition` / EvasiveFighter appears.
3. Open EvasiveFighter sheet → click clickable text "Guarded Mind:".
   - Pre-rest: popup "No Psionic Energy remaining" (counter never initialized on subclass repoint).
   - After Short Rest (counter 12/12): popup "Ended none conditions. Psionic Energy: 11/12." Die spent; badges/conditions persist.

## Likely Location
- `src/services/automation/handlers/class-sorcerer/guardedMindHandler.js` — reads `getRuntimeValue(playerName,'activeConditions',campaignName)`; at click time it saw a list not containing the GM-applied conditions (or non-string entries), yet still decrements the die unconditionally (no gate: spend happens before/independent of a non-empty `conditionsToRemove` check).
- `src/components/initiative/createEffectAdderHandlers.js` → `src/services/combat/conditions/conditionSaveService.js` `addCondition` (writes `activeConditions` with `conditionDef.key` at `:152-154`, `campaignName` omitted on the read at `:152`) — verify key/campaign-scope symmetry with the handler's read; runtime GET `?character=EvasiveFighter&key=activeConditions` returns `null` even after Apply.
- Initialization: `src/services/rules/trackedResources.js:184` (`resources.psionicEnergy`) runs at level-up build, not on subclass-edit repoint → runtime stays 0.
- Manifest stale path note: handler lives under `class-sorcerer/` though this is a Fighter feature (path only, routing OK via `automation/index.js:397`).

## Notes
- Control gate (0 uses → refusal popup, no spend) behaves correctly.
- PASS-subset criteria NOT met: "never clears condition" is an explicit FAIL condition; plus spend-without-effect is FAIL(a) (triggered but behaved wrong).
