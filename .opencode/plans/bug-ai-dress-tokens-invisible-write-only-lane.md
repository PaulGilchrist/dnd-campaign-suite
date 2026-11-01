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
