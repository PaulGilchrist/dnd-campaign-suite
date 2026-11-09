# Second-turn seam starves holder economy and writes phantom turnState records under the synthetic name

## Summary
When the initiative walk steps into a `(Second Turn)` twin row, `applyTurnStateTransition` (navigationHandlers.js:293) resolves nothing about the second-turn seam: it calls `resetForTurn(ts, '<Holder> (Second Turn)')`, creating a **phantom per-creature economy record under the synthetic name with a full fresh budget**, while the **holder's own entry is never re-armed**. The ratified law (owner ruling 2026-11-09, fix c076dfdf1) says the holder acts on their own extra turn — and the turnLock gate indeed lets them through — but the very next check (economy) denies the holder with "No action left this turn." whenever they spent their action on their normal turn. Net effect: with enforcement `{mode:'on', actionEconomy:true}`, Thief's Reflexes' extra turn is **action-inert for any holder who used their action**, while a phantom un-spendable budget rots in the shared `turnState` bucket (and a phantom char bucket `{pendingExpirations:[]}` is seeded by the un-guarded `expireStaleEffects` sibling at :297).

## Steps to reproduce
1. In test-campaign, start clean (`change-data {}`, log `[]`). With NO campaign selected yet or on the Campaigns view, seed via the API:
   - `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',turnLock:true,actionEconomy:true}}`
   - Select test-campaign → open the Initiative view and let it settle (~4s, 13 PCs merge).
   - `POST /api/campaigns/test-campaign/combatSummary {value:{round:1, activeCreatureName:'EvasiveFighter', creatures:[ {name:'EvasiveFighter',type:'player',initiative:'20',targetName:'ElderPaladin'}, {name:'EvasiveFighter (Second Turn)',type:'player',initiative:'10',secondTurn:true,holderName:'EvasiveFighter'}, {name:'ElderPaladin',type:'player',initiative:'15'} ]}}` (post-settle full-store POST is adopted live; see playbook echo law).
2. On EvasiveFighter's sheet, click a `+N` attack row once → the roll lands and `GET /change-data` shows `turnState.EvasiveFighter.actionsUsed = 1` (economy charging control face).
3. On the Initiative view click `Next →` until the twin card is the active row (`GET` shows `combatSummary.activeCreatureName = "EvasiveFighter (Second Turn)"`).
4. `GET /api/campaigns/test-campaign/change-data`:
   - `turnState` now contains a THIRD record keyed literally `"EvasiveFighter (Second Turn)"` with `turnActive:true, actionsUsed:0` (never spendable — every charge lands on the acting holder's own key).
   - `turnState.EvasiveFighter` is unchanged (`actionsUsed:1, turnActive:false`) — NOT re-armed for the extra turn.
5. On EvasiveFighter's sheet click an attack row again → popup "No action left this turn." + `enforcement_denied` log row `{creature:'EvasiveFighter', bucket:'action', reason:"No action left this turn."}` — during the holder's OWN extra turn.
6. Control (proves the denial is the missing re-arm, not turnLock): reload, re-select, and with the settled Initiative tab `POST` a fresh board as in step 3 but with `turnState` full-store-replaced so `EvasiveFighter.actionsUsed=0` and `activeCreatureName:'EvasiveFighter (Second Turn)'` + top-level `POST /activeCreatureName {value:'EvasiveFighter (Second Turn)'}` — the holder's attack then ROLLS normally (nat 19 → 26 vs AC 19 observed).
7. Companion control: stamp `turnState.AasimarTest.companionOf='EvasiveFighter'` (full-store turnState POST BEFORE reload) — AS's attack rolls while the twin is active (companion pass held); a stranger (ElderPaladin) denies with honest copy naming the twin row.
8. Walk `Next` past the twin; the phantom `turnState['EvasiveFighter (Second Turn)']` record stays in the bucket forever (`turnActive:false`, budget untouched), and a phantom char bucket `'EvasiveFighter (Second Turn)': {pendingExpirations:[]}` is materialized by the turn seam (`expireStaleEffects` at :297 is not ST-guarded).

## Expected behavior
A `(Second Turn)` row IS the holder's extra turn (owner ruling 2026-11-09). At the holder→twin seam the economy transition should re-arm the HOLDER (`resetForTurn(ts, holderName)`) so the extra turn grants fresh action/bonus budget (RAW: Thief's Reflexes = "take an extra turn"); at the twin→next seam it should close the holder. No turnState record or char bucket should ever be keyed under the synthetic `"<Holder> (Second Turn)"` name (phantom-bucket family, precedents 583d078ff/930393775/d55d4160a).

## Actual behavior
- `turnState` gains a phantom synthetic-name record with a full budget nobody can consume (charges always key on the acting creature = holder).
- Holder's entry is not reset → every spent bucket is denied on the extra turn ("No action left this turn.", two `enforcement_denied` rows observed) even though turnLock correctly allows the holder.
- Phantom record persists after the seam and past row retire; plus a phantom char bucket `{pendingExpirations: []}` under the synthetic name (seeded via the §pendingExpirations mirror-read seed lane).
- turnLock + stranger-denial + companion-pass faces are all honest (c076dfdf1 law held; companion face CLOSED live this run).

## Likely location
Confident: `src/components/initiative/navigationHandlers.js` — `applyTurnStateTransition` (line 148-156) and its call at line 293 never resolve the ST seam (contrast `readActiveCreature` in `src/services/combat/assertCanAct.js` which DOES resolve twin→holderName for the gate; the economy STATE writer was left behind when c076dfdf1 fixed the gate). The un-guarded `expireStaleEffects(campaignName, newActiveName)` at line 297 is the phantom-bucket producer. Sibling seam (code census, not ridden live): `markRewoundTurnActive` (line 161-166) will `openTurn` under the synthetic name on a Prev-step into the twin row.

## Suggested fix
In `applyTurnStateTransition` (and `markRewoundTurnActive`), look up the outgoing/newActive row in the live combatSummary mirror; when `isSecondTurnEntry(row) && row.holderName`, use `holderName` for closeTurn/resetForTurn/openTurn instead of the synthetic label (holder resets at the twin seam = fresh extra-turn budget; holder closes at the twin→X seam). Guard `expireStaleEffects` with the same `!isSecondTurnEntry(newActiveEntry)` condition the turn-start gate already uses (CLA-360 double-tick precedent — resolving expiries to the holder could double-tick, so skip on ST rows). `turnState.js` needs no change (pure math). Add a navigationHandlers ledger pinning: holder re-armed at twin seam, zero synthetic keys in turnState/change-data, holder closed at twin→X seam.

## Severity
Broken feature / data integrity risk — the ratified "holder acts on their own second turn" promise is silently nullified whenever action-economy enforcement is ON (popup + audit only on the denial side), and the shared `turnState` / change-data buckets accumulate synthetic-name records that no lane consumes or cleans.
