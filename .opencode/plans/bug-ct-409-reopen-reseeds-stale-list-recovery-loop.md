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
