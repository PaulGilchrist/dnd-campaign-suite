# BUG MA-0812 — Giant Octopus / Tentacles: grapple+restrained rider never granted (FAIL(a)/DATA, two-field)

**Verdict:** FAIL(a)/DATA — numbers axis LIVE-EXACT; grapple rider prose-only. Two-field twin MA-0801 (giant-crocodile Bite) / MA-0807 (giant-frog Bite). §59/§150 grapple axis.

## Row
MA-0812 `giant-octopus|actions|0` Tentacles, +5 reach 10 ft., 2d6 + 3 Bludgeoning, prose "Grappled (escape DC 13) … Restrained". Medium-or-smaller gate; Bandit 1 = Medium ✓.

## Disk (monsters.json giant-octopus actions[0]) — byte-quoted
```json
{
  "name": "Tentacles",
  "description": "Melee Attack Roll: +5, reach 10 ft. Hit: 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 13) from all eight tentacles. While <strong>Grappled</strong>, the target has the <strong>Restrained</strong> condition.",
  "attack_bonus": 5,
  "reach": "10 ft.",
  "damage_dice_primary": "2d6 + 3",
  "damage_type_primary": "Bludgeoning"
}
```
`hit_conditions` **ABSENT**. `escape_dc` **ABSENT**. Avg 2d6+3 = 10 ✓ matches prose. Manifest `conditions:[grappled,restrained]` = prose scrape, never consumed (§150).

## Consumer (code, live)
`buildHitConditionClause` MonsterCardHelpers.js:562 reads `action.hit_conditions` ONLY (key-only; description never parsed) → null clause → `handlePlainDamage.js` hit-clause stamper never fires. Consumer LIVE (MA-0010 seam, ~30 authored twins pinned in `handlePlainDamage.hitClause.test.js`). No code needed.

## Live E2E (test-campaign, 2026-09-22, dev:5173, header verified test-campaign)
- EB join exact "Giant Octopus"+"Bandit" → cs idx0 "Giant Octopus 1" (giant-octopus), idx1 "Bandit 1" (bandit, Medium, AC12 clean bludgeoning §75); Bandit staged maxHp/currentHp 999 full-store cs POST.
- Target armed Bandit 1 on Octopus OWN initiative card (§4 evaluate value+change stuck).
- 8 chip fires, "+5" chip non-absorbable first click (MA-0801 twin); per-fire ledger:
  - nat9 → 14✓ fd12 [5,4] Δ−12 (999→987)
  - nat18 → 23✓ fd7 [2,2] Δ−7 (987→980)
  - nat9 → abandon backdrop (attack logged hit:true, zero damage/hp — clean)
  - nat20 → CRIT "2d6*2+3 (3, 2)" fd13 Δ−13 (980→967), flat +3 undoubled §189
  - nat13 → 18✓ fd13 [4,6] Δ−13 (967→954)
  - nat19 → 24✓ fd13 [5,5] Δ−13 (954→941)
  - nat9 → 14✓ fd13 [5,5] Δ−13 (941→928) — [5,5] pool repeat ×2 honest: distinct attack dice (19 vs 9), no frozen HP, stage dismissed between rolls (§77/§667)
  - nat2 → 7✗AC12 MISS-light: popup Done-less "click to dismiss", zero damage entry, zero hp_change, zero conds (§MA-0802)
- Every non-crit damage formula byte "2d6 + 3" Bludgeoning; |hpΔ|==fd exact; chain 999→928 unclamped Σ−71 exact (§181).
- **Grapple axis ZERO**: whole-log grapple==0, restrained==0, escape==0; per-HIT condition-applied entries ==0; Bandit 1 change-data keys `[]` (activeConditions/activeConditionMeta/targetEffects all absent); top-level targetEffects null; lastAttack conds null.

## Fix (DATA, one row, two fields)
Author on giant-octopus actions[0], MA-0010/MA-0801-predicted byte-shape (ankheg/crocodile placement):
```json
"hit_conditions": ["grappled", "restrained"],
"escape_dc": 13
```
Consumer live, no code. Sustained-grapple "from all eight tentacles" multi-source stacking = §59/§70 advisory residual (state-machine zero producers MA-0287/0288/0354).

## Cleanup
Admin clear change-data + log, verified `log:[]` `cd:{}`. test-campaign only; no manifest/git writes.
