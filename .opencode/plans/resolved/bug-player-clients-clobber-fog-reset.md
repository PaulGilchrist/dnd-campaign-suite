# Read-only player clients auto-PUT map state and clobber GM fog resets

### Summary
Network (non-localhost, nominally read-only) player clients periodically persist the whole map document (`PUT /api/campaigns/:campaign/maps/:map`) and POST `__map__` runtime state. When the GM resets fog of war, any open player tab re-persists its stale fully-revealed copy within seconds, wiping the GM's fog edit. Observed live 2026-10-24.

### Steps to reproduce
1. In test-campaign on localhost (GM tab), open Maps → Test Map → Open. The map doc starts with `revealed` = all 400 cells, `fog` = [].
2. On a second device/tab via the LAN URL (e.g. `http://192.168.0.239:5173` — player view, GM tools absent), select test-campaign → Map. With no active map it shows "Waiting for the GM to open a map..." (correct).
3. GM tab: Maps → Test Map → Activate. Player tab live-renders the grid + tokens (correct), toolbar shows only Spell/Ruler (correct).
4. GM (or API, test-campaign sandbox): PUT the map document with `walls` = full column `10,0…10,19` and `revealed` = `[]` to seed fog behind the wall line.
5. Watch the player tab for ~5s and GET the map doc.

### Expected behavior
Fogged cells (west tokens cannot see past the sealed wall column) render fog on the player tab; `revealed` grows only from legitimate visibility computation; read-only clients issue no map-document writes.

### Actual behavior
- Player tab's network log shows **six `PUT /api/campaigns/test-campaign/maps/test-map` (200)** plus a `POST /api/campaigns/test-campaign/__map__ (200)` from the read-only client.
- Disk `revealed` jumped back to **400** within seconds of the reset → fog never appeared on the player tab (0 fog rects rendered); `fogCount` never nonzero.
- No user-facing feedback anywhere; the GM's fog reset is silently un-done.

### Likely location
Confident: `src/components/map/Map.jsx:223-233` — the "exploration memory" effect merges `visible` into persisted `revealed` and calls `setMapData` → the map save hook PUTs the whole document. It runs on EVERY client, not just localhost/GM, and recomputes from whatever copy the client holds. Multi-writer last-write-wins with no server-side monotonic merge and no client-role guard. `useSSESync.js` / the `__map__` runtime POST lane are secondary co-writers. The server `PUT /api/campaigns/:campaign/maps/:map` route (server/routes/maps.js) accepts full-document replacement from any origin (no mutation guard like the npcs bestiary guard).

### Suggested fix
- Gate the revealed-merge persistence (and any map document PUT) to localhost/GM role only — the same `isLocalhost` flag MapToolbar already uses to hide Paint/Erase/Reset Fog.
- Alternatively/additionally, make the server merge `revealed` monotonically per write and reject non-localhost map mutations with 403.
- Re-test: reset fog with a player tab open; `revealed` must stay at the GM's set (≤ LoS behind walls) and fog must render on the player tab live.

### Severity
Data integrity risk — GM-authored fog state is silently reverted by any open player client; also a privilege violation (read-only clients writing server state).

## Resolution (FIXED — 2026-10-24)

