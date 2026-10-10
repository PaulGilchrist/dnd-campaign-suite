# Map editor title re-derives from filename slug, losing acronym capitalisation

### Summary
The map editor toolbar title is computed by `formatMapName(mapName)` from the filename slug (e.g. `qa-fog-map`), which title-cases each word. This rewrites an acronym like "QA" to "Qa" and ignores the stored `displayName` ("QA Fog Map"). The Maps manager list shows the correct name, but opening the map shows the mangled one.

### Steps to reproduce
1. In `test-campaign`, on the Maps page, create a map named `QA Fog Map` (Create Map). The list correctly shows **QA Fog Map**.
2. Click "Open" on that map.
3. Read the toolbar heading.

### Expected behavior
Header shows the stored `displayName` "QA Fog Map".

### Actual behavior
Header shows **"Qa Fog Map"** (screenshot: `.playwright-mcp/page-2026-10-10T15-54-56-054Z.png`). Disk confirms `displayName: "QA Fog Map"` while `fileName: "qa-fog-map.json"` — the header is derived from the slug, not the display name.

### Likely location
Confident: `src/components/map/MapToolbar.jsx:63` renders `mapsService.formatMapName(mapName)`; `formatMapName` (`src/services/maps/mapsService.js:163-170`) uppercases the first letter of each hyphen-split word. `Map` is passed the slug `mapName`, not the server-provided `displayName`.

### Suggested fix
Thread the map's `displayName` down to the toolbar and render it when present, falling back to `formatMapName(slug)` only when absent. `GET /maps` already returns `displayName`/`name`; have `MapsAreaView`/`Map` carry it (or fetch it) instead of recomputing from the filename.

### Severity
Minor UX issue — cosmetic mislabeling of user-authored names, but confusing when names contain acronyms/proper nouns.

## Resolution

**FIXED (2026-10-10).**

**What was wrong:** The original diagnosis was essentially correct. `Map.jsx` loads the full map JSON via `useMapLoader` (which spreads the server payload, so `mapData.displayName` was already available in the component), but passed only the filename slug `mapName` down to `MapToolbar`, whose `<h4>` re-derived the title via `mapsService.formatMapName(slug)` — title-casing each hyphen-split word and mangling "QA" → "Qa". No new threading through `MapsAreaView` was needed; the display name was already one prop away.

**Fix (mirrors the existing `Map3D.jsx:96` pattern of `displayName || fallback`):**
- `src/components/map/MapToolbar.jsx` — new `displayName` prop; title renders `displayName || formatMapName(mapName) || 'Map'`.
- `src/components/map/Map.jsx` — passes `displayName={mapData.displayName}` to `MapToolbar`.
- `src/components/hex-map/HexMap.jsx` + `HexMapToolbar.jsx` — same latent defect on the outdoor toolbar title; threaded `displayName={mapLoader.mapData?.displayName}` with `displayName || mapName` fallback. (Server already persists `displayName` on create/rename — `server/routes/maps.js:66,78,224`; no server change needed.)
- `src/components/map/MapToolbar.display-name.test.jsx` — new regression test (5 cases): renders displayName verbatim ("QA Fog Map"), no "Qa Fog Map", slug fallback when displayName absent/empty, "Map" when nothing provided.

**Verification:**
- Live repro (pre-fix): created "QA Fog Map" in test-campaign → list showed "QA Fog Map", editor toolbar heading showed "Qa Fog Map". Bug confirmed.
- Live re-verify (post-fix, HMR + full reload): heading shows exactly **"QA Fog Map"** (`heading [level=4]`). Adjacent sanity: Battle Arena opens and titles correctly ("Battle Arena").
- `npx vitest run` — new test 5/5; touched folders (`src/components/map` + `src/components/hex-map`): 81 files, 1651 tests, all passed.
- `npm run lint` — clean, zero warnings.
- Cleanup: QA Fog Map deleted via manager modal; Admin → Clear Change Data + Clear Campaign Log (verified change-data keys `[]`, log count 0). Pre-existing Battle Arena / Test Map untouched.

