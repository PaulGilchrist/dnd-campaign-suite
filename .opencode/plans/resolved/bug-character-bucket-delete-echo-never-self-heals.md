# bug: character-bucket DELETE echo never self-heals mounted clients

## Summary
`DELETE /api/campaigns/:campaign/:key` for a per-character change-data bucket (e.g. `ElderPaladin`) evicts the bucket server-side and publishes the documented unconditional null SSE echo, but every mounted client silently DROPS that echo — the bucket's badges/rows (e.g. the GM Screen `ElderPaladin — Blinded` line, or any `useRuntimeValue(charKey, …)` consumer) stay phantom-live on every open tab indefinitely; only a full page reload adopts the truth. The server route's own comment promises the echo "lets stale local copies on other tabs self-heal" — for non-campaign keys it never does.

## Steps to reproduce
1. In `test-campaign`, open two localhost GM tabs (A and B).
2. In tab B, open the **GM Screen** view and note the `In Play` section shows no `ElderPaladin` condition line.
3. From either tab (or curl): `POST /api/campaigns/test-campaign/ElderPaladin` with body `{"value":{"activeConditions":["Poisoned"]}}`.
   - Within ~2 s the `ElderPaladin / Poisoned` line appears LIVE on both tabs' mounted GM Screen panels (add adoption works).
4. Now `DELETE /api/campaigns/test-campaign/ElderPaladin` (200 `Data deleted successfully`).
5. `GET /api/campaigns/test-campaign/change-data` — the `ElderPaladin` key is gone (server truth).
6. Observe the still-mounted GM Screen panels on tabs A and B: the `ElderPaladin / Poisoned` line **never disappears** (waited 2+ minutes across several runs). Navigating away and back (Log → GM Screen remount) does NOT clear it — the client runtime store still holds the evicted bucket.
7. Hard-reload a tab: the line is correctly gone (rehydration from server truth).

## Expected behavior
Per `server/routes/campaigns-changedata.js:616-620`: "the null SSE echo is unconditional (it honestly reports the post-request state — key absent — and lets stale local copies on other tabs self-heal)". All tabs should REMOVE the character bucket from their local runtime store within ~1–2 s of the DELETE, exactly as campaign-scope key deletes do (`targetEffects` DELETE in the same session adopted live: badge vanished and `No zones or markers on the table.` reappeared).

## Actual behavior
- Server: bucket evicted (change-data GET confirms), SSE `change-test-campaign-ElderPaladin` fires with `data: null`.
- Client: phantom row survives on every mounted tab, survives SPA remounts of the consumer, until the page reload rehydrates the whole change-data store.
- Zero console errors — it is a silent staleness.

## Likely location
Confident (code read matches both lived faces):
- `src/App.jsx` `handleChangeKeyEvent` (~line 162): for `event.data === null` (or any non-object), the null-echo mirror runs ONLY `if (isCampaignKey(storeKey))`; the comment states "Character stores are full-snapshot replaces, so a non-object payload there is corrupt noise and stays dropped." The cleared-key null echo for a CHARACTER key is therefore dropped, not mirrored as a bucket remove.
- Contrast: `applyStoreUpdate` (App.jsx ~line 113-132) already mirrors `data === null` as `campaignStore.delete(storeKey)` for campaign keys; the else-branch (character bucket path, `replaceRuntimeObject(storeKey, data)`) has no `data === null` arm.
- Server side needs no change: `campaigns-changedata.js` DELETE already publishes `publish(\`change-${campaign}-${key}\`, null, campaign)`.

Prior runs only ever verified bucket DELETEs via change-data GET ("evicted clean"), never via a mounted consumer, so the client drop was never witnessed.

## Suggested fix
In `handleChangeKeyEvent`'s null/non-object branch, route null payloads for NON-campaign keys to a bucket REMOVE as well (e.g. call `applyStoreUpdate(storeKey, null)` for every storeKey, and in `applyStoreUpdate`'s else-branch handle `data === null` by deleting the runtime object bucket — NOT storing null; the hex-arrival-null-echo crash precedent forbids storing null). Scalar non-null payloads can keep being dropped as corrupt noise. Also mirror-remove on the ACTING tab if the DELETE was fired outside the store API (it currently only self-heals via this same echo path). Add pins: character-key null echo evicts the local bucket (both actor and bystander tabs); missing-key DELETE (404 leg) publishing null is an inert remove; campaign-key null-echo lane byte-unchanged.

