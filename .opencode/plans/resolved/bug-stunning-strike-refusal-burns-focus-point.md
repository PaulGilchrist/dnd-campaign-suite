# Bug: Stunning Strike refusal burns the Focus Point AND the once-per-turn latch (FP spent upstream of saveOnlyHandler's zero-spend refusal)

## Summary
The 2026-11-05 `saveOnlyHandler` target fix (commit `1db06ea1f`) correctly refuses with `no_target` / `cannot_target_self` popups and a zero-spend `<slug>_refused` log row **inside the handler** — but for Stunning Strike the Focus Point is spent much earlier, in `useCharActionsAutomation.spendMonkFocusPoint` (:83-109, called at :445), and the same function also stamps the once-per-turn latch `_StunningStrike_usedRound` via `markStunningStrikeUsed` (:106). So when the handler subsequently refuses (armed target cleared or self-armed after the qualifying hit landed), the click has already: (a) decremented `focusPoints` by 1, (b) consumed the once-per-turn usage, and (c) logged nothing refunding either. Net effect: a refused Stunning Strike costs a Focus Point + the turn's usage and does literally nothing — violating the §5 zero-spend refusal convention for the one save_only consumer that pays a resource. Documented as a known residual in `bug-divine-spark-no-target-self-harms`'s Resolution; filed here as promised.

## Steps to reproduce
1. In `test-campaign`, put `Disciplined_Monk` (2024 Monk lv7, see `docs/test-character-registry.json`) on a combat board and ensure runtime `focusPoints` > 0 (GET change-data `d['Disciplined_Monk'].focusPoints`).
2. Arm a valid other-creature target (e.g. `EvasiveFighter`) on the monk's Initiative card select (`selectOption`) and land a melee weapon/unarmed HIT (any weapon row → resolve to Done with `hit:true`) so `gateStunningStrike`'s lastAttack checks pass.
3. BEFORE clicking the Stunning Strike row, clear the armed target via scoped PATCH (this is the seam the UI can also hit if the GM empties the dropdown between hit and reaction): `PATCH /api/campaigns/test-campaign/combatSummary` body `{"value":{"creatures":[{"name":"Disciplined_Monk","targetName":null}]}}` (or self-arm `targetName:"Disciplined_Monk"` — the API accepts self even though the dropdown omits it). Hard reload if the loaded tab's combatSummary mirror resists (~10s debounce).
4. Record `focusPoints` and absence of `_StunningStrike_usedRound`, then click the **Stunning Strike** `b.clickable` row.
5. Observe: refusal popup "No target selected — Stunning Strike requires another creature…" (or the self variant) + `stunning_strike_refused` automation row — BUT `focusPoints` is now **1 lower**, `_StunningStrike_usedRound` is stamped for this round, and a second click on the same round now hits the "Once per turn — already used this turn." denial even though no effect ever happened.

## Expected behavior
A refusal (no legal target / self) must be zero-cost: Focus Point unchanged, `_StunningStrike_usedRound` NOT consumed, refusal popup + `<slug>_refused` log row only. Either the target check moves BEFORE the spend (preferred — mirrors the divineSparkHandler fix: resolve target first, refuse with zero writes), or the refusal path refunds FP + clears the latch atomically.

## Actual behavior
- `spendMonkFocusPoint` writes `focusPoints: currentFP - 1` (:103) and stamps the latch (:106) unconditionally once `gateStunningStrike` passes — and `gateStunningStrike` (:17-47) only checks: once-per-turn, lastAttack-by-you, melee weapon, hit landed. It never checks that a legal target is *currently* armed.
- `saveOnlyHandler.handle` then refuses at :66-74 with popup + refusal row but cannot see or undo the upstream spend.
- No refund/compensation code exists anywhere for handler-level `save_only` refusals (grep `focusPoints` writers: only `spendMonkFocusPoint`, `trackedResources`, rest hooks).
- Repeat-fire hazard: the consumed latch makes the feature look "used this turn" after a cast that never happened.

## Likely location
Confident from code read:
- `src/components/char-sheet/useCharActionsAutomation.js` — `gateStunningStrike` (:17-47, no target gate) → `spendMonkFocusPoint` (:83-109: spend :103, latch :105-107) → handler dispatch at/after :445.
- `src/services/automation/handlers/combat/saveOnlyHandler.js` — refusal branch :66-74 (`saveOnlyRefusal` :30-51).
- Note the two existing zero-spend precedents to mirror: `divineSparkHandler` (resolve target BEFORE spend, refuse via `refuseTriggerGate`-style popup+log) and `refuseTriggerGate` itself (:135-146) which is already the in-file zero-spend refusal helper used by `spendMonkFocusPoint` for `no_focus_points`.

