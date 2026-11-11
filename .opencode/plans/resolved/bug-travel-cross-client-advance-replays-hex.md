# Cross-client travel advance replays the last hex (double budget charge, ghost log row)

## Summary
When a shared overland trip is advanced by one client, another client that adopted that advance via the SSE echo still drives `advanceOneHex` off a stale local `pathIndexRef`. Its next Advance press re-walks the already-traversed hex: it charges the shared daily travel budget again, writes a duplicate `travel advance` log row, and no-ops the index — before advancing normally on the following press.

## Steps to reproduce
Start from a clean-ish test-campaign with an active outdoor map whose `partyPosition` is set (the run used sandbox `jt-travel`, party (5,3), weather clear, `travel-eventFrequency:'none'`, `travel-dailyBudget:12`).

1. Tab A (GM, localhost:5173): open the map, press the Travel tool, click a destination hex ~9 hexes away, Advance the full route to arrival (clean, one charge per step — establishes the control).
2. Arm a NEW destination 2 hexes away (path = 3 points, costs 0.9375/hex under rain).
3. Tab B (visitor, `http://<en0-ip>:5173`, isolated context): select campaign → `Map` (auto-opens the active outdoor map) → Back to 2D if needed → press the Travel tool — the panel ADOPTS the live shared trip (Advance One Hex enabled).
4. Tab B: click Advance once. Server: `travel-pathIndex` 0→1, accrued +0.9375. Tab A's tube live-mirrors (behind/ahead split updates).
5. Tab A: click Advance ONCE. Observe server change-data.
6. Tab A: click Advance again.

## Expected behavior
Step 5 should take the shared party from hex 1 to hex 2 (arrival at the final hex): exactly one budget charge, `travel-pathIndex` 1→2/arrival clear, one `travel advance` row.

## Actual behavior
Step 5 charges the budget (accrued 7.6875 → 8.625, GET-verified) and logs a `travel`/`advance` row, but `travel-pathIndex` stays **1** — it re-wrote the hex the visitor already moved through (party position unchanged, no arrival bytes). Only the SECOND press (step 6) arrives. Live capture: trip 2 of 2 route hexes cost **3 advances** (final accrued 9.5625 = trip-1 6.75 + 3×0.9375). At a nearly-spent daily budget this replay can even fire the false `dayExhausted` wall before a real step.
Arrival itself is honest: trip keys REMOVED (not null-ghosted), `travel-started-by` null-released, day-state survives, toast `Arrived at destination — travel complete`, party file writeback (16,2).

## Likely location
Confident: `src/hooks/management/useTravelManagement.js`. `advanceOneHex` reads `pathIndexRef.current` (line ~494), but the ref is only backfilled at mount/resume (~:271), arrival-clear (~:443), new-destination (~:463) and LOCAL advance (~:538). No effect mirrors the synced `pathIndex`/`path` into the refs when an external SSE echo changes them — the code comment at :149-153 explicitly acknowledges the refs must be repopulated "or every advance silently no-ops", but only the mount/resume lane does it. The mirror UI (tube, panel) reads the synced STATE, so display is correct while the press math is a step behind — the classic display/truth split. Symmetric: the visitor tab replays GM steps the same way (same hook; only the GM face was ridden live).

## Suggested fix
Add an adoption-only backfill: `useEffect(() => { pathRef.current = safePath; pathIndexRef.current = safePathIndex; }, [path, pathIndex])` (null-proof guards already exist as `safePath`/`safePathIndex`). A local advance sets the ref first and the echo then writes the same bytes, so it is idempotent; alternatively make `advanceOneHex` read the synced values with the same coercions and drop the refs. Check the §87/§93 harness laws — nothing else consumes these refs.

## Severity
Data integrity risk — the shared daily travel budget is a game-state resource; a phantom charge per cross-client seam can falsely lock the party into dayExhausted/camp, and the campaign log gains dishonest duplicate rows.

