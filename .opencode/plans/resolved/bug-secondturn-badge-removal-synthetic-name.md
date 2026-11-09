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

## Resolution

**FIXED 2026-11-09.**

What was actually wrong (mechanism corrected vs the original guess): the guess pointed at
`ConditionEffectBadges.jsx` `REMOVE_HANDLERS.condition` — that branch is **dead code** (grep proves
zero producers of `badge.removeAction: 'condition'` / `removeKey` anywhere in `src/`). The live
broken lane is the condition-badge row itself: `CreatureCard.jsx` `ConditionBadgeRow` wires the ×
to `onBreakCondition(creature.name, cond)` → `handleAutoBreakCondition`
(`createAutoBreakConditionHandler.js`), which received the **synthetic** row name and, from it:
1. filtered `conditions` off the synthetic cs row (no display effect — runtime is authoritative),
2. called `removeCondition` (`conditionSaveService.js`) which read `getRuntimeValue(synthetic,'activeConditions')`
   (undefined → `[]`), filtered, and `setRuntimeValue(synthetic, 'activeConditions', [])` — **materializing the
   phantom bucket**, and
3. `logConditionEvent({action:'broken', creatureName: synthetic})` — the **false-positive audit**.
The holder's real bucket was never read or written, so the badge stayed on both cards.

Fix (mirrors the established precedent — `openEffectAdder` c5883e4a4 / `useAllyEditor.js`
`openAllyEditor`: remap `isSecondTurnEntry(row) && row.holderName → holderName` at the chokepoint
BEFORE any change-data write or audit):
- `src/components/initiative/createAutoBreakConditionHandler.js` — looks the cs row up by name
  (already did), derives `subjectName = row && isSecondTurnEntry(row) && row.holderName ? row.holderName : creatureName`,
  then strips the condition from the **holder's** cs row, routes `removeCondition` AND
  `logConditionEvent` by `subjectName`. Non-ST and holder-less-`holderName` rows are byte-identical to before.
- Chosen over the bug file's suggested `CreatureCard.jsx` prop swap because the handler is where the
  write + audit actually happen (single edit covers both, guards every caller), and passing the holder
  name into `ConditionEffectBadges` would additionally flip its `activeBuffs`/te display derivations —
  the recorded backlog asymmetry, out of scope here.
- Dual-ruleset: this lane is ruleset-agnostic UI code — no 2024 twin to change.

Regression test: `src/components/initiative/createAutoBreakConditionHandler.second-turn.test.js`
(4 pins: ST-row × remaps BOTH the `removeCondition` subject and the `broken` audit to the holder;
holder cs row stripped while the synthetic row is untouched; holder-card control keeps its own name;
`secondTurn` row without `holderName` falls back byte-identically). Mock conventions mirror
`useAllyEditor.test.js` / `Initiative.effectAdder-second-turn.test.jsx` (structural `isSecondTurnEntry` stub).

Verification:
- `npx vitest run` new test: 4/4 pass. Touched folder `src/components/initiative`: 93 files / 699 tests pass. `npm run lint`: zero warnings. No initiative-folder test pinned the synthetic-name removal (pinned-bug audit clean).
- Live repro re-run in `test-campaign` (curl-seeded ST board, header-verified): add Poisoned via the ST card Add modal (holder `["poisoned"]`, synth bucket GET-ABSENT — add lane still good) → **× on the ST card's Poisoned badge** → holder `activeConditions: []`, audit `condition broken` names `EvasiveFighter` (zero synthetic-name condition rows in the log), badge evicted from BOTH cards, synthetic bucket **never materialized** (GET-ABSENT). Holder-card control × equally honest. Console 0 errors / 0 warnings.
- Exit: browser closed, Admin clear-change-data + clear-log two-pass API, GET-verified `{}` / `[]` (incl. the repro's original phantom bucket), servers untouched.

Follow-up notes (not in this filing's scope):
- The same badge's **click** (condition-save reroll, `onRollConditionSave(creature.name, …)` →
  `createRollConditionSaveHandler.js`) still receives the synthetic name on ST rows — a sibling
  lane of the same class; if ever ridden, it needs the identical chokepoint remap.
- te/concentration badges still don't render on ST cards (`CreatureCard.jsx` filters by synthetic
  name — recorded FU backlog asymmetry), so `ConditionEffectBadges` REMOVE_HANDLERS are unreachable
  from ST rows today.

