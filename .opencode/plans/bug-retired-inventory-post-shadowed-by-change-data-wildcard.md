# Bug: Retired `POST /inventory` snapshot lane silently lands in the change-data wildcard (200 OK + phantom `inventory` key), not the pinned 404

## Summary
The item-intent fix (`3a57f189a`) retired the full-document `POST /api/campaigns/:c/inventory` lane and pinned a 404 — but only at the inventory-router unit level. In the composed server the path falls through to the generic change-data wildcard `POST /api/campaigns/:campaign/:key` (`server/routes/campaigns-changedata.js`), which accepts ANY unvalidated key: the retired call answers **200 OK** and writes a phantom top-level `inventory` key into the shared change-data store (broadcast as `change-<campaign>-inventory` and persisted to `character-change-data.json`). A stale pre-fix tab therefore receives a false success for a treasury write that never touched the treasury, and the phantom key survives reloads/campaign-selects until an admin change-data clear, with zero UI face showing the drift.

## Steps to reproduce
Starting from a fresh dev pair (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' npm run dev`), test-campaign:

1. `curl -s --max-time 5 -X POST http://localhost/api/campaigns/test-campaign/inventory -H 'Content-Type: application/json' -d '{"currency":{"cp":5},"items":[]}'` → **HTTP 200** (expected: a loud 404/400/410 like the retired-lane test pins claim).
2. `curl -s --max-time 5 http://localhost/api/campaigns/test-campaign/change-data` → contains `"inventory":{"currency":{"cp":5},"items":[]}` (the raw unsanitized snapshot body stored verbatim).
3. `cat public/campaigns/test-campaign/data/character-change-data.json` → same phantom written to disk (~10 s debounce).
4. `curl -s --max-time 5 http://localhost/api/campaigns/test-campaign/inventory` → sanitized REAL ledger (unchanged, `7638da67` disk hash) — i.e. GET hits the real route first while POST is silently shadowed; the Inventory UI never sees the phantom, so no face ever reveals the misroute.
5. Eviction proof that the wildcard owned the write: `curl -X DELETE .../api/campaigns/test-campaign/inventory` → 200 and the phantom key vanishes from change-data (the real inventory lane has no DELETE route at all).

Live-verified 2026-11-17 (explore run CD, HEAD `0a5dc2b3d`, fresh pair carrying current code).

## Expected behavior
A retired lane must fail loud, not alias into a different store. Precedent exists in the same wildcard: the deprecated `campaign` key is special-cased (`campaigns-changedata.js:78-90`) with a `Use /api/campaigns/:campaign/<key>…` refusal. `POST /inventory` should answer 400/410 naming the replacement lanes (`/inventory/adjust` for coins, `/inventory/item` for items) and write NOTHING.

## Actual behavior
200 OK; snapshot body persisted verbatim as a change-data key; every tab gets a `change-test-campaign-inventory` SSE event; the real treasury file is untouched but no client or log faces the divergence. Practical trigger: any still-open tab that bundled the pre-`77ccfeea6` client (chip debounce flush POSTed the whole doc through `saveInventory`) keeps hitting this lane after the server updates — silent-swallow exactly in the deploy window the clobber fix targeted. `DELETE` on the same path is also wildcard-owned (only eviction route for the phantom).

## Likely location
Confident: route composition order in `server.js` — `inventory.js` (mounted earlier) no longer declares `POST /api/campaigns/:campaign/inventory`, so Express falls through to `campaigns-changedata.js`'s catch-all `POST /:campaign/:key`; `keyValidators.js` registers no validator for `inventory`, so the write passes through by the documented L5 rule ("no validator registered ⇒ the write passes through EXACTLY as today"). The router-level 404 pin in `server/routes/inventory.test.js` never sees the wildcard because it mounts the router in isolation.

## Suggested fix
Add an explicit guard IN `server/routes/inventory.js` before the fall-through: `router.post('/api/campaigns/:campaign/inventory', 410/400 …)` with plain-English copy ("the party-inventory snapshot save lane is retired — apply coin deltas via /inventory/adjust and item edits via /inventory/item — nothing was saved"). Alternatively special-case the key in the changedata wildcard next to the `campaign`-key guard. Keep `DELETE /:key` as-is so the wildcard remains the eviction path for already-poisoned stores; note the admin clear already sweeps phantoms. Add a composition-level test (mounted `server.js` app or supertest on the full route stack) asserting the retired path does NOT create a change-data key.

## Severity
Data integrity risk (mild) — the real treasury is safe and the phantom is clearable, but a stale client gets a SUCCESS code for a write that silently landed in the wrong store, which is the same silent-divergence class the 2026-11-17 clobber fixes exist to end; the misroute leaves no UI, log, or error face.
