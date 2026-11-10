# `pendingOAs` missing from CAMPAIGN_KEYS — SSE echo misroutes to a ghost character store, cross-tab OA markers never live-update

## Summary

`pendingOAs` is a campaign-level change-data key: the trigger seam writes it with `setRuntimeValue('campaign', 'pendingOAs', …)` (`src/services/combat/pendingOpportunityAttacks.js` `PENDING_OA_KEY`) and both readers subscribe via `useRuntimeValue('campaign', 'pendingOAs', campaignName)` (`CharReactions.jsx:495`, `useMonsterPendingOa.js:26`). But it is NOT registered in `CAMPAIGN_KEYS` (`src/services/automation/common/campaignKeys.js`), so `isCampaignKey('pendingOAs')` returns false and every `change-<c>-pendingOAs` SSE echo fails the campaign-key branch in `applyStoreUpdate` — the echo is dispatched to a ghost CHARACTER store named "pendingOAs" that no consumer reads. Consequence: on an already-mounted tab, cross-client or curl-written OA trigger markers never update the client mirror; the sheet OA press silently falls to the legacy free-press lane (still charges the reaction) and the monster-card pending-OA affordance never appears until a remount/reload hydrates via the unfiltered seed pass. Same-tab drags mask the defect because the writing client's own optimistic set lands locally; a marker only lands on a settled tab when ANY unrelated registered campaign-key echo happens to fire `notify('campaign')`.

## Steps to reproduce

1. In test-campaign, select the campaign and mount Initiative (enforcement `{mode:'on',opportunityAttacks:true}` armed); open a second settled tab (or reuse one) whose client mirror is loaded.
2. With NO drag happening, seed a valid marker directly on the server: `POST /api/campaigns/test-campaign/pendingOAs` `{value:{<Defender>:{defender:<Defender>, mover:<Mover>, promptId:'probe-1'}}}` (full-store `{value}` wrapper). GET change-data confirms the row exists.
3. Observe the mounted defender tab: the sheet Reactions lane shows NO "Opportunity Attack:" triggered marker (`useRuntimeValue('campaign','pendingOAs')` stays stale) — press the OA row anyway and it resolves through the legacy free-press lane (reaction charged, no marker consumption). The monster-card lane shows no pending-OA affordance for the marked defender.
4. Control: `POST /api/campaigns/test-campaign/enforcement {value:{…}}` (a REGISTERED campaign key) → any pendingOAs-adjacent wake via `notify('campaign')` lands and the marker becomes visible — proving the drop is the key-registration branch, not SSE transport.
5. Reload the tab → marker hydrates (seed pass copies all top-level keys unfiltered) — the classic "only a reload sees it" signature of this family.

## Expected behavior

`change-<c>-pendingOAs` echoes route to the campaign store like every other campaign-level key: any client's trigger write live-updates every mounted tab's OA marker mirror within the SSE tick, sheet marker lane and monster-card affordance appear without reload, and drain-to-evict (key DELETE) echoes also propagate so `pendingOAs` ghosts don't linger per-client.

## Actual behavior

- Echo dispatched to a ghost character store "pendingOAs"; mounted-tab mirror never updates (live-witnessed 2026-11-09 during the Speedy OA fix: curl-seeded markers required an unrelated campaign-key echo to wake the store; the same-tab drag path masks it).
- Null/evict clears drop the same way, so a tab can keep stale markers across the drain seam until reload.

## Resolution

**FIXED 2026-11-09.** Root cause confirmed exactly as diagnosed: `pendingOAs` was missing from `CAMPAIGN_KEYS`, so in `App.jsx applyStoreUpdate` the `change-<c>-pendingOAs` OBJECT echo failed `isCampaignKey` and fell through to `replaceRuntimeObject('pendingOAs', data)` — a ghost CHARACTER store neither reader (`CharReactions.jsx`, `useMonsterPendingOa.js`, both correctly subscribing `useRuntimeValue('campaign', …)`) ever reads — and the drain-to-evict null DELETE echo was dropped as corrupt on the non-campaign snapshot lane. The registration covers BOTH faces: object echoes now mirror via `campaignStore.set` (full-bucket replace — correct, since every writer — `armPendingOas`/`clearPendingOa`/`prunePendingOas` — writes the whole map, and the server echoes the full merged bucket even for scoped PATCHes) and null echoes mirror via `campaignStore.delete` + `notify('campaign')`.

