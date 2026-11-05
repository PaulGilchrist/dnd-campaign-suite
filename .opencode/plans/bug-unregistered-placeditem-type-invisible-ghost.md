# Placed items with an unregistered `type` are invisible ghosts in both map render lanes — no fallback, no hit area, still counted in the 3D status bar

**Found:** Explore run CV — 2026-11-05 (live in test-campaign, localhost:5173, dev pair with CAMPAIGN_LOCK)

## Summary

`placedItems` rows whose `type` is not one of the 22 prop types + `door` + `npc`/`monster` are accepted and persisted by the map API (and by AI-Dress `add item` ops, which validate only that `item.type` is non-empty), but the rewritten `PlacedItems.jsx` dispatcher renders NOTHING for them: no sprite, no `<use>` fallback, no hit area. They are also invisible in the 3D lane, yet the 3D status bar counts them — so the GM sees "4 items" for a map that renders 3, and the ghost row cannot be selected, moved, hidden, or deleted from the map UI at all. `src/services/maps/itemSprites.js` explicitly documents a "fall back to the inline SVG symbols" path that is unreachable for these types (the whitelist dispatch happens before `renderProp` is ever called).

## Steps to reproduce

1. In test-campaign, create a map containing an unregistered item type via the API (this is exactly the shape AI-Dress `add item` produces for an invented type — `server/services/ai/authoring/dressMap.js` `addPlacedItem` pushes `op.item.type` verbatim after a non-empty check only):
   ```
   POST /api/campaigns/test-campaign/maps
   { "name": "CV Sprite Lane", "type": "indoor", "gridSize": 24,
     "placedItems": [
       { "id": "cv-legacy", "type": "cauldron", "gridX": 3, "gridY": 3, "visible": true },
       { "id": "cv-table",  "type": "table",    "gridX": 9, "gridY": 3, "visible": true } ] }
   ```
   → 201 Created; GET the map back and both rows are on disk.
2. Maps → Open "CV Sprite Lane" (GM/localhost).
3. Inspect the SVG: `document.querySelectorAll('g.placed-item')` returns titles `["table (9,3)"]` only. The cauldron has **zero** DOM: no `<image>`, no `<use href="#cauldron">`, no `.item-hit-area` (verified live: titles list + hit-area count).
4. Right-click where the cauldron should be (cell 3,3): nothing (no hit area to receive `contextmenu`). The row is untouchable — cannot be Deleted/Hidden/Rotated from the editor.
5. Click **View map in 3D**: status bar reads `0 walls · 2 items · 0 players · 0 npcs` for a scene that renders 1 prop — the ghost inflates the count; nothing renders at its cell.
6. (AI-Dress face, not re-run live this session): instruct AI Dress "add a cauldron at 3,3" — `dressMap.js` `addPlacedItem` (line ~141) accepts any non-empty `item.type` and lands the same invisible row (`type` is a free string per playbook §185).

## Expected behavior

Either a visible placeholder (the `itemSprites.js` module comment promises: "Unknown/legacy type ids … fall back to the inline SVG symbols in Map.jsx `<defs>`" — a generic symbol + hit area would satisfy this), or the write lanes reject unknown types with a clear error. In all cases the marker should be selectable so the GM can fix or delete it, and the 3D item count should match what renders.

## Actual behavior

Silently dropped from both render lanes with zero console errors/warnings and zero failed network requests; persisted on disk; counted in the 3D status bar; unreachable by every item context-menu action (Hide/Delete/Rotate/door toggle) because those ride the marker's hit area which is never rendered.

## Likely location

- `src/components/map/PlacedItems.jsx` — the fixed dispatch at the bottom (`renderItems('altar', …)` … `renderItems('web', …)`, 24 hardcoded types). Unknown types never reach `renderProp`, so its `<use href={`#${item.type}`}>` fallback branch (line ~98) is dead code for them, and no `#cauldron`-class symbol exists in `Map.jsx` `<defs>` anyway (defs carry only the 22 registered types).
- `src/components/map/Map3D/map3dScene.js` `getAssetUrl(`${type}.glb`)` returns nothing for unknown types → silently skipped; `src/components/map/Map3D/Map3D.jsx:103-111` counts all non-token rows regardless of renderability.
- Write lanes that permit it: `server/services/ai/authoring/dressMap.js` `addPlacedItem` (non-empty check only), `server/routes/maps.js` POST/PUT (no item-type allowlist — confirmed the create POST accepted `cauldron`).

Confidence: high on the client dispatch behavior (direct DOM proof + code read); medium on the AI-Dress face being hit in practice (prompt lists "chest, trap, torch, door, furniture…" so invented props like "rug"/"cauldron" are plausible for a non-compliant model).

## Suggested fix

Pick one contract and enforce at both ends:
1. Cheapest honest fix — generic fallback: in `PlacedItems.jsx`, append a final `renderItems` pass over `placedItems.filter(i => !KNOWN_TYPES.has(i.type) && !isToken(i.type))` using a "?" placeholder symbol (add one def in `Map.jsx`) + normal hit area, and in `map3dScene` a default box mesh (or exclude ghosts from the count and dim-warn). This keeps old/AI-authored rows recoverable.
2. Or server-side allowlist in `dressMap.js` `addPlacedItem` (refuse `op.item.type` not in the item registry, error message like the existing "needs item.type (chest, trap…)"), plus maps PUT/POST validation for indoor `placedItems[].type`.
3. Fix the `itemSprites.js` comment either way (it currently promises a fallback that the dispatcher prevents from ever running).
Start by reading `PlacedItems.jsx` (dispatch tail) and `Map3D/Map3D.jsx` counts.

## Severity

Data integrity risk (minor-to-moderate): silent, persistent, UI-unrecoverable rows created by an app-sanctioned lane (AI-Dress) with zero feedback, plus a lying status-bar count. No crash, but GM-authored content can be permanently invisible in the shared view.
