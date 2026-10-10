# Sidebar dice roller rolls locally but never logs to the campaign log (no shared record, no SSE)

### Summary
Clicking a die in the sidebar Dice Tray (e.g. d20) opens a popup with a result, but nothing is written to the campaign log — the server log stays empty and other tabs never see the roll — despite the Log view's empty state explicitly inviting "Roll dice or add a note to get started."

### Steps to reproduce
1. On localhost, in test-campaign, click "d20" in the sidebar dice tray.
2. A popup overlay appears showing the result (e.g. "11 d20").
3. Open the Log view → it still says "No entries yet. Roll dice or add a note to get started."
4. Verify server-side: `GET /api/campaigns/test-campaign/log` returns `[]` (0 entries).
5. Open a second tab on the same campaign, Log view: the roll never arrives via SSE either.

### Expected behavior
Per the app's own affordance ("Roll dice … to get started") and the project's logging convention ("every automation must log to the campaign log when triggered"), a GM dice-tray roll should append a `roll` entry to the campaign log and broadcast it via SSE so players see GM rolls.

### Actual behavior
Roll is purely client-local: popup shows the number, server log remains `[]`, no network POST to the log endpoint occurs, and other tabs observe zero change. Silent no-op outside the popup.

### Likely location
Confident (grep + live): `src/components/sidebar/DiceTray.jsx` contains no `log`/`addEntry` references at all, and `src/services/dice/diceRoller.js` is pure math with no fetch — the log/POST seam simply doesn't exist in this component. Contrast with the campaign log add-note path (`.campaign-tool.log-view` has its own note submit that does POST).

### Severity
Broken feature — the dice tray is advertised as producing log entries (Log empty-state text) and a shared-GM-tool, but produces no shared record. If locality IS the intent, the Log view's "Roll dice … to get started" copy is misleading and the tray needs a "log this roll" affordance.
