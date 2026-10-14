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
