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
