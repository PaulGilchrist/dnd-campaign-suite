# Bug: Give-currency transfers land on the player with zero display and no return lane (one-way money)

## Summary
The Party Inventory "Give" flow atomically moves currency from the party pool into the player's character file (`inventory.currency`), writes an honest `inventory_transfer` audit row — and then that money is invisible and unrecoverable through ANY UI: the campaign sheet renders no player currency, the From Players pane lists items only, and no reverse-transfer control exists for coins. Steppers/`To Party` cover items in both directions; currency is write-only.

## Steps to reproduce
1. On localhost (`npm run dev` pair), in `test-campaign`, open Inventory.
2. Party Currency card: click `+1` on the Copper row (title `Add 1 cp`) — pool shows 1 (auto-save debounce).
3. Click `Give` on the Copper row → "Give Currency to Player" modal → player `AasimarTest`, Copper amount `1` → `Give` → accept native confirm `Give 1 cp to AasimarTest?`.
4. Observe: pool Copper returns to 0; the Log view shows `1 cp moved from party inventory to AasimarTest` (correct).
5. From Players pane → select `AasimarTest` — the pane lists only items (Diamond Dust, Poisoner's Kit, …) each with a `To Party` button. There is NO currency row, no `Copper 1` line, no way to move coins back.
6. Open the AasimarTest character sheet — no currency/copper text anywhere on the sheet (body-text search for "Copper"/"Currency": zero hits).
7. Disk proof: `public/campaigns/test-campaign/AasimarTest.json` gained exactly `"cp": 1` under its `inventory` block (`diff` vs pre-transfer backup shows the single key) while `data/inventory.json` self-restored byte-exact — the coins live ONLY in the char file, which no component reads currency from.

## Expected behavior
Transferred currency is visible somewhere player-facing (From Players pane currency rows with `To Party` returns, mirroring the item lane, and/or a purse line on the sheet) so the party/GM can audit and reverse it — the hint line "Give opens a transfer to a player" (99ab38aed) implies a two-way bookkeeping surface.

## Actual behavior
Zero read faces. `grep -rln "currency" src/components/` lands on `PartyInventory.jsx` (the writer), unrelated admin/loot files — no consumer of `character.inventory.currency` exists anywhere in the frontend. Once given, coins can only be moved back by disk surgery. Player-facing tabs have no way to even see their purse.

## Likely location
Confident: `src/components/party-inventory/PartyInventory.jsx` `GiveCurrencyModal`/`transferInventory` lane (writes char `inventory.currency` via the server atomic transfer in `src/services/campaign/inventoryService.js` → `transferInventory`), while the From Players pane renderer (`pi-player-items`) maps only `character.inventory.items`. The read-back gap is a missing feature in the pane + sheet, not a failed write (server + audit row verified correct).

## Suggested fix
Extend the From Players pane to render a currency row (pp/gp/sp/cp totals from the same player inventory fetch) with a `To Party` stepper/button riding the existing `transferInventory` reverse direction (items already prove the round-trip works — party→player→party re-lived byte-exact this run). Optionally stamp a purse line on the sheet's inventory/backpack area. Keep the per-player currency shape as-is; only the READ + return UI is missing.

## Severity
Data integrity risk — assets silently leave all visible surfaces on a shared-authoring table; a player told "the party gave you 50 gp" cannot verify it, and reversal requires GM disk edits. Not corruption (writes are atomic + audited), but money is effectively lost to the UI.
