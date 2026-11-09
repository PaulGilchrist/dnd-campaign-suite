# Turn-lock enforcement denies the HOLDER from acting on their own second turn (Thief's-Reflexes twin is not resolved at the gate)

## Summary
With Admin → Enforcement → **Turn lock** ON, an active `(Second Turn)` row locks the very creature whose turn it is: while `EvasiveFighter (Second Turn)` is the active creature, EvasiveFighter's own Actions/Bonus Actions are refused — "It is EvasiveFighter (Second Turn)'s turn — EvasiveFighter cannot act now." The gate compares raw names and never resolves `isSecondTurnEntry → holderName`, unlike the whole CLA-360 lane family (c5883e4a4 / 583d078ff / 930393775 / b32ca1680). Owner ruling 2026-11-09 (FV session): the twin exists to represent the holder's extra turn — the holder (and their companions) should be able to act on it. **Hole, not law.**

## Steps to reproduce
1. In `test-campaign`, curl-seed `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',turnLock:true}}` and `POST /combatSummary` `{value:{round:1,activeCreatureName:'EvasiveFighter (Second Turn)',creatures:[{name:'EvasiveFighter',type:'player',initiative:'20',targetName:'ElderPaladin'},{name:'EvasiveFighter (Second Turn)',type:'player',initiative:'10',secondTurn:true,holderName:'EvasiveFighter'},{name:'ElderPaladin',type:'player',initiative:'15'},{name:'AasimarTest',type:'player',initiative:'12'}]}}` BEFORE campaign-select.
2. Select `test-campaign`, open the EvasiveFighter sheet.
3. Click the Shortbow hit chip (`+7`) in the Actions table.
4. Observe the denial; then full-store re-POST the same combatSummary with `activeCreatureName:'EvasiveFighter'` (holder active — control) and click the chip again.

## Expected behavior
The ST row IS the holder's second turn: the holder must pass the turn-lock while their twin is active (and per §18 D2, companions whose `companionOf` is the holder should act on it too). Only OTHER creatures should be locked out.

## Actual behavior
Step 3 (ST row active): zero roll — popup `It is EvasiveFighter (Second Turn)'s turn — EvasiveFighter cannot act now.` and audit row
`{"type":"enforcement_denied","creature":"EvasiveFighter","bucket":"action","source":"useCharActionsAttackHandlers","reason":"It is EvasiveFighter (Second Turn)'s turn — EvasiveFighter cannot act now."}`.
Control (holder active, live-adopted echo): the same click rolled `✓ HIT (19 vs AC 19)` + a `roll` row — so the lock is ST-seam-specific, not a general jam.
Also inert on the same seam (code census): the §18 companion exception `companionOf === activeCreatureName` (canTakeAction.js:77) can never match the suffixed twin, so a locked-holder's animate-dead thralls go inert during the holder's own extra turn too.

## Likely location
Confident: `src/services/combat/canTakeAction.js` `turnLockDenial` (:74-82) compares `creatureName !== activeCreatureName` raw; the value arrives unremapped from `src/services/combat/assertCanAct.js` `readActiveCreatureName` (reads the combatSummary mirror's `activeCreatureName` verbatim). The holder could also act when a DIFFERENT creature is active only if flags.turnLock off — not relevant.

## Suggested fix
Resolve the ST seam once at the shared read instead of in every consumer: in `assertCanAct.js` `readActiveCreatureName`, if the value is a `secondTurn:true` row's name, ALSO expose the holder (e.g. return `{name, holderName}` or normalize via the cs mirror row's `holderName`), and let `turnLockDenial` allow when `creatureName === activeCreatureName || creatureName === activeHolderName` — plus extend the companion exception to match the holder name. Alternative chokepoint: stamp a parallel `activeHolderName` on the cs write at navigation time. Add pins: holder allowed while twin active (both action and bonus buckets); companion with `companionOf=holder` allowed; a DIFFERENT creature still denied with honest copy naming the acting row. Coordinate copy: while the twin is active the denial for other creatures naming "(Second Turn)" stays truthful.

## Severity
Broken feature (opt-in enforcement): with Turn lock ON, a Thief's-Reflexes rogue gets an extra turn on which they — and only they, plus their thralls — cannot act; the enforcement audit row makes the paradox visible in the log. Enforcement is off by default, so Levels 1–4 play is byte-unaffected, which caps blast radius.

## Owner ruling
2026-11-09 (FV session): ruled a HOLE — the holder should act on their own second-turn row (remap at the gate), not intentional law. File this as fixable, not spec.
