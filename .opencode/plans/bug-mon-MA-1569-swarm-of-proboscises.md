# BUG MA-1569 — Swarm of Stirges "Swarm of Proboscises": bloodied variant, hit-grapple (escape DC 13), and turn-end 2d6 Necrotic riders all inert

**Verdict: FAIL(a)/DATA** — base attack exact; all three prose riders inert (row ships name/desc/attack_bonus/reach/dice only). PASS-partial evidence below.
**Row:** Swarm of Stirges / Swarm of Proboscises / attack, +5, reach 5 ft., 2d10 + 3 Piercing, conditions [grappled] (prose only)
**Date:** 2026-09-29 · E2E via Playwright on localhost:5173, test-campaign ONLY

## What failed

1. **FAIL — Bloodied 1d10 + 3 variant inert.** Swarm pressed at 15/36 (≤ half of 36 = Bloodied). Live damage popup + log: formula **`2d10 + 3`** (7, 7 +3 = 17), applied full 17 to Bandit 1 (HP 40 → 23). Expected offer/split for 1d10 + 3 (avg 8). Zero `1d10`, zero `blood`/`conditional` strings in the entire campaign log; card offered only the plain `+5` dice link.
2. **FAIL — Hit-grappled rider (escape DC 13) inert.** After two resolved hits (healthy + bloodied), Bandit 1 carried **no Grappled badge** in initiative and its `combatSummary` entry had no conditions/targetEffects (key absent). Zero `grappel*` strings in the log.
3. **FAIL — End-of-turn 2d6 Necrotic while grappled inert.** After hits, initiative advanced 14× Next through the full round into round 2 so **Bandit 1's turn started and completed** (trail: …Wild_Sage_Druid r1 → **Bandit 1 r2** → Swarm of Stirges r2). Zero turn-end effects: whole-log counts `Necrotic: 0`, `2d6: 0`, `grapple: 0`; no `hp_change` on Bandit outside the two attack resolutions.

## PASS-partial evidence (what IS correct — inside the bug)

- **Base +5 exact:** card chip "+5" = attack_bonus 5; popup "d20 8 +5 (+5 to hit) → 13 HIT (13 vs AC 12)".
- **Base 2d10 + 3 exact on healthy hit:** "2d10 + 3: 1, 9 +3 = 13 damage applied to Bandit 1" (`formula: "2d10 + 3"`, damageType Piercing, finalDamage 13).
- **Miss face live:** d20 nat 3 → total 8 vs AC 12 → `hit: false, isAutoMiss: false` logged.
- **Bloodied press still resolved honestly on the base face:** d20 15 +5 = 20 vs AC 12 HIT, damage dice genuine 2d10 (7,7)+3 — just the WRONG (non-conditional) table for a Bloodied swarm.

## Component → guard map (why inert)

| # | Component | Manifest keys present | Structured key needed | Guard |
|---|-----------|----------------------|----------------------|-------|
| 1 | +5 2d10+3 Piercing | attack_bonus, damage_dice_primary, damage_type_primary | — | LIVE exact ✓ |
| 2 | Bloodied 1d10+3 | prose only | `conditional_damage {dice:"1d10 + 3", condition:"bloodied", damage_type:"Piercing"}` | `buildChargeBonusOffer` — `if (!cd?.dice) return null` (`src/components/encounter/MonsterCardHelpers.js:666`) |
| 3 | Hit → Grappled, escape DC 13 (Medium-or-smaller, in space) | prose only | `hit_conditions: ["grappled"]`, `escape_dc: 13` (+ size/space gate per MA-0553) | `applyHitClauseConditions` needs `hit_conditions` (`src/hooks/combat/handlers/handlePlainDamage.js:553`, MA-1541 lane) |
| 4 | Grapple turn-end 2d6 Necrotic | prose only | structured turn-end rider, e.g. `turn_end_grapple_damage {dice:"2d6", damage_type:"Necrotic"}` | No turn-end grapple consumer exists anywhere in `src/hooks/combat/` — needs new consumer keyed off the grapple effect |

## Proposed data fix (row in `public/data/monsters.json`, actions[0])

```json
{
  "conditional_damage": { "dice": "1d10 + 3", "modifier": 3, "condition": "bloodied", "damage_type": "Piercing" },
  "hit_conditions": ["grappled"],
  "escape_dc": 13,
  "turn_end_grapple_damage": { "dice": "2d6", "damage_type": "Necrotic" }
}
```
(2 and 3 are two-field/byte-shape fixes in existing MA-1363 bloodied / MA-0812-MA-0930 hit_conditions lanes; 4 additionally needs a turn-end consumer for grapple-attached damage ticks.)

## Notes

- GM max-HP quirk recurred (same as MA-1547): max-only spinbox edit did not persist (`handleCreatureHpChange` delta===0 early-return); current-HP edits DO persist — Bandit probed at 40 current / 11 max.
- Swarm attacks surfaced phantom second values in log `rolls` (e.g. [8,11], total from rolls[0]) — cosmetic logging noise, hit/miss math self-consistent.
- Pending damage popups stack under `mc-overlay` when +5 is pressed repeatedly before dismissal; each popup must be dismissed for its `hp_change` to land.

## Cleanup performed

Admin → Clear Change Data + Clear Campaign Log (test-campaign), initiative cleared with it; runtime files (`campaign-log.json`, `character-change-data.json`) removed from disk. Only test-campaign touched.