**Root cause confirmed against live code.** The diagnosis in "Likely location" was correct and refined:
- `src/components/map/Map.jsx:223-233` exploration-memory effect merged each client's freshly-computed `visible` line-of-sight into the persisted `revealed` and called `setMapData` **on every client, regardless of role**.
- `setMapData` feeds the whole-document autosave in `src/components/map/hooks/useMapLoader.js` — the actual PUT lane (the autosave debounce, every pointer-up/leave, and the unmount flush all route through its single `flushSave` chokepoint). A LAN player tab that computed `visible`=380 on a reset map therefore PUT `revealed`=380 (or the original report's 400 pre-wall) back over the GM's fog within the ~1s debounce.
- Secondary co-writer: `src/components/common/MapContextSync.jsx` force-POSTed `__map__` (the active-map pointer) from every tab on mount.
- Server `PUT /api/campaigns/:campaign/maps/:mapname` had no mutation guard.

**Fix — gate map-document authorship to localhost/GM, mirroring the existing `isLocalhost` role flag MapToolbar/useWallDrawing/useMapDrops already use:**
- `Map.jsx`: the revealed-merge effect (and `resetFog`) now early-return for non-localhost clients — players compute line-of-sight locally for their own render but never author the persisted set.
- `useMapLoader.js`: accepts `isLocalhost`; `flushSave` (the sole save chokepoint), the autosave-scheduled save, and the initial-create save all bail out for read-only clients. Players still RECEIVE every change untouched via `useSSESync`.
- `MapContextSync.jsx`: read-only clients mirror `__map__` into their **local** runtime store with `skipSync=true` (grid distance checks keep working) but issue **zero** server POSTs; localhost GM behaviour is byte-unchanged. `App.jsx` passes `isLocalhost` through.
- Defense-in-depth (server), mirroring the npcs bestiary-guard / campaigns-admin precedent: `server/routes/maps.js` adds an `isLocalhost` gate that 403s non-localhost indoor-map PUT/DELETE/rename/activate/description (deny-safe on unknown type; outdoor hex documents stay writable — that is the party-travel persistence lane, untouched by this bug), logging `[maps] BLOCKED …`. `server/validation/keyValidators.js` registers `__map__` as always-engaged GM authority via the existing `validateAuthority` seam, so a read-only client's `POST /:campaign/__map__` is refused (400) with the standard `denied-*` SSE + persistent `enforcement_denied` log.
- Dual-ruleset: fog/map state is not ruleset-branched, so no 2024 sibling needed the same change; the shared indoor map lane is the single fix point.

**Verification (live, two browser contexts, test-campaign only):**
- Repro of the ORIGINAL bug reproduced first: a LAN (`http://192.168.0.239:5173`) player tab issued 4× `PUT /maps/test-map` + a `POST /__map__` (all 200), and disk `revealed` bounced 0 → 380 after a fog seed.
- After the fix, same setup: the LAN player tab rendered the fogged grid **live** (20 `rect.fog-cell-player` behind the sealed enclosure, toolbar read-only Spell/Ruler/3D) and issued **0** map-document PUTs and **0** `__map__` POSTs across the whole session (network-filtered). A GM/localhost fog reset (`revealed:=[]`) held at the GM's legitimate line-of-sight (`revealed` settled 380, NOT bounced to 400); fog stayed on the player tab.
- Adjacent flows sanity-checked and intact: GM Paint persists to disk (walls 36→37 on a stroke); GM token-drag syncs to the un-reloaded player tab live (`AasimarTest` mirrored to cell 7,10, token cx == cell cx); non-localhost GET of the map still returns 200 (players still read); server 403 fires on the two non-localhost guard-probes with `[maps] BLOCKED` logged, no off-target campaign-lock noise from this session.
- Tests: new `useMapLoader.read-only.test.js` (6), `MapContextSync.read-only.test.jsx` (2), `maps-read-only.test.js` (6, supertest + Host override) lock the exact behaviour. Touched-folder sweep `npx vitest run src/components/map src/components/common/MapContextSync.* server/routes/maps*.* server/routes/campaigns-changedata-l5-validation.test.js src/App.runtime-events.test.jsx` = **63 files / 808 tests passed**. `npm run lint` clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` OK.

**Cleanup:** test-map disk restored to original bytes (revealed 400, walls 0, `AasimarTest` back at 6,10; steady across the debounce), change-data cache `{}` and campaign log cleared to 0 via Admin API.

**Note:** `docs/app-exploration.md`, `docs/test-*-registry.json`, and `src/components/initiative/createConcentrationHandlers.js` also show as modified in `git status` — those are pre-existing/foreign working-tree changes, not part of this fix and left untouched.