## Suggested fix
Add a target-validity leg to `gateStunningStrike` BEFORE `spendMonkFocusPoint` runs: `await resolveTarget(campaignName, playerName)`; on absent/self target, `denyStunningStrike(...)` with the same user-facing wording saveOnlyHandler uses ("No target selected — Stunning Strike requires another creature." / "You can't target yourself with Stunning Strike — it requires another creature.") and a `stunning_strike_refused` row with reason token `no_target`/`cannot_target_self` (denyStunningStrike already logs refusals — reuse it, don't double-log with the handler side). Keep the handler-level refusal as defense-in-depth for non-monk consumers (Color Spray/Entangle/Grease/Arms of Hadar/Dominate Monster pay nothing here — they are unaffected either way). Do NOT implement refund-after-refusal via two extra writes (full-store POST race hazard, playbook §5 runtime writes) unless the pre-gate proves infeasible. Dual-ruleset: SS exists in both 5e (`ki`) and 2024 (`focus points`) — the `MONK_KI_FEATURES` list covers both names? verify which action names hit the spend path in each ruleset and pin both in tests.

## Severity
Minor data-integrity bug, rare-but-live trigger (target must change/go stale between the hit and the strike click, or be self-armed via API). Silently destroys a scarce Monk resource AND blocks the turn's legitimate re-use. Zero-spend-refusal convention (§5) violation. Not a crash.

## Resolution
FIXED 2026-11-05 (fix subagent).

**What was actually wrong:** exactly as filed — `gateStunningStrike` gated once-per-turn + lastAttack-by-you + melee + hit but never checked that a legal target was *currently* armed, so `spendMonkFocusPoint` burned `focusPoints` and stamped `_StunningStrike_usedRound` before `saveOnlyHandler.handle`'s own zero-spend `no_target`/`cannot_target_self` refusal could run. Live repro confirmed the full fingerprint first: FP 4→3, latch `{round:1}`, bogus "expended 1 Focus Point" spend row + the refusal row, and the 2nd click denied "Once per turn — already used this turn."

**Fix (pre-gate, no refund double-write):** added a target-validity leg INSIDE `gateStunningStrike`, after the hit leg and before any spend, in `src/components/char-sheet/useCharActionsAutomation.js`:
- New hoisted helper `refuseStaleStunningStrikeTarget` (hoisted for the complexity-15 ceiling) resolves the armed target with `getTargetFromAttacker(combat, playerName)` — the exact helper `saveOnlyHandler`'s `resolveTarget` wraps, on the same combat context the gate already awaits — and refuses absent/self targets through the existing in-file zero-spend helper `refuseTriggerGate` (popup + `stunning_strike_refused` automation row with reason token), wording byte-identical to the handler's. `gateStunningStrike` now takes `playerStats` (call site :432 updated).
- Handler-level refusal stays untouched as defense-in-depth for the non-Monk save_only consumers (Color Spray/Entangle/Grease/Arms of Hadar/Dominate Monster — not in `MONK_KI_FEATURES`, pay nothing, byte-unchanged: the gate early-returns for them before the target leg). Both rulesets' Stunning Strike rows carry the same action name + `monk_weapon_or_unarmed_hit` trigger, so one leg covers 5e and 2024. Since the gate now blocks before `executeHandler`, exactly ONE refusal row lands per refused click (handler never reached).
- save-dismissed companion listener and the promptId-gated hygiene in `saveOnlyHandler.js` untouched.

**Files changed:**
- `src/components/char-sheet/useCharActionsAutomation.js` (target-validity leg + helper + playerStats threaded into the gate)
- `src/components/char-sheet/useCharActionsAutomation.stunning-strike.test.js` (positive legs now arm a legal target via the mocked `getTargetFromAttacker`; new `describe` locks 4 refusal cases: {no_target, cannot_target_self} × {2024, 5e} — byte-exact popup, exactly one `stunning_strike_refused` row with reason token, `setRuntimeValue` NEVER called (FP unchanged, latch unstamped), no dispatch)

**Verification evidence:**
- Live repro (pre-fix, test-campaign): real Quarterstaff melee HIT (18 vs AC 18) → scoped cs PATCH `targetName:null` + reload → SS click → refusal popup AND FP 4→3 + latch `{round:1}` + spend row + refusal row + "Once per turn" 2nd-click denial.
- Live re-verify (post-fix, same rig): refusal popup "No target selected — Stunning Strike requires another creature. Select a target in combat first." with FP **unchanged at 4**, NO latch, exactly ONE `stunning_strike_refused` row (`description` carries `no_target: <message>`); re-click refused with the SAME wording (not "Once per turn").
- Self-armed face: cs PATCH `targetName:"Disciplined_Monk"` + reload → click → "You can't target yourself with Stunning Strike — it requires another creature." FP unchanged, latch not stamped, one refusal row with `cannot_target_self`.
- Legit cast still works: re-armed EvasiveFighter, SS click → FP 4→3, latch stamped, prompt queued (`pendingSavePrompts`), Roll Save → SUCCESS 28 vs DC 21, save_result rows, prompt drained.
- Dismiss hygiene on a fresh SS cast (second qualifying hit, latch staged round 0 to admit it): prompt Dismiss → `stunning_strike_refused`/`save_dismissed` row, charge stays spent (§9 pay-early family), no stranded overlay, console 0 errors/0 warnings.
- Tests: `useCharActionsAutomation.stunning-strike.test.js` 12/12; sibling lanes (useCharActionsAutomation* + saveOnlyHandler*) 14 files/200 tests; folder runs `src/components/char-sheet` + `src/services/automation/handlers/combat` 606 files/6097 tests green. `npm run lint` zero warnings; `no-timers-guard` OK.
- Cleanup: test-campaign admin-cleared (change-data `{}` + log `[]` GET-verified, tab closed first); no fixture characters written; dev server left running.
