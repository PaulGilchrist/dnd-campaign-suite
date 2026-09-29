# BUG MA-1547 — Succubus "Draining Kiss" (save row): no half-damage on success, HP-max-reduce rider inert

**Verdict: FAIL**
**Row:** Succubus / Draining Kiss / save, DC 15 Constitution, 3d8 Psychic, range 5 ft, conditions [charmed]
**Date:** 2026-09-28 · E2E via Playwright on localhost:5173, test-campaign ONLY

## What failed

1. **FAIL (primary) — Success does not halve damage.** RAW "Success: Half damage". Live: save SUCCESS (d20 nat 20 + 0 = 20 vs DC 15) applied **full 10 damage** (3d8: 5,8,7): Bandit HP 124 → 114. Expected −5. `lastAttack: {saveResult:"success", rawDamage:10}`; hp_change delta −10.
2. **FAIL (b) — HP-max-reduce rider inert on both faces.** RAW "Failure or Success: the target's Hit Point maximum decreases by an amount equal to the damage taken". Live: Bandit `maxHp` stayed **200** through all six resolutions (five failures −9/−20/−11/−12/−24 and one success −10). No `hp_max_reduce` targetEffect (`targetEffects: null`), no "Max HP −N" badge on the Bandit initiative card, zero `hp_max_reduce` log entries.

## PASS-partial evidence (what IS correct — inside the bug)

- **DC + type enforced honestly:** chip "DC 15 Constitution" (§986 twin chips with dice chip "3d8"), Bandit CON bonus +0. Six resolved rolls: totals 13, 6, 9, 10, 1 → FAILURE; total 20 → SUCCESS. Every total < 15 failed, ≥ 15 succeeded. Boundary consistent (no total exactly 15 observed; nearest fail 13, nearest pass 20).
- **Failed face damage math:** full 3d8 exact on all five failures — 9 (1,3,5), 20 (7,7,6), 11 (2,1,8), 12 (2,5,5), 24 (8,8,8 on nat 1). HP drops exact: 200→191→171→160→148→124 (`hp_change` log entries with matching deltas).

## maxHp values before/after each face

| # | Save | d20+mod vs DC 15 | dmg rolled | HP applied | Bandit HP | Bandit maxHp |
|---|------|------------------|-----------|------------|-----------|--------------|
| A | FAIL | 13+0=13 | 3d8=9 | 9 (full ✓) | 200→191 | **200 (expect 191) ✗** |
| 1 | FAIL | 6+0=6 | 3d8=20 | 20 ✓ | 191→171 | 200 ✗ |
| 2 | FAIL | 9+0=9 | 3d8=11 | 11 ✓ | 171→160 | 200 ✗ |
| 3 | FAIL | 10+0=10 | 3d8=12 | 12 ✓ | 160→148 | 200 ✗ |
| 4 | FAIL | 1+0=1 | 3d8=24 | 24 ✓ | 148→124 | 200 ✗ |
| B | **SUCCESS** | 20+0=20 | 3d8=10 | **10 (expect 5) ✗** | 124→**114** (expect 119) | **200 (expect 194/199) ✗** |

Baseline: Bandit 1 raised to 200/200 (un-clamped so max-reduce observable); final 114/200.

## Root-cause pointers (static)

- **Rider never authored:** Draining Kiss row in `public/data/monsters.json` carries only `save_dc`, `save_type`, `damage_dice_primary`, `damage_type_primary` + prose. No `hit_hp_max_reduce:{equal_to:"damage"}` key (compare specter Life Drain, MA-1489).
- **Seam is hit-path-only:** `parseHitHpMaxReduce` (`src/components/encounter/MonsterCardHelpers.js:788`) feeds `buildHitConditionClause` → consumed solely in `handlePlainDamage.js:990` (`hitClause.hpMaxReduce`). `src/hooks/combat/saveProcessing.js` and `handleNpcSaveDamage.js` grep clean of any `hpMaxReduce`/`hit_hp_max_reduce` consumption — the seam does not reach save resolution even if the key were authored. Fix needs: author the key on the save row + a save-outcome consumer that reduces max by `finalDamage` on BOTH faces (ledger `{baseMax, reduced, max}` + badge + `hp_max_reduce` log, per MA-1489 pattern).
- **Half-on-success gap (separate from rider):** the NPC-inline save seam rolled and logged the success but applied full damage — `computeDamageAfterEvasion`-style halving did not fire for this monster save path (popup: "✓ SAVE SUCCESS … 10 damage applied").

## Notes (not primary judgment)

- **Charmed-target RAW gate unenforced-by-default:** "one creature Charmed by the succubus" — no prerequisite gate on the row (`target_prerequisite` absent); the kiss fired on an uncharmed Bandit regardless. Succubus Charm itself is broken (MA-1546), so nothing could be legitimately charmed anyway.
- **Collateral quirk hit during probe:** GM initiative-card max-HP input does NOT persist a max-only change — `handleCreatureHpChange` early-returns on `delta===0` (`src/components/initiative/createCreatureHandlers.js:32`) and `MaxHpInput.onBlur` commits `onChange(name, unchanged currentHp)`, dropping the mutation. 200/200 baseline was set via the app's own `POST /api/campaigns/test-campaign/combatSummary`.
- Charm chip opened a save prompt reading "DC Unknown — no success or failure" (MA-1546 adjacent; left as-is).

## Cleanup performed

Initiative cleared, change-data cleared, campaign log cleared via Admin (test-campaign).
