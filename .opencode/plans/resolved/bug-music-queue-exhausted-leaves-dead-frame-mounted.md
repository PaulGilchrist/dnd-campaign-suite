# Music queue-exhausted lane leaves the dead YouTube embed mounted

## Summary
When the queue-exhaustion lane un-arms a mood because every track failed (e.g. all videoIds are dead), the frame-owning tab keeps its `.yt-music-frame` iframe mounted — a silent, dead embed survives on the last actor tab until the next remote arm or a manual stop. This directly contradicts the ownership law `improve music-local-stop-unmount` (047efa4e1) just established for the Stop and delete-while-playing lanes: "no dead embed survives the stop … frame-count is again a trustworthy ownership witness on the last actor tab."

## Steps to reproduce
1. In `test-campaign` on `http://localhost:5173` (GM/localhost tab), open the Music view.
2. Forge an override so a built-in mood has ONLY a dead track (legal bytes on the PATCH-intent lane):
   `curl -X POST -H 'Content-Type: application/json' -d '{"overrides":{"tavern":[{"videoId":"zzBogusDeadID","title":"YY Bogus Track"}]}}' http://localhost/api/campaigns/test-campaign/music`
3. Click `Play Tavern ambience` (`button[title="Play Tavern ambience"]`). One `.yt-music-frame` mounts; `music` store reads `{mood:'tavern', playing:true}`.
4. Wait for the YouTube player error (a few seconds; console logs `YouTube playback error (code 150) for video zzBogusDeadID. No playable tracks left — stopping.`).
5. Observe: the toast `No playable tracks for Tavern ambience` renders, the chip un-highlights, the log gets `Ambience stopped — no playable tracks for Tavern (zzBogusDeadID)`, and change-data `music` reads `{mood:null, playing:false}` — but `document.querySelectorAll('.yt-music-frame').length` is still **1**. Repeat arms of the same dead mood each end with the frame still mounted (reproduced twice, plus the same face on a `custom-yy-probe` category with only a dead track).

## Expected behavior
Queue exhaustion is a stop: the owning tab should release its player the same way the Stop button does since 047efa4e1 — `youtubePlayer.stop()` plus `setPlayerMounted(false)` so the mount-effect cleanup disposes the embed and the frame count drops to 0 on every mounted tab.

## Actual behavior
The bytes and the audit row are correct (`{mood:null, playing:false}` + one `action:'no_playable_tracks'` row), but the dead embed stays mounted on the owning tab (`frames:1` while nothing plays and the chip is inactive). Consequences: frame-count stops being a trustworthy ownership witness on exactly that lane, and a dead YouTube embed (with its third-party traffic) keeps living in the tab until the next REMOTE arm triggers the adoption teardown or the user presses Stop on a future mood.

## Likely location
Confident (code read): `src/components/music/MusicPlayer.jsx` — the `handleQueueExhausted` effect (~lines 493–509) commits `stopCommit(music)` + toast + log row, but unlike `stopMusic` (~line 483) it never calls `setPlayerMounted(false)` (the improve commit added that to the local Stop lane only). `src/services/ui/youtubePlayer.js` `handleError` correctly halts the transport and dispatches `music-queue-exhausted`; the consumer just under-releases.

## Suggested fix
Mirror the `stopMusic` release inside `handleQueueExhausted`: call `setPlayerMounted(false)` right after (or before) `commitMusic(stopCommit(music))`, matching the 047efa4e1 comment block — the mount-effect cleanup disposes the embed, bytes/rows stay byte-identical, and the pagehide guard already sees `playing:false` so nothing extra is written on reload. Add a pin to `MusicPlayer.local-stop-unmount.test.jsx` (or a queue-exhausted sibling) asserting frame count 1→0 after a full-queue error pass.

## Severity
Minor UX issue — no data corruption (store bytes and log rows are honest), but it regresses the just-shipped "no dead embed survives the stop" invariant on one lane and leaves third-party embed traffic alive after the table heard "no playable tracks."

## Resolution
FIXED 2026-11-20 — the bug file's diagnosis was confirmed exactly: `handleQueueExhausted` in `src/components/music/MusicPlayer.jsx` committed `stopCommit(music)` + toast + log row but never released the frame, so the dead `.yt-music-frame` survived on the owner tab.

**What changed:**
- `src/components/music/MusicPlayer.jsx` — `handleQueueExhausted` now calls `setPlayerMounted(false)` before `commitMusic(stopCommit(music))`, mirroring the 047efa4e1 `stopMusic` release law. One line + comment: the transport already ran its own `stop()` inside `youtubePlayer.js handleError` *before* dispatching `music-queue-exhausted` (verified in code, `youtubePlayer.js:53-61`), so unlike `stopMusic` the handler does not need a second `youtubePlayer.stop()` — `setPlayerMounted(false)` alone lets the mount-effect cleanup (`MusicPlayer.jsx:358-362`) call `youtubePlayer.dispose()`, destroying the embed. Bytes, toast and log row are untouched; the pagehide guard (`playerMounted && playing`) sees an already-released tab and writes nothing on reload. No dual-ruleset twin exists (the music lane is ruleset-independent; `TvMusicTransport.jsx` never mounts a frame — checked, no sibling fix needed).
- `src/components/music/MusicPlayer.queue-exhausted.test.jsx` — new pin `exhaustion releases the frame like a stop — 1→0, bytes and row untouched, re-arm re-mounts fresh`: frame count 1→0 after a full-queue error pass, `youtubePlayer.dispose` called once, arm+stop POST bytes and the `no_playable_tracks` row byte-identical, and a re-arm freshly re-mounts exactly one frame (`ensurePlayer` ×2).

**Verification:**
- Repro re-lived pre-fix on `:5173`: forged `{"overrides":{"tavern":[{videoId:'zzBogusDeadID',…}]}}` → arm Tavern → console `YouTube playback error (code 150) … No playable tracks left — stopping.` → `{mood:null,playing:false}` + honest `no_playable_tracks` row + chip un-highlighted, BUT `frames:1`.
- Post-fix live re-run (same repro): arm → `frames:1`, chip active; on error the toast `No playable tracks for Tavern ambience` (`music-toast music-toast-error`) renders AND `frames` drops to **0** (iframe count 0 in the DOM), chip inactive, no `Playing in another window` note; store `{mood:null,playing:false}`, exactly one `no_playable_tracks` row per arm — all three exhaustion rides matched "Expected" exactly.
- Adjacent sanity: Stop-button lane re-lived byte-identical (arm 1 frame → Stop → 0 + dispose, re-arm freshly re-mounts 1); two-tab remote-arm adoption intact — bystander released its frame on the owner's arm echo and showed `Playing in another window`.
- Tests: `npx vitest run src/components/music/MusicPlayer.queue-exhausted.test.jsx` 4/4; touched-area run `src/components/music` + `youtubePlayer.dead-track-exhaustion.test.js` + `src/hooks/runtime` → 30 files / 306 tests passed; full suite green; `npm run lint` zero warnings.
- Cleanup: forged overrides removed via Admin → Clear Change Data + Clear Campaign Log (dialogs accepted); exit baseline GET-verified `change-data {}` + `log []`, music key evicted (`{value:null}`), `character-change-data.json`/`campaign-log.json` ABSENT on disk, `git status --porcelain public/` empty.
