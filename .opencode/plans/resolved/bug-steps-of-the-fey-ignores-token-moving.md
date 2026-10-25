# Steps of the Fey free-Misty-Step ignores enforcement.tokenMoving — teleport never moves the token

## Summary
With Enforcement ON and the `tokenMoving` ("Teleport token-move") sub-flag ON, executing a Steps of the Fey step (verified: Refreshing Step) with the caster token placed and a combat target armed performs the resource spend and effect but NEVER relocates the token: the L5-003 §8.1 seam (`applyTeleportTokenMove`) is not called by `StepsOfTheFeyTauntModal`, which hardcodes "(GM-positioned)" prose in all four step legs.

## Steps to reproduce
1. In test-campaign: Admin → Enforcement ON + "Teleport token-move" (curl OK: POST `/api/campaigns/test-campaign/enforcement` `{value:{mode:'on',tokenMoving:true}}`, wait ~12s).
2. Maps → activate Battle Arena; drag the `HexWarlock` character chip from the Items palette onto a cell (e.g. (10,8)) so the mover has a grid position.
3. POST full-store combatSummary with `creatures[HexWarlock].targetName = 'NPC 1'` where a placed NPC token named "NPC 1" sits ~5 cells away (well inside the 30-ft teleport).
4. HexWarlock sheet → click `Steps of the Fey:` → chooser modal → click `Refreshing Step` card → `Refresh` on the confirm popup.

## Expected behavior
Per the flag's own hint ("Teleport automations move the token to the nearest legal space near the selected target (active map only)") and teleportService.js §8.1 (whose stated purpose: "every teleport feature … tempTeleport/Misty-Step family … has always asserted relocation in prose and written ZERO token position — this closes the gap"), the HexWarlock token should relocate near NPC 1, the log gain a `teleport_token_move` entry, and the copy carry "Token moved (x,y) → (x,y) — N ft." like psychicTeleportationHandler.js:48-56 / tempTeleportHandler.js:263-271 do.

## Actual behavior
Confirmed live 2026-10-25: token stays at (10,8) (disk `maps/battle-arena` players unchanged), `automationType:'teleport_token_move'` log count 0, and the ability_use entry reads "…teleporting up to 30 feet to an unoccupied space they can see (GM-positioned). Refreshing Step: HexWarlock gained 1 Temporary Hit Points." Spend side is honest (uses 3→2, THP 1 applied; Cancel = zero spend/move). No console errors.

## Likely location
CONFIDENT: `src/components/char-sheet/modals/StepsOfTheFeyTauntModal.jsx` — four hardcoded "(GM-positioned)" strings at lines 43/134/159/185; `grep -c applyTeleportTokenMove` on the file = 0. The three wired producers elsewhere (psychicTeleportationHandler.js:41, tempTeleportHandler.js:255, reactionDebuffHandler.js:231) show the intended call shape.

## Suggested fix
In the modal's step-apply handlers, after the effect write, call `applyTeleportTokenMove({ campaignName, mapName: null, creatureName: playerName, anchorName: <cs targetName>, maxFeet: 30 })` and append the `Token moved (…)` clause + `teleport_token_move` log when `move.moved`, keeping the current prose byte-identical on the off/no-anchor branches (same pattern as tempTeleportHandler.applyPlainTeleport). Bewitching Magic's copy at :389 ("GM positions the token") is the same family — check its handler too.

## Severity
Minor UX issue — no data corruption and the prose is honest, but the enforcement flag is silently incomplete for this lane: a GM who turned ON token-moving expects teleports to relocate tokens and gets prose-only for Steps of the Fey while its twin lanes honor the flag.

## Resolution
FIXED 2026-10-25. Diagnosis confirmed: the modal hardcoded the GM-positioned prose in every committing leg and never touched the §8.1 seam (`grep applyTeleportTokenMove` was zero).

