# Bug: Deleting a custom music category leaves a dangling editor mood — Save silently writes orphan overrides

## Summary
After a custom music category is deleted while its track editor is open (or was the selected mood), the component's `editMood` state is never reset. Reopening the track editor renders the mood `<select>` without the (now nonexistent) option — so it VISUALLY displays a built-in mood (`combat`) — but the internal `editMood` is still `custom-qa-cf-2`. Saving tracks then writes `music.overrides["custom-qa-cf-2"]`: an orphan row for a deleted, invisible category, misattributed away from what the select shows.

## Steps to reproduce
1. In test-campaign (localhost/GM), open the **Music** view.
2. Create a throwaway category: click `+ Add category` (`.music-add-category`), label `QA CF 2`, `Create`. Disk proof: change-data `music.customCategories` gains `custom-qa-cf-2`.
3. Click the new `QA CF 2` chip (selects it as the editor mood).
4. Open the track editor (`button[title="Edit tracks for this mood"]`); type a video id, e.g. `dQw4w9WgXcQ`, into the textarea (do NOT save).
5. Press `Delete category` (the in-editor `button.music-btn`, or the chip's `.music-mood-delete`) → dialog `Delete Music Category` → `Yes, Delete Category`. The editor unmounts; the category is gone from `music.customCategories`.
6. Click `Edit tracks for this mood` again. The `#music-editor-mood` select now shows value `combat` (options list is only the 5 built-ins — the dangling key has no option, so a controlled select with `value="custom-qa-cf-2"` renders the first option).
7. Type `dQw4w9WgXcQ` in the textarea and press `Save`.

## Expected behavior
Either (a) deleting the category resets the editor mood to a valid mood, so the reopened editor saves to the mood it displays (`combat`), or (b) the save is refused with inline copy because the target category no longer exists. The visible select must always agree with the actual write target.

## Actual behavior
- The save lands under the DELETED category key, not the displayed mood. Live GET of `/api/campaigns/test-campaign/change-data` immediately after Save:
  ```json
  "music": { "mood": null, "playing": false, "volume": 0.6,
    "overrides": { "custom-qa-cf-2": [ { "videoId": "dQw4w9WgXcQ", "title": "Rick Astley — Never Gonna Give You Up …" } ] },
    "customCategories": {} }
  ```
- Toast (honest, but names the invisible key): `custom-qa-cf-2 tracks saved — keep editing` — while the select visibly read `combat`.
- No console errors, no failed requests — the write is "successful" to an orphan bucket. The row is invisible in the UI (no category references it) and can only resurface as ghost tracks if a category with the same slug is later recreated.
- Related cosmetic face (same root cause witnessed live): after deleting category `QA CF Cat` while its editor was open, the `Discard Changes?` dialog on the next mood switch read `Discard changes to the custom-qa-cf-cat track list?` — `moodLabel()` has degraded to the raw key because the category is gone.

## Likely location
`src/components/music/MusicPlayer.jsx` — high confidence:
- The category-delete commit lane (~line 641: `if (editing && editMood === moodKey) …` inside the music-change effect) tears the editor down but never resets `editMood` (and `seedDraft`/snapshot stay stale).
- The editor select is `<select id="music-editor-mood" value={editMood}>` (~line 747) — a controlled select silently renders the first option when its value has no matching `<option>` (the display-vs-state desync).
- The save handler writes `overrides[editMood]` verbatim (~line 499) with no existence check for custom moods.

## Suggested fix
On successful category delete, in the same commit that removes `customCategories[key]`: if `editMood === key`, `setEditMood(MOODS[0].key)` (and re-seed the editor draft via `seedEditor`). Defense-in-depth: in `handleSave`, if `isCustomMood(editMood) && !music.customCategories?.[editMood]`, refuse with inline copy (reuse `.music-editor-error`) instead of writing an orphan. A controlled-select parity guard (render the current value as a disabled option when missing) would also make the desync visible instead of silent.

## Severity
Data integrity risk — a confirmed silent misrouted write: an override list persists for a category that no longer exists, under a UI state that claims a different mood. Not catastrophic (swept by Admin clear; niche path), but it is exactly the "displays X, stores Y" class.
