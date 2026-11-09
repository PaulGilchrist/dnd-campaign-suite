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

## Resolution

**FIXED 2026-11-09** (single-fix run). Root cause confirmed exactly as diagnosed: `TurnEconomyStrip.jsx` read `getTurnState`/`remainingMovement` under the passed name verbatim, and both initiative mount points (`CreatureCard.jsx` per-card strip, `Initiative.jsx` header strip anchored to `activeCreatureName`) fed the unremapped synthetic `(Second Turn)` name, while every charge writer and the gate key `turnState` on the holder (the `economyNameFor` law, 4dc24883b). `CharSummary.jsx` (the third mount) needs no remap — `playerStats.name` is always the holder's real name.

Fix — reuse the established chokepoint, no new abstraction:

- `navigationHandlers.js`: exported the existing `economyNameFor(summary, name)` seam resolver (was module-local).
- `TurnEconomyStrip.jsx`: new optional `economyName` prop — economy reads (`getTurnState`, `remainingMovement`) resolve under it when present; display name + aria label stay the row's own name (twin provenance preserved per the modal-header hint precedent). Normal rows omit it (byte-identical).
- `CreatureCard.jsx`: passes `economyName={effectSubjectName}` — the exact prop `ConditionEffectBadges` one line below already uses as the ST-remapped twin of `creature.name`.
- `Initiative.jsx`: header strip passes `economyName={economyNameFor(combatSummary, activeCreatureName)}` and resolves the `speedFeet` character lookup through the same name (a twin anchor previously missed the `characters` find and fell to the 30 ft default for non-30 holders).

Ruleset check: display seam is ruleset-agnostic (turnState is generic economy); no 2024 twin module involved.

Files changed: `src/components/initiative/navigationHandlers.js`, `TurnEconomyStrip.jsx`, `CreatureCard.jsx`, `Initiative.jsx`; new `TurnEconomyStrip.second-turn.test.jsx` (3 pins: holder-keyed spend displays on the twin row + twin display name kept; normal-row byte parity; a phantom synthetic-keyed record never feeds the twin read).

Verification:

- Live repro first (dev pair :80+:5173, twin active via seeded ST board + Next walk, holder key charged `actionsUsed:1 / movementUsedFeet:15` through the real seam): reproduced the filed face — header + twin strips stuck at `Action / Bonus / Reaction / 0/30 ft` while the holder card read `Action used … 15/30 ft`.
- Re-verify after fix, live + fresh reload/re-select: header strip and twin card strip both render `EvasiveFighter (Second Turn) → [Action used, Bonus, Reaction, 15/30 ft]` (twin name, holder budget); holder card unchanged; adjacent faces sane — twin→ElderPaladin Next seam closes the holder (`turnActive:false`, spent face) and opens EP fresh with the header strip re-anchoring to EP; enforcement DELETE ⇒ zero strips. Zero synthetic `turnState` keys in change-data throughout.
- Tests: `npx vitest run src/components/initiative` → 101 files / 736 tests green; `src/components/char-sheet/char-summary` → 51 files / 677 green (strip's third mount); `npm run lint` clean (zero warnings). No pre-existing failures hit.
- Exit: change-data `{}` + log `[]` GET-verified two-pass (closed tab).

