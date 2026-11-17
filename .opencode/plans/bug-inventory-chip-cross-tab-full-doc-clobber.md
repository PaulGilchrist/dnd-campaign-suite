# Bug: Two GM windows' currency-chip writes within the debounce window silently lose presses (full-document clobber)

## Summary
The Party-Inventory `+1/−1/…` currency chips persist through a trailing-debounce queue that POSTs the tab's **whole inventory snapshot** (`saveInventory`). Two GM windows stepping the pool within the same debounce window each schedule a full-document POST carrying only their own view; the later POST overwrites the earlier one. A press can vanish with zero feedback, zero error, and — because chip writes log nothing by design — zero audit trace.

## Steps to reproduce
1. On localhost (`npm run dev` pair), in `test-campaign`, open the **Inventory** view in TWO localhost browser windows/tabs (default context; both auto-select or re-select test-campaign). Pool starts all-zero.
2. **Same-coin face:** in one burst, click `+1 cp` (`Add 1 cp`) in window A and `+1 cp` in window B essentially simultaneously (inside the 400 ms trailing-debounce window — the component merges each burst into ONE full-doc POST captured ~`CURRENCY_PERSIST_DEBOUNCE_MS`=400 ms after the last click). Both tabs locally show `Copper 1`.
3. Wait 5+ s (debounce + flush). GET `http://localhost/api/campaigns/test-campaign/inventory` → `{"cp":1}` — **not 2**. One press lost. Both UIs settle to `Copper 1`.
4. **Cross-coin face (asset loss):** with pool `gp:11 cp:1`, simultaneously click `+100 gp` in window A and `+10 cp` in window B. Immediate locals: A reads `Gold=111, Copper=1`; B reads `Gold=11, Copper=11`.
5. Wait 6+ s. Server: `{"pp":0,"gp":11,"sp":0,"cp":11}` — window A's `+100 gp` press evaporated (B's later full-POST `{gp:11, cp:11}` clobbered it). Both tabs' UIs quietly repaint to the clobbered truth — no conflict notice.
6. Control (works): click `+10 gp` in A, wait ≥3.5 s (debounce flushes, B SSE-echoes to 10), then `+1 gp` in B → server lands `gp:11`. The hazard boundary is exactly the trailing-debounce window.

## Expected behavior
Concurrent chip presses from two GM sessions either both land (server-side per-coin delta application) or the stale writer gets a loud conflict refusal (the 409 `was modified in another tab or session…` copy family already exists in the Notes lane). A minted treasury increment must never silently vanish.

## Actual behavior
Last debounced full-document POST wins. Observed server outcomes: 2×`+1 cp` → 1; `+100 gp` ∥ `+10 cp` → gp unchanged, cp+10 (the 100 gp loss). No console errors on either tab, no toast, no `inventory_transfer` row (chips never log). `data/inventory.json` shows the clobbered doc.

## Likely location
Confident: `src/services/campaign/inventoryService.js` `saveInventory` (POSTs the entire inventory doc) driven by the trailing-debounce persist queue in `src/components/party-inventory/PartyInventory.jsx` (`persistQueueRef` / `flushCurrencyPersist` / `persist` ~lines 579–680 — the comment at :20 says the debounce exists to collapse ~30 whole-store POSTs; cross-tab staleness was never in scope). Server side: `server/routes/inventory.js` POST `/api/campaigns/:c/inventory` (:266, GM-gated) is a plain full-store overwrite with no revision check, so whichever snapshot POSTs last is canonical.

## Suggested fix
Best: give chips a server-side atomic delta lane — e.g. `POST /api/campaigns/:c/inventory/mint {currency:{gp:100}}` that clamps-and-adds on the SERVER's current doc (mirroring the proven atomic `/transfer` lane) and SSE-echoes the merged result; chips stop sending snapshots. Lighter alternative: stamp the doc with `updatedAt`/revision on save, require it on POST, and 409 with the established conflict copy (client then re-pulls and replays its delta additively). Investigate: whether the SSE echo handler intentionally overwrites local pending state (`persist(next)` snapshot capture point) — an echo-aware additive queue would fix the common face client-side but two truly-simultaneous POSTs still need the server lane.

Scope note (code-grounded, same root): `saveInventory` POSTs the WHOLE doc — `items` included — so the same race can silently drop a concurrent ITEM write (add/edit/move) from the other window, not just coins. Not separately reproduced live (timing the modal Save against the 2 s chip window is not deterministic); the currency face above is the live-proven one. Corroboration that the fix pattern exists in-app: `NPCFormModal.jsx:151` gates its zoom the same way the CharSummary bug fix needs, and the atomic `/transfer` lane is the server-side model to copy.

## Severity
Data integrity risk — the party treasury is durable campaign money; a GM's loot-grant press can disappear with no trace whenever a second GM window (or a helper clicking in parallel) saves within the 2 s window. Not corrupting the doc shape (writes stay well-formed), but silently wrong values with no audit evidence.
