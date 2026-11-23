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

## Resolution

FIXED 2026-11-23 (fix subagent, orchestrator-directed face: HONOUR the copy, do not weaken it).

**What was actually wrong** (confirmed, matching the diagnosis in "Likely location"):
`buildRegeneratedDocument` in `src/services/maps/regenerateMap.js` copied the freshly
generated `placedItems` VERBATIM over the current document for `bsp`/`adjacent` modes
(`LAYOUT_FIELDS_BY_MODE`), destroying every GM-placed token that rides that array —
Quick-Spawn stamps (`quick-spawn-<slug>-<x>-<y>`, `spawnTokenPlacement.js`), hand-dropped
items (`utils.guid()` ids, `useMapDrops.js`) and manual tokens alike — while the
DeleteConfirmModal copy the GM had just clicked promised "Names, description and tokens
stay … This cannot be undone." Only `players[]` party tokens actually stayed.

**Fix implemented** — `src/services/maps/regenerateMap.js`: a new
`mergeRegeneratedPlacedItems(currentItems, generatedItems)` id-merge, mirrored on the
token-art orphan-prune keep-set law in `server/routes/maps.js` (preservation computed by
id-set membership, never array wholesale). `buildRegeneratedDocument` now routes the
`placedItems` field through it: each fresh generated entry wins over a same-id current
entry (so hand-moved/deleted generator props REVERT — "any hand-edits to it is replaced"
stays true), and every current entry whose id the generator never authored survives
verbatim. Generator ids are deterministic prefixed forms (`torch-<room>-<x>-<y>`,
`npc-<n>`, `door-<n>`, …) and foreign ids are `quick-spawn-*`/guid forms, so the two
sets cannot collide. Terrain mode is untouched (its LAYOUT_FIELDS never included
placedItems). The dialog copy needed no change — the fix makes it honest.

**Regression tests** (promise pinned both ways):
- `src/services/maps/regenerateMap.test.js` — new test: a hand-moved generator prop
  (`door-1` at a foreign cell) is replaced by the generated one, while `chair-2-0`
  (id the roll no longer authors), `quick-spawn-goblin-5-4` and `zzz-token-1` survive
  verbatim, and `players[]` still survives; the `buildRegeneratedDocument` purity test
  now also proves the stored `placedItems` array is never mutated.
- `src/components/maps-manager/MapsManager.regenerate.test.jsx` — new test pins the
  confirm-copy promise strings ("Names, description and tokens stay" / "the generated
  layout (and any hand-edits to it) is replaced") so copy and behaviour move together.

**Live verification (test-campaign, :5173, localhost GM):**
- Pre-fix repro re-walked first: `ZZGen Keep` (BSP, seed 1203926556) stamped with
  `zzz-token-1` 'ZZZ Carrier' in `placedItems` + `zzz-party-1` in `players[]` → dialog
  read verbatim "…Names, description and tokens stay — the generated layout (and any
  hand-edits to it) is replaced. This cannot be undone." → confirmed → disk GET proved
  the placedItems token GONE (57→56) while the players token survived. Bug confirmed live.
- Post-fix leg A (`ZZGen Keep`): re-stamped `zzz-token-2` 'ZZZ Carrier 2' + hand-moved
  `torch-0-2-4` (2,4)→(1,1) → Regenerate → GET: `ZZZ Carrier 2` SURVIVED, players token
  survived, the moved torch REVERTED to (2,4), zero duplicate ids, 0 console errors.
- Post-fix leg B (adjacent twin, `ZZGen Keep 2`, seed 402849703): stamped
  `quick-spawn-goblin-3-6` + hand-moved `torch-0-0`→(0,0) → Regenerate → GET: quick-spawn
  token SURVIVED (placedItems 52→53), the torch REVERTED to (19,3), walls regenerate
  cleanly (483), `generationMode: adjacent` intact, no duplicate ids.
- Suites: `npx vitest run` on the two touched files 23/23; touched folders
  `src/services/maps src/components/maps-manager` 40 files / 604 tests all passing;
  `npm run lint` zero warnings.
- Cleanup: both `ZZGen Keep*` maps deleted via MapsManager (maps dir back to the 4
  baseline docs), Admin panel cleared change-data (`{}`) and campaign log (`[]`),
  overlays `[]` baseline held.

