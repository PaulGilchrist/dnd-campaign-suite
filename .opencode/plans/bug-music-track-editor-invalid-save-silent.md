# Bug: Music track editor Save with invalid input silently does nothing (no user-visible feedback)

### Summary
In the sidebar Music panel's track editor, clicking Save with a textarea containing no valid YouTube URLs/video-ids silently no-ops: the editor stays open, text is preserved, and the only signal is a `console.error`. The user gets no toast, inline error, or any visible indication the save was rejected.

### Steps to reproduce
1. In test-campaign (localhost), select a Music mood (e.g. Town) so the panel is in its normal state.
2. Click the pencil "Edit tracks for this mood" button — an inline `.music-editor` opens in the sidebar (Mood select + textarea pre-filled with the mood's video IDs + Save/Reset/Cancel).
3. Replace the textarea contents with junk, e.g. `not a youtube thing`.
4. Click Save.

### Expected behavior
Save is rejected with visible feedback (inline error near the textarea or toast, e.g. "No valid YouTube URLs or video ids entered"), matching the app's inline-error convention (`.ct-*-error` used on NPCs/Quests/Maps/Factions).

### Actual behavior
Nothing visible happens. Editor stays open, invalid text remains, no error element is rendered anywhere (`[class*="error"]/toast/msg` probe returns empty). Console shows only: `No valid YouTube URLs or video ids entered`.

### Likely location
Confident: `src/components/sidebar/MusicPlayer.jsx` `saveTracks` — `if (tracks.length === 0) { console.error('No valid YouTube URLs or video ids entered'); return; }`. The console.error is the entire rejection path.

### Suggested fix
Add a local `editorError` state rendered under the textarea (reuse the inline-error class used elsewhere), set it in the `tracks.length === 0` branch, clear it on next keystroke/save. Optionally disable Save while the textarea has no parseable line.

### Severity
Minor UX issue — no data risk (rejected input never persists), but a control that appears to do nothing invites repeated clicking and confusion.
