# Session planner modal: Cancel/Save buttons render outside the modal's right edge (clipped at narrow viewports)

**Found:** Explore run FFF, 2026-11-21 (HEAD 4eb3bf503), reported by owner during the same session.

## Summary
In the Sessions planner modal, the footer's left action cluster is wider than the modal's content box, so the `Cancel`/`Save` cluster (`.ct-modal-buttons`) is pushed **completely outside the 520px modal card** onto the page background. At an 800px-wide viewport the `Save` button is additionally clipped by the viewport edge (right edge 829 > 800), and at narrower widths it becomes fully unreachable.

## Steps to reproduce
1. In `test-campaign` (localhost GM tab), open **Sessions** in the sidebar.
2. Click **New Session**, type any name (e.g. `FFF Layout QA`), press **Save**.
3. Click the created session row to re-open the planner modal (the full footer renders: `Delete`, `Refine with AI`, `Mark as Played`, `Set active session`, `Write recap` on the left; `Cancel`, `Save` on the right).
4. Observe: `Cancel` and `Save` sit OUTSIDE the modal card's right border (they float over the page backdrop).
5. Resize the window to ~800px wide: `Save` is now cut off by the window edge. (Measured live via `setViewportSize`.)

Measured bytes (default 1728×997 viewport, modal centered at left=603, right=1125):
- `.ct-modal-footer` rect: left 604 → right 1124 (width 520, content box 480 after 20px padding).
- `.ct-modal-actions` (5 buttons incl. Write recap): left 624 → right 1126 — **502px wide, already wider than the 480px content box**.
- `.ct-modal-buttons` (Cancel+Save): left **1126** → right **1293** — entirely outside the card (168px of overflow).
- At 800×700: modal right = 661, Save spans 745→829 → partly off the viewport.

Control probe (same modal, `Write recap` display:none): actions cluster = 405px, Save right = 1196 → **still ~71px outside the card**. So the footer overflow predates today; `4eb3bf503` (Write recap button) nearly doubled it and made the detachment blatant.

## Expected behavior
All footer buttons stay inside the modal card; the action cluster wraps (or the modal grows) instead of shoving Cancel/Save onto the backdrop. `Save` must never be clipped or unreachable at any resizable window width.

## Actual behavior
`justify-content: space-between` on a `nowrap` 480px-content footer with ~668px of two-child flex content pushes the right cluster beyond the card's right border (`.ct-modal` has no `overflow` clip — the buttons visually escape). Zero console errors; the lane otherwise works (buttons still clickable at wide widths — the recap refusal/active-session legs rode them fine).

## Likely location
Confident (measured via getComputedStyle/getBoundingClientRect live):
- `src/App.css` `.ct-container .ct-modal-footer` (:430) — `display:flex; justify-content:space-between` with no `flex-wrap`, inside `.ct-container .ct-modal` fixed `width: 520px` (:383).
- `src/components/sessions/SessionPlannerModal.jsx` — the footer left cluster `.ct-modal-actions` uniquely stacks 5 action buttons here (Delete / Refine with AI / Mark as Played / Set active session / Write recap); Write recap added by `4eb3bf503` (roadmap Step 8). Other `.ct-modal` consumers (notes/quests/npcs/factions/settlements) carry ≤2-3 action buttons and measure inside the card — the Sessions modal is the overflow face.

## Suggested fix
Give the shared footer a wrapping law: `.ct-container .ct-modal-footer { flex-wrap: wrap; gap: 8px; }` and/or cap the sessions lane's action cluster (`flex-wrap: wrap` on `.ct-modal-actions`, or `max-width: 100%`) so the right cluster is pulled back inside the card at any width. Alternatively (sessions-scoped, safer for other consumers): in `SessionPlannerModal.css`, let the modal widen for this lane (`min(680px, 92vw)`) and wrap `.ct-modal-actions`. Add/extend a `SessionPlannerModal.test.jsx` or the App.css token test to pin that Save's rect stays within the modal's rect at a 520px modal width.

