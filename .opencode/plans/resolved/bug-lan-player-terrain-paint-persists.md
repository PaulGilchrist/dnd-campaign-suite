# LAN player can persistently paint terrain on outdoor hex maps (GM-only map editing leaked to network clients)

## Summary
A non-localhost (LAN) visitor to the campaign can arm the hex-map terrain **Paint** tool and write real, persistent terrain edits to the outdoor map document. The server's `PUT /api/campaigns/:campaign/maps/:mapname` skips the `refuseUnlessGm` guard whenever the stored document is `type:'outdoor'`, and the hex toolbar renders Paint terrain / Paint rivers / Roads / Travel mode fully ENABLED (not disabled) in the LAN player view — while the twin indoor-map PUT 403s with "Access denied: GM-only feature" and the AI-Dress button is correctly hidden. This violates the documented permission model ("GM features are localhost-only … network clients get read-only view" — AGENTS.md; and the maps.js comment "players … never resolve its events").

## Steps to reproduce
1. Run `npm run dev` (Vite `--host`) on the GM machine. Note the LAN URL (e.g. `http://192.168.0.224:5173`).
2. In a LAN-originated browser tab/context, select `test-campaign` (any campaign with at least one outdoor hex map; create one as GM: outdoor, gridSize 8, some terrain).
3. GM tab: on Maps, click **Activate** on the outdoor map so the player's Map view follows it.
4. LAN tab: nav **Map** (singular player nav). The hex editor mounts with toolbar buttons "Paint terrain", "Paint rivers", "Connect cities and settlements with roads", "Travel mode" — all clickable (`disabled:false`). AI Dress is absent (proving the tab IS detected as non-localhost).
5. LAN tab: click "Paint terrain", then click an empty hex cell on the board.
6. Within ~12 s (save debounce) the LAN tab fires `PUT /api/campaigns/test-campaign/maps/<hex-slug>` → **200 OK**; `GET` the map (from any client): the terrain dict gained the painted cell (verified: 28 → 30 cells, new `"7,4":"plains"` and `"4,6":"plains"` entries). Change is broadcast to every client via `map-data-<campaign>-<map>` SSE.
7. Control: from the SAME LAN tab, `fetch PUT /api/campaigns/test-campaign/maps/test-map` (indoor doc) → **403 `{"error":"Access denied: GM-only feature"}`**.

## Expected behavior
Per the app's permission model, map EDITING affordances are GM/localhost-only: on a network client the hex toolbar should not enable Paint terrain/rivers/roads (travel is the arguable shared lane), and/or the server should refuse editor-scope mutations (terrain/pois/roads/zoom) from non-localhost PUTs on outdoor documents.

