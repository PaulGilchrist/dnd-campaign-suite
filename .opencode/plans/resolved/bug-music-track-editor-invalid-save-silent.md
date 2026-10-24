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

## Resolution
**FIXED 2026-10-24.** Root cause matched the guess: `MusicPlayer.jsx` `saveTracks` rejected unparseable input with `console.error` only — no state, no rendered feedback. The app's actual inline-error convention is `.{area}-form-error` (`npcs-form-error`, `quests-form-error`, `factions-form-error`, `sessions-form-error`, `settlements-form-error` — the bug file's `.ct-*-error` shorthand; those all share the `--color-error-border` / `--background-color-error` / `--color-error-light` tokens from `index.css`).

**Changes:**
- `src/components/sidebar/MusicPlayer.jsx` — added local `editorError` state; the `tracks.length === 0` branch now sets it (keeping the `console.error`); rendered as `<div className="music-editor-error">` directly under the textarea. Cleared on next keystroke, mood switch, Reset, Cancel/reopen, and successful save — mirroring the Quests/Factions state-clearing flow.
- `src/components/sidebar/MusicPlayer.css` — `.music-editor-error` rule mirroring `.quests-form-error` (token-based, sidebar-scaled; no inline styles, no `!important`).
- `src/components/sidebar/MusicPlayer.invalid-save-error.test.jsx` — NEW regression tests (4): visible `.music-editor-error` with exact rejection message + junk not persisted + editor stays open; clears on keystroke; clears on cancel/reopen; subsequent valid save closes editor and persists.

**Verified live (Playwright, :5173, test-campaign):**
- Repro pre-fix: Save with `not a youtube thing` → `editorStillOpen:true`, textarea preserved, `[class*="error"]/toast/msg` probe empty, console-only `No valid YouTube URLs or video ids entered`. Bug confirmed.
- Post-fix: same steps → `.music-editor-error` VISIBLE with text "No valid YouTube URLs or video ids entered" (screenshot captured), editor open, textarea preserved, `change-data music.overrides.town` still absent (junk never persisted), console.error retained.
- Keystroke after error → error element removed. Happy path: valid `https://www.youtube.com/watch?v=q9yaKpYS9qc` → Save → editor closes, override persisted to change-data.
- Cleanup: stop ambience, Admin panel Clear Change Data + Clear Campaign Log (native confirms handled; verified `change-data == {}` and `log == []`; no `music` key resurrection after reload).

**Tests/lint:** new test file 4/4 pass; sidebar folder 5 files 87/87 pass; full suite `npm run test:run` 2765 files / 30,900 pass (3 expected-fail); `npm run lint` zero warnings.

**Note:** the pre-existing test `MusicPlayer.test.jsx` "ignores unparseable editor input" still passes unchanged — console.error is kept, and it asserts nothing about visible feedback.
