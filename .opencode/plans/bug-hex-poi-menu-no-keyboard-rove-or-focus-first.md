# Outdoor hex-POI context menu never adopted the indoor menu's keyboard tier (no focus-into-first, no Arrow/Home/End rove)

## Summary
`77ef39387` (improve item-context-menu-a11y) shipped the full ARIA menu keyboard tier — open-focuses the first entry, Arrow/Home/End rove with wrap — but only inside the INDOOR placed-item menu (`src/components/map/ItemContextMenu.jsx`). The outdoor hex POI menu (`src/components/hex-map/POIContextMenu.jsx`), which shares the same `role=menu` + `MenuOption` rows and the Escape-dismiss window listener, has NO focus-into-first and NO arrow/Home/End rove. A `role=menu` widget that promises arrow-key navigation to assistive tech does not honor it outdoors; the two sibling menus behave differently for no stated reason.

## Steps to reproduce
Starting state: `test-campaign`, GM tab on localhost.

1. Maps → Open "POI Showcase" (the outdoor hex fixture). Wait for the board (~4 s; 9 `g.poi-item` render).
2. Right-click a POI (trusted right-click on `rect.placed-hit-area`, or a bubbling `contextmenu` MouseEvent dispatch on it). The `g.poi-context-menu[role=menu]` mounts with 5 `g[role=menuitem][tabindex=0]` rows: Hide / Rename / Link to Map... / Delete / ✕.
3. Immediately probe `document.activeElement`.
   - EXPECTED (indoor twin + the PT#2 expectation): focus lands inside the menu (first menuitem).
   - ACTUAL: focus stays wherever it was (live witness: `BUTTON.sidebar-section-header active`).
4. Focus the first menuitem (`Hide`) — e.g. Tab or `.focus()` — then press ArrowDown.
   - EXPECTED: focus moves to Rename (indoor twin roves and wraps).
   - ACTUAL: focus stays on `Hide` — ArrowDown does nothing (and Home/End likewise; the page may scroll natively instead).
5. Control (indoor twin): open the indoor editor (e.g. "Battle Arena" → Edit), right-click a placed item — there the menu DOES focus-into-first and ArrowDown/ArrowUp/Home/End rove with wrap (live-verified by runs XD and XF).

Legs that DO pass outdoors (shared seam works): Enter and Space activate the focused row (Rename editor opened, label pre-filled, autoFocus); Escape with focus on a menuitem / on the body behind the menu dismisses zero-write; Escape inside the rename input reverts-and-closes (typed draft dropped, label unchanged); Enter on the ✕ row closes.

## Expected behavior
Both SVG context menus meet the same keyboard contract they advertise via `role=menu`: opening moves focus into the first entry, Arrow/Home/End rove among menuitems, Escape dismisses, Enter/Space activate.

## Actual behavior
Outdoors, keyboard users must Tab through exactly 5 focusable `g[role=menuitem]` nodes one by one (no wrap/jump), opening leaves focus outside the menu entirely (so an AT announces the menu but arrow keys dead-end), and Home/End are dead. No errors; purely inert keys.

## Likely location
Confident from code + live: the rove machinery (`NAV_DIRECTIONS`, `focusMenuRow`, the open-focus effect) lives file-local in `src/components/map/ItemContextMenu.jsx:73-160` and was never extracted alongside `MenuOption.jsx`; `src/components/hex-map/POIContextMenu.jsx` only mounts `MenuOption` rows (+ its window Escape listener). `MenuOption.jsx` itself is explicitly "menu-level Escape DISMISS is the host menu's job" — and host-level ROVE was never the host-independent piece it could be.

## Suggested fix
Lift the indoor tier into the shared seam: a small `useMenuRoving(menuRef)` hook (or wrap `POIContextMenu`'s `g.poi-context-menu` in the same pattern) that (1) on mount focuses the first `g[role=menuitem]`, (2) on keydown within the menu root handles ArrowUp/Down/Left/Right with wrap + Home/End, `preventDefault` to stop page scroll, (3) leave activation (Enter/Space) and Escape with `MenuOption`/the existing window listener. Mirror the indoor test `ItemContextMenu.keyboard.test.jsx` for the hex twin (the 293 lines of indoor pins give the exact expectation set). Watch the one behavior difference: the indoor visibility toggle keeps the menu open (label flips Hide↔Show) while the hex lane closes it — the rove hook must re-query rows after each commit face.

## Severity
Minor UX issue (accessibility-contract break) — the menu remains usable via Tab+Enter and mouse, but `role=menu` actively promises arrow rove that isn't implemented, and the two sibling menus silently diverge. Confirmed live (run XF 2026-11-16) plus file-local code census.
