# Fixed-overlay family hard-codes `left: 180px` — with the collapsible sidebar docked (≤767px) scrims sit 180px off-screen and modal buttons clip past the right edge

### Summary
`cb8df0f89` (collapsible sidebar) docks the sidebar off-canvas below 768px and zeroes the App content padding, but the fixed-position overlay CSS family still hard-codes the old sidebar carve-out (`left: 180px; width: calc(100vw - 180px)`). At narrow widths every overlay loses 180px it no longer needs: the scrim leaves an 180px dead strip on the left, the centered modal is shoved right, and footer buttons clip off the right edge. Two faces measured live at 420×800; twelve CSS files carry the pattern.

### Steps to reproduce
1. `test-campaign` (or any campaign) on a localhost tab; resize the window/viewport to 420×800 (`browser_resize` / `page.setViewportSize`).
2. Go to Initiative.
3. Click `+ Monster` (Quick Monster Spawn).
   - Measured: `.qms-overlay` = `position: fixed; left: 180px` → box `x:180 w:240` (the scrim covers only the right 240px of the 420px viewport; the left 180px strip stays uncovered/click-through).
   - `.qms-modal` collapses to `w:200` at x:200, and `.qms-spawn-btn` ends at `right: 427` — 7px past the 420px window (partially clipped).
4. Close the picker. Click a card’s `Edit allies of <Name>` button.
   - Measured: `.sp-modal` card spans `x:114 → right:486` (66px past the viewport, despite `max-width:480px`); the `Cancel` button spans `x:352 → right:439` — `visX:false`, 19px clipped off the right edge (only partially clickable). The `Confirm Allies (N)` button and list survive, but the layout is visibly shoved out of frame.
5. Escape on the AllySelectionModal is inert (dismiss is Cancel-button only) — so there is no keyboard escape from the clipped modal.

No console errors, no failed requests at any step — pure CSS pairing miss.

### Expected behavior
Below the 768px dock breakpoint, fixed overlays should cover the whole viewport (`left: 0; width: 100vw`) since the sidebar is out of flow (`position: fixed; transform`-docked) and `App.css` already zeroes its own 180px padding at that breakpoint. Modals should center within the viewport and every footer button should be fully in-window (this is the same bar 79d8ccbb9/0a83fb59c set for toolbars: docSW == innerWidth, controls reachable).

### Actual behavior
Overlays keep the pre-dock carve-out: scrim starts 180px into a 420px window, content gets 240px of usable width, and right-anchored controls clip past 100vw.

### Likely location
Confident. Grep census of `left: 180px` / `left:180px` with NO `768px` media override in the same file:
- `src/components/common/SavePromptModal.css:1-5` — `.sp-overlay { position: fixed; left: 180px; width: calc(100vw - 180px); }` (also Save prompts, Death saves via `DeathSavePromptModal.css`, Concentration, ConditionChoice, `AllySelectionModal.css`)
- `src/components/initiative/QuickMonsterSpawn.css` (`.qms-overlay`)
- `src/components/initiative/EffectAdder.css`
- `src/components/encounter/MonsterCardModal.css`
- `src/components/sidebar/DiceTray.css`
- `src/components/common/popup.css` (`.popup-overlay` attack popups — the only “768” hit is a comment at :55, not an override)
- `src/components/char-sheet/modals/CircleOfTheLandSpellsModal.css`, `ResourcePoolModal.css`, `NaturalRecoveryModal.css`, `FontOfMagicModal.css`
`App.css:10` (content `padding-left:180px`) DOES have the narrow-screen lane (its 768px rules landed with cb8df0f89) — the overlay family was simply missed in that sweep.

### Suggested fix
Introduce a single token, e.g. `:root { --sidebar-w: 180px; } @media (max-width: 767px) { :root { --sidebar-w: 0px; } }`, and replace every hard-coded `left: 180px` / `calc(100vw - 180px)` in the files above with `var(--sidebar-w)` / `calc(100vw - var(--sidebar-w))`. (The `App.css` breakpoint already owns the dock law, so it stays the single pairing point — no duplicate media queries per component.) While in `AllySelectionModal.css`, note the missing Escape lane is a separate dismiss question (see exploration map, create-family dismiss law).

### Severity
Minor UX issue — nothing corrupts data and the GM can widen the window, but on the app’s own supported 420px GM tier every combat adjudication overlay (save prompts, death saves, quick-spawn, allies, attack popups) renders off-frame with clipped buttons, and the non-covering scrim breaks the modal contract (board clicks land beside it).
