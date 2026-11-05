# Indoor Item Sprite Overhaul — Sidecar State (2026-11-05)

Goal: same treatment as outdoor POIs (commit 99f50d223) for the 23 indoor
placed-item types. 2D map currently renders inline SVG `<use>` symbols;
replace with Blender top-down transparent PNG sprites, style-matched to the
3D view by rendering the EXISTING GLBs from src/assets/3d-map/*.glb.

## Pipeline (mirrors tmp-qa/poi-plan.md)
1. Code wiring (safe before sprites exist — registry returns null → SVG fallback):
   - src/services/maps/itemSprites.js — registry `itemSpriteHref(type)` → /images/items/<type>.png
   - PlacedItems.jsx — sprite `<image>` path + SVG `<use>` fallback; keep hit areas,
     drag highlight, fog/hidden opacity, rotation, wide-item footprints
   - ItemsPanel.jsx — palette thumbnails use PNG when available
   - update tests pinning `use[href="#type"]` → image lane
2. Blender: import each GLB, normalize scale, top-down ortho camera, transparent
   film, sun+fill lighting, EEVEE render 288px (wide items 2:1) →
   /Users/paulgilchrist/Source/dnd-campaign-suite/tmp-qa/items/*.png
   → copy to public/images/items/<type>.png
3. Rig: tmp-qa/item-demo-map.mjs — indoor demo map in test-campaign with one of
   every item type (API POST /api/campaigns/test-campaign/maps).
4. Playwright: screenshot 2D map (localhost:80 or :5173), iterate lighting/models
   until great; spot-check 3D view still fine.
5. npm run lint && npm run test:run && node .opencode/plans/no-timers-guard.mjs

## Constraints
- Only test-campaign may be written to.
- Working Blender scene is fresh (default cube) — last session's poi_assets.blend
  is in tmp-qa/poi_assets.blend if style reference needed.
- Item types (23): altar arrowSlitWall barrel bed bookshelf boulder bush chair
  chest crate door firepit fountain pillar secretDoor skeleton stairs statue
  table torch trap tree web (+npc/monster tokens stay as-is).
- Rotation rotates the sprite about the footprint center (pure top-down = valid).

## Status
- [x] code wiring
- [x] lint/tests green (fallback lane) — 93 files/1118 map+maps tests, full suite 33604 pass, guard ok
- [x] Blender batch renders (23 sprites -> public/images/items/, 18° tilt; walls 40-52°)
- [x] demo rig: test-campaign map "Item Showcase" (slug item-showcase) all 23 types
- [x] GLB re-export + TEXTURE BAKE FIX: glTF drops procedural base colors -> grey;
      bake_procedural() joins per material, smart-UV, Cycles diffuse-COLOR bake to
      256px PNG, wires baseColorTexture BEFORE export. Flame renamed lowercase
      'flame' so map3dScene.js torch texture swap matches.
- [x] Playwright 2D + palette + 3D re-verify: no grey fallbacks
- Build scripts: tmp-qa/build_item_sprites.py (canonical), _sprites2.py (chunked
  BUILDERS dict via GLB_QUEUE env for batch runs), contact_sheet_blender.py
- Originals backup: tmp-qa/items/glb-originals/
