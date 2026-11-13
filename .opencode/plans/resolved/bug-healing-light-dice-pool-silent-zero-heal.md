# Bug: Healing Light dice-pool commit on a full-HP target consumes the die and logs the roll as HP restored when nothing was restored

## Summary
`HealingPoolModal`'s dice-pool path (CelestialWarlock **Healing Light**) lets you roll and commit dice against a target that is already at max HP. The pool die is spent, the in-modal copy says “`Rolled 1d6: 6 = 6 HP to restore`”, and a `healing_pool` log row is minted with `amount:<roll>` — but the actual HP restored is 0 (write collapses to the unchanged value / is never made). The combat ledger therefore over-reports healing. Contrast: the same suite's Hand of Healing lane annotates its audit row honestly (`(Already at full HP)`), so the two heal lanes treat the identical situation with different honesty.

## Steps to reproduce
Starting in test-campaign on a freshly-selected campaign (cleared change-data is cleanest; any untouched character works):

1. Ensure a combat board exists (join any monster via Encounter Builder so the party rows fan out, or seed a hand-rolled `combatSummary`). Reload + re-select so mirrors hydrate. An untouched target like `AasimarTest` has a bucket with `hitPoints:143` and NO `currentHitPoints` key — its mirror reads full (143/143).
2. Open CelestialWarlock's sheet → click the `Healing Light:` Special Actions row → in the target-chooser pick the full-HP target (or Skip for self, also full) → `Heal`.
3. Roll view shows e.g. `Roll Dice — AasimarTest (143 / 143 HP) (Max 4 dice)` — i.e., the target is visibly at max.
4. Press `Roll a d6` → modal reports `Rolled 1d6: 6 = 6 HP to restore`, pool ticks 20/21. Press `Done`.
5. `GET /api/campaigns/test-campaign/change-data`: `AasimarTest` bucket still has NO `currentHitPoints` key (0 HP actually restored); `CelestialWarlock.healinglightPool` HAS been decremented. `GET …/log`: a row exists — `{"type":"healing_pool","sourceName":"CelestialWarlock","featureName":"Healing Light","targetName":"AasimarTest","amount":6,"diceUsed":1,"rolls":[6],"poolAfter":19}`.
6. CONTROL (lane works on damaged targets): damage the target first (e.g. scoped PATCH `AasimarTest {value:{currentHitPoints:110}}`, reload + re-select), repeat → roll 6 → `Done` → bucket `currentHitPoints` 110→116, pool 19→18, row `amount:6` — all consistent.

## Expected behavior
Committing against a target at max HP should either (a) refuse before the die is spent with visible feedback (“target is already at full HP”), or (b) clamp honestly: log `amount:0` (or an `(Already at full HP)` annotation like the monk lane), and return/not consume the die. The modal’s “N HP to restore” copy must not promise restoration it cannot deliver.

## Actual behavior
Die spent, over-reporting log row minted (`amount:6`, no annotation), zero HP delta anywhere, no console error, no failed request, no inline notice. The roll view even DISPLAYS `(143 / 143 HP)` at step 3 and still lets the spend proceed.

## Likely location
`src/components/char-sheet/modals/divine/HealingPoolModal.jsx` — `applyAccumulatedHealing` (~lines 476–505): it computes `newHp = Math.min(targetMax, targetCurrentHp + accumulatedTotal)` then unconditionally spends (`setPoolRemaining`), logs, and writes — with no `actualHeal = newHp − targetCurrentHp` clamping/annotation (the amount path and the Hand-of-Healing handler both have richer handling: `healingHandler` logs `(Already at full HP)`, and the combat lane `applyHealingToTarget` returns an `actualHeal`). Confident on the component; the fix belongs in the dice path mirroring the amount path's honesty.

## Secondary verified law (context, not a separate bug)
Heal writes (both lanes) only ever touch the bucket `currentHitPoints`; the `combatSummary` creature rows never move (GET-verified: cs `AasimarTest.currentHp` stayed 100 while the bucket healed 110→116→134 across three commits). Target-choosers built from `combatSummary` rows (`SecondaryTargetModal` via `collectTouchTargets`) can therefore offer HP that contradicts the bucket truth inside one flow. Filed separately as an improvement/UX-drift note in the exploration backlog.

## Severity
**Data integrity risk (minor-to-moderate):** the shared campaign log is the party's record of resource expenditure; it records 6 HP restored that never happened, and the pool die is silently lost. Fully silent — no feedback distinguishes it from a successful heal.

