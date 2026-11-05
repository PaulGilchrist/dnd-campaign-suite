# POI Realism Overhaul — Plan

1. **Blender**: build 9 detailed POI models (camp, city, dungeon, hazard, landmark, loreSite, naturalWonder, settlement, tower) with materials + lighting.
2. **Sprites**: render isometric transparent PNGs → `public/images/pois/<type>.png`.
3. **Models**: export GLBs → `public/models/pois/<type>.glb`.
4. **2D**: POILayer.jsx renders sprite `<image>` instead of flat SVG `<use>`.
5. **3D**: hex3dScene.js loads GLBs via GLTFLoader, falls back to poiShapeSpec primitives.
6. **Rig**: generate demo hex map in test-campaign with one POI per type.
7. **Playwright**: screenshot 2D + 3D views, iterate until great.
8. lint + test:run + guard:no-timers.

Baseline fingerprint: test-campaign maps = battle-arena.json, test-map.json (both indoor). Demo map is additive.