## Resolution
FIXED 2026-11-11 (fix run). The "Likely location" diagnosis was correct: `advanceOneHex` drives off `pathRef`/`pathIndexRef`, which were only backfilled at mount (`useRef(path)` seed), file-resume adoption, arrival-clear, new-destination and LOCAL advance. An external SSE echo (the other tab advancing the shared trip) updated only the SYNCED `travel-path`/`travel-pathIndex` state — so the adopting tab's display (tube/panel read the synced STATE) moved while its press math stayed a step behind, re-walking the traversed hex.

**Fix** — `src/hooks/management/useTravelManagement.js`: one adoption-only backfill effect added next to the null-proof render guards, mirroring the synced values into the refs through the same `safePath`/`safePathIndex` coercions:

```js
useEffect(() => {
  pathRef.current = safePath;
  pathIndexRef.current = safePathIndex;
}, [path, pathIndex]);
```

Idempotent on every existing ref write (local advance sets the ref first, the echo then writes the same bytes through the store; arrival-clear and new-destination likewise). It also self-heals two adjacent stale-ref faces the old lane silently shared: `startPlanning`/`cancelTravel` wrote synced `path:[]` without touching `pathRef`, and a null-echoed path now zeroes the ref instead of leaving stale bytes. The local-advance ref writes were KEPT (they keep same-tick double presses correct before the echo lands — the §87/§93 harness laws confirmed only `advanceOneHex` consumes these refs). No 2024 sibling needs the same change — the travel hook is ruleset-agnostic.

**Regression test** — `src/hooks/management/useTravelManagement.cross-client-advance.test.js` (4 tests): external pathIndex echo → next advance walks the NEXT hex once (one charge, idx 1→2, no replay); echo at penultimate hex → next press ARRIVES with the completed-trip key clears; external path REPLACEMENT adopted (walks the new route); local advance stays idempotent through its own echo. Pre-fix fingerprint: 3/4 tests fail with the fix temporarily removed; all pass with it.

**Verification**
- `npx vitest run src/hooks/management/useTravelManagement.cross-client-advance.test.js` → 4/4 PASS.
- `npx vitest run src/hooks/management/` → 20 files / 177 tests PASS. `npx vitest run src/components/hex-map/` → 48 files / 530 tests PASS (no pre-existing failures found). `npm run lint` → clean (zero warnings).
- **Live re-ride (test-campaign, sandbox `fix-travel` 40×20, party-centred, weather clear 0.75/hex, budget 12, eventFrequency none):** GM tab arms a 3-pt route → LAN-origin tab (`http://192.168.0.44:5173`) auto-ADOPTS and advances (server idx 0→1, accrued +0.75) → GM tab's tube live-mirrors behind/ahead `1/2` split → GM presses Advance ONCE: **arrives directly** — one budget charge (GET-verified 6.0→6.75), trip keys REMOVED, `travel-started-by` null-released, mode inactive, party writeback to the destination, exactly one `travel advance` + one `travel arrived` row for the trip, arrival toast on the presser. Expected behavior now occurs exactly.
- Adjacent sanity: solo (single-client) control trip 2 hexes = 2 charges + arrival honest; tube behind/ahead split renders and live-updates from the echo; both tabs 0 console errors; day-state keys survive arrival unchanged.
- Cleanup: sandbox map deactivated→DELETED (row buttons; the LAN tab's mounted board re-stamped it active once — MapContextSync law — so the tab was moved off the board view first), Maps-manager back to 4 owner fixtures (battle-arena md5 94fcd0bf byte-exact), change-data + campaign log cleared through the Admin-panel lane (`/admin/clear-change-data` + `/admin/clear-log`) with BOTH tabs closed (open-tab re-seed law), closed-tab two-pass GET-verified change-data `{}` + log `[]`, `git status --porcelain public/campaigns/` empty, servers stopped by PID.

