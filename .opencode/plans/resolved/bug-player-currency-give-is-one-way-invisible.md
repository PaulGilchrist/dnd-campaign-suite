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

## Summary
Give-currency transfers landed on players with zero read-back: the From Players pane listed items only and no control could move coins back. The From Players pane now renders one purse row per non-zero coin (mirroring the server's currency resolution) whose `To Party` button rides the existing atomic `player-to-party` transfer lane with the same confirm + directional-audit idioms as the item return. Money given is now visible and reversible entirely in-UI; both disk files self-heal byte-exact across the circle.

## Resolution
FIXED 2026-11-17 (fix run). Repro re-lived first exactly: `+1 cp` → Give 1 cp to AasimarTest (native confirm `Give 1 cp to AasimarTest?`) → pool 0, log row `1 cp moved from party inventory to AasimarTest`, disk `AasimarTest.json` `cp: 0→1` (md5 `3bfe7eca→b1de4e12`), From Players pane showed the 4 item rows with `To Party` and zero currency rows (`hasCopper: false`).

Root cause confirmed as diagnosed: write + audit + server lanes were all correct — `server/routes/inventory.js` already implements the FULL return lane (`applyPlayerToParty` currency branch → `removeCurrencyFromCharacter`, and player→party is intentionally open to every client per the route header note), and `transferInventory` in `inventoryService.js` already accepts `currency` in either direction. The ONLY gap was the client read: `PlayersPanel` in `PartyInventory.jsx` mapped `character.inventory.backpack` and nothing else. Freshness was never a problem — the transfer route publishes `character-<campaign>-<file>` and App.jsx's SSE handler replaces the roster entry, so the pane's `characters` prop already carried `inventory.currency`.

Changes:
- `src/components/party-inventory/PartyInventory.jsx` — new module helper `playerCurrency(character)` mirrors the server's canonical `characterCurrency()` debit rule (the `{pp,gp,sp,cp}` block when present, else positive `inventory.gold` counted as gp — exactly what a return can move; 10 of 13 test-campaign chars carry gold-only files, so a currency-block-only read would have hidden their returnable gold). `PlayersPanel` renders one row per non-zero coin in CURRENCIES order above the backpack rows (reuses `.pi-player-items` / `.pi-player-item-name/-qty` / `ct-btn pi-move-btn` classes — zero new CSS), with `handleCurrencyMove` mirroring the item `handleMove` structure: native confirm `Move 1 cp from <Player> to party inventory?` → `transferInventory({direction:'player-to-party', playerName, currency:{[key]: amount}})` → directional `inventory_transfer` audit row → `onMoved()`. Also threaded the parent's existing `flushCurrencyPersist` into `PlayersPanel` as `beforeTransfer` (drain-before-atomic-transfer idiom already used by `handleConfirmMove`/`handleDeleteItem`/`handleCurrencyTransfer`) so a debounced chip snapshot can't clobber the credited pool — both item and currency return legs now drain first.
- `src/components/party-inventory/PartyInventory.player-currency.test.jsx` (new) — 6 tests: purse row rendering per coin above items; gold-only character resolves as a Gold gp row; empty message only when neither items nor coins; refuse = zero writes with exact confirm copy; accept rides the atomic lane with a cp-only payload; directional audit row + party-pool refresh shows the returned coin.
- `src/components/party-inventory/PartyInventory.move-confirmation.test.jsx` — helper updated: its gold-10 fixture now legitimately renders a second `To Party` (the new Gold purse row), so the item-row locator is scoped via `.pi-players-panel` (the pinned confirm/transfer behavior is unchanged).

The "purse line on the sheet" option was NOT implemented (bug file said and/or; pane + return lane is the minimal fix). Dual-ruleset: N/A — inventory reads the raw character file, ruleset-agnostic; no 2024 sibling exists.

Verification:
- Live re-run in test-campaign (fresh nav, :5173): From Players → AasimarTest now shows `Gold 10 gp` + `Copper 1 cp` purse rows with `To Party`; clicking Copper's confirms `Move 1 cp from AasimarTest to party inventory?`, pool Copper → 1, the Copper row disappears live (SSE char echo), Gold row untouched; log shows both directional rows. Adjacent-lane sanity: Longsword Add → Move-to-player → To Party → Delete all passed with the ZK-verbatim confirms; `Remove 1 cp` zeroed the pool. Disk SELF-HEALS BYTE-EXACT across the whole circle: `AasimarTest.json` back to `3bfe7eca…`, `data/inventory.json` back to `7638da67…` (the cp-restore rig from prior runs is now unnecessary — app-exploration PT#1 prediction confirmed).
- `npx vitest run src/components/party-inventory src/services/campaign` → 33 files / 381 tests green; server `inventory*.test.js` → 37 green. `npm run lint` → 0 warnings/0 errors.
- Exit hygiene: 0 console errors; closed-tab two-pass headless admin clears GET-verified cd `{}` + log `[]` with both disk files absent; dev pair (CAMPAIGN_LOCK=test-campaign) killed by this run.

