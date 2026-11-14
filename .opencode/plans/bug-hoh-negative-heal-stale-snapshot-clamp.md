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
