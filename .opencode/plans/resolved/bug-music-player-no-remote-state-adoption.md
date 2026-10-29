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

## Resolution

**FIXED 2026-10-29** (fix run for this bug).

### What was actually wrong
Confirmed the bug file's diagnosis: `MusicPlayer.jsx` mirrored the shared `music` campaign key across tabs via `useSyncedState`, but `youtubePlayer.pause()/resume()/stop()` were called only inside the local click handlers — no effect adopted remote `mood`/`playing` transitions. Live repro (two-tab rig on :5173, test-campaign):
1. B mirrored `active:"Town"` + enabled `Pause` with `#yt-music-frame` count 0; B's Pause flipped change-data `playing:false` and A's UI to `Play` while A's mounted frame/module received **no** command (and produced **no log row** — audit gap).
2. Extra hazard confirmed live: with A owning a Town frame, B starting Combat mounted a SECOND frame in B while A's stale Town queue kept playing — two players live at once (double audio) and A's UI claimed Combat/Pause it never played.

The fix took Expected option **(a)** — remote-state adoption (server-first: every client's local player follows remote transitions). Option (b) (gating controls on `playerMounted`) was rejected because it contradicts the existing `MusicPlayer.test.jsx` contract ("re-queues persisted tracks when resuming after reload" — a fresh, non-mounting tab must be able to press Play) and would freeze control in the acting tab.

### What changed
- `src/components/sidebar/MusicPlayer.jsx`
  - New **adoption effect** keyed on `music.mood`/`music.playing`/`playerMounted`, mirroring the `useTravelToolSync` adopt lane (ref-guard + provenance `console.info('[MusicPlayer] …')`): first observation is a mount **baseline** (commands nothing); bytes matching the last commit this tab made itself are skipped (SSE self-echo never re-commands the player). Remote transition drives the local module: **remote pause → `pause()`** (keeps the frame so a later local resume reuses it); **foreign play or remote stop → `stop()` + unmount frame** (mount-effect cleanup disposes) — a play/mood change always originates from a click in a tab that mounts its own player, so every other tab releases its frame: exactly one audible player, no UI-vs-module lie.
  - New `commitMusic()` wrapper stamps the `localMusicRef` guard for every handler commit (`selectMood`, `togglePlay`, `stopMusic`, and the just-shipped queue-exhaustion un-arm — that lane's behavior is untouched).
  - **Pause/resume log rows** (the folded-in audit gap): `togglePlay` now logs `{type:'music', action:'pause'|'resume', mood, message:'GM paused/resumed <Mood> ambience'}` — the transport is no longer row-free. Remote echoes themselves log nothing (the acting tab owns the row; no duplicates).
- `src/services/ui/youtubePlayer.js` — unchanged; its `player && ready` guards make adoption commands safe no-ops on non-owning tabs. No 2024 sibling: music is ruleset-agnostic UI.
- `src/components/sidebar/MusicPlayer.remote-adoption.test.jsx` — NEW, 7 tests: remote pause commands the module (frame kept), self-echo never re-commands, foreign play releases this tab's frame (stop+dispose), remote stop releases, non-owner never self-mounts, persisted-state mount is a silent baseline, pause/resume log rows exist. Remote echoes simulated via `setRuntimeObject(…, skipSync=true)` — the exact SSE-apply path.

### How verified
- **Live re-run of the repro** (two tabs A/B via `context().newPage()`, header `test-campaign` checked both tabs): A plays Town (frame 1). B's Pause → A logs `[MusicPlayer] Ambience paused in another tab — pausing this tab's player` (module commanded; frame kept), change-data `playing:false`, new log row `music/pause | GM paused Town ambience`. B resumes → B mounts (frame 1) and A **stands down** (`Ambience started in another tab…`, frame 1→0) — double-audio hazard closed. Owner-local pause/resume emitted ZERO adoption lines (self-echo guard). Stop → both tabs' transport disabled, `music/stop` row. No accidental reloads (`__noReload` markers intact).
- **Tests**: new file 7/7; touched folders (`src/components/sidebar/` + `src/services/ui/`) 240/240 — includes the dead-track exhaustion lane and all existing MusicPlayer contracts; full suite green (see fix-run report). `npm run lint` zero warnings; `no-timers-guard.mjs` OK (no timers added).
- **Cleanup**: Admin panel Clear Change Data + Clear Campaign Log (native confirms accepted); GET-verified `change-data {}`, `log []`, `music` key absent (`{value:null}`). Overrides were never edited (editor untouched — no Reset needed).

### Known edges (documented, not regressions)
- Same-mood cross-tab re-click while another tab plays commits byte-identical transport bytes → `setRuntimeValue`'s deep-equal early-return means no echo to adopt and the clicking tab's locally-mounted player double-plays (pre-existing, unchanged by this fix).
- Remote `volume` changes still don't drive a non-origin tab's player volume mid-playback (out of scope; each tab initializes from the shared key on mount).
