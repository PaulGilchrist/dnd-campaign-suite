# Bug: Map Regenerate silently destroys GM-placed tokens/props while the confirm dialog promises "tokens stay"

## Summary

The MapsManager per-row **Regenerate** control (newly surfaced for stamped rows since `62998a1df` render-only-when-stamped doctrine) opens a DeleteConfirmModal whose copy states: **"Names, description and tokens stay — the generated layout (and any hand-edits to it) is replaced. This cannot be undone."** But for dungeon modes (`bsp`/`adjacent`) the lane replaces `placedItems` wholesale — and `placedItems` is exactly the layer that holds GM-placed monster/item tokens (quick-spawn stamped tokens and hand-placed props). A token the GM placed on the map is silently destroyed, directly contrary to the promise shown in the "cannot be undone" confirmation the GM just clicked. Only `players[]` party tokens actually stay.

## Steps to reproduce

1. In `qa-starter` (or any sandbox campaign), open **Maps** → **Generate Dungeon** → name `ZZGen Keep`, default BSP options → **Generate**. The row gains a stamped, enabled **Regenerate** button ("Generated with: Mode: BSP Dungeon · Seed: … · Grid size: 30 · Density: 50%" tooltip).
2. Place a token on the map via the API-equivalent of any GM token lane: `GET /api/campaigns/qa-starter/maps/zzgen-keep.json`, append to `placedItems` an entry `{ id: 'zzz-token-1', type: 'npc', name: 'ZZZ Carrier', x: 3, y: 3 }`, `PUT` the same document (200 "Map saved successfully"). GET confirms the token exists.
3. Also append a party token to `players[]`: `{ id: 'zzz-party-1', name: 'ZZZ Party', x: 5, y: 5 }`, PUT (200).
4. In MapsManager click the row's **Regenerate** → read the confirm copy → **Yes, Regenerate**.
5. `GET /api/campaigns/qa-starter/maps/zzgen-keep.json` again.

## Expected behavior

Per the confirm dialog's own copy, tokens stay. At minimum, hand-added/foreign `placedItems` entries (anything not produced by the generator, e.g. quick-spawn stamped tokens `quick-spawn-goblin-*`, manual tokens `manual-*`, GM-added props) should survive — the dialog explicitly promises it.

## Actual behavior

After Regenerate the document's `placedItems` is the freshly regenerated generator prop set (60 items: 16 torch, 7 trap, 7 npc …) — the hand-placed `ZZZ Carrier` npc token is **gone**, with zero warning or feedback (success path stays silent, the only log row reads "Map regenerated from recorded options: …"). The `ZZZ Party` token in `players[]` **did** survive. Live-proved 2026-11-23 (run ZC) on `qa-starter` with the disk GETs as evidence.

## Likely location

Confident (code-grounded, not a guess): `src/services/maps/regenerateMap.js`

- `LAYOUT_FIELDS_BY_MODE` (lines 29–33): `bsp: ['gridSize', 'walls', 'placedItems']` and `adjacent: [..., 'placedItems', ...]` — `buildRegeneratedDocument` copies the generated `placedItems` VERBATIM over the current doc, so every hand-added placedItem is dropped.
- The file's own comment (lines 27–28) says the excluded fields keep "its authored label, blurb and tokens" — the author equated "tokens" with `players[]`, but the app's GM-facing token layer includes `placedItems` (QuickMonsterSpawn "Place a token" stamps `placedItems`; the item/NPC token context menus ride the same array).
- The contradicting copy is `RegenerateMapModal` in `src/components/maps-manager/MapsManager.jsx` ("Names, description and tokens stay …").
- `MapsManager.regenerate.test.jsx` greps zero for `placedItems`/`players`/`tokens stay` — the seam is unpinned in both directions.

## Suggested fix

Pick ONE honest face (owner call):

- **Fix the copy** (smallest change): the dialog should say "Names, description and party tokens stay — the generated layout, props and monster/item tokens are replaced (and any hand-edits)." Update `RegenerateMapModal` and pin it in `MapsManager.regenerate.test.jsx`.
- **Or honour the copy**: in `buildRegeneratedDocument`, keep current `placedItems` entries whose `id` is not in the freshly generated id set (i.e. replace only generator-authored items, preserve foreign/hand-placed ones). The generator ids are deterministic (`torch-<n>-<x>-<y>` style), so a by-id exclude of generated ids + keep-set of the rest is straightforward.

Either way, add a test pinning the promise against both token arrays (one `players[]` token + one foreign `placedItems` token through a regenerate).

## Severity

Data integrity risk — a "cannot be undone" confirmation whose stated preservation guarantee is false; GMs who stamped monster tokens via Quick-Spawn or hand-dressed a dungeon lose that placement silently on one Regenerate click.
