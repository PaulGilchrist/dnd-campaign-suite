# TurnEconomyStrip reads the synthetic second-turn name — active twin's economy readout never moves

## Summary

The per-card / header `TurnEconomyStrip` (L5 economy readout, `improve(economy-card-chip)` 3fb421d93) reads `turnState` under the creature's literal name. For a `(Second Turn)` twin row no remap to the `holderName` exists, so while the twin is the ACTIVE creature, both its own card strip and the Initiative header strip keep rendering the default fresh face (“Action / Bonus / Reaction / 0/30 ft”) even though the twin's real economy — where the gate and all writers actually charge — lives on the holder's `turnState` key and is visibly spent there on the holder's card.

## Steps to reproduce

1. In test-campaign, clear state, then enable enforcement: `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',turnLock:true,actionEconomy:true,movementBudget:true}}`.
2. On the Initiative view (settled), full-store `POST /combatSummary {value:{round:1,creatures:[{name:'EvasiveFighter',type:'player',initiative:20},{name:'EvasiveFighter (Second Turn)',type:'player',initiative:19,secondTurn:true,holderName:'EvasiveFighter'},{name:'ElderPaladin',type:'player',initiative:15}]}}`.
3. Walk Next once so the twin is active (`activeCreatureName` = `EvasiveFighter (Second Turn)`).
4. Charge the holder key exactly the way a genuine twin-turn action/movement does (FX run live-proved token drags and sheet attacks while twin-active write to the HOLDER key): `POST /turnState {value:{EvasiveFighter:{turnActive:true,actionsUsed:1,bonusActionsUsed:0,reactionsUsed:0,movementUsedFeet:15,hasMoved:true,reactionCap:1,companionOf:null}, ...}}` (or, on the map, drag the EvasiveFighter token ~15 ft while the twin is active — same write target).
5. Observe the economy strips.

## Expected behavior

Every ST-row lane resolves the holder (the established chokepoint law: c076dfdf1 gate, 4dc24883b economy seam, b32ca1680 badges, 583d078ff removal, d55d4160a click, 930393775 allies). The twin's card strip — and especially the header strip, which is anchored to the ACTIVE creature — should display the holder's live budget (e.g. “Action used”, “15/30 ft”), since that bucket is what gates and charges the twin's own turn.

## Actual behavior

Live witness (this run, dev pair :80+:5173, twin active, holder key = `actionsUsed:1 / movementUsedFeet:15` in change-data):

- Holder card strip: `EvasiveFighter → [Action used, Bonus, Reaction, 15/30 ft]` — honest.
- **Header strip (active = twin): `EvasiveFighter (Second Turn) → [Action, Bonus, Reaction, 0/30 ft]` — stale fresh face.**
- **Twin card strip: same fresh face.**

The enforcement readout for the creature whose turn it is never moves all turn, while the bucket it is supposed to mirror drains on the holder key. Gate behavior is unaffected (canTakeAction resolves the seam) — this is a display seam, but it is the GM's only economy visibility for the active twin.

## Likely location

Confident (component read in full):

- `src/components/initiative/TurnEconomyStrip.jsx` — `getTurnState(turnState, creatureName)` / `remainingMovement(turnState, creatureName, speedFeet)` use the passed name verbatim; no `secondTurn`/`holderName` handling.
- Callers pass the unremapped name: `src/components/initiative/CreatureCard.jsx:669` (`creatureName={creature.name}` — note line 670's `ConditionEffectBadges` right below DOES use `effectSubjectName`, the ST-remapped twin of this prop) and `src/components/initiative/Initiative.jsx:787-792` (`creatureName={activeCreatureName}`).

## Suggested fix

Remap at the two mount points (or inside the strip via a `holderName`/`isSecondTurn` prop): when the resolved row is `secondTurn:true`, read the economy under `holderName` (mirror `economyNameFor` from `initiative/navigationHandlers.js`, or look the row up in displayCreatures). The display-only strip name can stay the twin's (provenance-hint precedent: “ (second turn)” suffix). Add a `TurnEconomyStrip.second-turn.test.jsx` pin: twin-active + holder charge ⇒ strip shows holder's spent/movement values.

## Severity

Minor UX issue — no game-state or gate impact (the enforcement gate and all charge writers resolve the seam correctly); but the shipped readout silently misinforms the GM about the ACTIVE creature's remaining economy for the whole second turn.
