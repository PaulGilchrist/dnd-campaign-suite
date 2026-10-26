# Travel never sets `sessionState.phase = 'travel'` — `MODES.TRAVELING` has no producer

## Summary
`useTravelManagement` wraps the travel-mode setter so that entering `MODES.TRAVELING` sets the session phase to `travel`, and leaving to `inactive` restores `exploration` (but only if it currently owns the phase — the guard added in `e59497e69`). But **nothing in the codebase ever calls `setTravelMode(MODES.TRAVELING)`**. Travel runs entirely in `MODES.PLANNING`, so the `travel` phase is never written and the phase-restore branch never fires. The whole `sessionState` phase transition from travel is inert.

## Steps to reproduce
Starting state: `test-campaign`, an outdoor map with Travel tool available (this run used a throwaway "QA Hex 2" outdoor map, since deleted; any outdoor map works).

1. Open the outdoor map → travel tool (`button[aria-label*="Travel mode"]`).
2. Click the `Frequent` chip; plan a short route (click a hex near the party marker). Panel shows `REMAINING 2 hexes`, enabled `Advance One Hex`.
3. Advance to the destination (party arrives, arrival toast fires, panel closes). Repeat travel a few times (start, advance, arrive) to be thorough.
4. Read runtime state: `GET /api/campaigns/test-campaign/change-data` → look at `sessionState` and `travel-mode`; `GET .../log` → filter `type==='session_phase'`.

## Expected behavior
Per the comment at `useTravelManagement.js:66-71` ("TRAVELING engages the travel phase, INACTIVE returns to exploration"), starting/advancing travel should move `sessionState.phase` to `travel` and emit a `session_phase` log entry; on arrival/cancel it should return to `exploration`.

## Actual behavior
- `travel-mode` only ever holds `planning` (never `traveling`) — confirmed across the full session: `change-data['travel-mode']` was `planning` mid-travel and `inactive` after arrival/cancel.
- Before any combat event was accepted, `change-data.sessionState` did **not exist** (`null`) and there were **zero** `session_phase` log entries, despite many successful advances/arrivals/cancels.
- The only `session_phase` entry that ever appeared came from the auto-encounter path: `Session phase: exploration → encounter (travel event: Giant Eagle) — auto-encounter.`
- Source confirms it: `grep -rn "traveling" src/ --include='*.js' --include='*.jsx' | grep -v test` returns exactly ONE production line — the constant definition itself (`useTravelManagement.js:25`). No call site assigns or persists `MODES.TRAVELING`.

## Likely location
`src/hooks/management/useTravelManagement.js`. `MODES.TRAVELING` (line 25) is declared and read (line 72) but never written. The "plan a route / start advancing" handlers around lines 154-181 set `MODES.PLANNING`; the advance handler (lines 200-236) sets `PAUSED`/`INACTIVE` only, never `TRAVELING`. Confidence: high (grep-confirmed no producer + live-confirmed no `travel` phase ever written).

## Suggested fix
In the advance handler (the `advanceOneHex`/`planRoute` flow in `useTravelManagement.js`), call `setTravelMode(MODES.TRAVELING)` when the party actually begins moving along a planned path (i.e., a successful `Advance One Hex` that is not the final arrival step), so the existing `TRAVELING` branch at line 72 fires and `phase` becomes `travel`. On the last-hex arrival and on `cancelTravel` the existing `INACTIVE` branch will then correctly restore `exploration` (and the `readSessionPhase==='travel'` guard at line 76 will finally have a real `travel` phase to protect against the auto-encounter clobber it was written for). First verify against `useMapLoader.js:20` and the persistence round-trip that `traveling` is a legal persisted `travel-mode` value.

## Severity
Minor UX issue / incomplete feature — no crash or data loss (the session phase is currently "orchestration metadata no L1–4 feature consults yet", per `sessionService.js`), but the travel→`travel`→exploration lifecycle described in the code and the phase-ownership guard from `e59497e69` are both unreachable through the UI, so that guard's stated protection cannot engage in real play. Flagging because a future feature that gates on `phase === 'travel'` (§10.2/§10.4 per the comments) would silently see `planning`/`exploration` instead.

## Resolution
FIXED 2026-10-25 (subagent run). Diagnosis confirmed as filed — the black-box guess was accurate.

**What was wrong:** `advanceOneHex` moved the party while the mode sat in `MODES.PLANNING`; the only mode writes it made were `PAUSED` (event) and `INACTIVE` (arrival), so `MODES.TRAVELING` had zero producers and the session-phase wrapper branches (arm `travel` / restore `exploration`) were dead code. Live repro this run (new outdoor map "QA Phase Repro", plan → advance → event → skip → advance → arrive): mid-travel change-data `travel-mode` went `planning→paused` (never `traveling`), `sessionState` key never existed, zero `session_phase` log entries across full cycles.

**Fix (minimal, as suggested):** in `src/hooks/management/useTravelManagement.js` → `advanceOneHex`, a successful advance that neither arrived nor stopped for an event now calls `setTravelMode(MODES.TRAVELING)` (guarded by `travelMode !== MODES.TRAVELING` to skip same-value churn; `travelMode` added to the callback deps). Placement is deliberately AFTER both early returns so an advance performs at most ONE travel-mode write per tick (same-endpoint POSTs race — runtime-writes fingerprint). The existing setter wrapper then arms `sessionState.phase='travel'` (sessionService dedupes repeat arms) and the arrival/cancel `INACTIVE` branch restores `exploration` through the `readSessionPhase==='travel'` phase-ownership guard — which is now finally reachable. `e59497e69` semantics untouched: an `encounter` phase armed by the auto-encounter still survives the cancel race (pinned by `useTravelManagement.session-phase.test.js`, still green). Server truth: `travel-mode` has no keyValidator (free pass-through) and the map-persist `buildTravelInit` accepts any mode string ⇒ `traveling` is a legal persisted value; `travel` is in the server `sessionState` phase enum. No dual-ruleset sibling (pure travel hook, no 5e/2024 twin). No timers added.

**Files changed:**
- `src/hooks/management/useTravelManagement.js` — TRAVELING producer in `advanceOneHex`
- `src/hooks/management/useTravelManagement.traveling-phase.test.js` — NEW regression test (5 cases: mid-route advance writes `traveling` + arms phase `travel` + exact `session_phase` audit bytes; same-value churn writes exactly once; arrival and cancel each restore `exploration` with their own entry; event advance stays a single `paused` write, phase untouched)

**Verification:**
- `npx vitest run src/hooks/management/useTravelManagement.traveling-phase.test.js` → 5/5 pass (pre-fix, case 1 fails on the exact broken fingerprint: mode stayed `planning`, zero phase writes)
- `npx vitest run src/hooks/management` → 6 files / 91 tests pass; `npx vitest run src/components/hex-map` → 30 files / 346 tests pass
- `npm run lint` → clean (zero warnings)
- Live re-run in test-campaign: mid-route advance ⇢ change-data `travel-mode:'traveling'`, `sessionState:{phase:'travel',changedBy:'travel management'}` (survived a 20s idle — no timer churn); arrival ⇢ arrival toast, mode `inactive`, phase back to `exploration`; mid-travel Cancel ⇢ same restore; event leg ⇢ advance-with-event stays `paused` (single write). Three full cycles produced exactly 3 matched pairs of `session_phase` log entries: `exploration → travel (travel started) — travel management.` / `travel → exploration (travel ended) — travel management.`
- Cleanup: QA Phase Repro map deleted (named modal), Admin cleared change data + log (verified via API: `change-data {}`, `log []`, maps back to baseline).
