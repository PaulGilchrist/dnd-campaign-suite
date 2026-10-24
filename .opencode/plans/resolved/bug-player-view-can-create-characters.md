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

## Resolution
FIXED 2026-10-24. Diagnosis confirmed on both lanes; fix mirrors the existing `maps.js`/admin authority-guard pattern.

**What was actually wrong (matches the original guess):**
- `src/components/sidebar/Sidebar.jsx` — `CharacterList` rendered the `+ Add Character` button unconditionally; `isLocalhost` was already a Sidebar prop but was never passed into `CharacterList` (only consumed by `NavButton`/Admin footer).
- `server/routes/campaigns-character.js` — `POST /api/campaigns/:campaign` had no hostname guard (GET/PUT/PATCH/DELETE on the `.json` routes are unchanged — the players' read lane and the pre-existing sheet edit/delete affordances stay byte-identical; guarding create-only is the surgical scope, per the maps.js deny-indoor/keep-travel precedent).

**Files changed:**
- `src/components/sidebar/Sidebar.jsx` — pass `isLocalhost` into `CharacterList`; wrap the Add Character button in `{isLocalhost && (...)}` (mirrors CampaignSelection.jsx `b0337f5d5`).
- `server/routes/campaigns-character.js` — added `isLocalhost(req)` + `refuseUnlessGm(req, res)` (copied structure/logging from `maps.js` refuseUnlessGm): create POST from a non-localhost Host now logs `[campaigns-character] BLOCKED non-localhost POST … — GM-only` and returns 403 `{ error: 'Access denied: GM-only feature' }`.
- `src/components/sidebar/Sidebar.test.jsx` — stale pins inverted: "renders Campaigns and Add Character regardless of localhost" → player view now asserts Add Character ABSENT + localhost asserts present; the non-localhost onAddCharacter click test moved to the localhost lane.
- `server/routes/campaigns-character-localhost-create.test.js` — NEW regression test (path-aware fs mock per playbook §444): forged LAN Hosts (192.168.0.239, 100.92.171.80, example.test) ⇒ 403 + no file + no SSE broadcast; localhost/127.0.0.1 create still 201 + file + broadcast; player GET of an existing char stays 200 (scope pin).

**Verification:**
- Pre-fix repro (live, browser + curl): LAN tab `http://192.168.0.239:5173` → header `test-campaign`, `button.add-character` `disabled:false`, full 12-step wizard opened; `POST :80` with `Host: 192.168.0.239` → 201 + `LANProbe.json` on disk (probe DELETEd via localhost, 200).
- Post-fix repro re-run: LAN tab shows ZERO Add Character buttons (`addCharButtons:0`, `wizardOpen:false`) — wizard unreachable; character roster unchanged (12 read-only rows). `:80` forged-Host POST → **403** on both LAN IPs with honest `BLOCKED` server-log line, no probe files written. Honest `Host: localhost` POST → **201** `LocalProbeDeleteMe.json`, DELETE → 200, disk clean. localhost GM tab: button visible, wizard opens/cancels exactly as before, zero writes.
- Tests: `npx vitest run` — new server test + 3 sibling `campaigns-character*` files + all `src/components/sidebar` + `App.runtime-events`/`mockComponents`: **175 passed** (11 files) / 103 passed cross-checks. `npm run lint`: **zero warnings**. `npm run guard:no-timers`: OK (no new timers).
- Cleanup: `LANProbe`/`LocalProbeDeleteMe` deleted, admin `clear-change-data` + `clear-log` → `{}` / `[]` (browser closed first per tab-resurrection rule §17).

**Note for owner:** the dev-proxy caveat still stands (playbook §742/§784, `bug-vite-proxy-localhost-guard-bypass.md`) — through Vite :5173 `changeOrigin:true` spoofs the Host so this 403 only bites on direct :80 writes; the client-side hide covers the :5173 UI lane. The fix is exactly as strong as the sibling guards; the proxy bypass remains a separate systemic ticket.
