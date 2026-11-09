# Bug: Condition badge × on a `(Second Turn)` row removes by the synthetic name — fake audit + phantom bucket, holder untouched

## Summary

The c5883e4a4 fix (bug-effectadder-secondturn-phantom-bucket) correctly remaps EffectAdder **add** writes from the Thief's-Reflexes `(Second Turn)` row to the holder. But the row card still renders the holder's **condition badges** (CLA-360 display law resolves conditions via `holderName`) with working Remove buttons whose handler removes by the row's **synthetic** name (`CreatureCard.jsx:644` passes `creature.name`). Clicking × on such a badge writes an audited `condition broken` row naming the synthetic creature, materializes a phantom change-data bucket keyed `"EvasiveFighter (Second Turn)"` (`activeConditions: []`), and leaves the holder's real condition fully active — the badge stays on the card, silently "succeeding" against nothing.

## Steps to reproduce

1. In `test-campaign`, seed a second-turn board (playbook curl-seed recipe): `POST /api/campaigns/test-campaign/combatSummary` with `{value:{round:1, creatures:[{name:'EvasiveFighter',type:'player',initiative:20},{name:'EvasiveFighter (Second Turn)',type:'player',initiative:19,secondTurn:true,holderName:'EvasiveFighter'}]}}`.
2. Open the Initiative view — the `(Second Turn)` card mounts (holder HP resolves, e.g. 112).
3. On the ST row card click the GM Add button (`button[title="Add condition, effect, or concentration to EvasiveFighter (Second Turn)"]`) → Conditions → Poisoned → Apply. State lands on the holder (bucket `EvasiveFighter.activeConditions:["poisoned"]`, holder card AND ST card both show a Poisoned badge, audit names `EvasiveFighter`) — this half is the shipped fix and works.
4. **Now click the × (`button[title="Remove effect"]`, sibling inside the badge wrapper) on the Poisoned badge of the ST row card.**
5. `GET /api/campaigns/test-campaign/change-data` and `GET /api/campaigns/test-campaign/log`.
6. Control: perform the identical × on the Poisoned badge of the holder (EvasiveFighter) card.

## Expected behavior

Because the ST card displays the holder's condition, removing it there should remove the holder's Poisoned — same as the add-side fix: audit names `EvasiveFighter`, holder bucket `activeConditions` becomes `[]`, badge evicts from both cards, zero buckets keyed by the synthetic name.

## Actual behavior

Step 4/5 (ST-row ×):
- Holder bucket untouched: `cd['EvasiveFighter'].activeConditions == ["poisoned"]` (verified mid-rig while it was the only remaining copy).
- Poisoned badge stays rendered on the ST card (and holder card).
- New log row: `{type:'condition', action:'broken', characterName:'EvasiveFighter (Second Turn)', condition:'Poisoned'}` — a false-positive "condition broken" audit naming a creature that has no character file and whose holder is still poisoned.
- New phantom change-data bucket `'EvasiveFighter (Second Turn)': {activeConditions: []}` created and persisted (server GET proved it; it survives the row's round-wrap retirement until Admin clear).

Step 6 control (holder ×): `activeConditions -> []`, audit names `EvasiveFighter`, badges evict — honest. The ST-row leg is the anomaly.

Follow-up witness (same bucket): marking the ST row away (away toggle) then stamped `pendingExpirations: []` into the same phantom bucket — at least one more per-card lane keys the synthetic name. Related filed sibling: `bug-secondturn-allies-editor-phantom-bucket.md` (allies editor writes `selectedAllies` into the same synthetic bucket).

## Likely location

Confident on the mechanism chain:
- `src/components/initiative/CreatureCard.jsx:644` passes `creatureName={creature.name}` (synthetic row name) into `ConditionEffectBadges`.
- `src/components/initiative/ConditionEffectBadges.jsx` `REMOVE_HANDLERS.condition` → `removeConditionByKey(ctx.creatureName, …)` reads/filters/writes the runtime bucket keyed by the synthetic name (hence `[]` phantom) and `logConditionEvent` audits the same name.
- The display side resolved it correctly via `buildDisplayCreature` (`displayCreatureUtils.js` CLA-360 `lookupName = creature.holderName || creature.name`) — the remove ctx simply never carries `holderName`.
- `c5883e4a4` patched only the add chokepoint (`Initiative.jsx openEffectAdder`); the badge-remove lane is the second chokepoint it missed.

## Suggested fix

Mirror the CLA-360 remap at the remove chokepoint: in `CreatureCard.jsx` compute `const stateName = creature.holderName || creature.name` (or reuse `isSecondTurnEntry`) and pass that as `creatureName` to `ConditionEffectBadges` — or remap inside `REMOVE_HANDLERS.condition`/`taunting_step`/`remove_pfeag` and the concentration spec if their display ever resolves via holder. Check first whether any other consumer of `ConditionEffectBadges.creatureName` (removeKey lookups, save-prompt wiring `onRollConditionSave`) relies on the raw row name. Alternative accepted-by-precedent face: render ST-row badges non-removable and force GMs to the holder card, but display-side holder law + add-side holder routing argue for consistent holder remapping. Add a pin beside `Initiative.effectAdder-second-turn.test.jsx`.

## Severity

Data integrity risk — small but real: a false-positive audit row in the campaign log claiming a condition broke on a nonexistent creature, plus orphaned change-data bucket pollution (the exact class c5883e4a4 removed from the add lane), while the intended state removal silently does nothing.
