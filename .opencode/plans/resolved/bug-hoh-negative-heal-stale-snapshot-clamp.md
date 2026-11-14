# Bug: Hand of Healing commit writes a NEGATIVE heal (drains target HP + spends Focus) when the dispatch-snapshot row max is below the bucket while the live row says healable

**Filed:** 2026-11-14 explore run MM. Live-verified against `5c114db7b` (dev pair, :5173, CAMPAIGN_LOCK=test-campaign).

### Summary
Improve `9c3ec68ea` made the HoH picker display and the commit-time full-HP gate re-anchor on the LIVE combatSummary row (bucket-first). The heal-APPLICATION leg, however, still clamps against the combatSummary captured at feature dispatch. When the dispatch-snapshot row carries a stale max BELOW the target's HP bucket (e.g. the app's own 1/1-HP Initiative fan-out placeholders) and a mid-dwell board echo raises the live max above the bucket, the gate honestly allows the heal — and the application leg then clamps `newHp = min(bucketHp + roll, staleMax)` and WRITES the negative delta: the target is drained, Focus is spent, and the audit rows are self-contradictory (`isHealing: true` on a −59 delta; description “= 16 (Already at full HP)”).

### Steps to reproduce
Start from a clean test-campaign (cd `{}`, log `[]`):
1. Mount **Initiative** once so the combatSummary board exists (13-PC fan-out; some rows are 1/1-HP placeholders — EvasiveFighter’s row was one).
2. Seed the victim bucket: `POST /api/campaigns/test-campaign/EvasiveFighter` `{"value":{"currentHitPoints":60}}` (row still says 1/1, bucket says 60).
3. Sanctioned fixture grant (pitfall 10): edit `public/campaigns/test-campaign/Disciplined_Monk.json` `class.subclass.name` → `"Warrior of Mercy"`, then reload the page + re-select the campaign (subclass rows re-derive on select).
4. On the Disciplined_Monk sheet click the exact row `Hand of Healing:` → the target picker opens. EvasiveFighter’s radio reads `Select EvasiveFighter, 60 of 1 HP`.
5. Mid-dwell, raise the live row: `PATCH /api/campaigns/test-campaign/combatSummary` `{"value":{"creatures":[{"name":"EvasiveFighter","maxHp":112,"currentHp":60}]}}`. The picker radio live-updates to `Select EvasiveFighter, 60 of 112 HP` (the 9c3ec68ea echo — works).
6. Select the EvasiveFighter radio and press **Heal**.

### Expected behavior
Either the heal restores HP up to the live headroom (max 112 − 60 = 52), or — if capacity truth is ambiguous — the commit is refused with zero spend. A heal click must NEVER reduce the target’s HP and never spend the resource while logging “Already at full HP”.

### Actual behavior
Result panel: `Hand of Healing — Healing—EvasiveFighter (1 / 1 HP) 1d12 + 7 + 2: 7 + 9 = -59 HP restored`. Network: `POST /EvasiveFighter 200`, `POST /Disciplined_Monk 200`, two `POST /log 200`. Resulting state/rows:
- EvasiveFighter bucket `currentHitPoints` **60 → 1** (drained 59 by a “heal”).
- `hp_change` row: `sourceName:"Hand of Healing", delta:-59, currentHp:1, maxHp:1, isHealing:true` — negative delta flagged as healing, stamped with the stale snapshot max.
- `ability_use` row: `Disciplined_Monk expended 1 Focus Point to use Hand of Healing on EvasiveFighter: 1d12 + 7 + 2 = 16 (Already at full HP).` — code KNEW the heal resolved to no-heal (the `healDesc(actualHeal<=0)` annotation) yet still wrote HP and spent Focus (20 → 19, `focusPoints` bucket).

