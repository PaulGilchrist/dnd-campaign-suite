# Bug: Two GM windows' concurrent party-ITEM saves are last-writer-wins full-snapshot replaces (residual face of the chip clobber class)

## Summary
`bug-inventory-chip-cross-tab-full-doc-clobber` (resolved 2026-11-17) closed the CURRENCY half of the full-document clobber class: chips now flush signed deltas through the atomic `/inventory/adjust` lane and `POST /api/campaigns/:c/inventory` no longer accepts or writes currency. The ITEM lane itself still persists via whole-item-list snapshot replaces: two GM windows saving items within each other's stale-view window (Add Item modal Save / qty stepper / qty-set / Delete) merge last-writer-wins — an add, edit, step or delete made in window A after window B last synced can silently vanish when B's POST lands. No revision check, no conflict 409, no console error; unlike chips there IS an audit asymmetry (delete logs `Removed "X" from party inventory` even when a concurrent save later re-adds the resurrected row, so the log can claim more than the ledger kept).

## Steps to reproduce
Not reproduced live (modal-Save timing across two windows is not deterministic; the face is code-grounded):
1. Windows A and B both on Inventory in `test-campaign`, item pool `{X}`.
2. A: Add Item `Y` → Save (server `{X,Y}`; B's echo may not have repainted yet).
3. Within B's echo latency B: Add Item `Z` → Save — B's snapshot is `{X,Z}` → server lands `{X,Z}`; A's `Y` vanished.
Same shape for qty steps (A bumps X→2, B's later save carries X→1 back) and for a Delete racing an Add (delete row audited, item resurrected).

## Expected behavior
Concurrent item writes either merge additively (per-item atomic lanes: add/upsert/delete/setQty keyed by item id, mirroring `/transfer`/`/adjust`) or the stale writer gets a loud revision-conflict 409 (the Notes copy family: `… was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`).

## Actual behavior
`src/components/party-inventory/PartyInventory.jsx` `persist`/`handleDeleteItem` POST the tab's current full `items` array; `server/routes/inventory.js` POST `/api/campaigns/:c/inventory` replaces `inventory.items` verbatim (sanitized/re-sorted), currency preserved. Last POST wins.

## Likely location
Confident: `server/routes/inventory.js` POST `/inventory` (items lane, no revision stamp) + `PartyInventory.jsx` snapshot queue (`persistQueueRef` / `flushPersist`). The atomic-lane pattern to copy is the sibling `/adjust` / `/transfer` routes (server re-reads, applies the DELTA, publishes merged doc).

## Suggested fix
Per-item atomic endpoints keyed by id (upsert `{id?, name, quantity, description}`, `setQty {id, quantity}`, `delete {id}`) with the client chips-style serialize + stale-rev ack guard, OR the lighter revision-stamp + 409 + client re-pull-and-replay of the single intent. Delete-audit must stay post-ack (delete-item-log idiom).

## Scope note
Frequency is far lower than the chip face: item saves are immediate (no 400 ms debounce window), modal-paced, and the hazard window is echo latency (~ms) plus dwelling-stale views; GMs rarely edit items in two windows simultaneously. This is the deliberately-residual face of the 2026-11-17 chip fix, split out so the closed clobber bug can resolve.

## Severity
Low-to-moderate data integrity: silent loss of an item add/edit/delete possible but only under concurrent two-window item editing; audit rows for delete can claim writes a later save resurrected.

## Resolution
FIXED 2026-11-17 (fix run). **Reproduced live first** (the filed face said "not reproduced live"): with two localhost tabs both on Inventory in `test-campaign`, (a) FORCED face — window B's `/subscribe` request hung via a Playwright route so its view stayed stale; A modal-Saved `QA Concurrent Coin`, B qty-stepped `QA Base Lantern` → server landed `{Lantern 2}` — the Coin silently evaporated, zero console errors, both UIs repainted honestly to the clobbered truth; (b) NATURAL face — no rig at all, back-to-back `page.evaluate` clicks (A Save ∥ B stepper) across live SSE: attempt 1 of 3 hit the real race window and evaporated `QA Natural 1`. The bug is exactly as diagnosed: client persisted the tab's whole `items` array and the server replaced `inventory.items` verbatim.

**Fix (atomic per-item intent lane — the `/adjust`/`/transfer` pattern the sibling fix established):**

- `server/routes/inventory.js` — the snapshot lane `POST /inventory` is **retired** (no alias, per the no-legacy policy; pinned 404). New `POST /inventory/item` (GM-only via `refuseUnlessGm`, same guard matrix) applies ONE intent onto the server's freshly re-read ledger and publishes merged: `add {item:{id?,name,quantity,description}}` (appends; client-minted ids are KEPT so the writer's optimistic row keeps its key and a retried POST is idempotent), `update {item:{id,…}}`, `setQty {id,quantity,name?}`, `delete {id,name?}`. `update`/`setQty`/`delete` on a row a concurrent window already removed → **409** with the Notes-family copy labelled by display name (`Party item "X" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`) plus the current merged doc — never a silent resurrection, so the delete-audit asymmetry (row claiming a removal a later save re-added) is gone: no intent can re-add rows it never names, and no edit can resurrect a deleted id. Currency is untouched by every intent; every accepted write re-sorts, `writeFileSync`s and `publish(inventory-<c>)` like the coin lane.
- `src/services/campaign/inventoryService.js` — `savePartyItems` replaced by `applyItemIntent` (attaches `.status` + `.inventory` on 409 so the view can adopt server truth).
- `src/components/party-inventory/PartyInventory.jsx` — the snapshot persist queue became a **serialized FIFO intent queue** (one in-flight POST, chip-style rev-guarded acks): modal Save sends `add`/`update` (name-match add still rewrites the matched row — historic behaviour, now keyed by its id), stepper/qty-set send absolute `setQty`, Delete sends `delete` (drain-first + post-ack `Removed "X"` audit row unchanged; rejection rolls the optimistic delete back exactly as before; a 409 adopts the merged doc instead of re-adding a ghost).

**Verification:**
- Live re-run of both repro faces on a throwaway `PORT=8123 CAMPAIGN_LOCK=test-campaign node server.js` (new code + fresh `dist`): the exact same stale-window sequence now MERGES — GET shows `{Lantern 2, Coin 1}`, B's reload converges to the merged truth; 409 face lived: stale step of a row A deleted alerts the verbatim family copy and B's view adopts truth (ghost row gone, resurrected-row audit asymmetry dead); forged-id curl 409s with display-name label + merged doc, zero write; publish lived: `inventory-test-campaign` SSE frame on `:8123/subscribe` carries the merged doc after an item intent; single-tab add→edit→qty→delete round-trip clean; chip delta lane + delete audit row (`Party currency adjusted: -1 cp`) still work; log showed exactly ONE post-ack `Removed` row per accepted delete, zero rows on conflict legs.
- Tests: NEW `server/routes/inventory.item-intent.test.js` (18 lanes incl. the interleaved two-session clobber regression and the 404-retired-lane pin) + NEW `src/components/party-inventory/PartyInventory.item-intent-lane.test.jsx` (7 client wire-shape/FIFO/409 pins); updated `inventory.test.js` (old snapshot-lane suite removed), `inventory-localhost-guard.test.js` (403/200 guard matrix retargeted), `inventoryService.test.js` (`applyItemIntent` contract incl. 409 `.status`/`.inventory`), and the 9 PartyInventory component tests' mocks/assertions. Touched-area run 159/159; FULL suite 3348 files / 35,912 tests all pass; `npm run lint` zero warnings; `no-timers-guard` OK.
- Exit census: `inventory.json` md5 `7638da67…` byte-exact baseline (items `[]`, currency zeros), all nine other `data/*.json` pins byte-exact, change-data `{}` + log `[]` GET-verified via headless admin clears, throwaway :8123 killed by recorded PID, owned dev pair untouched (80/5173 still 200).

**Note for the owned pair:** the running :80 Express predates both inventory commits (it still answers the retired full-doc lane), so a :5173 tab's item writes 404 until the orchestrator restarts the pair on the new code — expected harness staleness, not a regression.
