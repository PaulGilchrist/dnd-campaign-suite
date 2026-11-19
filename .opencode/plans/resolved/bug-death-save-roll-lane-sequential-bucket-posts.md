# Bug: death-save ROLL lane still issues sequential whole-bucket POSTs (the race family just fixed on the Clear lane)

## Summary
`4a291a1ec` collapsed `handleRemoveDead` from three sequential whole-bucket `setRuntimeValue` POSTs into one `setRuntimeBatch`, explicitly because "HTTP/1.1 socket fan-out gives same-origin POSTs no arrival-order guarantee" and a stale snapshot landing last can resurrect/diverge the bucket via the SSE echo. The sibling producer — `rollDeathSave` in the SAME file — was left untouched and still fires up to FOUR sequential whole-bucket POSTs on a terminal roll (isDead → deathSaves → deathFailures, plus currentHitPoints on a NAT 20). Any reordering where the earlier, less-complete snapshot arrives last leaves the server bucket divergent (e.g. `isDead:1` with `deathFailures` still `[t,t,f]`, or NAT-20 `currentHitPoints:1` with stale tracks).

## Steps to reproduce
Mechanism steps (the race itself is stochastic — 4/4 deterministic terminal cycles in the 2026-11-19 QA run landed consistent; the sibling lane was live-witnessed diverging 1-of-N cycles):
1. In `test-campaign`, open the EvasiveFighter sheet; set HP to 0 via the sheet HP editor (click the `Hit Points:` line, type 0, Enter) — death-saves block arms.
2. `PATCH /api/campaigns/test-campaign/EvasiveFighter {"value":{"currentHitPoints":0,"isDead":0,"deathSaves":[false,false,false],"deathFailures":[true,true,false]}}`.
3. Press the third failure (organic, or wrap `Math.random` → 0.22 around one click on `div.death-saves-roll`).
4. Immediately GET `/api/campaigns/test-campaign/change-data` and read `EvasiveFighter.{isDead,deathSaves,deathFailures,currentHitPoints}`. Repeating across many sessions can surface `isDead:1` with a stale 2/3 failures track (DEAD badge but wrong tracks — the exact UI/server divergence family of the just-fixed lane).

## Expected behavior
A terminal roll's cleared/set fields (isDead, both tracks, restore HP) should land as ONE merged `setRuntimeBatch` write, like `handleRemoveDead` (and like `CharHitPoints.handleValueChangeCurrentHitPoints`, which already merged its four death-bucket writes), so one commit = one POST = nothing to interleave.

## Actual behavior
`rollDeathSave` writes sequentially: `setRuntimeValue(name,'currentHitPoints',restoredToHp)` (NAT 20), then `setRuntimeValue(name,'isDead',1)` (fatal), then `setRuntimeValue(name,'deathSaves',…)`, then `setRuntimeValue(name,'deathFailures',…)` — each a full-mirror bucket POST with its own SSE echo. Not reproduced live this session (4/4 terminal cycles byte-consistent: fatal ×3 → `{isDead:1,fails:[t,t,t],chp:0}`, NAT 20 ×1 → `{chp:1,tracks reset}`), but the divergence mechanism is the one the same-day fix committed to eliminating, left standing on the roll producer.

## Likely location (confident — code-read)
`src/components/char-sheet/char-summary/DeathSavingThrows.jsx` — `rollDeathSave()` lines ~122-124 (NAT-20 HP write), ~143 (isDead write), ~153-154 (tracks writes). Whole-bucket POST + mirror semantics per playbook §57; the fixed sibling is `handleRemoveDead` lines 74-87 in the same file.

## Suggested fix
Collapse the per-outcome writes in `rollDeathSave` into a single `setRuntimeBatch(name, {...}, campaignName)`: build a `writes` map (`deathSaves`/`deathFailures` always; `isDead:1` when `result.result==='dead'`; `currentHitPoints:restoredToHp` when non-null) and issue one batch, mirroring the `handleRemoveDead` / CharHitPoints merged-batch idiom. Log rows keep their current order/shape. Add a wire-shape pin (fetch spy, one POST per terminal roll with all fields present) like `DeathSavingThrows.clear-single-write.test.jsx`.

## Severity
Data integrity risk — intermittent, self-healing on the next write, but exactly the class (whole-bucket last-writer-windover leaving DEAD/track divergence) the project just ruled unacceptable and fixed on the adjacent lane.