## Actual behavior
- Paint/Rivers/Roads/Travel buttons render enabled in the LAN player tab (only AI-Dress is host-gated).
- A paint click from the LAN tab is saved by the server (200) and persists to disk + broadcasts to all clients. Only the indoor branch is GM-guarded.
- Failed-write feedback is moot because the write SUCCEEDS — the player sees terrain silently change (and the GM's map mutates under them).

## Likely location
- Server: `server/routes/maps.js` PUT handler (~line 332): `if (!isOutdoor && !refuseUnlessGm(req, res)) return;` — the `!isOutdoor` short-circuit exempts ALL outdoor writes from the GM guard (the outdoor branch needs to stay open only for the shared player lanes — fog reveal / party-marker/travel state — not editor fields).
- Client: `src/components/hex-map/HexMapToolbar.jsx` — `paint/rivers/road/travel` buttons are not gated on the `isLocalhost` prop the way `dressButton` is (`HexMap.jsx` passes `isLocalhost` down; toolbar ignores it for the edit tools). `src/components/hex-map/hooks/useTerrainPainting.js` likewise has zero `isLocalhost` references.

## Suggested fix
- Server-first (deny-safe): in the PUT outdoor branch, when `!isLocalhost(req)`, diff incoming body vs stored doc and accept ONLY the player-legit keys (e.g. per-client fog `revealed` sets / travel acks the outdoor lane actually needs players to write); 403 editor-scope deltas (terrain, rivers, roads, pois, placedItems, zoom/pan) with the canonical GM-only response. Investigate which outdoor fields real player sessions write today (grep client outdoor save callers) before scoping.
- Client parity: hide/disable terrain-paint, river, road toolbar buttons when `!isLocalhost` (mirror the dressButton pattern) so the read-only view is honest even before the server fix lands.
- Note: `maps-create-localhost-guard.test.js` covers create; add the outdoor-PUT differential to `maps.test.js`.

## Severity
**Data integrity risk** — any network visitor can silently rewrite a production campaign's outdoor map (terrain/POIs/roads via full-doc save) and broadcast the mutation to all players, while the app's own docs promise read-only LAN views.

## Resolution
**FIXED 2026-11-02.** Diagnosis confirmed against the live code: `server/routes/maps.js` PUT gated the GM guard only on the indoor branch (`if (!isOutdoor && !refuseUnlessGm(...))`), and `HexMapToolbar.jsx` rendered every editor tool regardless of the `isLocalhost` the host already receives.

What was actually wrong vs the guess: the outdoor all-tab PUT lane is *intentional* but was left **fully** open. It exists for the shared party lanes — hex `useMapLoader` PUTs the 14-key envelope whenever party marker / travelState / marchingOrder / per-client view pan-zoom change (and the travel lane rolls weather as it runs). So the fix is a **differential guard**, not a blanket `refuseUnlessGm`:

### Files changed
- `server/routes/maps.js` — new `outdoorEditorDelta(storedData, body)` (lodash `isEqual` on normalized `terrain/rivers/roads/pois/gridSize/draft`; missing stored doc = deny-safe true). Outdoor PUT from a non-localhost Host with any editor delta → canonical 403 `{"error":"Access denied: GM-only feature"}` + `[maps] BLOCKED …outdoor editor fields… GM-only` log; echoes/travel/view deltas still 200. Indoor branch and `refuseUnlessGm` untouched (mirrored, not reinvented).
- `src/components/hex-map/HexMapToolbar.jsx` — editor tools (Paint terrain / Erase terrain / terrain selector / Paint rivers / Roads) + Grid-size input now render only when `isLocalhost` (new prop, default `false` = hidden), mirroring the `dressButton` host-gate pattern. Buttons were extracted to a same-file `EditorTools` sibling to stay under the ESLint complexity ceiling (playbook §47). Travel / POI panel / marching order / 3D / print / zoom stay shared lanes (existing code treats travel as the shared party lane — maps.js authority comment).
- `src/components/hex-map/HexMap.jsx` — passes `isLocalhost` to the toolbar.
- `server/routes/maps.outdoor-put-editor-guard.test.js` — NEW regression suite (10 tests): LAN terrain/pois/roads/rivers/gridSize deltas 403 + disk-inert + zero-broadcast; deny-safe create-via-PUT 403; pan/travel/weather echo lane still 200 + persists + broadcasts; missing-rivers normalization never false-403s; indoor control 403; GM edits still persist (sanity).
- `src/components/hex-map/HexMapToolbar.test.jsx` — GM byte-order contract moved to `isLocalhost: true` defaults + new `host gating` describe: LAN census (Travel/POI/marching/3D/Print/Zoom only), travel still arms for LAN, host-less render defaults read-only.

### Verification (live, two-tab, test-campaign, dev:locked :5173 + LAN IP)
- **Repro (pre-fix)**: LAN isolated-context tab → Map nav → toolbar showed Paint/Erase/Rivers/Roads/Travel all `disabled:false`, no AI Dress; paint click on hex (6,2) → `PUT /maps/qa-lan-paint` **200**, disk terrain 5→6 cells. Indoor control PUT from same tab → 403, as filed.
- **Post-fix LAN tab**: toolbar buttons = [Back, Travel, POI panel, Marching, 3D, Print, Zoom×3] — `editorButtons: 0`, grid input absent, no dress; terrain-delta PUT from the real LAN tab → **403** GM-only + disk unchanged; pan-only PUT → **200** (travel/view lane alive); indoor control → **403**.
- **GM workflow intact**: localhost tab still shows all editor buttons + AI Dress; paint (6,2 plains, then 7,3 hills) persisted to disk; LAN tab adopted the hills cell **live via SSE** (terrain-layer cell fill = `#8DB580` hills with jitter) without reload; zero non-probe 403s / no re-PUT storm from the passive tab.
- Server log shows the new `[maps] BLOCKED non-localhost PUT … outdoor editor fields … GM-only` lines.
- Tests: new guard suite 10/10; all 9 `server/routes/maps*.test.js` files 163/163; `src/components/hex-map` 46 files / 504 tests green; full `npm run test:run` 3020 files / 33097 passed / 3 expected-fail / 0 failed; `npm run lint` zero problems.

### Cleanup
Throwaway fixture map `QA LAN Paint` created (GM) for the repro and DELETEd after; test-campaign restored to BD baseline byte-identical (test-map md5 `8e40779e…`, battle-arena `94fcd0bf…`), change-data `{}` + log `[]` verified closed-tab; dev:locked trio left running for reuse.
