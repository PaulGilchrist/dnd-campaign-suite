# Bug: Allies editor on a `(Second Turn)` row writes `selectedAllies` into the synthetic-name phantom bucket; holder untouched

## Summary

The c5883e4a4 fix routed EffectAdder opens from the Thief's-Reflexes `(Second Turn)` row to the holder, but the row card's **allies editor** button (`Edit the ally list of …`) was not covered by the same law. Confirming allies through it stores `selectedAllies` in a change-data bucket keyed by the synthetic row name, audits an `ability_use` row naming the synthetic creature, and leaves the holder's real ally list unset — the exact phantom-bucket class the fix eliminated on the add lane. The picker additionally lists the `(Second Turn)` row itself as a selectable ally (no `secondTurn` exclusion, unlike the target-select law).

## Steps to reproduce

1. In `test-campaign`, seed a second-turn board: `POST /api/campaigns/test-campaign/combatSummary` `{value:{round:1, creatures:[{name:'EvasiveFighter',type:'player',initiative:20},{name:'EvasiveFighter (Second Turn)',type:'player',initiative:19,secondTurn:true,holderName:'EvasiveFighter'}]}}`, then open the Initiative view (mount merge keeps the synthetic twin).
2. On the `(Second Turn)` card click the allies editor button (`button[title^="Edit the ally list"]`). Modal header reads `Allies of EvasiveFighter (Second Turn)` and the candidate list includes `EvasiveFighter (Second Turn) (Player)` itself.
3. Tick any ally (e.g. AasimarTest) and click `Confirm Allies (n)`.
4. `GET /api/campaigns/test-campaign/change-data` and `/log`.
5. Control: open the allies editor from the holder (EvasiveFighter) card and confirm a selection.

## Expected behavior

Either the ST row exposes no allies editor (like the delegation picker, which is correctly absent), or the open is remapped to the holder like `openEffectAdder` now does — so the ally list lands on `EvasiveFighter` and the audit names the real character. The candidate list should exclude `secondTurn` rows the same way target-select does.

## Actual behavior

Step 3/4: change-data bucket `'EvasiveFighter (Second Turn)'` gains `selectedAllies:["EvasiveFighter (Second Turn)","AasimarTest"]` (pre-existing `{activeConditions:[], pendingExpirations:[]}` pollution in the same bucket — separate badge-removal bug). The holder bucket has no `selectedAllies`. Log row `ability_use` with `characterName:"EvasiveFighter (Second Turn)"`. The synthetic bucket survives the row's round-wrap retirement — permanent orphan pollution until Admin clear.

Step 5 control (holder card): title `Allies of EvasiveFighter`, `selectedAllies:["Wild_Sage_Druid"]` lands on the holder bucket, audit names `EvasiveFighter` — honest. The ST-row leg is the anomaly.

## Likely location

Confident: the allies-editor opener in `src/components/initiative/Initiative.jsx` (or the `onEditAllies` handler chain from `CreatureCard.jsx`) passes the raw row `creature.name` to the allies modal + store without the `isSecondTurnEntry → holderName` remap that `openEffectAdder` received in c5883e4a4. Candidate-list side: the allies picker builds from all present creatures without the `!c.secondTurn` filter used by `TargetSelect`/`useTvPresentation` (the exclusion law exists — CreatureCard target-list law and `useTvPresentation.js` filter; the allies list just doesn't use it). Guessing on exact file/line since the handler may live in `createCreatureHandlers`/allies editor service.

## Suggested fix

Apply the c5883e4a4 chokepoint pattern to the allies editor open: remap `{...creature, name: creature.holderName}` when `isSecondTurnEntry(creature) && creature.holderName` (mirroring `Initiative.jsx:496-504`), and filter `secondTurn` rows out of the candidate list. Pin beside `Initiative.effectAdder-second-turn.test.jsx`. Also worth an audit of the remaining per-card lanes on that card for the same law (away toggle observed next).

## Severity

Data integrity risk — persists an orphaned bucket + false-attribution audit row for a creature that has no character file and disappears at the round wrap; the GM's intended ally-list edit silently does nothing for the holder (betrayal-flip/friendly-fire automations keyed off the holder's `selectedAllies` never see it).