**One correction to the ticket's repro step 4:** the control wake did NOT reproduce. Re-POSTing the registered `enforcement` blob on a settled tab left the stale mirror stale (0 affordances) — `notify('campaign')` alone cannot inject the value because it was only ever written to the ghost store; re-reads of `getRuntimeValue('campaign','pendingOAs')` find nothing. The wake witnessed during the Speedy run was therefore some other event (re-select/reload seed), making the live defect slightly WORSE than documented: nothing short of a remount ever showed a cross-client marker.

**Files changed:**
- `src/services/automation/common/campaignKeys.js` — registered `'pendingOAs'` with a precedent comment citing the `lastCombatResult`/`pendingStarryChaliceHeal` family. No reader/writer changes (all already use charKey `'campaign'`; grep audit confirmed zero character-store consumers).
- `src/services/automation/common/campaignKeys.pendingOas.test.js` — NEW registration unit pin (mirrors the victory-stamp/pending-heal test style, incl. the look-alike-name guard).
- `src/App.runtime-events.test.jsx` — two new dispatch pins in the capture-handler rig: marker-object echo mirrors into the campaign store (never a ghost store, `replaceRuntimeObject('pendingOAs',…)` never called) and the drain-to-evict null echo REMOVES the key + wakes `notify('campaign')`.

**Verification:**
- Live repro (pre-fix): settled Initiative tab + open Goblin card; curl `POST /pendingOAs {value:{Goblin:{…promptId:'probe-1'}}}` → server GET shows the row, tab shows 0 `[data-kind="oa"]` after the SSE tick; control enforcement re-POST → still 0; reload + re-select → affordance "Opportunity Attack on EvasiveFighter" hydrates via the unfiltered seed pass (family signature confirmed).
- Live re-verify (post-fix, same rig): open card showing the seeded affordance → curl DELETE → affordance + Reactions section vanish from the settled tab in ~3.5 s (evict echo); curl POST a fresh marker → affordance mounts live in ~3 s (no reload, no wake needed). Adjacent registered-key echo sanity: top-level `activeCreatureName` POST moves `.creature-card.active` live. Same-tab drag→marker→press end-to-end: enforcement(mode:on, opportunityAttacks) + sandbox map + FeyRanger defector `selectedAllies` + cell-stepped 3-cell drag → joined trigger toast + `pendingOAs` marker armed; EF sheet "Opportunity Attack:" press rode the MARKER lane — `automation/opportunity_attack` provenance row (marker-lane-only writer) + honest `speedy_opportunity_disadvantage` row vs FeyRanger (Agile Movement) + marker consumed with drain-to-evict (key GET ABSENT). The only console errors were the documented §49 no-`currentHitPoints` rig face (FeyRanger bucket created without HP keys), not caused by the fix.
- Tests: `campaignKeys.pendingOas` + victory-stamp + pending-heal + `App.runtime-events` → 33/33; pendingOAs contract suites (navigationHandlers.pendingOas, pendingOpportunityAttacks, opportunityTrigger, MonsterCardModal OA pair, CharReactions OA quartet + edge/slow) → 144/144 (none asserted the old ghost-store shape — no pins needed updating); full `src/services/automation/common` folder → 222/222; `src/hooks/runtime` → 164/164; all five root App suites → 64/64. `npm run lint` zero warnings; `no-timers-guard` OK (no timer-adjacent code touched).
- Exit hygiene: tab closed → fix-poa sandbox map deactivated + DELETEd (maps back to the 4 owner fixtures, none active) → admin clear change-data + log, GET-verified `{}`/`[]` with no rehydration → `git status --porcelain public/campaigns/` empty.


## Likely location

Confident (code read + live witness):
- `src/services/automation/common/campaignKeys.js` — add `'pendingOAs'` to the `CAMPAIGN_KEYS` set with a precedent comment citing this family (`lastCombatResult`, `pendingStarryChaliceHeal` bullets describe the identical misroute).
- Consumers already use the correct `'campaign'` charKey, so no reader/writer changes expected.

## Suggested fix

One-word registration in `CAMPAIGN_KEYS`. Audit afterwards: `applyStoreUpdate`'s campaign-object branch handles OBJECT buckets by merge-or-replace — verify `pendingOAs` per-defender-row merges (or full-store replacement) behave for both the partial PATCH writes and the drain-to-evict null DELETE echo; pin with a regression test in the same style as the victory-stamp fix (`App.runtime-events.test.jsx` capture-handler rig or a `campaignKeys` unit pin), and re-run the `pendingOpportunityAttacks` / `navigationHandlers.pendingOas` / `opportunityTrigger` folder suites since drain-to-evict contract tests may assert on echo shape.
