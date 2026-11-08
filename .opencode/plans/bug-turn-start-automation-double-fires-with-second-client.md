# Turn-start automation double-fires when a second client views Initiative (and the visitor client POSTs GM-authoritative state)

## Summary
When two clients (GM localhost tab + one LAN visitor tab) both have the Initiative view open, every turn-START automation seam executes once PER CLIENT: the GM's `Next` click runs `applyTurnStartGate` locally, then the SSE echo of `activeCreatureName` independently passes the visitor's (stale) round-gate and runs `applyTurnStartPass` → `applyTurnStartEffects` again. Observed: byte-identical audit rows 6 ms apart, duplicate effect writes, and the non-localhost visitor device POSTing GM-authority runtime keys (`/FeyRanger`, `/__initiative__`).

## Steps to reproduce
1. In `test-campaign`, ensure a character with a turn-START automation and a once-per-combat latch: FeyRanger (Dread Ambush / Ambusher's Leap — logs `ability_use` "FeyRanger's Ambusher's Leap — Speed increases by 10 ft until the end of this turn." at its round-1 turn start) is sufficient. Reset its latch: `PATCH /api/campaigns/test-campaign/FeyRanger {"value":{"dreadAmbushSpeedActive":false}}`.
2. GM tab (localhost:5173): select test-campaign → Initiative. Make sure the board will give FeyRanger a round-1 turn (e.g. Initiative "Clear" → role=dialog "Clear Initiative Board" → `Yes, Clear Board` re-seeds round 1 with the 13 PCs).
3. Open a second tab in an ISOLATED context (`isolatedContext:'lan'`) at `http://<LAN-ip>:5173` (e.g. `http://192.168.0.44:5173`), select test-campaign, navigate to Initiative (the view is read-only for LAN but renders).
4. Note the current Dread Ambush row count: `GET /api/campaigns/test-campaign/log`.
5. On the GM tab, click `Next →` until `activeCreatureName` becomes `FeyRanger` (verified here: 8 clicks from post-clear start).
6. Re-read the log; inspect the visitor tab's network requests.

## Expected behavior
One `ability_use` "Ambusher's Leap" row per turn seam — the repo's own law ("fires-once-not-twice", round-scoped `lastAppliedTurnStartCreature` gate, pinned by `turnStartEffects_additional.test.js`). The visitor client must not write game state (writes are GM-authorship; see "bug-player-clients-can-hijack-initiative" family).

## Actual behavior
- TWO byte-identical "Ambusher's Leap" rows land 6 ms apart per seam (with both tabs on Initiative). Control (GM tab only, same walk): exactly ONE new row — proving the duplication is the second client, not a GM self-echo.
- The LAN visitor tab performs the automation's writes itself: `POST /api/campaigns/test-campaign/FeyRanger` ×2 and a stream of `POST /api/campaigns/test-campaign/__initiative__` (its own gate stamp, written WITHOUT `skipSync`) — all 200 OK.
- For idempotent, latch-guarded effects like Dread Ambush the visible damage is just a chatty audit row; for NON-idempotent turn-start effects (Regenerate heal ticks, Heroism temp HP, Elder Champion regeneration, legendary-uses regain, resource resets) each additional viewing client can apply the effect again, and the gate-stamp POSTs from every client race each other.

## Likely location
Race between the SSE lane's dedupe ref and the GM's gate stamp:
- `src/components/initiative/navigationHandlers.js` `applyTurnStartGate` (~L171-178): sets local ref + stamps `__initiative__.lastAppliedTurnStartCreature` + mutates `updatedSummary.lastAppliedTurnStartCreature`, but the stamped combatSummary is persisted only AFTER `await applyTurnStartEffects(...)`.
- `src/components/initiative/sseHandlers.js` `handleActiveCreatureNameChange` (~L107-146): the `activeCreatureName` echo is processed BEFORE a stamped combatSummary arrives; `shouldApply = prevActive !== newActive && lastAppliedTurnStartCreatureRef.current !== gateKey` reads the client's stale ref → visitor (or any second client) applies.
- `src/components/initiative/Initiative.jsx` (~L241-250) ref hydration is a React effect on `[campaignName, combatSummary]` — too late for the async SSE handler's decision.
`applyTurnStartPass` has no GM/localhost ownership guard.

## Suggested fix
Make the server (or the GM writer) the single executor/authority at the turn seam:
1. Cheapest: in `sseHandlers.applyTurnStartPass`, run the EFFECTS only on the GM-authoritative client (thread `isLocalhost` into the handler and skip `applyTurnStartEffects` + the `setRuntimeValue('__initiative__'...)` post on non-localhost; visitors keep mirror/adopt reads). This closes both the double-fire and the player-hijack writes.
2. Stronger: gate inside `applyTurnStartEffects` per effect on a server-merged stamp (the `dreadAmbushSpeedActive` await-read/await-write latch loses a same-tick double dispatch — 6 ms apart proves it), or have the GM stamp `lastAppliedTurnStartCreature` in the SAME POST as `activeCreatureName` so no consumer can decide before the gate lands.
Investigate first: read how the test suite simulates the seam (single client only — the cross-client face is untested) and whether `useSSEEqualityGuard` ordering guarantees cs-before-name; it doesn't (server publishes in write order).

## Severity
Data integrity risk — duplicate audit rows are the visible symptom, but every non-idempotent turn-start effect applies once per viewing client, and visitor devices gain write access to GM-authority runtime keys.
