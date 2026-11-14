# HealingPoolModal dice commit uses a stale HP snapshot — a "heal" can write LOWER HP than the target currently has

## Summary
The `Roll a dN` → `Done` lane of `HealingPoolModal` (fixed by `d595cff2c` for the at-full-HP die-spend bug) computes the commit HP and the `actualHeal` refund gate from the **render-closure** `targetCurrentHp`, and a mounted modal never re-reads the target's `currentHitPoints` bucket when it changes externally (proven: header still read `100 / 143` a second after an external PATCH filled it to `143`). Pressing `Done` after an external heal/fill therefore writes `min(max, STALE + rollTotal)` over the current bucket — turning a heal into silent HP LOSS — and the fix's own "dice that can restore nothing are returned to the pool" refund path is unreachable in exactly the scenario its comment claims to cover ("target filled by another tab after the rolls").

## Steps to reproduce
Starting from clean change-data in test-campaign:

1. Seed the rig BEFORE campaign-select (playbook drift-rig recipe):
   - `POST /api/campaigns/test-campaign/combatSummary` `{value:{round:1,creatures:[{name:'CelestialWarlock',type:'player',initiative:20,…},{name:'ElderPaladin',…},{name:'Disciplined_Monk',…},{name:'EvasiveFighter',…},{name:'AasimarTest',type:'player',initiative:3,…}]}}`
   - `POST /api/campaigns/test-campaign/AasimarTest` `{value:{currentHitPoints:143,hitPoints:143}}`
2. Open http://localhost:5173, select **test-campaign**, open the **CelestialWarlock** sheet.
3. `PATCH /api/campaigns/test-campaign/AasimarTest` `{value:{currentHitPoints:100}}` (simulates the target being damaged; the settled tab adopts scalar PATCHes live).
4. On the CW sheet click the `Healing Light:` action row → chooser → select **AasimarTest** (shows `100 / 143 HP`) → press **`Roll a d6`** twice (e.g. 3 + 1 = 4 HP to restore).
5. WHILE the modal is open, fill the target externally: `PATCH …/AasimarTest {value:{currentHitPoints:143}}` (simulates another tab's healer / an AI-referee `hp_change` landing mid-modal). Wait ~1 s.
6. Observe: the modal header STILL says `Roll Dice — AasimarTest (100 / 143 HP)`, no gate note, `Roll a d6` still enabled — the mounted modal never adopts the changed bucket.
7. Press **Done**.

## Expected behavior
Per the fix's own comment (`HealingPoolModal.jsx` `applyAccumulatedHealing`: "dice that can restore nothing (target filled by another tab after the rolls) are returned to the pool"): the commit must read the CURRENT target HP, find zero capacity, refund the dice, and write NO HP. At minimum it must never write an HP value lower than the target's current one.

## Actual behavior
The commit computes from the stale snapshot: `newHp = Math.min(143, 100 + 4) = 104` and `POST /AasimarTest` **overwrites the bucket 143 → 104** — the target LOSES 39 HP from a "heal" — while the ledger row claims a heal:

```json
{"type":"healing_pool","sourceName":"CelestialWarlock","featureName":"Healing Light","targetName":"AasimarTest","amount":4,"diceUsed":2,"dieType":6,"rolls":[3,1],"poolAfter":16}
```

GET after Done: `AasimarTest.currentHitPoints = 104` (was 143), pool 16, row `amount:4`. No console errors; both POSTs 200. Witnessed live 2026-11-13 (run FX), 1/1 reproduction.

Control results (the ORIGINAL bug d595cff2c fixed IS fixed — for context): full-HP face gates `Roll a d6` disabled with "AasimarTest is already at full HP. No die spent." and zero writes (brute native `.click()` on the disabled button also lands nothing); partial-capacity face clamps the copy ("Rolled 3d6: 1 + 2 + 3 = 4 HP to restore" for capacity 4, gate note appears, Done writes `amount:4` with HP capped at 143).

## Likely location
Confident: `src/components/char-sheet/modals/divine/HealingPoolModal.jsx` → `applyAccumulatedHealing` (lines ~507–546) and its inputs `resolveHealCapacity`/`resolveDiceActualHeal` — they consume the closure's `targetCurrentHp`/`targetMaxHp` computed at render from `getRuntimeValue(...)`. The component does not subscribe to the TARGET creature's bucket, so nothing re-renders it when another writer changes it. Sibling face (same pattern, lower reachability): the amount path's no-creature `else` branch (lines ~475–488) also writes `Math.min(playerStats.hitPoints, targetCurrentHp + amount)` from the closure; the creature branch is safe because `applyHealingToTarget` → `modifyHitPoints` re-reads `getRuntimeValue(creature.name,'currentHitPoints')` at commit time. The monk lane has no dwell window (commits on the picker click).

## Suggested fix
In `applyAccumulatedHealing` (and the amount-path else branch), re-read at commit time instead of trusting the closure: `const freshHp = Number(getRuntimeValue(resolvedTargetName,'currentHitPoints') ?? targetCurrentHp)`, then compute `capacity = maxHp - freshHp`, `actualHeal = Math.max(0, Math.min(maxHp, freshHp + accumulatedTotal) - freshHp)`, write only when `actualHeal > 0`, else refund `rolledFaces.length` dice (the refund branch already exists — it just needs fresh inputs). The same fresh read will make the gate note/capacity display self-correcting on Done. Alternatively/additionally subscribe the modal to the resolved target's bucket so the header/gate re-render on SSE echo — but the commit-time re-read is the integrity fix; UI refresh is polish.

## Severity
Data integrity risk — a positive-delta "heal" silently overwrites a HIGHER current HP with a lower one (witnessed −39 HP). Window is narrow (external bucket write between the rolls and `Done`), but the modal can dwell indefinitely per the no-timers policy, and the fix's documented refund promise is dead code without the fresh read.

## Summary
Fixed: `applyAccumulatedHealing` and the amount-path else branch now re-read the target's `currentHitPoints` via `getRuntimeValue` at COMMIT time (mirroring `hpModifier.modifyHitPoints`), so an external fill landing mid-modal clamps or refunds instead of overwriting a higher HP with a stale-snapshot value. Repro re-run live twice (bug confirmed 1/1 pre-fix: bucket 143 → 110; post-fix: bucket stays 143, dice refunded to pool 21, honest `amount:0` row), refund path now fires, normal heal control still commits honestly (100 → 109, `amount:9`). Pinned by `HealingPoolModal.stale-closure.test.jsx` (3/3); divine-modal folder 16 files/238 tests green; lint zero warnings.

## Resolution
Landed 2026-11-13. The diagnosis in "Likely location" was correct as filed.

**What was wrong.** `HealingPoolModal.jsx` computed `targetCurrentHp` in a render-time IIFE from `getRuntimeValue(...)`, and the modal never re-renders when another writer changes the TARGET's bucket (no subscription). `applyAccumulatedHealing` (the dice lane's `Done`/Escape commit) built `newHp = min(targetMax, STALE + accumulatedTotal)` and unconditionally POSTed it over the bucket, so an external fill landing between the last roll and `Done` was clobbered (live pre-fix: bucket `143 → 110` after rolls `6+4` from a stale `100` snapshot, ledger row `amount:10`). With the stale snapshot, `resolveDiceActualHeal` always saw capacity, so the `d595cff2c` refund branch ("dice that can restore nothing … are returned to the pool") was unreachable dead code. The amount-path no-creature `else` branch had the same closure-write flaw.

