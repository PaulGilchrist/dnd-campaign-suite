# New-initiative-roll pendingOAs drop law never fires — every producer dispatches while the Initiative listener is unmounted

## Summary

The pendingOAs drop law (documented in `pendingOpportunityAttacks.js`: "a new initiative roll (Initiative.jsx initiative-rolled listener) … retires every pending trigger marker") is dead in practice. The `initiative-rolled` window event is dispatched ONLY by lanes that run while the Initiative view is unmounted (Encounters-page join, NPCs-page add, sheet-page Primal Companion), and the sole consumer of the event — the `clearAllPendingOas` listener — lives in `Initiative.jsx`'s mount effect. Result: starting a brand-new combat via Encounter Builder "Join Encounter" (or adding an NPC from the NPCs page, or the companion re-roll) leaves stale OA trigger markers in `pendingOAs`, and those markers mount live resolution affordances (monster-card Reactions chip, PC sheet marker press) in the new combat where no provocation happened.

## Steps to reproduce

1. In test-campaign, seed one pending marker directly on the server (or trigger one honestly with the OA drag rig):
   `POST /api/campaigns/test-campaign/pendingOAs` body `{"value":{"ElderPaladin":{"defender":"ElderPaladin","mover":"EvasiveFighter","promptId":"ga-drop-probe-1"}}}` → GET change-data proves the key lands.
2. From the **Encounters** page (Initiative view NOT open), tick Wolf + Goblin (`input.monster-checkbox[aria-label="Select Wolf"]` etc.) and click **Join Encounter**. Initiative is re-rolled (new rows carry fresh initiative values, `activeCreatureName` re-anchors) — a bona-fide new initiative roll. The join auto-navigates to the Initiative view.
3. With the Initiative view now fully settled, GET `/api/campaigns/test-campaign/change-data`.
4. CONTROL (same session, seconds later): while still on the Initiative view, re-POST the marker, wait ~1.2 s, then `window.dispatchEvent(new CustomEvent('initiative-rolled'))` in the page console, wait ~2 s, GET again.

## Expected behavior

Per the module's own drop law, step 3 shows `pendingOAs` ABSENT — a new initiative roll retires every pending trigger marker.

## Actual behavior

- Step 3: `pendingOAs` byte-survives the join (`{"ElderPaladin":{"defender":"ElderPaladin","mover":"EvasiveFighter","promptId":"ga-drop-probe-1"}}`), witnessed twice (immediately post-join and again ~60 s later with the Initiative view mounted and cs merged to 15 rows). No mount-side sweep exists to compensate.
- Step 4: the SAME event dispatched while the view is mounted evicts the key (`pendingOAs` ABSENT within 2 s) — the listener works; the producers just never reach it.
- Consequence: in a fresh combat the stale marker's defender card/sheet still offers a "live" OA resolution that rolls before the normal melee gate against a mover who never provoked this combat.

## Likely location

Confident (grep census of producers vs consumer):

- Consumer: `src/components/initiative/Initiative.jsx:636` (`clearAllPendingOas(campaignName)` inside the `initiative-rolled` listener registered at :653 — only mounted while the Initiative view is open).
- Producers, all off-view: `src/services/encounters/encounterToInitiative.js:177` (loadEncounterToInitiative) and `:352` (addMonstersToInitiative — the EB Join lane; auto-navigate to Initiative happens AFTER the dispatch), `src/services/npcs/npcCombatService.js:60` (addNPC from the NPCs page; `onViewInitiative()` navigates after), `src/services/automation/handlers/class-ranger/primalCompanionHandler.js:308` (sheet page).
- No other `initiative-rolled` listener exists app-wide; the Initiative mount merge has no `pendingOAs` sweep (grep `clearAllPendingOas` = Initiative.jsx:636 + createCreatureHandlers.js:273 only). The unit ledger `initiative-init-rolled-handler.test.jsx` mounts Initiative and dispatches — it passes without ever exercising the real producer timing.

## Suggested fix

Don't rely on window-event timing. Options, cheapest first:
1. Call `clearAllPendingOas(campaignName)` directly in both `encounterToInitiative.js` dispatch sites (it's a plain runtime-store write, campaignName is in scope there) and in `npcCombatService.addNPC` — mirror the existing `sweepNewCombatClocks` new-combat seam that already runs at the same points.
2. Additionally sweep on Initiative MOUNT when a fresh initiative structure is detected, as defense-in-depth for out-of-tab/second-client new combats (an SSE observer tab never dispatches locally at all — cross-client joins leak the same way, worse: the observer never even fires the event).
3. Update `initiative-init-rolled-handler.test.jsx` (or a new ledger) to pin the join-lane eviction at the producer.

## Severity

Data-integrity risk / rules correctness: the drop law is a documented invariant ("the old provocation no longer stands") but is unreachable through every real UI path, so every new combat started while stale markers exist carries phantom OA affordances into the new round. Not corrupting HP state, but a resolution press on a phantom marker spends nothing yet rolls a real gated attack.

---
*Filed by exploration run GA, 2026-11-10, live-verified in test-campaign (dev pair :80/:5173, HEAD f13a90e15).*
