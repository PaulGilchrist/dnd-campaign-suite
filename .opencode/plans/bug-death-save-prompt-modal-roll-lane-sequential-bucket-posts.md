# Bug: DeathSavePromptModal roll lane still issues sequential whole-bucket POSTs (residual of the sheet-lane roll race family)

## Summary
`bug-death-save-roll-lane-sequential-bucket-posts` collapsed the SHEET roll lane (`DeathSavingThrows.rollDeathSave`) into a single `setRuntimeBatch` (2026-11-19 fix run, wire-verified). The sibling producer — `handleRoll` in `src/components/common/DeathSavePromptModal.jsx` — was NOT part of that fix and still fires up to FOUR sequential whole-bucket `setRuntimeValue` POSTs per roll: `deathSaves` (:241), `deathFailures` (:242), `isDead` on a fatal roll (:244), `currentHitPoints` on a NAT 20 (:249). Worse, the NAT-20 `death-save-result` window event makes the HP write happen TWICE with independently-ordered snapshots: once from the `CharHitPoints` listener (`CharHitPoints.jsx:111`, and `Initiative.jsx:702` for monsters) and once from the modal's own :249 write. A stale track snapshot landing after the listener's HP-restored snapshot leaves a standing creature still wearing pre-roll failures (the exact divergence shape witnessed on the sheet lane pre-fix).

## Steps to reproduce
Mechanism steps (stochastic race, code-confirmed; the sheet-lane twin was wire-witnessed 2026-11-19 with the identical POST shape — a stale intermediate body carrying `isDead:1` + 2/3 track, and `currentHitPoints:1` + stale track):
1. In `test-campaign`, arm a death-save prompt for a player (drop their bucket `currentHitPoints` to 0 via the sheet editor, then the prompt arms through the save-prompt lane).
2. Wrap `window.fetch` onto `window.__posts` (playbook wire-capture recipe), press `Roll Death Save` in the `.dsp-overlay` with forced `Math.random` for a fatal roll.
3. Read `__posts`: ≥3 sequential whole-bucket POSTs to the char key, with intermediate bodies missing the later fields.

## Expected behavior
One roll = one merged `setRuntimeBatch` (mirroring `DeathSavingThrows.rollDeathSave` post-fix and `handleRemoveDead`), and a decision on the duplicate HP restore between the modal's own write and the `death-save-result` listeners (single writer or merged body — one commit = one POST = nothing to interleave).

## Actual behavior
Sequential per-key `setRuntimeValue` calls, each a full-mirror bucket POST with its own SSE echo; on NAT 20 the HP field is additionally written by a second producer (the window-event listeners), widening the reorder window.

## Likely location (confident — code-read)
`src/components/common/DeathSavePromptModal.jsx` — `handleRoll()` writes at lines 241-250; second HP producer at `src/components/char-sheet/char-summary/CharHitPoints.jsx:110-111` and `src/components/initiative/Initiative.jsx:697-704`.

## Suggested fix
Collapse the four writes into one `setRuntimeBatch` (tracks + `isDead:1` when fatal + `currentHitPoints` when `restoredToHp !== null`), keeping `sendDeathSaveResult` / the `death-save-result` dispatch / `clearDeathSavePrompt` / the finality row in their current order (mirror the sheet lane's fix in `DeathSavingThrows.jsx`). Then decide the listener-duplication: either the modal stops writing HP (listeners own it — but Initiative's lane only covers the combat board) or the listeners skip when the acting producer already merged HP (e.g. a `hpWritten:true` flag on the event detail). Add a wire-shape pin (fetch spy against the real store module, one POST per terminal roll) like `DeathSavingThrows.roll-single-write.test.jsx`.

## Severity
Data integrity risk — same class ruled unacceptable by the adjacent fixes (whole-bucket last-writer-windover leaving DEAD/track/HP divergence via SSE echo); intermittent, self-healing on the next write.

## Origin
Filed 2026-11-19 by the `bug-death-save-roll-lane-sequential-bucket-posts` fix run while scoping that fix (sheet lane fixed here; modal lane left standing, matches the app-exploration map's carried DeathSavePromptModal priority target).
