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