**Control (isolates the face):** a FRESH dwell where the dispatch snapshot equals the live board (`1 of 112`) heals honestly — `1d12 + 7 + 2: 5 + 9 = 14 HP restored`, bucket 1 → 15, panel `(15 / 112 HP)`. Also honest: the refusal faces (stale-full picker press → inline `EvasiveFighter is already at full HP. No focus spent.` with zero requests; `Cancel` → zero requests).

**Natural reachability:** the divergence condition (snapshot row max < bucket current < live row max) is exactly what a late Initiative mount-merge/fan-out settle write or any GM card edit landing AFTER the feature click dispatches — the picker can dwell across those echoes by design (that is what 9c3ec68ea made visible).

### Likely location
Confident (code read + live repro):
- `src/services/automation/handlers/healing/healingHandler.js` — `applyMonkHeal({ cs, … })` passes the **dispatch-captured** `cs` into `applyHealingToTarget` (“CLA-092 canonical choke … clamps at target max on the combatSummary entry”), while the gate `monkHealTargetAtFullHp` resolves the **live cache row** via `resolveMonkHealGateRow` (9c3ec68ea). The two legs read different HP truth.
- `src/services/rules/combat/applyHealing.js` `applyHealingToTarget` → `modifyHitPoints` clamps `newHp` at the row’s maxHp with no floor at the resolved current HP → negative `delta` flows into the bucket write and the `hp_change` row; `isHealing` is stamped from the roll amount, not the delta sign; the monk lane spends Focus whenever the gate let the click through.

### Suggested fix
Make the application leg resolve the same row the gate resolved: in `applyMonkHeal`, re-find the target row cache-first (mirror `resolveMonkHealGateRow`) before calling `applyHealingToTarget`, so capacity truth is single-sourced. Additionally defend the choke point: in the heal lane clamp `actualHeal = Math.max(0, Math.min(healAmount, maxHp - currentHp))` and route an `actualHeal === 0` outcome to the existing refuse path (zero write, zero Focus spend, inline note) instead of writing “0 healed”; stamp `isHealing` from `delta > 0`. Regression pin: snapshot max < bucket current < live max on a dwell → expect positive heal capped at live headroom (or refusal), never a negative `hp_change`, never a Focus spend with an “Already at full HP” description.

### Severity
Broken feature / data integrity risk — a positive-intent heal click silently costs the target 59 HP and spends a limited resource, and poisons the log with contradictory rows (`isHealing:true` on a negative delta).

## Resolution

**FIXED 2026-11-14 (fix run).**

### What was actually wrong

The bug file's diagnosis was CONFIRMED against the real code and reproduced live exactly before any edits (clean test-campaign → Initiative mount → EF row 1/1 → full-store `POST /EvasiveFighter {value:{currentHitPoints:60}}` with the bucket-max mirror absent from the client store, as the filed run's replace+reload left it → Warrior-of-Mercy fixture → picker `Select EvasiveFighter, 60 of 1 HP` → mid-dwell scoped `PATCH /combatSummary` maxHp 112 → radio echo `60 of 112` → select + Heal): result panel `1d12 + 7 + 2: 9 + 9 = -59 HP restored (1 / 1 HP)`, EF bucket 60→1, Focus 20→19, `hp_change {delta:-59, currentHp:1, maxHp:1, isHealing:true}`, ability_use `… = 18 (Already at full HP)`.

Root cause exactly as diagnosed — two HP-truth legs:
- `monkHealTargetAtFullHp` gates on the SSE-adopted live row (`resolveMonkHealGateRow`);
- `applyMonkHeal` fed the dispatch-captured `cs` into `applyHealingToTarget` → `modifyHitPoints` (`src/services/shared/hpModifier.js`), whose upper clamp `newHp = Math.min(maxHp, oldHp + heal)` has no floor at the resolved current HP. With `maxHp` resolving BELOW `oldHp` (stale 1/1 fan-out placeholder; the bucket carries no `hitPoints` max after a full-store replace), the positive heal became a negative write.

### Changes

