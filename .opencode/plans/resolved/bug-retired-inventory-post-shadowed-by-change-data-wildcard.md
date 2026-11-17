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

## Resolution
FIXED 2026-11-17 (fix subagent, owned dev pair with `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`).

**Root cause — confirmed exactly as diagnosed.** `server/routes/inventory.js` had no `POST /api/campaigns/:campaign/inventory` handler after the item-intent retirement, so the composed server fell through to the change-data wildcard (`campaigns-changedata.js` `POST /:campaign/:key`); `keyValidators.js` registers no validator for `inventory`, so the L5 pass-through rule stored the raw snapshot verbatim as a phantom top-level `inventory` key and answered 200. Reproduced live before the fix: POST → 200 `Data saved successfully`, `GET /change-data` → `{"inventory":{"currency":{"cp":5},"items":[]}}`, disk `character-change-data.json` written, `GET /inventory` still the untouched real ledger (md5 `7638da67…`), and the browser face: a stale-tab `fetch` POST from a loaded test-campaign tab resolved `ok:true` while the open Party-Inventory pane stayed at 0 Copper forever and the phantom sat invisibly in change-data.

**Fix (option 1 of the suggested fix — the route owns its retired path, mirroring how `starter-seed`/`meta` mount before the wildcard "so it can never capture" the path).** `server/routes/inventory.js` now declares an explicit guard `router.post('/api/campaigns/:campaign/inventory', …)` answering **400** with a plain-English refusal naming both replacement lanes (`/inventory/adjust` for coin deltas, `/inventory/item` for item intents) plus "nothing was saved", and logs a named `[inventory] Rejected POST to the retired party-inventory snapshot lane` console line — the same console.error + 4xx JSON-with-copy pattern as the wildcard's deprecated `campaign`-key guard and the `.json`-key trap (no audit row / no SSE publish, matching those guards; a stale debouncing client must not spam the campaign log). 400 chosen over 410 because every retired-lane guard in this server (campaign-key, `.json`-key) answers 400. **Write NOTHING, publish NOTHING**; `DELETE /:key` stays wildcard-owned untouched — it remains the eviction lane for already-poisoned stores.

**Files changed**
- `server/routes/inventory.js` — retired-lane 400 guard beside the GET.
- `server/routes/inventory.item-intent.test.js` — router-isolation pin updated from the (never-reachable-in-composition) 404 to the loud 400 + copy + no-write/no-publish.
- `server/routes/inventory.retired-snapshot-wildcard-shadow.test.js` — NEW composition-level regression test: mounts `inventory` BEFORE `campaigns-changedata` in the real `server.js` order (the setup the old unit pin structurally could not see), asserting the retired POST 400s with the replacement-lane copy, creates NO change-data key (store entry not even created), writes no disk, publishes nothing, and `GET /change-data` stays `{}`; plus the split-face pin (GET /inventory serves the real ledger even while a phantom sits in the store) and adjacent lanes through the same composed stack: /adjust, /inventory/item, legitimate wildcard key writes, the deprecated `campaign`-key guard, and the wildcard DELETE eviction (200 on an existing phantom, honest 404 on a never-created one).

**Verification**
- `npx vitest run server/routes/inventory.retired-snapshot-wildcard-shadow.test.js` → 9/9 pass; the 6 touched-area suites (inventory ×4 + campaigns-changedata ×2) → 115/115; full `npx vitest run server/routes` → **115 files / 1781 tests passed**; `npm run lint` → zero warnings.
- Live re-run of the repro on the restarted owned pair: page-context stale-tab POST → **400** with the verbatim replacement-lane copy, `ok:false`; `GET /change-data` never gains an `inventory` key; real `GET /inventory` untouched. Adjacent sanity lived too: Copper chip **+1 → server `cp:1` + UI repaint "Copper 1" → −1 → `cp:0`** each landing one `Party currency adjusted: ±1 cp` audit row; `inventory.json` self-healed byte-exact (`7638da67…`); console shows only the deliberate probe's `400` resource line.
- Exit hygiene: tab closed, headless admin clear-change-data + clear-log (GET `{}` / `[]`, disk cd/log files absent — the repro's phantom `inventory` key swept), dev pair killed, ports re-probed dark.

**Client-side note:** no dual-ruleset (5e/2024) sibling — server lane only; the current client bundle already POSTs nothing to this path (`inventoryService.js` uses GET + `/adjust` + `/item` + `/transfer`), so the guard fires solely for stale pre-`77ccfeea6` tabs, exactly its purpose.

