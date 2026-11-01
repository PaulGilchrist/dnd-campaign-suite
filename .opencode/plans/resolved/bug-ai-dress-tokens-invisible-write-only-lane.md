# AI Dress `token` ops apply with success feedback but the tokens never render (write-only lane)

### Summary
Applying an AI Dress plan that adds monster/NPC tokens reports success and persists rows into the map document's `items[]` lane, but NO client renderer ever draws `mapData.items` — the placed tokens are invisible in the 2D indoor view, invisible in 3D, and never appear again even after a hard reload. Same defect class as the just-fixed indoor-POI bug (2b617ef71), which got an `IndoorPoiLayer`; the token lane has no equivalent layer.

### Steps to reproduce
1. In `test-campaign`, enable AI (Admin) pointing at any OpenAI-compat model that returns a dress plan with a token op, e.g. `{"ops":[{"op":"add","target":"token","token":{"name":"QA Goblin","kind":"monster"},"gridX":3,"gridY":3}]}` (QA rig: instruction containing `TOKENADD`, endpoint `http://127.0.0.1:8123/v1`, model `qa-ay-fake-model`).
2. Maps → Open "Test Map" (indoor) → toolbar **AI Dress** → type the instruction → **Dress map**.
3. Proposal card lists "add monster token QA Goblin at 3,3" and a teal preview marker mirrors on the grid.
4. Click **Apply to map**. Dialog closes, marker wipes, no error.
5. Observe the grid: nothing at 3,3. `GET /api/campaigns/test-campaign/maps/test-map` shows the row persisted: `items:[{"id":"ai-dress-token-3-3-0","name":"QA Goblin","type":"monster","gridX":3,"gridY":3,"visible":true}]`.
6. Hard-reload the page, re-select test-campaign, reopen Test Map — still nothing rendered. Move/remove legs (cite the real digest id) validate + persist correctly server-side but are equally invisible.
7. Toggle the 3D view — no token mesh either (Map3D is fed the `placedItems` prop, never `mapData.items`).

### Expected behavior
An applied dress op the GM confirmed from a preview should produce a visible result. The digest, prompt, schema, applier, SSE adoption (`useSSESync.js:53`), and preview overlay (`dressPreview.js` token lane) all treat `token` as a first-class lane — the applied token should render as a monster/NPC marker on the indoor board (and be GM-removable, like placed NPCs / indoor POIs).

### Actual behavior
Zero observable delta after Apply: no SVG marker (`g[title]` set stays `barrel/QA AY Chest/Thug 1/Zombie 1`; no `svg text` matches the token name), no 3D token, no console error, no network failure. The rows accumulate silently in `items[]`.

### Likely location
Confident on the shape, guessing on the intended fix:
- Server writes tokens to the legacy `doc.items` lane: `server/services/ai/authoring/dressMap.js` `addToken` (rows pushed with `type:'monster'|'npc'`).
- Client grep shows the ONLY consumer of `mapData.items` app-wide is its SSE adoption at `src/components/map/hooks/useSSESync.js:53` — no renderer reads it. `PlacedItems.jsx` filters `placedItems` (the `placedItems` lane); `Map3D.jsx:72` passes `items: placedItems` into the scene, so 3D can't see `doc.items` either.
- The live NPC-token lane the rest of the app uses is `placedItems` entries with `type:'npc'` (e.g. "Thug 1", "Zombie 1"), which DO render (`renderNpc`) and get context menus. `doc.items` looks vestigial.

### Suggested fix
Two options; pick per owner intent:
1. **Route tokens into the live lane** (likely simpler): in `dressMap.js` `addToken`, push into `doc.placedItems` with `type:'monster'|'npc'` shaped like the existing NPC entries (id/name/type/gridX/gridY/visible) — then everything (2D render, title labels, fog dim, GM menus, 3D `_buildNpcs` for npc) rides existing machinery. `monster`-type placed items have no SVG yet, so either reuse the npc marker visual or add a minimal `MonsterTokenLayer`.
2. **Render the legacy lane**: add an `IndoorTokenLayer` mirroring the just-landed `IndoorPoiLayer` pattern (`src/components/map/IndoorPoiLayer.jsx` + `useIndoorPois.js`) fed from `mapData.items`, with GM right-click Hide/Delete.
Investigation needed: confirm with owner which lane is canonical for creature markers before coding; also pin `buildMapDigest`'s `tokens` source so the digest and the renderer agree.

### Severity
Broken feature — the GM gets an explicit, previewed "Apply to map" success whose result is permanently invisible; op state accumulates in a dead document lane with no feedback.

## Resolution

**FIXED — 2026-11-01 fix run (Option 1: tokens routed into the live `placedItems` lane).**

