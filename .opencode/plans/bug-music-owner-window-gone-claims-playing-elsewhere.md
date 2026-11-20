# Shared ambience keeps claiming "Playing in another window" after the owning window dies

## Summary
The shared `music` store key keeps `playing: true` when the only window that owns the YouTube
player frame reloads or closes. Every surviving window (and the reloaded owner itself) then shows
the chip highlighted plus the note **"Playing in another window"** while zero `.yt-music-frame`
iframes exist anywhere — the ambience is silently dead table-wide and nothing self-heals. Recovering
requires a Pause→Play round trip, and the Pause writes a `Paused <Mood> ambience` log row for audio
that was not playing.

## Steps to reproduce
Single-window face (most common — a DJ reloads their own tab mid-session):

1. In `test-campaign`, on a localhost tab, open the **Music** view.
2. Click a built-in mood chip (e.g. `Play Tavern ambience`). Confirm the tab owns the frame:
   `document.querySelectorAll('.yt-music-frame').length === 1`, and
   `GET /api/campaigns/test-campaign/change-data` → `music.playing === true`, `music.mood === "tavern"`.
3. Reload that tab (navigate to `http://localhost:5173/`), re-select `test-campaign`, open **Music** again.
4. Observe: the Tavern chip is still highlighted, `.music-remote-note` reads **"Playing in another
   window"**, and `document.querySelectorAll('.yt-music-frame').length === 0`
   (`document.querySelectorAll('iframe').length === 0`) — there is no other window at all.
5. Click `[title="Pause"]`. `GET /change-data` → `music.playing === false`;
   `GET /api/campaigns/test-campaign/log` gains a row `message: "Paused Tavern ambience"` even though
   nothing had been playing since step 3.

Two-window face (the DJ closes their tab):

1. Tab A (localhost) and Tab B (either origin) both on `test-campaign`, Music view open.
2. In Tab A click a mood chip → Tab A holds `.yt-music-frame` (1), Tab B shows
   `Playing in another window` with 0 frames (correct at this point).
3. Close Tab A completely.
4. Tab B is unchanged: chip still active, note still `Playing in another window`, 0 frames, and the
   server still reports `music.playing === true`. Nothing ever adopts or releases that claim.

## Expected behavior
`music.playing` describes real playback. When no window holds the player frame there is no
playback, so either the shared state should fall back to a stopped/paused truth on the owner's
teardown (the same contract the component already implements for a *campaign switch*:
`Stopped ambience (left campaign)` + `{mood:null, playing:false}`), or the UI must stop asserting
that another window is playing and instead offer to take ownership.

## Actual behavior
- Shared state survives the owner's reload/close: `music = {mood:"tavern", playing:true, …}` with
  zero player frames in any client (verified live: `frames: 0, iframes: 0`, store `playing: true`).
- Surviving tabs render the honest-looking-but-false claim `Playing in another window`.
- No audio plays anywhere; the failure is silent (no notice, no error, no console entry owned by the
  app — the only console errors in the run were third-party `google.com/pagead` CORS noise from the
  YouTube embed).
- The only recovery is Pause (writes a bogus `Paused Tavern ambience` audit row) then Play (mounts a
  fresh frame and legitimately re-owns playback — verified: `frames: 1`, note gone).

## Likely location
Confident about the lane, guessing about the exact seam:
- `src/components/music/MusicPlayer.jsx` — `playerMounted` is per-tab `useState`; the only
  state-releasing teardown is the `[]`-dep unmount effect (`Stopped ambience (left campaign)`), which
  React never runs on a page reload or tab close. Nothing re-asserts ownership on mount, and the
  remote-adoption effect early-returns via `if (!playerMounted) return;`, so a survivor never adopts
  the stale `playing:true` (by design) and never challenges it either.
- `server/routes/campaigns-changedata.js` `POST /api/campaigns/:campaign/music` — the lane is
  stateless shared storage; the SSE close handler in `server/routes/sse.js` removes the subscriber
  but releases no owner-held keys (precedent for a bounded teardown exists in
  `src/services/automation/common/savePrompt.js`, which writes liveness markers via a keepalive POST
  on `pagehide`).

## Suggested fix
Start with the cheap, timer-free client lane, mirroring the savePrompt liveness precedent
(the app forbids game timers, so this must stay event-driven, never a countdown):

1. On mount, a client that hydrates `music.playing === true` while it holds no frame cannot know
   whether a live peer owns playback. Make the note honest instead of asserting a specific claim —
   e.g. `Ambience claims playback — press Play to take over` — and while no local frame exists let a
   single Play click take ownership directly (today Play is not even rendered in that state; only
   Pause is, so the DJ must pause first).
2. Optionally add a keepalive release: in the existing unmount lane, also fire a
   `navigator.sendBeacon`/`fetch(…, {keepalive:true})` `POST /music {mood:null,playing:false}` on
   `pagehide` **only when this tab owns the frame** (`playerMounted && music.playing`), reusing the
   `stopCommit` bytes so the log row stays byte-identical to the Stop button. Reload and close both
   fire `pagehide`; a crash still leaves the ghost, which is why the wording fix in (1) matters.
   Check `src/services/ui/sseClient.js` — it already registers a `pagehide` listener, so the
   pattern and the ordering (SSE torn down vs beacon sent) are worth reading first.

## Severity
Minor UX issue — no data corruption and playback is recoverable in two clicks, but the table gets
silent audio loss with an actively misleading explanation, and the recovery path writes a false
audit row (`Paused <Mood> ambience`) into the campaign log.
