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

## Resolution

**Fixed 2026-10-10.**

### What was actually wrong
Confirmed the original diagnosis, with one refinement: the missing seam lives in `src/components/sidebar/Sidebar.jsx`, not `DiceTray.jsx`. `DiceTray` is presentational and calls `onRoll({ label, value })`; `Sidebar` wired it straight to local `useState` (`onRoll={setDiceResult}`), so the roll only opened the popup and never POSTed to the campaign log. `DiceTray.jsx` itself needed no change.

### Files changed
- `src/components/sidebar/Sidebar.jsx` — new `handleDiceRoll` handler: shows the popup (unchanged) and appends a `roll` entry via the existing `addEntry(campaignName, entry)` seam from `src/services/ui/logService.js` (same POST + SSE broadcast path used by the Log view's add-note flow and `encounterToInitiative.js` `logRoll`). Entry shape follows existing roll conventions: `{ type: 'roll', rollType: 'dice', characterName: 'GM', name: 'Dice Tray <die>', rolls: [value], total, formula }`. Server assigns id/timestamp and publishes `log-<campaign>` over the ONE shared SSE connection. No new endpoints, no `new EventSource`, no localStorage, no inline styles.
- `src/components/sidebar/Sidebar.dice-tray-log.test.jsx` — new regression test locking the broken behavior: rolling a die calls `logService.addEntry` with the exact entry shape, and the result popup still appears.

### Verification
- **Live repro re-run (Playwright, test-campaign, localhost):** clicked d20 in sidebar tray → popup "14 d20"; Log view now shows "GM · Dice Tray d20 · 14"; `GET /api/campaigns/test-campaign/log` returned the `roll` entry (`rolls:[14], total:14`). Second tab, Log view open: rolled d6 in first tab → "GM · Dice Tray d6 · 2" appeared live in the second tab via SSE (no reload). Sanity: adding a log note still works and arrives via SSE; d6 (different die) logs correctly.
- **Tests:** `npx vitest run src/components/sidebar/Sidebar.dice-tray-log.test.jsx` → 2 passed. `npx vitest run src/components/sidebar/` → 4 files, 99 tests passed.
- **Lint:** `npm run lint` → clean (zero warnings).
- **Cleanup:** Admin panel → Clear Change Data + Clear Campaign Log on test-campaign; `GET .../log` returns `[]` afterward.
