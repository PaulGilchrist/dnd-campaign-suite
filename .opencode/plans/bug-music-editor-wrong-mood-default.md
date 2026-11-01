# Music editor opens/saves the catalog-first mood, not the one the button promises

## Summary
The Music view's edit button is titled **"Edit tracks for this mood"**, but the inline editor always opens on `MOODS[0]` (**Town**) regardless of which mood is active — seeding Town's track list, naming Town in its discard confirm and toasts, and writing the GM's typed tracks into `overrides.town`. With Tavern active and playing, a save landed the tracks in the Town bucket.

## Steps to reproduce
Starting state: app on http://localhost:5173, inside **test-campaign** (verified 2026-11-01 run AV).

1. Sidebar → **Music** (GM-only nav item, between Maps and Notes).
2. Click mood **Tavern** in the mood grid (it becomes `.music-mood-btn.active`; ambience auto-plays, change-data `music.mood = "tavern"`, `playing: true`).
3. Click the pencil button (`button[title="Edit tracks for this mood"]`).
4. Observe the editor's mood `<select>` value = `town` (not `tavern`) and the textarea seeded with **Town**'s starter tracks.
5. Type any valid video id (e.g. `dQw4w9WgXcQ`) and press **Save**.
6. Toast reads **"Town tracks saved"** and change-data shows `music.overrides.town = [{videoId: "dQw4w9WgXcQ", …}]` — Tavern's override is untouched even though Tavern is the mood in play.
7. Also: typing a garbage draft then pressing **Cancel** raises the named discard confirm "Discard changes to the **Town** track list?" while the active mood is Tavern.

## Expected behavior
"Edit tracks for this mood" should open the editor on the currently active mood (`music.mood`) when one is selected — seed its tracks, name it in confirm/toast copy, and save into its override bucket. (At minimum the button title/copy must not promise "this mood" while operating on another.)

## Actual behavior
`editMood` is initialized `useState(MOODS[0].key)` = `'town'` and never syncs to `music.mood`. Verified live: active Tavern + editor select `town`; save wrote `overrides.town`; toast "Town tracks saved"; cancel-confirm named Town. Recoverable only via the editor's mood `<select>` — which works (switching to Tavern re-seeds `vyg5jJrZ42s…` and saves into `overrides.tavern`) — but the select has **no aria-label** and the mismatch is easy to miss, so a GM adding Tavern tracks without touching the select silently misfiles them.

## Likely location
Confident: `src/components/music/MusicPlayer.jsx` — `const [editMood, setEditMood] = useState(MOODS[0].key)` plus `openEditor` (seeds from `editMood`), `saveTracks`/`resetMood` (write `overrides[editMood]`), and `useReloadGuard` `confirmMessage: \`Discard changes to the ${moodLabel(editMood)} track list?\``. The button title lives in the `.music-controls` block (~line 378). Behaviour predates the sidebar→view relocation (26e72d435) but is now first-class surface; the move did not add a `music.mood` → `editMood` sync.

## Suggested fix
In `openEditor`, seed from the active mood when one exists:
`const key = music.mood || editMood; setEditMood(key); …getTracksForMood(key, …)… seedDraft…`
(or add a `useEffect` syncing `editMood` to `music.mood` while `editing` is false). Alternative/complement: drop "this mood" from the button title and give the mood `<select>` an `aria-label="Tracks mood"` so the chooser is discoverable to tests and screen readers.

## Severity
Minor UX issue (with misfiled-input risk): nothing is corrupted and recovery is possible via the select, but the control's own label misdescribes its target and a GM can save tracks into the wrong mood's bucket without any warning.
