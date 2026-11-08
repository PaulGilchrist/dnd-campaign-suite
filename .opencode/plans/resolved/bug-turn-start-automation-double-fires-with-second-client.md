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

## Summary
Fixed. The SSE-mirrored turn-start pass (`applyTurnStartPass` in `initiative/sseHandlers.js`) executed on EVERY client that had the Initiative view open — with no GM/localhost ownership guard — so a LAN visitor's `activeCreatureName` echo (which always arrives BEFORE the GM's stamped `combatSummary`, since the server publishes in write order and the GM POSTs the name first) passed the visitor's own stale round gate and re-ran the whole lane: duplicate automation execution + POSTs to GM-authority keys. Fix threads `isLocalhost` into `createSseEventHandler` and guards the pass: non-localhost (or option-omitted, fail-closed) clients only mirror (name state, boundary cache write, expiry, CLA-307/MN-003 skipSync turn-end mirrors) and adopt the executor's writes via the ordinary SSE lanes. Live re-verification in test-campaign: GM + LAN visitor both on Initiative, 8-click walk to FeyRanger = exactly ONE `ability_use` "Ambusher's Leap" row (was 2, 8 ms apart at repro); visitor network shows ZERO POSTs to `/__initiative__`, `/FeyRanger`, `/log` (was 7 + 2 + 1); visitor board mirror still live (13 cards, active card follows). Pinned by new `sseHandlers.turn-start-gm-ownership.test.jsx` (5 legs); full initiative folder 634/634 green, lint zero warnings.

## Resolution
**What was actually wrong** (confirms the bug file's "Likely location"): `handleActiveCreatureNameChange` → `applyTurnStartPass` in `src/components/initiative/sseHandlers.js` had no client-ownership check. The GM's `handleNextCreature` POSTs `activeCreatureName` (navigationHandlers.js:290) BEFORE the gate stamp (`__initiative__`/cs stamp inside `applyTurnStartGate`) and the final stamped `combatSummary` persist (navigationHandlers.js:314), so ANY second client with Initiative mounted processes the name echo while its own `lastAppliedTurnStartCreatureRef` still holds the PREVIOUS seam's gate key — `shouldApply` is true and the visitor executes the full GM lane: `applyTurnStartEffects` (duplicate `ability_use` rows / non-idempotent effect re-application) + `setRuntimeValue('__initiative__', …)` and character-bucket POSTs WITHOUT `skipSync`. The ref-hydration effect (Initiative.jsx) can never win: per seam, the name event always precedes that seam's stamp. Repro confirmed live first: 2 byte-identical "Ambusher's Leap" rows 8 ms apart; visitor tab network captured `POST /__initiative__` ×7, `POST /FeyRanger` ×2, `POST /log`, `POST /CelestialWarlock`.

**Fix (suggested option 1, mirroring the established GM/localhost ownership-guard idiom — `createCreatureHandlers.js` `if (!isLocalhost) return`, `createAutoBreakConditionHandler.js:17`):**
- `src/components/initiative/sseHandlers.js` — `createSseEventHandler` accepts `isLocalhost` (default `false`, fail-closed like the `createNpcClickHandler` omitted-options doctrine); `applyTurnStartPass` early-returns for non-GM clients. All mirror/adopt reads (active-name state, boundary cache write, `expireStaleEffects`, CLA-307/MN-003 skipSync turn-end mirrors, combatSummary adoption) are untouched — visitors keep seeing everything the GM wrote.
- `src/components/initiative/Initiative.jsx` — threads the `isLocalhost` prop into `createSseEventHandler` (+ useCallback dep).
- Dual-ruleset: N/A — `sseHandlers.js` is the single shared consumer lane (no 2024 twin of `applyTurnStartPass`); `turnStartEffects.js` has one ruleset-agnostic dispatcher.
- Known residual (OUT OF SCOPE, pre-existing): a SECOND localhost tab (e.g. a TV on the GM machine — "isLocalhost cannot cover it") can still race the executor tab, since both are GM-authoritative; closing that needs the server/GM-stamp-in-same-POST option 2 from the bug file. The reported cross-client face (visitor writes + per-visitor duplication) is closed.

**Tests:**
- NEW `src/components/initiative/sseHandlers.turn-start-gm-ownership.test.jsx` — visitor runs ZERO GM-authority writes on a fresh boundary (no effects, no `__initiative__` POST, no stamped-summary write) while keeping every mirror read; GM fires exactly once + self-echo stays gated; omitted option = fail-closed.
- `sseHandlers-main.test.jsx` + `sseHandlers.malformed-active-echo.test.jsx` wiring marked `isLocalhost: true` (they pin the GM lane).
- `npx vitest run src/components/initiative/sseHandlers.turn-start-gm-ownership.test.jsx` → 5/5; `src/components/initiative` full folder → 82 files / 634 tests passed; `npm run lint` → zero warnings; `node .opencode/plans/no-timers-guard.mjs` → OK.

**Live re-verification (test-campaign, dev :5173 + LAN :192.168.0.44, exit state change-data `{}` + log `[]` two-pass GET-verified, tab network inspected, extra tabs closed):**
1. Fresh clear + Clear Board walk with GM + LAN visitor BOTH on Initiative: 8 Next clicks to FeyRanger → log = exactly **1** `ability_use` "Ambusher's Leap" row (`totalRows` 1, latch `dreadAmbushSpeedActive:true`, gate stamp `1:FeyRanger`).
2. Visitor tab `browser_network_requests {static:false}`: only the by-design `MapContextSync` `POST /__campaign__` mount stamp (same request, same index, as in the pre-fix capture — NOT the turn seam); ZERO `/__initiative__`, `/FeyRanger`, `/log` POSTs.
3. Visitor mirror sanity: board adopts live (13 cards, `.creature-card.active` = FeyRanger, read-only — no Next/Clear).
4. GM-only exactly-once face: the single client produced the single row (a GM self-double-fire would have shown 2 rows with the visitor inert), pinned additionally by the GM-leg unit tests.

