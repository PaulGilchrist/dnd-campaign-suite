# Player (non-localhost) clients can write party inventory — currency forged, Add Item live

## Summary
The party-inventory lane has no GM authority guard: a LAN player tab (non-localhost) can click +100/−100 on party Gold and the server accepts every write (`gp 0→100→0` round-trip proven live). The `Add Item` button also renders enabled on the player view. This is the same privilege family as the just-fixed Add-Character leak (97e11931a) — inventory was missed.

## Steps to reproduce
1. From a non-localhost host (e.g. `http://192.168.0.239:5173` — same app via Vite, real Host now forwarded since a679ae28a), select **test-campaign**.
2. Sidebar → **Inventory**. Observe the Party Currency rows render with ENABLED `+1 / +10 / +100` chips and an `Add Item` button (only `−` chips self-disable at balance 0; `Give` disables at 0).
3. Click `+100` on the Gold row → display shows 100; `GET /api/campaigns/test-campaign/inventory` → `currency.gp = 100` (POST accepted from the LAN host).
4. Click `−100` → server `gp = 0` again. Both legs accepted from the player hostname.

## Expected behavior
Per the app's server-first doctrine (AGENTS.md: "network clients get read-only view"), party inventory writes should be GM-only: the +/- chips, Add Item, and row actions should be hidden/disabled on non-localhost views (like Encounters/Factions/NPCs… already are), and the server routes should refuse non-GM writes with 403 (like character-create now does).

## Actual behavior
- UI affordances fully live on the player tab.
- Server accepts everything: `POST /api/campaigns/<c>/inventory` (currency + presumably item CRUD via the same route), `POST /inventory/transfer`, `POST /inventory/deposit` — no hostname check exists in `server/routes/inventory.js` (grep: zero `localhost`/`refuseUnlessGm` occurrences in the file).
- No console error, no refusal popup — silent success.

## Likely location
- Server: `server/routes/inventory.js` — the three write handlers at :248, :299, :345 lack the `refuseUnlessGm(req, res)` prologue used by `campaigns-character.js` (97e11931a), `maps.js`, `quests.js`, `campaigns-admin.js`.
- Client: `src/components/party-inventory/PartyInventory.jsx` — +/- chips and `Add Item` render without the `isLocalhost` prop gate other management views use.

## Suggested fix
Mirror the established pattern: add the hostname helper + `refuseUnlessGm` at the top of the three POST handlers in `inventory.js` (403 `{error:'Access denied: GM-only feature'}`), and gate the chip/button renders in `PartyInventory.jsx` behind `isLocalhost`. Keep the player view functional for whatever legitimately player-originated lanes exist (e.g. a Give-from-player flow) — audit whether `/inventory/transfer` (player→party) should stay open to players and guard only the forge-from-nothing lanes (+/- grants, item add/edit/delete). Add a route test mirroring `campaigns-character-localhost-create.test.js`.

## Severity
Data integrity risk — any network client can mint or drain shared party wealth and add/delete party items while the GM isn't looking; trivially exploitable, silent, and contradicts the enforced read-only-player contract established app-wide.

## Resolution
**FIXED 2026-10-24.** Root cause confirmed exactly as guessed: zero hostname guards in
`server/routes/inventory.js` and no `isLocalhost` prop gate in `PartyInventory.jsx`.
Reproduced live first: LAN player tab (:5173) clicked `+100` → server `gp 0→100`, `−100`
→ `gp 0`; both POSTs 200 from the player hostname, silent success.

### What changed
- **Server (`server/routes/inventory.js`)** — added the established `isLocalhost` /
  `refuseUnlessGm` prologue (verbatim pattern from `campaigns-character.js` 97e11931a:
  `[inventory] BLOCKED non-localhost …` console audit + 403 `{error:'Access denied: GM-only feature'}`) to:
  - `POST /inventory` — full-store overwrite (currency chip flushes, item add/edit/delete) — GM-only;
  - `POST /inventory/deposit` — currency mint (its only caller, the loot Award panel, is already `isLocalhost`-gated);
  - `POST /inventory/transfer` — **GM-only for `party-to-player`** (disbursement). **Audited exception: `player-to-party` stays open** — a player contributing from their OWN resources is a legitimate lane; the server debits the character file atomically and 409s shortfalls, so it can never mint treasury wealth (proven live: LAN `player-to-party gp:999999` → 409 "AasimarTest has only 10 gp").
- **Client (`src/components/party-inventory/PartyInventory.jsx`)** — new `isLocalhost` prop (wired in `src/App.jsx` OverlayViews): hides the `+/-` currency chips, `Give`, `Add Item`, the items-table Actions column, and the row qty stepper (plain qty text instead) on network views; read-only balances, search, and the From Players/`To Party` contribution panel stay. Fail-closed: missing prop = affordances absent (mirrors NavButton/Quests). Empty-state copy drops the "Click Add Item" hint for players.
- **Tests** — new `server/routes/inventory-localhost-guard.test.js` (mirrors `campaigns-character-localhost-create.test.js`): 3× LAN hosts × mint/deposit/party-to-player → 403 + disk untouched + no SSE publish; LAN GET + LAN player-to-party stay open; localhost legs byte-untested-stable (200). New `src/components/party-inventory/PartyInventory.localhost-readonly.test.jsx` pins the player-view absence of every write affordance + GM-view presence. The 6 pre-existing party-inventory test files gained `isLocalhost: true` in defaultProps (GM lane, matching initiative-suite convention).

### Verification
- **Live (Playwright + curl, test-campaign only):** LAN player tab post-fix — Inventory renders 0 chips / no Give / no Add Item / no Actions column (DOM probe `chips:0 addBtn:0 give:0 actionsTh:0`); forged POSTs from LAN origin via :5173 proxy AND via :80 with LAN Host header → **403** on all three mint/disburse routes; GET → 200; server log shows 4× `[inventory] BLOCKED non-localhost POST … — GM-only`. GM localhost tab still fully functional: `+100` chip → display 100 → server `gp:100`; `−100` → baseline restored.
- **Baseline honored:** inventory durable-store back to recorded baseline `{pp:0,gp:0,sp:0,cp:0}, items:[]` (GET + disk verified); Admin cleared change-data `{}` + log `[]`, stable 12s post-clear.
- **Suites:** new server guard test 18/18; `server/routes` full 53 files / 1088 tests pass; party-inventory folder 7 files / 52 tests pass; `npm run lint` zero warnings.

### Pitfall found
`npm run dev` runs `node server.js` **without --watch** — a server started before a server-route edit keeps serving the OLD code, so a "still accepted" POST during fix verification may just be a stale process. After editing `server/`, kill the trio and restart the dev stack before re-testing live guards.
