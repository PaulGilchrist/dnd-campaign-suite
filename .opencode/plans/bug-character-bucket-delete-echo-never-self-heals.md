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
