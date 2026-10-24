# Party inventory currency chips lose rapid clicks (stale-closure batch + racing full-store POSTs)

### Summary
Rapid repeated clicks on Party Currency +/- chips within a single frame collapse into a single adjustment — extra clicks are silently lost. Worse, a full revert to the pre-click value (200 gp → 0 gp) was observed once while racing chip clicks, indicating out-of-order `persist()` full-store POST responses can wipe landed edits.

### Steps to reproduce
Controlled repro (synthetic clicks in one evaluate tick; verified live 2026-10-24 on http://localhost:5173, test-campaign):
1. In test-campaign, open Inventory (Party Inventory). Click Gold `+100` once; wait ~1s. Gold = 100 (persists to `/api/campaigns/test-campaign/inventory`).
2. Without waiting between clicks, fire three `+1` clicks on the Gold row in one synchronous JS block (or click as fast as physically possible):
   ```js
   const row = [...document.querySelectorAll('.pi-currency-row')].find(r => r.innerText.includes('Gold'));
   const b = [...row.querySelectorAll('button')].find(x => x.textContent.trim() === '+1');
   b.click(); b.click(); b.click();
   ```
3. Observe Gold immediately after re-render and after the ~10s debounce.

### Expected behavior
Gold = 103 (+3). Each click is a discrete GM intent and must accumulate.

### Actual behavior
Gold = 101 (+1). Two of three clicks silently vanish; no feedback. Same-tick `+100 ×2` from 104 likewise produced 204 (+100, not +200). Additionally, an earlier trusted-event double-click of `+100` (two separate `page.click()` calls) displayed 200 in the UI but within ~60s both the card AND `/api/campaigns/test-campaign/inventory` read gp:0 — the entire edit rolled back (observed once; subsequent controlled repros persisted the single landed increment).

### Likely location
Confident on the collapse mechanism: `handleCurrencyAdjust` in `src/components/party-inventory/PartyInventory.jsx:457-464` computes `next` from the **closure** `inventory` and calls `setInventory(next)` (object form, not functional updater). Multiple same-frame clicks each read the same stale snapshot and write the same `value + delta`.
For the full revert: `persist()` (:440-455) fires one un-debounced full-store POST per click and does `setInventory(saved)` from each response — concurrent POSTs whose responses arrive out of order (or a stale snapshot POST landing last, classic same-endpoint replace-route reorder, playbook §39) can restore 0. Guessing between client reorder vs server-side race; the file to read is the inventory save service (`saveInventory` / inventory route in `server/routes/`).

### Suggested fix
- Use the functional updater: `setInventory(prev => { const next = {...prev, currency: {...prev.currency, [key]: Math.max(0, (prev.currency[key]||0)+delta)}; return next; })` and persist from the updated value (or chain persists sequentially).
- Serialize/debounce `persist()` so one full-store snapshot per burst is sent, and ignore stale responses (sequence stamp or compare-before-set).
- Add a unit test: three same-tick `+1` clicks → +3.

### Severity
Data integrity risk — GM currency edits silently disappear (worst case entire balance reverts), with zero error surface.

## Resolution
**FIXED 2026-10-24.**

### What was actually wrong
Confirmed the collapse diagnosis: `handleCurrencyAdjust` computed `next` from the closure `inventory`, so multiple same-frame clicks (React batches their state updates into one flush) each wrote the identical `value + delta` snapshot — both to UI state and into one POST per click, so the collapse persisted. The full-revert vector was the un-serialized `persist()`: one concurrent full-store POST per click with `setInventory(saved)` from **every** response (plus per-click SSE echoes) — a stale snapshot response/echo landing last rewrites the whole doc (playbook §39 same-endpoint replace reorder). No server-side change was needed: the route writes synchronously in arrival order, so client serialization makes write-order deterministic.

### Fix (mirrors the existing `useMapLoader` pendingSave/flushSave pattern + §39 stamp guidance)
`src/components/party-inventory/PartyInventory.jsx`:
- `inventoryRef` kept synchronously in sync via new `applyInventory(next, {ack})` — all state adoptions (refresh, SSE echo, transfer results, POST acks) and all local edits flow through it, so same-frame clicks accumulate off the ref, not the closure. `handleCurrencyAdjust` and item handlers (`handleSaveItem`/`handleItemStep`/`handleDeleteItem`/qty input) now compute from `inventoryRef.current`.
- `persist()` no longer fires a POST per click: it stores the latest snapshot in `persistQueueRef` and calls `flushPersist()` — at most **one in-flight POST per endpoint**, bursts coalesce into a single trailing POST of the latest snapshot, drained in `.finally`.
- Stale-response guard: a `localRevRef` revision stamp bumps on every non-ack adoption; a POST response whose rev ≠ current rev is dropped (never `setInventory(saved)` from a stale echo). Dead `else await refresh()` branch removed (`saveInventory` always returns a normalized object or throws).
- No timers introduced (serial queue, not debounce) — `guard:no-timers` untouched/OK.

### Verification
- **Live repro re-run (test-campaign, :5173):** +100 once → 301; same-tick `+1×3` → **304** (was 101-style collapse); same-tick `+100×2` → **504**; after 11s debounce `/api/campaigns/test-campaign/inventory` reads `gp:504` — no revert, no collapse. 6 spaced rapid clicks → +6 exact, POSTs serialized non-overlapping.
- **Adjacent sanity:** clamp-at-0 + −chip disable OK; Give modal transferred 1 gp party→AasimarTest with `inventory_transfer` log entry and char gold mirror updated; player→party reverse leg OK; all state restored to pre-session values (party 0/0/0/0, AasimarTest gp:10). Change-data + campaign log cleared via Admin (API-verified empty).
- **Tests:** new `PartyInventory.rapid-currency.test.jsx` (5 tests: same-tick +1×3→+3, same-tick +100×2→+200, stale hung-POST echo dropped, clamp-at-0, SSE-adoption-then-adjust). Red-verified against the old stale-closure handler (`51`≠`53`, `150`≠`250`) before restoring the fix. `src/components/party-inventory/` + `inventoryService.test.js` + `server/routes/inventory.test.js`: **46/46 pass**. `npm run lint`: clean (zero warnings).

### Files changed
- `src/components/party-inventory/PartyInventory.jsx` (fix)
- `src/components/party-inventory/PartyInventory.rapid-currency.test.jsx` (new regression test)
