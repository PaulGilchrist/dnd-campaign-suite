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
