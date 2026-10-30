# Music volume is a write-only zombie field of the shared `music` key — never adopted by ANY tab, not even on fresh mount

## Summary
The campaign `music` key `{mood,playing,volume,overrides}` is shared and SSE-synced, and since 576be121d mood/playing transitions are adopted by every tab. But `volume` is held in a mount-time-seeded `useState` that initializes from DEFAULT_MUSIC before the async store hydration lands, and nothing ever re-seeds it. Result: a GM's volume change persists server-side, yet EVERY other tab's slider — and the tab that actually owns the YT player — ignores it; worse, even a full reload of the ignoring tab still shows the default 60, not the stored value. The persisted `music.volume` is read by no UI path at all; only the acting tab's local state ever drives `youtubePlayer.setVolume`.

## Steps to reproduce
Starting state: test-campaign, two localhost tabs (A and B).

1. On tab B, start ambience (`button[title="Play Combat ambience"]`) so B owns the player (B `.yt-music-frame` = 1, A = 0).
2. On tab A, set the volume slider to 20% (input+change with the native value setter, or drag).
3. `GET /api/campaigns/test-campaign/change-data` → `music.volume` reads `0.2` (the write landed server-side).
4. Read tab B's `.music-volume` value — it still reads `60` (stale). Read tab A's own slider — `20`.
5. Reload tab B fully and re-select test-campaign (reload lands on the campaign-select screen — the documented deselect quirk) — the slider STILL reads `60` while the server reads `0.2`: mount-time adoption is absent too, because `useState` initializes from `DEFAULT_MUSIC` before the async store hydration lands.
6. CONTROL: change the volume on tab B itself — B's slider + local player follow B's own state (the acting-tab write path is fine).

## Expected behavior
Consistent with mood/playing adoption (576be121d): the shared key's `volume` should live-mirror into every mounted tab's slider, and the tab owning the player should apply the new volume to its iframe without a remount. At minimum, a fresh mount should seed the slider from the persisted `music.volume` rather than the default.

## Actual behavior
- Server: `music.volume = 0.2` ✓ (write path fine, no console errors on either tab).
- Other tab B (the player OWNER): slider frozen at `60`, zero console output, no adoption effect — the shared key changed underneath it and nothing reacts. B's YT iframe keeps its own volume (code-certain: the `setVolume` effect tracks the LOCAL `volume` state only).
- Even after a FULL reload of B + campaign re-select, the slider reads `60` (verified live this run) — the persisted volume is consumed by no UI path: the single reader of `music.volume` is the `useState` initializer, which loses the hydration race to the default.
- Verdict framing: the UI divergence (slider ≠ server truth, across tabs AND across reload) is live-observed here; the audio divergence (owner tab's audible level ignoring the shared key) is code-certain — audible loudness itself was not asserted (cross-origin iframe, same caveat as the closed AE adoption bug).

## Likely location
Confident: `src/components/sidebar/MusicPlayer.jsx:32` — `const [volume, setVolume] = useState(music.volume ?? DEFAULT_VOLUME)` seeds once; there is no `useEffect` re-seeding `volume` when `music.volume` changes externally, and the 576be121d adoption effect (lines ~78–95) deliberately compares only `{mood,playing}` (the `commitMusic` ref carries just those two fields). `handleVolume` writes `setMusic({...music, volume})` so the key lands; adoption is the missing half.

## Suggested fix
Minimal: (1) seed-on-hydrate — an effect that adopts `music.volume` into local state whenever the hydrated/echoed value first arrives or changes externally (skip when it equals the last locally-committed value to stay echo-safe); the existing `useEffect([volume]) → youtubePlayer.setVolume` then naturally drives the owner's iframe without further changes. Optionally fold `volume` into the `commitMusic` adoption ref alongside mood/playing for a stricter self-echo guard. Re-pin the MusicPlayer test folder (119 tests per 576be121d's run).

## Severity
Minor UX issue (with a small sync-correctness tail) — no game state is affected, but it is the one remaining field of a headline SSE-synced key that does not live-mirror, so two GMs at one machine hear/see different volumes than the shared state claims.
