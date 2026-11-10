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

## Resolution

**FIXED 2026-11-10 (fix run).** Filed diagnosis confirmed live before touching code: curl-seeded `pendingOAs` marker byte-survived a real Wolf+Goblin **Join Encounter** (board re-rolled — Wolf init 19/speed 40, Goblin init 9/speed 30, `activeCreatureName` re-anchored, 15 cards), while the SAME event dispatched with the Initiative view mounted evicted it within 2 s. So the listener was fine; the producers never reached it.

### What was actually wrong (and where the ticket was off)

Root cause as filed: mount-scoped consumer vs off-view producers. Two corrections found while verifying against the real code:

1. **The producer census was incomplete — 8 dispatch sites, not 4.** Besides `encounterToInitiative.js` ×2 and `npcCombatService.js`, five *summon* lanes also dispatch `initiative-rolled`: `monsterSummon.js:345` (runs from the monster card, i.e. WITH Initiative mounted, so it does reach the listener today) plus the sheet-page `primalCompanionHandler.js:308`, `animateDeadHandler.js:169`, `createUndeadHandler.js:179`, `summonSpiritHandler.js:471`.
2. **Suggested-fix option 2 (sweep on Initiative MOUNT) was REJECTED as a rules regression.** A legitimately-armed marker must SURVIVE a reload → re-select → Initiative mount (GA-verified law, and the fold-gate ledger PT4 explicitly flags an unexplained live-marker disappearance as a suspected defect — a mount sweep would make that eviction permanent and silent). It is also unnecessary for the cross-client case: `clearAllPendingOas` is a shared runtime-store key DELETE, and `pendingOAs` is registered in `CAMPAIGN_KEYS`, so the producer tab's write publishes the null echo that evicts the bucket in **every** tab. Verified live (the joining tab's own mark `survive-1` rode a Log→Initiative remount untouched, then evicted on the mounted `initiative-rolled` dispatch).

The **summon-family lanes were deliberately left alone**: a companion/familiar summon inherits the *caster's* initiative (`resolveCompanionInitiative`) and only re-sorts the board — nothing is re-rolled — so the drop law's trigger ("a new initiative roll") does not apply, and adding the drop there would silently retire legitimately-armed markers mid-combat. Their mirror-image inconsistency (those dispatches clear markers/round flags only when the GM happens to sit on the Initiative view) is a separate rules question → backlog, below.

### Changes

| File | Change |
|---|---|
| `src/services/encounters/encounterToInitiative.js` | `clearAllPendingOas(campaignName)` at BOTH new-initiative-roll seams — `loadEncounterToInitiative` (next to the existing `sweepNewCombatClocks` new-combat seam, before the dispatch) and `addMonstersToInitiative` (unconditional before the dispatch, matching the mounted listener, which also dropped markers on a mid-round join — NOT gated on the new-board branch the clock sweep uses). Fires only after the board write ACKs, so a failed join still drops nothing. |
| `src/services/npcs/npcCombatService.js` | Same one-liner beside the `addNPCToInitiative` dispatch, after the `already` / `needs-weapon` / missing-AC-HP refusals (a refused add drops nothing). |
| `src/services/combat/pendingOpportunityAttacks.js` | Doc-only: the header drop law named "Initiative.jsx initiative-rolled listener" as the new-roll lane — that stale citation is what let the seam rot. Now names the producers, notes the listener keeps its own idempotent call for in-view dispatches. |

Pattern mirrored, not invented: `clearAllPendingOas(campaignName)` as a plain call at a new-combat seam is exactly what `createCreatureHandlers.confirmClear` (sweep clocks → clear markers) already does. No new helper/event; no 2024 twin needed (the module header pins it ruleset-agnostic, single trigger implementation). No log row added — every existing drop-law lane (turn seam, Initiative Clear, mounted listener) is silent and the join seam already writes its initiative-roll + `party_joined_initiative` rows; adding a row on one of four paths would split the convention.

### Verification

- **Repro re-run live (test-campaign, dev pair :80/:5173, localhost GM):** Encounters page → marker seeded (`ga-drop-probe-1` GET-proved present) → Wolf+Goblin **Join Encounter** → 15 cards, `round: 1`, Wolf 19/Goblin 9, roll rows + fan-out row logged → **`pendingOAs` ABSENT** (was the byte-surviving bucket). NPCs-page lane with a throwaway NPC (`QA Drop Probe`, AC 15/HP "20 (5d8)"): marker `npc-page-probe-1` present → "Add QA Drop Probe to Initiative" → joined at init 18 with its roll row → **`pendingOAs` ABSENT**. Zero app console errors (0 errors / 5 total messages).
- **Adjacent behavior:** live marker survives a Log→Initiative remount (no over-eager sweep); the mounted `initiative-rolled` listener still evicts (in-view dispatches unchanged); join still stamps initiative/speed and logs honestly.
- **Regression tests (new, co-located, non-vacuous):** `src/services/encounters/encounterToInitiative.pending-oa-drop.test.js` (6) + `src/services/npcs/npcCombatService.pending-oa-drop.test.js` (3). They register NO `initiative-rolled` listener — that absence is the regression condition — and pin the real eviction bytes (`deleteRuntimeKey('campaign','pendingOAs',campaign)`, never a `pendingOAs:{}` POST), plus the zero-write negatives (bucket absent, refused NPC add, rejected board write) and that the event still dispatches. With the producer calls neutered **4 of the 9 fail**; restored → 9 pass.
- **Suites:** touched folders `src/services/combat` + `encounters` + `npcs` + `components/initiative` = 389 files / 5229 tests PASS; full `npm run test:run` = 3179 files / 34404 pass + 3 expected-fail, 0 failures; `npm run lint` clean (0 warnings); `no-timers-guard` OK.
- **Rig exit:** throwaway NPC DELETEd (NPCs list back to the single `Marta Copperkettle` fixture, only `updatedAt` re-stamped by the sanctioned CRUD save), closed-tab two-pass API clears → change-data `{}`, log `[]`, overlays `[]`, `git status --porcelain public/campaigns/` empty.

### Backlog (not fixed here)

Summon-family `initiative-rolled` dispatches (`primalCompanionHandler`, `animateDeadHandler`, `createUndeadHandler`, `summonSpiritHandler`, `monsterSummon`) reuse the new-combat event as a *board-refresh* signal, so their side effects (player round-flag resets, `_Vex_appliedTarget`, Hunter's Mark concentration, pendingOAs) fire **only when the GM happens to be on the Initiative view** — a mount-dependent no-op otherwise. Needs an owner call: give them `combat-summary-updated` (the `summonedCreatureService.js` precedent) or keep the clears, but it should stop depending on which view is open.
