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

## Resolution
FIXED 2026-11-16 (fix run). Diagnosis confirmed as filed: the open-focus + rove machinery was file-local to `ItemContextMenu.jsx` and the hex menu never adopted it.

**What changed** — lifted the indoor tier into the shared seam exactly as suggested:
- NEW `src/hooks/ui/useMenuRoving.js` — `NAV_DIRECTIONS` + `focusMenuRow` extracted verbatim from the indoor twin, plus the open-focus effect. Signature `useMenuRoving(menuRef, openKey)`: focus lands on the first `[role=menuitem]` whenever `openKey` turns truthy (hosts pass `null` while a lane owns focus itself), and the returned root `onKeyDown` handler does Arrow/Home/End rove with wrap + `preventDefault`. Two additions beyond the indoor original: (1) an inline `.context-menu-input` guard so arrows/Home/End keep native caret movement inside the hex rename editor (indoor has no input — guard is a no-op there); (2) rows are re-queried on every keydown, so the link-picker commit face and the indoor Hide↔Show label flip rove the live row set (the behavior difference the bug file flagged).
- `src/components/map/ItemContextMenu.jsx` — refactored onto the hook (local machinery deleted; Escape window listener + zero-write laws untouched; open-focus now keyed on `id:menuX:menuY` instead of riding the Escape effect's deps).
- `src/components/hex-map/POIContextMenu.jsx` — `menuRef` + hook wired on `g.poi-context-menu` (`ref` + `onKeyDown`); `openKey` nulls while `showRename` is armed so the rename input's autoFocus is never stolen. Activation (Enter/Space via `MenuOption`) and Escape dismissal unchanged. Stale comment corrected (the rename-input Escape face shipped 2026-11-13).

**Regression test** — NEW `src/components/hex-map/POIContextMenu.keyboard.test.jsx` (11 tests), mirroring `ItemContextMenu.keyboard.test.jsx` faces: focus-into-first on open/reopen, ArrowDown/Up walk + wrap both ends, ArrowRight/Left + Home/End, root-focus start-at-top, `preventDefault` (no page scroll), rove re-query after link-picker open, Enter-after-rove dispatch, and the rename-editor focus-preservation face (editor keeps focus; arrows/Home/End inside the input are NOT preventDefault-ed).

**Results** — `npx vitest run` new test 11/11; touched folders (`src/components/hex-map` + `src/components/map` + `src/hooks/ui`) 156 files / 1678 tests all green; `npm run lint` zero warnings; `no-timers-guard` OK.

**Live re-verification (Playwright, test-campaign, dev pair on :5173):** pre-focused `BUTTON.sidebar-section-header`, trusted right-click on an in-view POI of poi-showcase → 5 rows mount and `activeElement` = `Hide` inside `g.poi-context-menu` (was: focus stayed on the sidebar button). Trusted key walk: ArrowDown→Rename, ArrowDown→Link to Map..., Home→Hide, End→✕, ArrowDown wraps→Hide, ArrowUp wraps→✕; Escape dismisses zero-write. Previously-passing legs re-proven: Enter on a roved-to Rename opens the editor pre-filled ("The Watcher Stone") with focus in the input (not stolen), typed draft + Escape reverts-and-closes (label unchanged, zero writes), End+Enter on ✕ closes, picker-open Enter then ArrowDown lands on the first map row. Indoor twin re-lived on item-showcase after the hook refactor: open→Hide focus, ArrowDown→Delete, Home/End, wraps, Escape close — unchanged. Console 0 errors. Exit hygiene: headless Admin clear GET-verified `change-data {}` + `log []`; all 4 map md5 pins byte-exact (94fcd0bf/8e40779e/860eda23/7561e4bf — no POI hidden/renamed/deleted left behind).

