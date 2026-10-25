# Placed-token rename renames EVERY same-named token (name-matched, id ignored)

## Summary
Renaming a placed map token via the contextmenu → Rename popover matches items by `item.name === oldName` and rewrites all matching placedItems, so duplicate-named tokens (the default — every palette NPC lands unnamed and displays/defaults as "NPC") are all renamed together, persisting to disk.

## Steps to reproduce
1. In test-campaign, open Maps → Battle Arena (Open).
2. From the Items palette, drag the `NPC` entry onto three different cells (e.g. grid (12,8), (15,8), (18,8)) — synthetic `DragEvent('npc')` with `dataTransfer 'text/plain':'npc'` works; each token displays "NPC".
3. Right-click ONE token (e.g. at (12,8)) → `Rename` → popover input pre-filled "NPC" → type a unique name `QA Solo Rename` → press Enter.
4. Wait ~10s (map PUT autosave) and GET `/api/campaigns/test-campaign/maps/battle-arena`.

## Expected behavior
Only the right-clicked token (single, stable `id` — e.g. `1d596968-…`) is renamed; the other two keep name "NPC".

## Actual behavior
ALL THREE tokens change to "QA Solo Rename" immediately in the SVG (all `g.npc-group` labels) and on disk:
`placedItems = [{gridX:12,name:'QA Solo Rename',id:'1d596968…'},{gridX:15,…same…},{gridX:18,…same…}]`.
No console errors, no failed network requests. First observed accidentally: renamed one of two "NPC 1" tokens and BOTH changed.

## Likely location
CONFIDENT: `src/components/map/Map.jsx:307-318 handleRenameItem` — `prev.map(item => item.name === oldName ? {...item, name: newName} : item)`. The rename popover payload carries only NAMES (`ItemContextMenu.jsx:67` dispatches `onRenameClicked(e, selectedItem, item?.name || 'NPC')`; `Map.jsx:362-375 handleRenameClicked` stores `renamePopover {itemName, name}`), so the stable `selectedItem.id` available at the menu is dropped before commit.

## Suggested fix
Thread the item `id` through: pass `item.id` (or the whole selectedItem) into `handleRenameClicked`/`renamePopover`, and in `handleRenameItem` filter `item.id === id` instead of name-matching. Keep the name-based `setNpcImages` reset keyed off the resolved item's old name. Check `Map-context-menus.test.jsx` "Enter commits the new name to that NPC only" — its fixture likely has unique names, which is why the unit test passes; add a duplicate-name regression case.

## Severity
Data integrity risk — a bulk silent mutation of user-placed map data from a single-token edit; also collides with the L5-003 zones/LoS lanes that resolve combatants by token NAME.

## Resolution
FIXED 2026-10-25.

**Root cause** — confirmed exactly as diagnosed in this file: `Map.jsx handleRenameItem` matched `item.name === oldName`, and the rename popover payload dropped the stable `id` (only names were threaded from `ItemContextMenu` → `handleRenameClicked` → `renamePopover` → commit). Every same-named placedItem was rewritten and persisted.

**Fix (files changed):**
- `src/components/map/Map.jsx`
  - `handleRenameClicked` now stores `renamePopover = { id: item.id, name, position }` (the `itemName` name-bridge is gone; `selectedItem.id` was already available at the menu).
  - `handleRenameItem(id, newName)` filters `item.id === id` — mirrors the sibling id-matched contextmenu ops (`handleDeleteItem`/`handleRotate`/`handleToggleItemVisibility`, which already take `selectedItem.id`). Blank-name guard unchanged; the `setNpcImages` reset stays keyed on the NEW name (byte-identical behavior — clears any image cached under that name so the renamed token never inherits a stale portrait).
- `src/components/map/Map-context-menus.test.jsx` — added regression test *"Rename with duplicate names: Enter commits only to the right-clicked token id"*: three placedItems sharing name `'NPC'` with distinct ids; renaming the middle one asserts `[npc-1:'NPC', npc-2:'QA Solo Rename', npc-3:'NPC']` plus popover unmount. The pre-existing unique-name test ("Enter commits the new name to that NPC only") still passes unchanged — its `Goblin`/`Bogey` fixture is why the defect slipped through.

**Sibling audit:** no other name-matched placedItem mutation exists in `src/components/map/` (`delete`/`rotate`/`visibility`/`door` are all id-based; `useMapDrops`'s name check is an intentional PC double-place guard). Out-of-scope note: the click-select dock still labels every unnamed token "NPC" (filed separately in the app-exploration backlog — pairs with this fix but not changed here).

**Verification:**
- Live repro pre-fix (Playwright, test-campaign → Battle Arena): dropped 3 palette NPCs at (12,8)/(15,8)/(18,8), right-clicked (12,8) → Rename → `QA Solo Rename` + Enter → ALL three SVG labels changed and disk GET showed all three `placedItems.name = 'QA Solo Rename'` (distinct ids) — bug confirmed.
- Live re-verify post-fix (same steps): ONLY the (12,8) token displays/persists `QA Solo Rename`; (15,8) and (18,8) keep `"NPC"` on disk after the ~10s autosave debounce. Exact expected behavior.
- Adjacent flow sanity: contextmenu Delete on the (15,8) "NPC" fired `Delete "NPC" from the map?` and removed exactly that one token (disk placedItems 3→2).
- Tests: `npx vitest run src/components/map/Map-context-menus.test.jsx` 6/6 pass; `npx vitest run src/components/map` 59 files / 663 tests pass; full `npx vitest run` 2802 files, 31262 pass / 3 expected-fail, exit 0; `npm run lint` clean (zero warnings).
- Cleanup: Battle Arena restored to baseline via GM `PUT /maps/battle-arena` (verbatim baseline doc: placedItems [], name "Battle Arena", players AS@15,9/FR@9,8/EF@1,8, walls [], revealed 400); Admin Clear Change Data (`change-data` → `{}`) + Clear Campaign Log (`log` → `[]`) GET-verified; campaign folders back to the 5 baseline names.