- `src/services/automation/handlers/healing/healingHandler.js` — `applyMonkHeal` re-anchors the target row through the SAME `resolveMonkHealGateRow` the gate uses (SSE cache first, captured-cs fallback) before handing the board to `applyHealingToTarget`: capacity truth is single-sourced across gate and application. No-cache lanes keep their captured-cs bytes.
- `src/services/shared/hpModifier.js` — choke-point defense: the HP ladder (extracted into `clampHpLadder`, shared by both lanes — also de-escalated an eslint complexity warning the inline-twin version tripped) gains a **heal-never-drains floor**: with `delta > 0` and a known positive `maxHp`, `newHp` never lands below `oldHp` (a stale-max heal becomes a 0-delta write, event suppressed). `maxHp === 0` is exempt so the existing `??`-vs-`||` STRUCT pin keeps its bytes; damage lanes (negative delta) untouched.
- `src/services/automation/common/healingRoll.js` — `logHealingToSSE` stamps `isHealing: actualHeal > 0` (delta sign) instead of a blanket `true`, so an `hp_change` row can never again carry `isHealing:true` beside a negative delta.

### Verification

- New regression tests (green):
  - `src/services/automation/handlers/healing/healingHandler.handOfHealing.stale-snapshot-apply-leg.test.js` — divergent dwell: the row handed to the CLA-092 choke is the LIVE cache row (max 112 ≥ bucket 60), never the stale snapshot (max 1); honest spend laws hold (1 Focus FOR a real heal, `Regained N HP` audit, positive payload face); no-cache fallback keeps captured-cs bytes.
  - `src/services/shared/hpModifier.heal-never-drains.test.js` — stale-max heal writes 60→60 delta 0 (never 60→1) in both lanes; normal clamp/damage/STRUCT-0-max pins unchanged.
- Full vitest suite: 3296 files / 35466 tests GREEN (EXIT=0). `npm run lint` clean (0 warnings). `no-timers-guard` OK.
- Live re-verification (fixed code, identical repro steps): same divergent dwell committed `1d12 + 7 + 2: 12 + 9 = 21 HP restored`, panel `(81 / 112 HP)`, bucket 60→**81** (positive, capped by live headroom 52), `hp_change {delta:+21, currentHp:81, maxHp:112, isHealing:true}`, ability_use `… = 21 (Regained 21 HP)`, Focus 20→19 spent FOR the real heal.
- Adjacent faces re-lived clean on the same dwell: second honest heal 81→89 (`+8 (Regained 8 HP)`), full-HP press → inline `EvasiveFighter is already at full HP. No focus spent.` with ZERO POSTs, Cancel zero-spend, console 0 errors, overlays untouched.
- Exit sweep: subclass surgery restored byte-exact (md5 `ba4d456c…`), closed-tab admin clears GET-verified cd `{}` + log `[]` (disk files absent), `git status --porcelain public/campaigns/` EMPTY.

### Notes / residuals

- The residual Improve-suggestion "route an actualHeal === 0 outcome to the refuse path with zero Focus spend" is NOT re-plumbed: with the single-sourced row the gate-pass now implies positive application headroom; a zero-heal after a passed gate is only reachable via the already-carried bucket-side race (fold-gate ledger, unit-pinned) and lands as an honest 0-delta row — never a drain.
- Improvement-backlog bullet "mount-snapshot can render an inverted fraction (`60 of 1`)" is display-only and unchanged by this fix (still owned by the PT#3 decision).
- Other heal-lane row builders besides `logHealingToSSE` (e.g. `spellCastService/execution/helpers.js`, massHeal lanes) still stamp `isHealing: true` unconditionally, and `applyHealingDirectly` has no heal-never-drains floor of its own — but it clamps against the BUCKET/sheet max (no stale-cs-row fallback), so it cannot produce this bug's negative face. Widening the floor/stamp convention app-wide is audit hygiene, not data-integrity.
