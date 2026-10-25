# Accepting a travel COMBAT event: auto-encounter's `encounter` phase is clobbered back to `exploration` ~50ms later while monsters stay on the tracker

## Summary
With `enforcement.autoEncounters` ON, accepting a hex-map travel combat event correctly hydrates the monsters into initiative and writes session phase `exploration → encounter` — but the same accept flow then ends travel (`setTravelMode(INACTIVE)`), whose phase hook unconditionally writes `encounter → exploration` 54ms later. Final persisted state: 12 monsters on the live initiative tracker while `sessionState.phase = 'exploration'`.

## Steps to reproduce
1. In test-campaign: enforcement ON + autoEncounters (POST `/api/campaigns/test-campaign/enforcement` `{value:{mode:'on',autoEncounters:true}}`, wait ~12s).
2. Maps → create an Outdoor map, Open it, toolbar Travel tool; set Events = Frequent.
3. Click a destination hex and `Advance One Hex` until a "COMBAT ENCOUNTER" `g .event-dialog` appears (~1.7 events/leg, ~30% combat — may take several legs; Camp when budget exhausts).
4. Click `Accept`.
5. GET `/api/campaigns/test-campaign/change-data` and `/log` after ~5s.

## Expected behavior
Session phase ends at `encounter` (combat IS live — the auto-encounter's own write), and phase is only returned to exploration when the encounter actually clears (or at least never regresses while non-player creatures sit on the tracker).

## Actual behavior
Confirmed live 2026-10-25 (Wolves on the Hunt → gnoll pack, party avg lv19):
- cs gains 12 gnolls (e.g. `Gnoll Pack Lord 1 {ac:15, hp:49, init:'12'}`), round 1 — GOOD.
- Log: `session_phase "exploration → encounter (travel event: Wolves on the Hunt) — auto-encounter."` at t=…542314, `automation auto_encounter_started …(24 on the tracker…)` at t=…542365, then `session_phase "encounter → exploration (travel ended) — travel management."` at t=…542419 — the LAST write wins.
- `change-data.sessionState = {phase:'exploration', changedBy:'travel management'}` with all 12 gnolls still active on the tracker.
(The service header itself declares the phase is "read as truth" by §10.2/§10.4 consumers — those will misjudge the campaign as out-of-combat.)

## Likely location
CONFIDENT on the two colliding writers: `src/services/encounters/autoEncounterService.js:59-64` (awaited async chain → setSessionPhase('encounter')) vs the travel-mode phase hook `src/hooks/management/useTravelManagement.js:70-77` (`setTravelMode(INACTIVE)` → setSessionPhase('exploration'), fired by the arrival/event-accept path in `HexMap.jsx handleEventAccept` → travel stop). Deterministic ordering (54ms apart), not a coin-flip race: the auto-chain awaits `hydrateRoster` + `loadEncounterToInitiative` before its phase write, while the travel-stop write fires earlier in the click's effect flush but lands AFTER because… actually it lands last — the auto write is issued first from a fire-and-forget promise and travel's INACTIVE write overtakes it via SSE echo ordering. Either way, no phase-awareness in the INACTIVE branch.

## Suggested fix
Make the `travel ended` transition phase-aware: in the setTravelMode INACTIVE branch, only write `exploration` when `readSessionPhase() === 'travel'` (i.e., don't clobber a phase another engine action owns); or gate it on the combat summary having no non-player creatures; or, simplest, in `HexMap.jsx handleEventAccept`, suppress the INACTIVE phase write for the accepted-combat path (auto-encounter owns the phase from there; clearing initiative restores exploration). Add a regression: accept combat event with autoEncounters on ⇒ final sessionState.phase === 'encounter'.

## Severity
Data integrity risk (state-machine truth) — no file corruption, but the L5 session phase is declared orchestration truth and every future phase-gated feature (§10.4 console, phase gates) starts from a wrong value after any auto-encounter.

## Resolution
FIX: FIXED (2026-10-25).

**What was actually wrong** (refines the "Likely location" — the two colliding writers were guessed correctly, the caller of the travel-stop was not, and "SSE echo ordering" was not involved):
Live repro in test-campaign (Wolves on the Hunt → 4× Cyclops) with temporary `console.trace`s in the two writers produced a decisive ordering:
1. Accept click → `handleEventAccept` → `acceptEvent()` → `clearEvent()` → `setTravelMode('planning')` — PLANNING, which moves no phase.
2. Fire-and-forget `autoStartEncounterFromEvent` hydrates + starts initiative, then writes `exploration → encounter` (auto-encounter). Correct.
3. `handleStartEncounter` (also fired by Accept) finishes creating + opening the spawned battle map (`onEncounterCreated` → App `handleEnterMap`). Opening the indoor map transiently re-mounts `HexMap` with `key={mapName}` while `Map.jsx` still holds the outdoor `mapData` (and React StrictMode double-invokes the mount pass in dev); the fresh instance's `tool` state defaults to `TOOL_NONE` while the synced `travel-mode` is still `'planning'`, so `useTravelToolSync`'s domain rule — tool left while travel live — fires `travelMgmt.cancelTravel()` (stack: `useTravelToolSync → cancelTravel → setTravelMode('inactive')`).
4. The INACTIVE branch wrote `encounter → exploration (travel ended)` **unconditionally** — clobbering the phase the auto-encounter owns, ~54ms later, while the monsters stayed on the tracker. The `travel ended` write reading `encounter → exploration` proves it executed after the auto write landed; no race ambiguity.

**Fix** (the bug file's first suggested option, verified correct against the code): `src/hooks/management/useTravelManagement.js` — the `setTravelMode` INACTIVE branch is now phase-aware: it returns the session to `exploration` only when `readSessionPhase(campaignName) === 'travel'` (travel owns the phase). A phase another engine action armed (auto-encounter's `encounter`; referee console's manual picks) survives; `encounter → exploration` remains owned by Initiative Clear (`createCreatureHandlers.handleClear`, already audited as `combat cleared — initiative tracker`). The travel-mode state write itself is unchanged — travel still ends (mode `inactive` on the accept path is pre-existing tool-sync behavior; clearing initiative remains the phase's restoring seam). No dual-ruleset twin: travel/session phase is ruleset-agnostic (single implementation).

**Files changed:**
- `src/hooks/management/useTravelManagement.js` — phase-ownership gate on the INACTIVE transition (+ `readSessionPhase` import).
- `src/hooks/management/useTravelManagement.session-phase.test.js` — NEW regression lane (5 tests), mirroring the sibling `useTravelManagement.test.js` mock conventions. Pins: `encounter` phase survives cancelTravel AND arrival legs (zero `sessionState` writes, zero `session_phase` audit — the live clobber), `travel`-owned phase still restores `exploration` with exact audit bytes, exploration/unset legs byte-quiet, planning/paused never move the phase.
- `src/services/combat/sessionService.js` — unchanged (debug traces added during diagnosis were removed; file byte-identical to HEAD).

**Verification:**
- Red capture: with the gate reverted (`if (true)`), exactly the two clobber-leg tests fail; with the fix, 5/5 pass.
- Touched folders: `npx vitest run src/hooks/management src/services/encounters src/services/combat/sessionService.test.js src/components/hex-map` → 123 files / 1531 tests passed.
- `npm run lint` → clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` → OK.
- Full suite `npx vitest run` → 31255 passed, 1 failed: `SaveAttackAoeModal.ma2063-ymir-frost-geyser.test.jsx` — passes 3/3 in isolation (pre-existing full-suite pollution flake in the AoE-save lane, zero overlap with travel/session code; not fixed here).
- Live re-run of the exact repro (test-campaign, enforcement `{mode:'on',autoEncounters:true}`, fresh Outdoor map, Travel + Frequent, Advance until "COMBAT ENCOUNTER — Wolves on the Hunt", Accept): final `change-data.sessionState = {phase:'encounter', changedBy:'auto-encounter'}` with 4× Cyclops (hp 138, engine-rolled init) on the live tracker round 1; log carries exactly ONE `session_phase` entry — `exploration → encounter (travel event: Wolves on the Hunt) — auto-encounter.` plus `auto_encounter_started` — and NO `encounter → exploration (travel ended)` clobber.
- Adjacent-flow sanity: Initiative `Clear` afterwards still owns the return leg — phase `encounter → exploration (combat cleared) — initiative tracker.` (server-verified post-debounce).

**Cleanup:** throwaway maps deleted (QA Phase Clobber + both auto-spawned `…---encounter-at-*` battle maps; maps list back to baseline [Battle Arena, Test Map]); Admin clear of change-data (`{}`) and campaign log (`[]`) GET-verified; enforcement key gone with the clear; no campaign folders touched besides test-campaign; all debug instrumentation removed (grep-zero).

**Playbook-worthy pitfall:** the auto-encounter Accept lane silently unmount-remounts `HexMap` (battle-map open), and the remount's `TOOL_NONE` default trips `useTravelToolSync → cancelTravel` ~50ms after Accept — any GM-visible travel state you expect to persist past an accepted combat event is already gone (mode `inactive`, path cleared); only the phase was in this ticket's scope.