### What was actually wrong
Diagnosis confirmed as filed: `applyDressOps` wrote token rows into the legacy
`doc.items` lane, which has ZERO renderers app-wide (2D `PlacedItems.jsx` filters
`placedItems`; `Map3D.jsx` feeds the scene the `placedItems` prop; the only
`mapData.items` consumer was the useSSESync adoption). Beyond the original guess,
the fix also had to keep the whole lane coherent: `buildMapDigest`'s `tokens`
source (was `doc.items`), the client preview's `laneRows` (was `doc.items`), and
the remove-preview copy (typed creature rows by TYPE — the client marker labeled
them by NAME; the ladder is now name-first so both surfaces agree).
`monster`-type placed items genuinely could not render with existing machinery
(whitelisted 2D dispatch, npc-only 3D `_buildNpcs`), so the monster kind reuses
the NPC token visual with a distinct marker: purple ring (`.monster-circle`,
2D CSS + 3D `COLORS.monster`) + ☠ glyph instead of the name initial.

### Files changed
- `server/services/ai/authoring/dressMap.js` — `laneOf` token → `placedItems`;
  digest splits `placedItems` by `TOKEN_TYPES` (npc/monster → `tokens` with name,
  props → `items`; legacy `doc.items` rows surface nowhere); `addToken` shapes the
  row like palette NPC entries; remove copy name-first.
- `server/services/ai/authoring/entitySchemas.js` — schema comment lane truth.
- `src/components/map/PlacedItems.jsx` — `renderCreature(item, isMonster)` shared
  marker; monster dispatch added (npc bytes byte-identical).
- `src/components/map/Map.css` — `.map .monster-circle` purple ring.
- `src/components/map/Map3D/map3dScene.js` — `isCreatureToken` helper;
  `_buildNpcs` renders monsters (purple parity colors), `_buildPlacedItems`
  skips both creature types (no more fallback-box ambiguity).
- `src/components/map/Map3D/Map3D.jsx` — counts route creatures to the token tally.
- `src/services/maps/dressPreview.js` — preview `laneRows` resolves item/token
  against `placedItems` (poi separate), matching server `laneOf`.
- `src/components/map/hooks/useSSESync.js` — comment truth (code unchanged:
  placedItems adoption already live; legacy items adoption kept for
  generator-era docs).
- Tests: NEW `server/services/ai/authoring/dressMap.tokens.test.js` (6: lane +
  shape + digest source + digest-id move/remove round-trip + legacy lane
  unquotable + name-first copy), NEW `src/components/map/PlacedItems.tokens.test.jsx`
  (5: monster renders npc-group/title/name/☠/purple ring, NPC bytes intact,
  hide-dim/LAN/fog visibility law, GM hit-area menu wiring); UPDATED pins in
  `dressMap.test.js` + `dressPreview.test.js` (fixtures moved to the rendered lane).

### How verified
- Live repro BEFORE fix: TOKENADD on test-map → rows persisted to `items[]`
  (`ai-dress-token-3-3-0`), zero markers (`g[title]` census unchanged, no svg
  text matching the name) — exact as filed.
- Live re-verification AFTER fix (dev trio restarted — plain `node server.js`
  needs it for server edits): apply → `QA Goblin` renders LIVE at 3,3 (circle
  bbox center 140,140 = cell 3,3; purple `.monster-circle` + ☠ + name label),
  `QA Marta` at 5,5 (red npc visual); survives hard reload; right-click GM menu
  Hide (dims 0.5) / Show (1) / Delete (named confirm `Delete "QA Marta" from the
  map?` → row + marker gone, autosave persisted); TOKENMV round-trip citing the
  REAL digest ids moved Thug 1 → 9,9 (bbox 380,380) and removed Zombie 1
  (doc + board); 3D view shows tokens (`0 walls · 1 items · 11 players · 3 npcs`);
  adjacent lanes sane: POITEST chest renders `g[title="QA AY Chest"]` and POI
  renders in `g.indoor-poi-layer`; `ai_dress` proposal+applied log pairs carry
  op counts. Cleanup: baseline map doc restored (legacy `ai-dress-token-*`
  orphans in `doc.items` included), change-data + log + aiConfig cleared, rig killed.
- `npx vitest run` on the new tests + all touched folders (server/services/ai/
  authoring, src/components/map incl. Map3D, src/services/maps): 96 files /
  1126 tests green; `npm run lint` zero warnings.

### Residuals (noted, not chased)
- The AI map GENERATOR (`server/services/ai/authoring/applyMaps.js` `dressTokens`)
  still writes encounter tokens into the invisible `doc.items` lane — same defect
  class, different face (generator/drafts, event-clear this session); the lane's
  SSE adoption is kept for its docs. Owner call whether it should route to
  `placedItems` too.
- Monster tokens get Hide/Delete/Rotate but not Rename/"View Stats" (npc-only,
  Map.jsx gates `type === 'npc'`) — left per scope.
