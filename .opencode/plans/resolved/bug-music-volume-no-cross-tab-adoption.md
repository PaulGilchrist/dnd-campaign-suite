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

## Summary
Music volume was the write-only zombie field of the shared `music` key: seeded once from `DEFAULT_MUSIC` before async hydration and never re-seeded, so remote volume changes AND fresh reloads ignored the persisted value. Fixed by folding `volume` into the 576be121d adoption doctrine — a new echo-safe adoption effect (mount baseline → adopt on every external change of `music.volume`) plus recording the acting tab's own commit in a `localVolumeRef` sibling of `localMusicRef`, so the SSE echo can never clobber an in-flight slider drag. The existing `useEffect([volume]) → youtubePlayer.setVolume` then drives the owner's iframe with the adopted value, no remount. Live-verified two-tab in test-campaign: A↔B slider mirroring both directions with the owner frame intact, full-reload seed from the persisted value, control (acting tab) unaffected, and mood/playing adoption unregressed. 4 new vitest pins; sidebar folder 132/132; lint clean.

## Resolution
FIXED — the "Likely location" guess was accurate; nothing drifted.

**What was actually wrong (confirmed live + in code):** exactly as filed — `useState(music.volume ?? DEFAULT_VOLUME)` (line 32) seeds before async store hydration lands, and the 576be121d adoption effect compares only `{mood,playing}`, so no path ever consumed `music.volume` after mount. Live repro at HEAD: B owned the player (frames B1/A0), A set 20% → server `music.volume:0.2`, B's slider stayed `60`; full reload of B + campaign re-select STILL showed `60`.

**Fix (files changed):**
- `src/components/sidebar/MusicPlayer.jsx` — (1) new `localVolumeRef` + volume adoption effect mirroring the transport guard: first observation = mount baseline (useState already holds it), then adopt any `music.volume` different from the last observation/commit; (2) `handleVolume` records its committed value in `localVolumeRef` (commitMusic-style self-echo guard) so the SSE echo of a local drag is skipped and cannot clobber in-flight state. The existing `[volume] → youtubePlayer.setVolume` effect drives the owner's iframe unchanged. No server change; state rides the existing shared `music` change-data key (server-first intact). 5e/2024 sibling question: N/A — music is ruleset-agnostic (single campaign key, no dual-ruleset path).
- `src/components/sidebar/MusicPlayer.remote-adoption.test.jsx` — new `MusicPlayer volume adoption` describe (4 pins): sync-persisted mount seed (70), **hydrate-after-mount seed 60→20** (the core race), remote volume live-mirrors into owner slider + exactly one `setVolume(0.25)` iframe command, and echo-safety (own-echo fires zero player commands; subsequent foreign 0.45 still adopts).

**Verification:**
- `npx vitest run MusicPlayer.remote-adoption.test.jsx` → 11/11 (7 existing adoption pins unregressed).
- `npx vitest run src/components/sidebar/` → 11 files, **132/132** passed (folder was ~119 at 576be121d; all green, re-pinned).
- `npm run lint` → zero warnings/errors.
- Playwright live re-run (test-campaign, two tabs @ :5173): post-fix reload of both tabs seeds BOTH sliders to the persisted 20; B plays Combat (owner frame 1), A sets 35 → **B's slider live-mirrors 35 zero-reload** (server 0.35); control: owner B drags 50 → B follows AND A mirrors 50 (server 0.5); full reload of B (marker-gone proven) re-seeds 50. Mood/playing sanity on the touched component: A's Pause makes owner-B pause with the canon INFO `Ambience paused in another tab — pausing this tab's player` and B KEEPS its frame; own Stop behaves as before (player stopped, frame mount unchanged — pre-existing semantics, not a regression). Audible loudness inside the cross-origin YT iframe remains unassertable (same caveat as prior music bugs; the `setVolume` command on the owner is test-pinned).
- Cleanup: `admin/clear-change-data` + `admin/clear-log` POSTed, GET-verified `{}` / `[]` after close.
