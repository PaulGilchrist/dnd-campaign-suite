# Music player mirrors playing STATE across tabs but no tab has a player that reacts — Pause from another tab leaves the audio tab's module untouched

## Summary
`MusicPlayer.jsx` keeps the shared `music` campaign key (`{mood,playing,volume,overrides}`) in sync across tabs, but the actual YouTube player is per-tab and the component has NO effect that adopts remote `mood`/`playing` transitions (only the local button handlers call `youtubePlayer.pause()/resume()/stop()`). Result: a second GM tab shows a live "playing" affordance while it has no player mounted at all (ytFrame 0), and pausing from that tab flips BOTH tabs' UI to paused without ever commanding the tab that actually owns the YT iframe to pause — that tab's UI now claims "Play" while its player module was never touched (audio-divergence hazard; audio itself not black-box verifiable, see notes).

## Steps to reproduce
1. In test-campaign, open two localhost tabs (A and B). Both show the Music sidebar block (GM-only).
2. Tab A: click `button[title="Play Town ambience"]` → log row `GM set ambience: Town — <track>`; `GET /api/campaigns/test-campaign/change-data` shows `music.playing:true`. A mounts a `.yt-music-frame` iframe (`https://www.youtube.com/embed/…`).
3. Observe Tab B WITHOUT touching it: the Town mood button renders `active` and the first `.music-btn` has title `Pause` (enabled) — yet `document.querySelectorAll('#yt-music-frame').length === 0` in B. B presents full playing controls with no player.
4. Tab B: click the `Pause` button → change-data `music.playing` flips false (SSE ~instant).
5. Observe Tab A: mood active class cleared, first `.music-btn` title now `Play` — while A's mounted YT iframe/module was never sent any pause command (no code path reacts to a remote `playing` transition).

## Expected behavior
Per server-first doctrine, either (a) every client's local player follows remote state transitions (pause/resume/stop when `music.playing`/`mood` change from another client — an adoption effect), or (b) non-owning tabs show a read-only "ambience set by GM" state without functional Play/Pause/Stop affordances that misrepresent local playback. At minimum, tab B must not render a Pause button while it owns no player, and tab A must not render "paused" while its player was never commanded.

## Actual behavior
Live-proven: B shows `activeBtn:"Town"`, enabled `Pause`, `ytFrame:0` (mirrored state, no local player); B's Pause sets `music.playing:false` and A's UI flips to `Play` with the iframe still mounted — A's `youtubePlayer` module received no command (grep: `pause/resume/stop` are called only inside `togglePlay`/`stopMusic` click handlers; no `useEffect` on `music`). A pause-row is also NOT logged (only `set_ambience` + eventual `stop` rows exist), so the log can't even disambiguate who paused.

## Likely location
Confident: `src/components/sidebar/MusicPlayer.jsx` — state via `useSyncedState('campaign','music',…)` (shared), player via per-tab singleton `src/services/ui/youtubePlayer.js`; no adoption effect exists (only mount/local-handler calls). The commit-commented "surprise-autoplay guard" (PATCH overrides-only) shows remote transitions were considered but player-adoption was never wired.

## Suggested fix
Add an effect keyed on `music.mood`/`music.playing` that drives the local module to match (skip when the change originated locally, e.g. compare against a ref of the last locally-committed value): playing true + local frame → resume/play tracks; playing false → `youtubePlayer.pause()`; mood null → `stop()` + unmount frame. If multi-client playback is NOT intended, instead gate the controls on `playerMounted` (disable Pause/Stop and drop the `active` class when this client has no frame).

## Notes / evidence bound
Audio-truth leg (does sound actually keep playing in A after B's Pause) is black-box UNVERIFIABLE here — the YT iframe is cross-origin and the sandboxed click may not have started audible playback (autoplay policy). Everything above is UI-observed + code-certain.

## Severity
Minor UX issue — no game state is at stake, but it is a live cross-tab UI-vs-reality divergence in a GM-facing control: one tab shows controls it can't back, the other shows a paused badge while its player was never paused.
