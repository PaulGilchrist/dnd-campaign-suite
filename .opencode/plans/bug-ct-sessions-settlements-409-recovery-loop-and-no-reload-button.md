# bug-ct-sessions-settlements-409-recovery-loop-and-no-reload-button.md

## Summary
The `9cee7bfa2` close-consumes-skipped-SSE recovery machinery and the `ee4f9f177` one-click "Reload list" banner button were wired into the four `.ct-*` array lanes (NPCs, Notes, Factions, Quests) but NOT into Sessions or Settlements. A 409 concurrent-edit conflict in those two lanes therefore dead-ends: closing and reopening the editor in-view re-seeds the STALE row, so the banner's own instruction ("reload the list and re-apply your edit") loops the same 409 indefinitely until a full page reload or view remount.

## Steps to reproduce
(In `test-campaign`, single browser tab on `http://localhost:5173`; server on :80 or Vite proxy.)

1. Sidebar → Sessions. Create a session (or `PUT /api/campaigns/test-campaign/sessions/QA%20Sess%20UI2` body `{name:"QA Sess UI2", date:"2026-10-27"}`).
2. Click the session row to open its editor.
3. While the editor is OPEN, from another "tab" (curl/Code Mode) bump the row on disk: `PUT /sessions/QA Sess UI2` with a fresh-echo body changing `date` to `2026-11-09` → 200 (disk re-stamps synchronously; the SSE list refresh is skipped while the editor is open).
4. In the open editor, make any live edit and press **Save** → **409**, inline banner `.sessions-form-error` reads `Session "QA Sess UI2" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.` — note there is **no "Reload list" button** (compare `.npcs-error-reload-btn` on the NPCs lane).
5. Press **Cancel**, then click the same row again to reopen — the date field re-seeds `2026-10-27` (the STALE pre-bump value), not `2026-11-09`.
6. Press **Save** again → the **same 409** repeats. Repeat step 5-6: identical 409 forever.

Settlements lane reproduces identically (`.settlements-form-error`, reopen re-seeds stale fields, second Save 409s again). All steps live-proven 2026-10-27 (run I). Only a full `page.reload()` (or sidebar→character→back view remount) breaks the loop.

## Expected behavior
Parity with NPCs/Notes/Factions/Quests: the 409 banner carries a "Reload list" button, and closing any `.ct-*` editor consumes the list broadcast that was skipped while editing so a reopen seeds fresh stamps and the re-applied edit saves 200.

## Actual behavior
- Banner text instructs "reload the list" but offers no button and no in-view refetch on close.
- Reopen re-seeds stale stamps → guided recovery loops the identical 409 (reproduced live in BOTH Sessions and Settlements lanes).
- Drafts are preserved (no data loss), but the user's edit is unsavable without discovering an undocumented page reload.

## Likely location
High confidence (grep-proven): `missedListBroadcast` appears 10× in `src/components/npcs/NPCs.jsx` and 8× in `src/components/factions/Factions.jsx` but **0×** in `src/components/sessions/Sessions.jsx` and `src/components/settlements/Settlements.jsx`; neither renders `errorConflict && onReloadList`. The playbook itself flagged this as the "natural follow-up pair" after `ee4f9f177`. Services already set `err.conflict` (dce3b5249), so the discriminator reaches the components — only the render + close-refetch legs are missing.

## Suggested fix
Port the two proven pieces from the Factions lane:
1. Track `missedListBroadcast` on the save-409 and on session/sse list events while an editor is open; on editor close, if missed, refetch the list (the `9cee7bfa2` pattern).
2. Render the banner through a `showError(message, conflict)` choke point and add `errorConflict && <button className="sessions-error-reload-btn">Reload list</button>` (settlements twin) wired to `{ missedListBroadcast.current = true; handleClose(); }`.

## Severity
Minor UX issue with data-frustration risk: no silent corruption (the guard correctly refuses and drafts survive), but the sanctioned recovery is a proven infinite loop on two lanes — the exact dead-end `9cee7bfa2` was created to eliminate, just un-shipped there.