## Severity
Minor UX issue → borderline broken feature at narrow widths: at desktop widths the buttons are ugly-but-usable; at ~800px the primary `Save` is clipped by the viewport edge and smaller windows make it unreachable, stranding edits (data-entry risk, not data corruption).

## Resolution
FIXED 2026-11-21 (e2e-fix subagent run).

**What was actually wrong:** the original diagnosis of the nowrap space-between footer was correct, but the deeper root cause was a **dead CSS rule**: `Sessions.css` already intended a wider planner via `.sessions-modal { width: 720px }` — a single-class selector (0-1-0) that LOSES to the shared `.ct-container .ct-modal { width: 520px }` (0-2-0). The lane's 720px never applied (measured 522px live), and the shared `.ct-modal-footer` had no wrapping law, so ~668px of two-child nowrap flex content overflowed the 480px content box and the modal has no overflow clip — Cancel/Save escaped onto the backdrop.

**Files changed:**
- `src/App.css` — shared footer wrapping law: `.ct-container .ct-modal-footer` gains `flex-wrap: wrap; gap: 8px`; `.ct-container .ct-modal-actions` gains `flex-wrap: wrap` (shrinks below its widest single-line row); `.ct-container .ct-modal-buttons` gains `margin-left: auto` (keeps the right cluster right-aligned even when it wraps alone onto a second row — `space-between` can't). No-op for the ≤2-3-button consumers (notes/quests/npcs/factions/settlements): they still render a single row inside the 520px card.
- `src/components/sessions/Sessions.css` — the planner width law now out-specifies the shared card: `.ct-container .ct-modal.sessions-modal { width: min(720px, 92vw); }` (viewport-capped, so it never exceeds small windows).
- `src/App.css.test.jsx` — two new contract tests pinning the layout laws (jsdom does no layout, so the repo idiom is CSS-text pinning; the file already parses stylesheets into selector→property maps): (1) footer declares `flex-wrap: wrap` + `gap: 8px`, actions cluster declares `flex-wrap: wrap`, buttons cluster declares `margin-left: auto`; (2) Sessions.css must carry the compound `.ct-container .ct-modal.sessions-modal` width rule (not a bare-class override), wider than 520px and vw-capped.

**Verification:**
- Live repro (pre-fix): modal right 1125 vs Cancel/Save spanning 1126→1293, `saveOutsideModal: true`; at 800×700 Save 745→829 clipped by the viewport — byte-exact to the filed measurements.
- Post-fix re-measure (`getBoundingClientRect` on `.ct-modal` + every footer button, `saveOutsideModal = saveRect.right > modalRect.right`):
  - 1728×997: modal 503→1225 (722px, the lane's intended width now applies); all 7 footer buttons `inside: true` (actions cluster wraps its 5th button to a second row, Cancel 1038→1112 / Save 1120→1204 right-aligned inside the card); `saveOutsideModal: false`.
  - 800×700: modal 39→761; Save 656→740 — inside card AND viewport; zero offenders.
  - 640×700: modal 31→609; Save 504→588 — inside card AND viewport; zero offenders.
- Adjacent consumer sanity: Quests editor modal re-opened post-fix — still 522px wide, footer stayed a SINGLE row (no stray wrapping), all 4 buttons inside the card, then closed via Cancel (zero writes; quests md5 untouched).
- Tests: `npx vitest run src/App.css.test.jsx` 21/21 pass; `npx vitest run src/components/sessions` 10 files / 73 tests pass; other App.css-consuming suites (VictoryBanner modal-tier + no-capture, CreatureBadge, MonsterCardModal header-layout, generateModalParity) 33/33 pass. `npm run lint` clean (zero warnings).
- Cleanup: throwaway `Fix QA Layout` session deleted via the planner's Delete (native confirm accepted); browser closed before the admin clears; POST `admin/clear-log` + `admin/clear-change-data` → GET-verified `change-data {}` + `log []`; `sessions` API back to `[]`; no change-data/log residue files on disk.