## Resolution
**FIXED 2026-11-19 (fix run).** The code-read diagnosis was confirmed exactly, and the race mechanism was witnessed on the wire pre-fix.

**Live pre-fix reproduction (test-campaign, :5173, fetch spy on `window.__posts`):** EF sheet HP editor → 0, scoped PATCH `deathFailures:[t,t,f]`, deterministic fatal roll (`Math.random`→0.22): the roll shipped **two sequential whole-bucket POSTs**, the FIRST one the exact divergence shape — `isDead:1` paired with the stale 2/3 track (`deathFailures:[t,t,f]`). NAT-20 leg (re-arm, `Math.random`→0.97): two sequential POSTs, the first carrying `currentHitPoints:1` with the **stale pre-roll track** (`deathFailures:[f,f,t]`). (POST count is 2–4 per roll depending on which fields actually differ from the mirror — `setRuntimeValue`'s `valuesEqual` self-skip elides unchanged keys; the stale intermediate is present whenever more than one field mutates.) This session's samples still landed consistent server-side — the bug is the intermediate bodies on the wire, not a guaranteed terminal divergence.

**Fix:** `rollDeathSave` in `src/components/char-sheet/char-summary/DeathSavingThrows.jsx` now builds a `writes` map (`deathSaves`/`deathFailures` always; `isDead:1` when fatal; `currentHitPoints` when `restoredToHp !== null`) and issues ONE `setRuntimeBatch` — mirroring the `handleRemoveDead` / CharHitPoints merged-batch idiom. Log rows keep their current order/shape (roll row → stable/dead finality row, verified byte-pattern-identical to the pre-fix session). Unused `setRuntimeValue` import dropped.

**Dual-ruleset check:** `deathSaveRules.js` has no 2024 twin (single module shared by both rulesets) — one fix covers both.

**Residual found while scoping (filed, not parked):** the PROMPT-modal producer `handleRoll` in `src/components/common/DeathSavePromptModal.jsx:241-250` still fires the same sequential per-key writes plus a duplicate HP restore via the `death-save-result` listeners → FILED `bug-death-save-prompt-modal-roll-lane-sequential-bucket-posts.md` (its cross-listener write order needs a separate owner-visible decision; sheet lane is fully closed here).

**Files changed:**
- `src/components/char-sheet/char-summary/DeathSavingThrows.jsx` — merged roll write
- `src/components/char-sheet/char-summary/DeathSavingThrows.test.jsx` — roll-path pins moved from sequential `setRuntimeValue` to the merged `setRuntimeBatch` contract
- `src/components/char-sheet/char-summary/DeathSavingThrows.roll-single-write.test.jsx` — NEW wire-shape pin (real store module + fetch spy, mirrors `DeathSavingThrows.clear-single-write.test.jsx`)
- `.opencode/plans/bug-death-save-prompt-modal-roll-lane-sequential-bucket-posts.md` — NEW tracker for the modal-lane residual

**Verification:**
- `npx vitest run DeathSavingThrows.roll-single-write.test.jsx` — 3/3 (fatal: one POST, `isDead:1` + both tracks + `currentHitPoints:0` passthrough + 2 ordered log rows; NAT 20: one POST with restored HP + reset tracks; non-terminal: one POST, tracks only).
- `npx vitest run src/components/char-sheet/char-summary/` — 58 files / 707 tests green; adjacent `DeathSavePromptModal.*` + `deathSaveRules` suites — 6 files / 81 tests green (untouched lanes unregressed).
- `npm run lint` — zero warnings; `node .opencode/plans/no-timers-guard.mjs` — OK.
- Live re-verification (:5173, fresh reload + re-select, single spy layer): fatal roll → **exactly ONE** bucket POST `{isDead:1, deathSaves:[f,f,f], deathFailures:[t,t,t], currentHitPoints:0}` and DEAD badge; Clear-death badge × → still ONE batch POST clearing the track, Roll re-arms; NAT-20 roll → **exactly ONE** bucket POST `{currentHitPoints:1, both tracks reset}`, HP line reads 1/112 (sheet HP editor lane sanity-intact). Server `GET /change-data` byte-consistent at every step.
- Cleanup: tab closed, headless admin clears answered 200, `change-data {}` + log `[]` GET-verified; zero char-file surgery; dev pair left running.
