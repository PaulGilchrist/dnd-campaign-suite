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

## Resolution

**FIXED 2026-11-05.** Reproduced live in test-campaign (dev pair on localhost): POSTed the sandbox map with the `cauldron` ghost row, opened it as GM — `g.placed-item` titles were `["table (9,3)"]` only, `.item-hit-area` count 1, zero `<use>`: the ghost had no DOM and no context-menu affordance, exactly as described.

**What was actually wrong** (vs the original guess): the 2D diagnosis was exact — `PlacedItems.jsx` ends in a 24-type whitelist dispatch, so unknown types never reach `renderProp`, whose `<use href={#${item.type}}>` fallback resolved to a non-existent symbol anyway. The **3D face did not reproduce**: `map3dScene._buildPlacedItems` already falls back to a grey `_fallbackBox` when `getAssetUrl('type.glb')` is null, so the ghost DOES render in 3D and the status-bar count was honest ("2 items" for 2 visible meshes — grey box + table, screenshot-verified). Only the 2D lane silently dropped the row.

**Fix (option 1 of the suggested plan — generic fallback, kept recoverable):**
- `src/components/map/GenericPropSVG.jsx` — NEW shared "?" placeholder def (dashed rounded chip + glyph), follows the sibling `*SVG.jsx` def pattern.
- `src/components/map/Map.jsx` — mounts it in `<defs>` as `#generic-prop` (after `bush`, before the POI landmark).
- `src/components/map/PlacedItems.jsx` — (a) final dispatch pass renders every non-whitelisted row through `renderProp` with default opts (single cell, non-rotatable); (b) `renderProp`'s `<use>` fallback now points at `#generic-prop` (the per-type symbol only ever existed for art-backed types — dead href before). Ghosts inherit the full shared law: fog/hidden visibility, GM dim, drag + right-click hit areas → Hide/Delete/Rotate reachable.
- `src/services/maps/itemSprites.js` — module comment corrected (it promised an unreachable per-type `<defs>` fallback; now describes the actual placeholder lane).
- Write lanes left permissive by design (server accept + client render) so existing/AI-authored rows become recoverable rather than erroring — matches "a visible placeholder + selectable" branch of the Expected.

**Verification:**
- Live repro steps re-run post-fix: titles `["table (9,3)","cauldron (3,3)"]`, `use[href="#generic-prop"]`, hit-area count 2, def mounted in defs. Right-click at (3,3) opened the menu (Hide/Delete/Rotate/✕); Delete → `Delete "cauldron (3,3)" from the map?` dialog → Yes, Delete removed the marker AND persisted (disk GET 12 s later shows only `cv-table`). 3D: `2 items` with grey box + table both rendering.
- New tests (all pass): `PlacedItems.unknown-type.test.jsx` (8 — ghost marker/title/hit-area/context-menu/drag wiring, hidden+fogged LAN law, legacy `token` rows, registered types never touch the placeholder), `Map.unknown-item.test.jsx` (2 — container seam: placeholder + def on the live board, Delete→dialog→autosave PUT carries the filtered array), `GenericPropSVG.test.jsx` (3 — def census/byte pins, sibling `*SVG.test` pattern).
- `npx vitest run src/components/map src/services/maps`: 96 files / 1131 tests pass (after updating the golden defs-census pin in `Map.test.jsx` T3 to include `generic-prop` — an intentional contract change).
- `npm run lint`: clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs`: OK.
- Cleanup: scratch map "CV Sprite Lane" deleted (maps back to the 4 baseline rows), change-data + campaign log cleared via Admin.