## Severity
**Stale-state / misleading UI bug (moderate).** No disk corruption (server truth is correct), but shared-table surfaces show conditions/HP/flags for every client that a DELETE already removed — GM-visible phantom badges that survive indefinitely until reload, on ALL open tabs, silently.

## Resolution
FIXED 2026-11-20. The "Likely location" diagnosis confirmed exactly against the snapshot: `src/App.jsx` `handleChangeKeyEvent` gated every null/non-object payload on `isCampaignKey(storeKey)` (`applyStoreUpdate` only ran for campaign keys), so the character-key null echo that `server/routes/campaigns-changedata.js` DELETE publishes unconditionally (line 632, including the honest-404 missing-key leg) was silently dropped — while `applyStoreUpdate`'s character branch (`replaceRuntimeObject(storeKey, data)`) had no `data === null` arm to mirror it either. Reproduced live first: two localhost tab pair with mounted GM Screens; `POST /ElderPaladin {activeConditions:["Poisoned"]}` adopted on both tabs in ~2 s, `DELETE /ElderPaladin` evicted server-side (change-data GET: key absent) yet the `Poisoned` In-Play row stayed phantom-live on BOTH tabs (zero console errors) — exactly the filed face.

**Fix (client-only; server untouched — its echo contract was already correct and its comment now holds):**
- `src/App.jsx` `handleChangeKeyEvent`: the non-object branch gate became `if (isCampaignKey(storeKey) || event.data === null)` — a null (cleared-key/bucket) echo mirrors for EVERY store key; non-NULL scalars on character keys stay dropped as corrupt noise (and the campaign-scope scalar lane is byte-unchanged).
- `src/App.jsx` `applyStoreUpdate`: new `else if (data === null)` arm on the character branch mirrors the evicted bucket as a bucket REMOVE via `replaceRuntimeObject(storeKey, {})` — reusing the established full-snapshot-replace primitive (it already evicts every absent key, notifies consumers on change, and is memory-only, so the skipSync never-re-POST law holds; no new helper/event type). Declared defaults win; nothing ever stores null (hex-arrival-null-echo crash precedent preserved). The acting tab is covered by the same path: the echo reaches all subscribers including the originator, and there is no in-app character-bucket DELETE API lane to mirror locally.

**Tests:**
- NEW `src/App.bucket-null-echo.test.jsx` (real `useRuntimeState` via `importActual`, harness parity with the level-up/App.runtime-events rig): bystander echo evicts a POST-echo-primed bucket + wakes store listeners + zero re-POSTs; actor-primed bucket (local `setRuntimeObject`) self-heals on the same echo; missing-key DELETE (404-leg null) is an inert remove (no crash, nothing stored, no notify); non-null scalar character echo stays corrupt noise; campaign-key null-echo lane unchanged (key REMOVE + campaign notify). 5/5 pass.
- `src/hooks/runtime/useRuntimeState.replaceRuntimeObject.test.js`: added pin — an empty `{}` snapshot evicts the WHOLE bucket and notifies once; on an already-empty store it is inert (no notify, nothing resurrected).
- `src/App.runtime-events.test.jsx`: the stale pins locking the drop were migrated with the fix — "keeps dropping null/scalar echoes for character-scoped keys" split into the null-bucket-REMOVE pin (`replaceRuntimeObject('Aragorn', {})`, never `(…, null)`) + the scalar-still-dropped pin; the malformed-events table's `null data` row became `undefined data` (null data is no longer malformed — it is the evict echo).
- Touched-area run: 310/310 (28 files, all `src/App.*` + `src/hooks/runtime`). `npm run lint` clean (zero warnings). `no-timers-guard` OK. Full `npm run test:run`: 3451 files / 36684 tests passed, 0 failed.

**Live re-verification (:5173 live source, both tabs hard-reloaded on the fixed build, GM Screens mounted):** POST seed → `ElderPaladin / Poisoned` line appears on BOTH tabs (~2 s); DELETE → row vanishes from BOTH tabs within ~2 s WITHOUT reload (server change-data GET: `ElderPaladin` absent, `epPresent:false`). Adjacent lanes green in the same session: targetEffects campaign-key add AND delete both adopted live (placeholder `No zones or markers on the table.` returned); the 404 missing-key DELETE echo arrived on both mounted tabs with zero console errors and stored nothing; zero app console errors/warnings all session. Cleanup: closed-tab admin clears, GET-verified change-data `{}` + log `[]` twice after settle.
