# Music queue: an unplayable YouTube track (error 150 etc.) triggers an uncapped load → error → skip → wrap loop while a mood is playing

## Summary
`youtubePlayer.js` onError advances the queue with modulo wrap, so when every track in a mood is unplayable (YouTube error 150 = embedding disabled — common for real videos), the single-track queue re-loads the SAME dead video immediately, erroring again forever: live-observed 186 identical console errors (~1 per second) over a ~4-minute session with zero backoff, zero attempt cap, and zero user-visible feedback — the mood button stays active and the UI says “playing” while nothing can play. Only Stop (`intentStopped`) breaks the loop.

## Steps to reproduce
1. In test-campaign (localhost), open the Music editor (`button[title="Edit tracks for this mood"]`), select mood Town, and Save a single known-unembeddable/invalid video id (used here: `Me9VLOSaJkg`).
2. Click `button[title="Play Town ambience"]`.
3. Open DevTools console (or the vite server log — client console errors forward there).
4. Watch: `YouTube playback error (code 150) for video Me9VLOSaJkg. Skipping to next track.` repeats indefinitely (~1/s) while the Town button remains `active`.
5. Press Pause — UI flips to paused; press Play — the error storm resumes.
6. Press Stop — the loop finally silences.

## Expected behavior
A queue whose playable tracks are exhausted should stop after a bounded number of consecutive failures (e.g. one full pass of the queue) and surface honest feedback (toast / inline “No playable tracks for this mood”), flipping `playing` false. Skipping “to next track” that wraps to the same failed track is not a skip.

## Actual behavior
186 identical `console.error` lines accumulated (console read counted 186, stable at 186 only after Stop). loadVideoById spam continues against the YT iframe with no backoff. No UI feedback anywhere: mood button stays active, Play/Pause behave as if audio works. All 186 errors are this one line — the app console is otherwise clean.

## Likely location
Confident: `src/services/ui/youtubePlayer.js` — `onError` handler (~:42): `console.error(…Skipping to next track); if (!intentStopped) advanceQueue();` and `playAt()` wraps with `((index % queue.length) + queue.length) % queue.length`; a 1-dead-track queue re-selects the same video. `advanceQueue` has no consecutive-failure counter and no dedup against the just-failed id.

## Suggested fix
Track consecutive failures (reset on `onStateChange(PLAYING)`): if `failCount >= queue.length`, stop the queue — set `intentStopped`-equivalent, `player.stopVideo()`, and notify the UI (MusicPlayer already has a toast lane + the synced `music` key) so the mood can un-arm itself. Optionally also skip immediately re-loading the same failed id.

## Severity
Broken feature (bounded blast radius) — any mood whose videos are embedding-disabled becomes an infinite console/network churn loop with a lying “playing” UI; GM audio is a convenience feature, so data is not at risk, but the loop never self-terminates except via Stop.
