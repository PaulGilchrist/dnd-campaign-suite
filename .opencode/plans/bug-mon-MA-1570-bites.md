# BUG MA-1570 — Swarm of Venomous Snakes "Bites": bloodied 1d4+4 Piercing variant inert (rule gate ignored)

**Verdict: FAIL(a)/DATA** — attack + dual-pool LIVE exact; bloodied primary variant prose-only, no `conditional_damage` key → zero offer, zero conditional log. PASS-partial evidence below. Exact-twin shape of MA-1537 (Stone Golem Slam dual-pool seam, MA-0427) plus the MA-1569 bloodied-inert lane.
**Row:** Swarm of Venomous Snakes / `swarm-of-venomous-snakes` / Bites, attack, +6, reach 5 ft., primary `1d8 + 4` Piercing, secondary `3d6` Poison (HP 36, AC 14; Bandit AC 12)
**Date:** 2026-09-29 · E2E via Playwright on localhost:5173, test-campaign ONLY

## What failed

1. **FAIL — Bloodied 1d4 + 4 Piercing variant inert.** Swarm set to 18/36 (≤ half of 36 = Bloodied). Pressed Bites "+6": damage popup + log formula **`1d8 + 4`** (roll [4] → 8 Piercing), NOT `1d4 + 4`. Whole-campaign-log counts: `1d4: 0`, `blood: 0`, `conditional: 0`. Card Bites row offered only the plain `+6` `mc-dice-link` — zero offer chrome (no bloodied toggle/offer button anywhere in modal DOM; tracker UI shows zero `bloodied` mentions even while at 18/36). Log `conditional=0`.

## PASS-partial evidence (what IS correct — inside the bug)

- **+6 exact:** popup "d20 18 +6 (+6 to hit) → 24 ✓ HIT (24 vs AC 12)" (Bandit AC 12 verified in log `effectiveAc: 12`).
- **Dual-pool LIVE, correct order, healthy hit:** primary `1d8 + 4` Piercing rolls [4] → 8, then SECONDARY `3d6` Poison rolls [5,1,1] → 7; popup "8 Piercing damage + 7 Poison damage = 15 total damage"; `hp_change` delta **−15, 40 → 25** exact; log `combined_damage_roll` entry carries `formula:"1d8 + 4"` + `secondaryFormula:"3d6"`, `damageType:"Piercing"` + `secondaryDamageType:"Poison"` in order; breakdown `[Piercing 8, Poison 7]`.
- **Miss faces live, zero damage:** nat 1 → 7 "CRITICAL MISS! ✗ MISS (7 vs AC 12)"; nat 5 → 11 "✗ MISS (11 vs AC 12)" (boundary d20≤5 correct). No `hp_change`, Bandit server HP unchanged at 40 across both misses.
- **Bloodied press still resolved honestly on the base face (dual-pool intact):** swarm 18/36 → HIT 24 vs 12; primary `1d8 + 4` [4]=8 Piercing + secondary `3d6` [3,2,6]=11 Poison = 19 applied; `hp_change` delta **−19, 25 → 6** exact. Just the WRONG (non-conditional) primary table for a Bloodied swarm.

## Component → guard map (why inert)

| # | Component | Manifest keys present | Structured key needed | Guard |
|---|-----------|----------------------|----------------------|-------|
| 1 | +6 attack | attack_bonus | — | LIVE exact ✓ |
| 2 | Primary 1d8+4 Piercing | damage_dice_primary, damage_type_primary | — | LIVE exact ✓ |
| 3 | Secondary 3d6 Poison | damage_dice_secondary, damage_type_secondary | — (`autoDamageSecondaryFormula` → `rollAndApplySecondaryDamage`) | LIVE exact ✓ |
| 4 | Bloodied 1d4+4 Piercing | prose only | `conditional_damage {dice:"1d4 + 4", condition:"Bloodied", damage_type:"Piercing"}` | `buildChargeBonusOffer` — `if (!cd?.dice) return null` (`src/components/encounter/MonsterCardHelpers.js:666`) |

## Proposed data fix (row in `public/data/monsters.json`, actions[0])

```json
{
  "conditional_damage": { "dice": "1d4 + 4", "modifier": 4, "condition": "Bloodied", "damage_type": "Piercing" }
}
```
Byte-shape fix in the existing MA-1363 bloodied / MA-1569 lane — same seam that keeps MA-1569's stirges variant inert.

## Notes

- Cosmetic popup noise: bloodied-hit popup primary line printed "HP: 33 → 25" (bogus interim base; real pre-hit 25 for the bloodied hit, 40 for the healthy hit) while the final combined line "15/19 damage applied — HP: 40 → 25" / "25 → 6" and server `hp_change` were exact both times.
- Bandit max-HP spin quirk recurred (MA-1547/MA-1569): current-HP edit (→40) persists server-side; server kept `currentHp: 25` after attacks while tracker spinner showed stale 40 until re-render.
- First click on sidebar/card absorbed (§138) as usual; combat modal state confirmed via `combat-ui-viewingMonster` in change-data.

## Cleanup performed

Admin → Clear Change Data + Clear Campaign Log (test-campaign), initiative cleared with them; change-data endpoint returns `{}` and log returns 0 entries; runtime files removed from `public/campaigns/test-campaign/`. Only test-campaign touched.
