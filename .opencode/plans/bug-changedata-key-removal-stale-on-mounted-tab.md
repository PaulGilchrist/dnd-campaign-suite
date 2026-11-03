# Removing a per-character change-data key via a full-store replace POST is not evicted by already-mounted tabs — the stale key keeps enforcing until reload

## Summary
When a character's runtime bucket is re-POSTed (full-store `{value:{…}}`) without a key that previously existed — here `selectedAllies` — the server truth correctly loses the key, but a tab that was already open keeps the OLD key in its in-memory runtime store and keeps enforcing it. Game decisions made on that tab (aura allegiance gates, OA hostility, etc.) are adjudicated against data that no longer exists server-side, silently, until the tab reloads.

## Steps to reproduce
Two browser contexts help; a single tab + an API writer works too.
1. In test-campaign (GM tab, localhost:5173), open EvasiveFighter's sheet; have a Lion-buff bearer (see bug-lion-aura-self-target-exclusion-inert.md rig: DD token adjacent + `activeBuffs [{optionName:'Lion'}]`) and DD's `selectedAllies = ["DraconicDragon","EvasiveFighter"]` confirmed via the Allies editor. EF's Glaive attack on a target rolls `mode:"disadvantage"` (aura kept on a listed ally) — log truth.
2. Without touching the tab, replace DD's bucket dropping the key:
   `GET /api/campaigns/test-campaign/change-data`, then `POST /api/campaigns/test-campaign/DraconicDragon` `{value:{ …allOtherKeys, selectedAllies DELETED }}` (Lion buff and everything else kept).
3. Verify server truth: `GET /api/campaigns/test-campaign/change-data` (cache: reload) → `DraconicDragon.selectedAllies` absent. Wait ≥ 5 s (SSE window).
4. On the still-mounted tab, roll EF's Glaive again.

## Expected behavior
The tab adopts the new bucket (key gone) → bearer is legacy-unedited → `bearerSupports` passes → roll is `mode:"disadvantage"` (this is exactly what a freshly-reloaded tab does with the identical server state).

## Actual behavior
The mounted tab rolls `mode:"normal"` twice (log: `{"rolls":[2,14],"mode":"normal","targetName":"DraconicDragon"}` and `{"rolls":[13,20],"mode":"normal",…}`) — it still enforces the deleted `["DraconicDragon"]` defector list, so the attacker is gated OFF. After `page.reload()` + campaign re-select (no server writes in between), the same roll logs `mode:"disadvantage"` (`{"rolls":[17,17],…}`), proving the server state always favored the aura and the stale tab was wrong.

## Likely cause / location
Guessing at internals, confident about the boundary:
- Server→client sync (`src/hooks/runtime/useRuntimeState.js` + SSE handler) merges incoming buckets WITHOUT evicting keys absent from the payload (merge-not-replace on the client), while tab→server writes are full-store snapshots. So a removal that happens on ANOTHER client (or via API) is invisible to a mounted tab. The same asymmetry underlies the known "loaded tabs RESURRECT cleared data via full-store POSTs" playbook note (§17) — this is its enforcement-side face: not just stale display, stale RULES decisions (allegiance gates read `getRuntimeValue(...,'selectedAllies')` from the polluted store every roll).

## Suggested fix
First read `useRuntimeState.js` / the SSE bucket-echo handler to confirm the merge semantics. Likely fix: treat a full-store bucket echo as REPLACE (drop in-memory keys missing from the payload) rather than deep-merge — or stamp a bucket revision and rebuild the bucket wholesale when it advances. Watch the §41 in-place-mutation law (dirty-check `new===old`) when constructing the replacement object. Reuse one shared `skipSync=true` adoption path so the echo doesn't bounce back.

## Severity
Data-integrity risk. Multi-client campaigns constantly snapshot full buckets; any key-removal lane (allies cleared, buff expiry, per-key admin deletes) can leave mounted tabs adjuditing on ghost state indefinitely — here it silently inverted an allegiance-gated attack roll outcome.