**Changes:**
- `src/components/char-sheet/modals/StepsOfTheFeyTauntModal.jsx` — added a shared `applyMistyStepTokenMove(stepName)` helper that mirrors `tempTeleportHandler.applyPlainTeleport`: resolves the anchor via `getCombatContext` + `getTargetFromAttacker` (armed combat target) and calls `applyTeleportTokenMove({ campaignName, mapName: null, creatureName: playerName, anchorName, maxFeet: 30 })` — the seam self-gates on enforcement/tokenMoving/active-map. On `move.moved` it emits a `teleport_token_move` automation entry ("Step: token relocated (x,y) → (x,y) within 30 feet.") and the legs swap "(GM-positioned)." for "Token moved (x,y) → (x,y) — N ft." (also in the on-screen result copy). Wired into EVERY committing leg: Refreshing Step, Disappearing Step, Taunting Step (`handleTauntConfirm`, seam fires at cast time before saves resolve), Dreadful Step (`handleDreadfulConfirm`), the plain free-cast Skip leg (`handleFreeCastSkip`), and Bewitching Magic (`logFreeCast`/`applyBewitchingFreeCast` — its "GM positions the token." result prose now also swaps on a real move). Off / no-anchor branches stay byte-identical. `handleSkip` (taunting/dreadful zero-target escape that logs nothing and consumes nothing) was left untouched — pre-existing lane, out of scope.
- **No 2024 sibling needed:** 2024 Steps of the Fey data rides the same `steps_of_the_fey` automation type → same handler + same modal (grep of `src/services/rules/features/` for a 2024 twin is zero), so this single fix covers both rulesets.
- **Sibling test updates (mechanical):** all 9 `StepsOfTheFeyTauntModal.*.test.jsx` files' `damageUtils` mocks gained `getTargetFromAttacker: vi.fn(() => null)` (new modal import); `bewitching` + `noUses` accept/skip assertions wrapped in `waitFor` (those legs now await the self-gating seam, so resolution is one microtask chain later — degrade prose/counts unchanged).
- **New regression test:** `StepsOfTheFeyTauntModal.tokenMove.test.jsx` (9 tests) — each of the six committing legs calls the seam with the armed anchor + `maxFeet:30`, moved legs carry the Token moved clause in log + result and fire exactly one `teleport_token_move` entry; moved:false keeps the byte-identical "(GM-positioned)" / "GM positions the token." prose and zero token-move entries; unarmed anchor ⇒ `anchorName: null`.

**Verification:**
- Live repro (pre-fix, test-campaign, dev :5173): enforcement ON + tokenMoving ON, HexWarlock chip dropped at (10,8), NPC token renamed "NPC 1" at (15,8) (id-matched rename lane), cs POST armed `targetName:'NPC 1'` → Refreshing Step spent uses 3→2 + THP but disk `players` unchanged, log had ONE `ability_use` with "(GM-positioned)", zero `teleport_token_move` — bug confirmed exactly as filed.
- Live re-verify (post-fix): same rig → result copy AND ability_use log carry "Token moved (10,8) → (16,8) — 30 ft."; disk `maps/battle-arena` players show HexWarlock at (16,8); `automation/teleport_token_move` entry present ("Refreshing Step: token relocated (10,8) → (16,8) within 30 feet."). Flag OFF differential (second run, Disappearing Step): prose stays "(GM-positioned)", zero token writes, zero new token-move entries.
- Tests: new file 9/9; `src/components/char-sheet/modals` 213 files / 2053 tests green; seam + wired-producer folders (`teleportService.test.js`, `class-warlock`, `psychicTeleportationHandler.test.js`) 26 files / 348 tests green; full `npm run test:run` green (2803 files / 31271 passed). First full-suite pass showed 1 failure in the untouched `ElementalAttunementModal.phase-flow.test.jsx:331` (`findByText` at 1021ms vs its default 1000ms timeout — load flake in a component with zero import overlap with this change; passed standalone twice and the clean re-run is 100% green). `npm run lint` clean (zero warnings); `no-timers-guard` OK (no new timers).
- Cleanup: Battle Arena restored via GM `PUT /maps/battle-arena` verbatim (players SA(15,9)/FR(9,8)/EF(1,8), placedItems [], name byte-kept); Admin cleared change-data `{}` + log `[]` (GET-verified, quiet after debounce); ghost `test-campaign-renamed/` resurrection folder removed via sanctioned `DELETE /api/campaigns/test-campaign-renamed`; UI left deselected at campaign select.
