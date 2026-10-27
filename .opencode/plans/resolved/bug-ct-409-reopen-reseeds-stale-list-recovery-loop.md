# Bug: 409 conflict's guided recovery ("reload the list") dead-ends — closing and reopening a `.ct-*` editor re-seeds the stale list

## Summary
After the new concurrent-save 409 ("…reload the list and re-apply your edit — it was NOT saved."), the literal recovery the message prescribes — close the editor, reopen it, save again — repeats the SAME 409 forever, because closing the editor never re-fetches the entity list and the SSE list refresh was skipped while the modal was open. Only navigating to another view (component remount) or a full page reload breaks the loop.

## Steps to reproduce
Confirmed live in test-campaign (2026-10-27, run G), two browser tabs:
1. Tab A: NPCs view → open Marta Copperkettle's editor (leave open).
2. Tab B: open Marta, change the notes field, Save → succeeds (row `updatedAt` bumps).
3. Tab A: change the appearance field, Save → 409, inline banner appears verbatim: `NPC "Marta Copperkettle" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.` Draft retained, modal open. (Correct so far.)
4. Tab A: close the editor (× `button.ct-modal-close[aria-label="Close"]`) — note list on screen does NOT refresh (no refetch on close; the SSE `npcs-list-*` broadcast during step 2 was skipped because `modalOpen`).
5. Tab A: click Marta's row again → editor re-seeds from the stale client list (OLD `updatedAt`) → re-apply the appearance edit → Save → **409 AGAIN**. Repeat step 4–5: identical 409 every time.
6. Workaround: navigate to a character sheet, click NPCs again (remount → `loadNPCsList()`), reopen Marta, Save → 200, both tabs' edits coexist on disk.

## Expected behavior
Either (a) closing an editor that has just been rejected (or any editor close) triggers a list refetch, or (b) reopening an entity editor fetches the fresh row, or at minimum (c) the 409 banner offers a working "Reload list" action. The user should never have to discover view-re-remount by trial and error.

## Actual behavior
Reopen → re-seed from stale in-memory list → same 409, indefinitely. The error's own instruction ("reload the list") has no matching affordance in the NPCs view; the list visibly shows no marker that it is stale.

## Likely location
Confident (read + live): `src/components/npcs/Npcs.jsx` — SSE handler `handleSSEEvent` returns early when `modalOpen` (by design, protects the draft), and `handleCloseModal` only resets error + closes; nothing re-runs `loadNPCsList()` on close, and `handleEditNPC` seeds `getDefaultFormData(npc)` from the possibly-stale `npcs` state. Same pattern in the shared `useEntityManagement` used by Notes/Factions/Quests (Notes.jsx has the same skip-while-editing guard).

## Suggested fix
Cheapest correct: in `handleCloseModal`, if a save conflict error was shown (or unconditionally when the last SSE broadcast was skipped while `modalOpen`), call `loadNPCsList()`. Track a `missedBroadcast` flag in the SSE handler (set when `modalOpen`, consumed on close). Alternative: mark the list rows stale (dot/banner) and add a Refresh button, or make `handleEditNPC` GET the single entity before seeding the form. Applies to whichever `.ct-*` components implement the skip-while-editing pattern.

## Severity
Minor UX issue — server authority holds (nothing is lost or clobbered; the guard is honest), but the fix's own guided recovery path is a dead-end loop in normal two-tab use.

## Resolution
FIXED 2026-10-27 (subagent run). Root cause confirmed exactly as diagnosed: the SSE list handler in each `.ct-*` manager returns early while `modalOpen` (draft protection) but nothing ever applied the skipped refresh, and `handleEditNPC` re-seeded the form from the stale in-memory `npcs` list — so close→reopen→save repeated the SAME 409 forever.

**Fix (suggested `missedBroadcast` approach, implemented in all four skip-while-editing components):** a `missedListBroadcast` ref is set in the SSE handler whenever a list broadcast is skipped while the editor is open, and also in the save-catch (a server-rejected save proves the on-screen list is stale). `handleCloseModal` consumes the flag and re-fetches the list — the first safe moment — so a reopen always seeds the fresh row (current `updatedAt`) and the re-applied edit saves 200. Success/delete paths clear the flag after their existing reload so the editor's own SSE echo never causes a redundant refetch/flicker. No changes to hooks, server, or SSE transport.

**Files changed:**
- `src/components/npcs/Npcs.jsx`
- `src/components/notes/Notes.jsx`
- `src/components/factions/Factions.jsx`
- `src/components/quests/Quests.jsx`
- New regression test `src/components/npcs/NPCs.stale-list-recovery.test.jsx` (3 tests: close-after-skipped-broadcast → refetch → reopen seeds FRESH row; close-after-409 → refetch with no visible echo; clean close / successful save → no redundant fetches)
- Updated the four `*.sse-sync.test.jsx` "skips while open" tests to the new contract (missed event is applied ON CLOSE, live refresh with modal closed unchanged)

**Verified live (test-campaign, :5173, 2026-10-27):** reproduced the loop first (409 verbatim → close = ZERO refetches → reopen seeded stale `""` notes vs disk `TAB-B-EDIT…` → same 409 again). Post-fix re-run: 409 verbatim → close → `GET /npcs 200` immediately → reopen seeds the other tab's fresh notes → re-apply appearance → **PUT 200**, modal closes, disk holds BOTH edits coexisting (`appearance:"FIXCHECK appearance"`, `notes:"TAB-B2-EDIT…"`). Adjacent sanity: external PUT with the editor CLOSED still live-mirrors via SSE (`GET:200` unprompted). Marta probe fields cleared back to `""`; change-data `{}` + log `[]` API-verified from closed-tab quiet state.

**Tests/lint:** `npx vitest run` on npcs/notes/factions/quests/hooks → 299 files / 2752 passed (3 pre-existing expected-fail); `npm run lint` clean (zero warnings); `node .opencode/plans/no-timers-guard.mjs` OK.

## Summary
Fixed the 409-recovery dead-end loop: closing a `.ct-*` entity editor (NPCs/Notes/Factions/Quests) now consumes any SSE list broadcast skipped while the modal was open — plus marks a save-rejection as staleness — and re-fetches the list, so the next reopen seeds the fresh row and the prescribed "close, reopen, re-apply" recovery saves 200 instead of repeating the same 409 forever.
