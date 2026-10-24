# Bug: Quest edit modal stays open after confirmed delete

### Summary
Deleting a quest from the Quests view removes the row but leaves the "Edit Quest" modal open, still populated with the deleted quest's data. Saving again from the stale modal would re-create/orphan data.

### Steps to reproduce
1. In test-campaign, open the Quests view.
2. Create a quest (e.g. "QA Quest Two") via New Quest → Name → Save.
3. Click the quest row (`[aria-label="Edit quest: QA Quest Two"]`) to open the Edit modal.
4. Click **Delete** in the modal footer and accept the native confirm (`Delete quest "QA Quest Two"?`).
5. Observe the page.

### Expected behavior
Quest is deleted and the modal closes (row removed, no overlay).

### Actual behavior
The row is removed from the list (verified via DOM: `Edit quest:` rows no longer include the deleted name) but `.ct-modal-overlay` remains open with the deleted quest's form still populated (Name field still contains the deleted name). Confirmed twice: once with Playwright auto-accept, once with an injected `window.confirm`-override returning true. With the override returning **false**, the delete is correctly blocked and the row stays — so only the post-accept modal-close path is broken.

No console errors; DELETE network call succeeds.

### Likely location
Quests view component (`src/components/Quests/…` — the quest list/editor). Guess: the delete handler calls the API and refreshes the list but never calls the modal's close/setEditing(null) on the success path.

### Suggested fix
In the quest delete handler, close the edit modal (clear editing state) after the DELETE resolves — mirror what the Cancel/close button does. Add a test asserting no `.ct-modal-overlay` remains after confirmed delete.

### Severity
Minor UX issue — data deletes correctly, but the lingering modal shows stale data for a nonexistent entity and invites a re-save that resurrects a ghost quest.

## Resolution (2026-10-24)

**FIX: FIXED.** Root cause confirmed exactly as guessed: `handleDelete` in `src/components/quests/Quests.jsx` awaited `deleteQuestAction(quest.id)` (which refreshes the list via `useEntityManagement.deleteItem → loadItems`) but never closed the modal on the success path — no `closeModal()`/`handleCloseModal()` call. Every sibling management view does close: NPCs (`NPCs.jsx:100`), Notes (`Notes.jsx:265`), Factions (`Factions.jsx:163`), Sessions (`Sessions.jsx:139`). Quests was the sole outlier.

**Changes:**
- `src/components/quests/Quests.jsx` — `handleDelete` now calls `handleCloseModal()` after the DELETE resolves (same close path the Cancel button uses), clears `error` on success, and surfaces `setError(...)` on failure — mirroring the Sessions handler. No new architecture, no campaign-log entry added (no sibling management-view delete logs; `useEntityManagement` / `questsService` are untouched).
- `src/components/quests/Quests.delete-close.test.jsx` — NEW regression test (3 cases): accepted delete that resolves unmounts `.ct-modal-overlay` and removes the row; declined confirm keeps row + open modal; failed DELETE keeps the modal open with an inline error.
- `src/components/quests/Quests.test.jsx` — updated one pre-existing test ("…re-enables it after") that had locked in the buggy behavior (asserted the Delete button remained in the DOM after a successful delete); it now asserts the modal is gone after resolve.

**Verification:**
- Live repro BEFORE fix (Playwright, :5173, test-campaign): created "QA Quest Two", opened Edit, Delete + accepted confirm (`Delete quest "QA Quest Two"?`) → row removed, DELETE `/api/campaigns/test-campaign/quests/<id>` → 200, but `.ct-modal-overlay` count = 1 with `#quest-name` still "QA Quest Two". Bug confirmed exactly as reported.
- Live re-verify AFTER fix: accepted delete → `overlays: 0`, no `Edit Quest` modal, rows show only surviving quests. Block path (injected `window.confirm` returning false): confirm asked with exact message, row + modal intact, `deleteItem` not fired. Edit→Save happy path on another quest ("QA Quest Three" description edit): modal closes, description persists. Zero console errors throughout.
- Tests: `npx vitest run src/components/quests/Quests.delete-close.test.jsx` → 3/3 pass; `npx vitest run src/components/quests/` → 28/28 pass; `npm run lint` → clean (zero warnings).
- Cleanup: all QA test quests deleted (server list restored to just "The Lost Artifact"), then Admin Clear Change Data (`GET /change-data` → `{}`) and Clear Campaign Log (log length 0) via UI with confirms handled.