**Fix (files changed).**
- `src/components/char-sheet/modals/divine/HealingPoolModal.jsx`
  - Extracted the render IIFE's bucket-first HP resolution into module-level `resolveTargetCurrentHp(combatSummary, resolvedTargetName, playerStats)` — one source of truth, byte-identical resolution law (player creature → runtime `currentHitPoints`; monster → cs row `currentHp`; no creature → caster bucket, then sheet max).
  - `applyAccumulatedHealing` now calls it at COMMIT time (`freshCurrentHp`) for `newHp`/`actualHeal` — same commit-time `getRuntimeValue` re-read idiom as `shared/hpModifier.js` `modifyHitPoints:34`. Zero fresh capacity → the EXISTING refund branch fires (dice returned, HP untouched, `amount:0` row); partial capacity → commit caps at max and the row logs only the restored capacity. Never writes below current HP. Dropped the now-unused `targetCurrentHp` closure from the useCallback deps.
  - Amount-path else branch: commit-time re-read of `getRuntimeValue(resolvedTargetName, 'currentHitPoints')` (closure value only as absent-bucket fallback) before `Math.min(max, fresh + amount)`. Its logged `amount` stays the allocated amount — that lane's documented over-cap semantics (map §healing-pool law: "over-max heals pay ALLOCATED not actual") were deliberately not changed.
  - No dual-ruleset twin: `HealingPoolModal.jsx` is shared by 5e and 2024 (single component; the monk `HandOfHealingModal` lane commits on the picker click, no dwell window — untouched).
- `src/components/char-sheet/modals/divine/HealingPoolModal.stale-closure.test.jsx` (NEW) — 3 faces on the mutable-store harness mirroring `HealingPoolModal.dice.test.jsx` conventions: full fill mid-modal → zero HP writes + refund `poolUpdate [[20],[19],[21]]` + `amount:0` payload + table row; partial raise 100→140 with 10 rolled → writes `143`, row `amount:3`, no refund; amount-lane raise 100→140 with amount 5 → writes `143` (pre-fix would write 105).

**Verification.**
- Live pre-fix repro 1/1 in test-campaign (drift-rig per steps 1–7): header stayed `100 / 143` after the mid-modal fill to 143; `Done` (rolls 6+4) wrote `currentHitPoints: 110`, row `amount:10`, pool 19 — exactly the filed behavior.
- Live post-fix (same steps): bucket stays `143` (zero HP written), `healinglightPool` back to `21` (both dice refunded), row `{amount:0, diceUsed:2, rolls:[3,5], poolAfter:21}`. Adjacent sanity face: damaged target 100, rolls 4+5, `Done` → bucket `109`, row `amount:9, poolAfter:19` (real heals unaffected).
- Tests: `HealingPoolModal.stale-closure.test.jsx` 3/3; `divine/` folder 16 files / 238 tests pass; healing-adjacent sweep (handlers/healing + applyHealing + hpModifier + modals/shared) 120 files / 804 tests pass; `npm run lint` zero warnings.
- Cleanup: test-campaign change-data `{}` + log `[]` GET-verified from a localhost origin after closing the tab; campaign fixtures on disk untouched (`git status --porcelain public/campaigns/` empty).