## Resolution
**FIXED 2026-11-13 (fix run).** Live-reproduced exactly as filed before touching code: fresh change-data + hand-rolled `combatSummary` (AasimarTest + CelestialWarlock player rows) → CelestialWarlock sheet → trusted-click `Healing Light:` row → chooser → AasimarTest (roll view displayed `Roll Dice — AasimarTest (143 / 143 HP) (Max 4 dice)`, `Roll a d6` ENABLED) → rolled 4 → `Done` → pool persisted 20/21, log row `{"amount":4,"diceUsed":1,"rolls":[4],"poolAfter":20}`, AasimarTest bucket gained NO `currentHitPoints` (the `setRuntimeValue` same-value dedup in `useRuntimeState.js` is what silently swallows the no-op write — the POST never fires).

**Root cause confirmed as diagnosed:** `HealingPoolModal.jsx` dice path (`applyDiceHeal` spends a pool die per roll; `applyAccumulatedHealing` commits `accumulatedTotal` into the log unconditionally with no `newHp − targetCurrentHp` clamp and no full-HP gate). Fixed both halves of the dishonesty:

1. **Refuse before the die is spent** (Expected option (a), mirroring the monk lane's `selfHealingHpRefusal` "Already at full HP … No use spent." pattern): new `healCapacity` derivation (module helpers `resolveHealCapacity`/`resolveRestorableTotal`, matching the file's existing `resolveEffectivePoolMax` helper idiom) disables `Roll a d6` when the target is at max (or the pending rolls already fill it), with an inline `.healing-restriction-note` (existing CharSheet.css class, no new CSS) — `"X is already at full HP. No die spent."` / `"These rolls already fill X to maximum HP — further dice would restore nothing."` `applyDiceHeal` gained the matching guard. The gate stays open when HP truth is unknown (`targetMaxHp <= 0`) so fallback lanes are untouched.
2. **Honest commit** (mirrors the amount lane's `result.actualHeal` from `applyHealingToTarget`): `applyAccumulatedHealing` now logs `amount = max(0, newHp − targetCurrentHp)` in both the `healing_pool` row and the in-modal log table; a commit that would restore nothing (target filled by another tab after the rolls) refunds the spent dice to the pool and logs `amount:0` with the refunded `poolAfter`, and skips the pointless HP write. The partial-overflow case (e.g. 4 HP of room, rolled 12) still spends the die but logs `amount:4`.
3. **Copy clamp:** the roll view's `= N HP to restore` now shows `restorableTotal = min(accumulatedTotal, maxHp − currentHp)` — it can never promise restoration the commit cannot deliver.

The amount path's combat-row branch already logged `result.actualHeal` honestly and was left as-is. Single shared component serves both rulesets (5e Healing Light + 2024 Lay-On-Hands-style pools) — no twin file needs the fix. Secondary law (cs rows never move) untouched, per file.

**Files changed:**
- `src/components/char-sheet/modals/divine/HealingPoolModal.jsx` — the fix (roll gate + note, capacity-clamped copy, honest commit + refund).
- `src/components/char-sheet/modals/divine/HealingPoolModal.dice.test.jsx` — the `caps the accumulated heal` case pinned the OLD over-report (`amount:12` for a 4-HP restore); expectation updated to `amount:4` + clamped-copy assertion (lane itself: HP write 36→40 still lands, die stays spent).
- `src/components/char-sheet/modals/divine/HealingPoolModal.overheal.test.jsx` — NEW regression file (4 tests): full-HP self refusal (disabled button, note, force-click fully inert), full-HP ally via chooser refusal, partial-overflow copy+ledger clamp (roll 6 vs 2 HP of room → copy `= 2 HP to restore`, row `amount:2`), and roll→filled-by-other-tab commit refund (`poolAfter` refunded, `amount:0`, zero HP write).

**Verification:**
- `npx vitest run` — new overheal file 4/4; divine folder 15 files 235/235; full suite `npm run test:run` EXIT=0, 165 files **1569/1569 pass**. `npm run lint` zero problems. `node .opencode/plans/no-timers-guard.mjs` OK (no timers added).
- Live re-verification in test-campaign (Vite :5173, fresh select): full-HP face now reads `Roll a d6` **disabled** + `AasimarTest is already at full HP. No die spent.`, Done closes with **pool still 21/21, log `[]`, no bucket write**. CONTROL (bucket 110/143): roll 3 → copy `= 3 HP to restore` → Done → bucket **110→113**, pool **21→20**, row `amount:3, rolls:[3], poolAfter:20` — all consistent. Exit: admin cleared change-data + log (GET-verified `{}`/`[]`), tab unloaded, `git status --porcelain public/campaigns/` empty; dev pair left running.

**Harness note:** one background vitest completion notification claimed a failure in `src/components/char-actions/ActionList.melee-full-attack.test.jsx` — that path does not exist in the repo (grep-zero) and the canonical full run passed 1569/1569; treated as fabricated tool-output noise per playbook §1, not a real test.
