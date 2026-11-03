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

## Resolution (FIXED 2026-11-03)

**Root cause — confirmed, exactly the file's primary guess.** The SSE echo adoption lane `applyStoreUpdate` (src/App.jsx) dispatched character-scoped `change-<campaign>-<key>` object echoes through `setRuntimeObject(storeKey, data, campaign, true)` — a MERGE loop that only sets payload keys and never evicts keys absent from them. Meanwhile the server wildcard POST (server/routes/campaigns-changedata.js:260) stores each write as a full-bucket REPLACE, so the echo IS complete server truth. The stale echo lane was even self-documented ("Character stores are full-snapshot replaces") — the implementation just didn't match the doctrine. Allegiance gates (`useAllySelection.js` `getRuntimeValue(name,'selectedAllies')`, read per roll) then enforced the ghost key.

**Repro note (snapshot drift):** HEAD `76fa0f578` landed the Lion self-target exclusion since this bug was filed, so the file's literal face (attacking the bearer, expecting disadvantage) is no longer reachable. Adapted face: EF attacks **FeyRanger** (target ≠ bearer), DD is the adjacent Lion bearer; defector `selectedAllies:["DraconicDragon"]` → gate OFF (`normal`); key removed → legacy unedited → gate ON (`disadvantage`). Reproduced pre-fix on the live app: mounted tab rolled `[11,2] normal` with the defector set (matching server), API replace-POST dropped the key (GET-proven), 6 s later the SAME tab still rolled `[19,1] normal`, while a reload+re-select tab rolled `[7,19] disadvantage` on identical server state.

**Fix (client-side adoption, 2 files):**
- `src/hooks/runtime/useRuntimeState.js` — new `replaceRuntimeObject(characterKey, fullObject)`: memory-only REPLACE adoption mirroring `setRuntimeObject`'s structure/dirty-check (`valuesEqual`, single `notify`). Evicts every store key missing from the payload, sets/updates payload keys, never POSTs (structural skipSync — no echo bounce). Array payloads are rejected with a console.error instead of evicting the live bucket.
- `src/App.jsx` — `applyStoreUpdate`'s character branch now calls `replaceRuntimeObject(storeKey, data)`; dropped the unused `campaignName` param. Pipeline lane untouched (its server route isn't a bucket-replace lane). This also structurally shrinks the §17 resurrection hazard: after any echo, a tab's bucket equals server truth, so its next full-store POST can no longer resurrect ghosts.

**Regression tests:**
- NEW `src/hooks/runtime/useRuntimeState.replaceRuntimeObject.test.js` (8 tests) — pins the exact bug: adopted bucket missing `selectedAllies` ⇒ `hasRuntimeValue` false + `getRuntimeValue` null while `activeBuffs` survives; never-POSTs; falsy-but-present values survive; eviction-alone notifies once; coercion-equal no-notify; null/scalar/array guards; per-key isolation.
- `src/App.runtime-events.test.jsx` — dispatch-table pins re-armed: character object echo adopts via `replaceRuntimeObject` and NEVER the merging `setRuntimeObject`; biPrompt gate + malformed-event tests assert the replace lane too.
- `npx vitest run src/hooks/runtime` 9 files/164 ✓; App + auras + ally suites 18 files/242 ✓; full `npx vitest run` **3036 files / 33,277 passed, 3 expected-fail, exit 0**; `npm run lint` zero warnings.

**Live re-verification (test-campaign, :5173, fixed bundle):** fresh tab on EF's sheet; API (other client) adds defector `selectedAllies:["DraconicDragon"]` → echo SET adopted, roll logged `{"rolls":[11,12],"mode":"normal"}` (gate enforced live); replace-POST WITHOUT the key → 6 s → SAME tab, no reload, rolls `{"rolls":[4,10],"mode":"disadvantage"}` + "Disadv (conditions)" popup chip — the exact inversion the bug describes, now correct. Multi-tab sanity: tab B's Allies editor "Confirm Allies (2)" (a normal full-store client write carrying every key) mirrored live into tab A, whose next roll logged `{"rolls":[20,13],"mode":"disadvantage"}` (named-ally face) with its own bucket untouched — partial-key writes and cross-tab echo behavior intact. Only console noise was the pre-existing savePrompt-404 dismiss backlog (fact-5 lane).

**Cleanup verified:** both tabs closed → Admin clears via API → `change-data {}` + log `[]` GET-confirmed quiet; battle-arena restored byte-exact (md5 `94fcd0bfe9e4cf6e1118f736b920e7a2` == pristine dist copy). Note for future rigs: the Allies modal now hard-disables `Confirm Allies (0)` (AllySelectionModal.jsx:98) — the editor's clear-to-legacy lane described in CI fact 1 no longer exists; API replace-POST remains the key-drop lane.
