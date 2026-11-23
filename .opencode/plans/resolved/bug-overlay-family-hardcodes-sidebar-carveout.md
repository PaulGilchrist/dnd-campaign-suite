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

## Resolution

FIXED 2026-11-23 (fix-run subagent). Diagnosis confirmed — a pure CSS pairing miss — with two corrections against the file’s guess: (1) `App.css` had moved on since the file was written: the 768px lane now releases `.app-body` to a **36px toggle column** (`padding-left: 36px`, not 0) — the column is drawer furniture, so overlays still correctly release the FULL carve-out; (2) the real census is **13** overlay CSS files (the summary said twelve): the four char-sheet modals, Save/DeathSave/Concentration/ConditionChoice prompts, `popup.css`, `DiceTray.css`, `AllySelectionModal` rides `.sp-overlay` (no own hardcode), plus `left: 180px; right: 0` siblings `QuickMonsterSpawn.css`, `EffectAdder.css`, `MonsterCardModal.css`. `Log.css:188` (`calc(100vh - 180px)`) is a vertical height budget — unrelated, untouched.

Fix — the suggested single-token law, living in `App.css` next to the dock rule it shares a breakpoint with:
- `src/App.css`: `:root { --sidebar-w: 180px; }`; the existing `@media (max-width: 768px)` block now also sets `:root { --sidebar-w: 0px; }`; `.app-body` padding-left rides `var(--sidebar-w)`. No per-component duplicate media queries.
- 13 overlay CSS files (all listed above): `left: 180px` → `left: var(--sidebar-w)`; `width: calc(100vw - 180px)` → `width: calc(100vw - var(--sidebar-w))` (the ea/qms/mc `right: 0` tiers needed only the `left` swap). Comments-only mentions of the old literal left as history (`popup.css:55` reworded to “pre-token”).

Tests — repo precedent for CSS contract tests is `src/App.css.test.jsx`; extended in place (no new architecture):
- two existing pins migrated with the token: the gutter↔sidebar-width law now asserts `padding-left: var(--sidebar-w)` AND that the `:root` token equals `.sidebar` width; the 768px release law reads the desktop value off the token (was `parseFloat(padding-left)` — would NaN); the var()-definedness hygiene test now also counts tokens declared in App.css’s own `:root`.
- new `describe('fixed-overlay sidebar carve-out …')` with three contracts: token declared 180px + zeroed at the dock breakpoint (with file-order tie-hardening); every listed overlay scrim is `fixed` + `left: var(--sidebar-w)` + `calc(100vw - var(--sidebar-w))`-or-`right: 0`; and a census guard walking EVERY `.css` under `src/` (comments stripped) asserting no `left: 180px` / `calc(100vw - 180px)` literal ever returns.

Verification:
- Repro re-lived BEFORE the fix at 420×800 exactly as filed: `.qms-overlay` fixed `left:180px` box x:180 w:240, `.qms-spawn-btn` right:426.8 (Cancel right:522.2); `.sp-modal` x:114→486 with Cancel x:351.7→439.1 `visX:false` (19px clip).
- Post-fix live on :5173 (HMR-carried source), 420×800: `.qms-overlay` x:0 w:420 (full viewport), `.qms-modal` x:20 w:380, Spawn right:267.9 / Cancel right:363.3 — every button `inWindow:true`; allies modal: overlay x:0 w:420, `.sp-modal` x:24 w:372, Cancel x:261.7→349.1 fully in-window. Desktop control at 1280×800: overlay x:180 w:1100 (carve-out intact), modal centered at x-center 730 = 180+1100/2, all buttons in-window — no regression.
- `npx vitest run src/App.css.test.jsx` 36/36; touched-folders run (`common`/`sidebar`/`initiative`/`encounter`/`char-sheet/modals`) 881 files / 6156 tests green; `npm run lint` clean (zero warnings).
- Closeout: browser closed, `POST /admin/clear-change-data` restored the `{}` baseline (mount-merge bake only; log was `[]` and overlays `[]` throughout — the repro wrote no log/overlay/game state).

