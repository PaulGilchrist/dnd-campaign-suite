# Bug: Player (LAN, non-localhost) view still offers and accepts Add Character

### Summary
Non-localhost clients are supposed to get a read-only view, but the sidebar's "Add Character" button is NOT gated by `isLocalhost` — a player on the LAN URL can open the full 12-step character-creation wizard, and the server accepts the POST from a non-localhost host, writing a new character JSON into the live campaign folder.

### Steps to reproduce
1. Start the app (`npm run dev`). On a second tab/machine open the LAN URL, e.g. `http://100.92.171.80:5173`.
2. Select **test-campaign**. Sidebar correctly strips Encounters/Factions/NPCs/Quests/Sessions/Settlements/Admin and renames Maps→Map… **but "Add Character" is visible and enabled** (verified live 2026-10-24: `disabled:false`).
3. Click "Add Character" → the full "Create New Character" wizard opens (steps 1–12 rendered).
4. Server lane: `curl -X POST http://100.92.171.80/api/campaigns/test-campaign -H 'Content-Type: application/json' -d '{"campaignName":"test-campaign","character":{"name":"LANProbe",...}}'` → **HTTP 201** `{"message":"Character created successfully","fileName":"LANProbe.json"}`; `public/campaigns/test-campaign/LANProbe.json` exists on disk. (Probe deleted afterwards via localhost DELETE → 200.)

### Expected behavior
Per the localhost-only GM-feature policy (same rule that hid campaign "Add" in b0337f5d5 and gated the initiative controls in c8c998531), the "Add Character" button should not render for non-localhost clients, and `POST /api/campaigns/:campaign` should 403 for non-localhost hosts.

### Actual behavior
Button renders enabled, wizard opens, POST from LAN hostname returns 201 and persists the file. Any player can spam-create characters into the running campaign.

### Likely location
- `src/components/sidebar/Sidebar.jsx:89` — the `+ Add Character` button is rendered outside the `isLocalhost` branch (`:167`) that wraps the other GM-only buttons.
- `server/routes/campaigns-character.js` — no localhost guard on `POST /api/campaigns/:campaign` (cf. `server/routes/quests.js:4` `isLocalhost` pattern, and admin-clear routes which do 403).
Confident on the frontend location (read the file); server route location is a strong guess based on the 201 response + grep showing localhost guards exist only on quests/admin routes.

### Suggested fix
Wrap the Add Character button in `isLocalhost && (...)` in Sidebar.jsx, and add the same `isLocalhost(req)` 403 guard used by quests/admin to the character-create POST on the server (client-side hiding alone is not enough — the POST lane is the real hole).

### Severity
Data integrity risk — unauthenticated LAN clients can mutate persistent campaign data; same threat class as the fixed initiative-hijack bug.
