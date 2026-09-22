# BUG MA-0863 — Glabrezu / Pincer: grapple rider never granted (FAIL(a)/DATA, two-field twin MA-0812/MA-0829)

Campaign: test-campaign ONLY (header verified each select). Fresh session, admin full-reset pre-rig (log:[] cd:{}). Date: 2026-09-22.

## Verdict
**FAIL(a)/DATA — two-field grapple rider missing.** Numeric axis fully LIVE-EXACT; Grappled + escape DC 15 prose-only in description; `hit_conditions` and `escape_dc` ABSENT disk; consumer never fires. §59/§150 grapple axis; byte-twin of MA-0812 (giant-octopus Tentacles) / MA-0829 (giant-squid Tentacle) — "two X" limb-stack prose family ("from one of two pincers").

## Row (manifest MA-0863, stableKey glabrezu|actions|1)
+9, reach 10 ft., "2d10 + 5" Slashing, avg 16 ✓ (11+5). Prose: "If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 15) from one of two pincers." Bandit 1 = Medium ✓ gate honest.

## Disk (public/data/monsters.json glabrezu actions[1] FULL quote)
```json
{
  "name": "Pincer",
  "description": "Melee Attack Roll: +9, reach 10 ft. Hit: 16 (2d10 + 5) Slashing damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 15) from one of two pincers.",
  "attack_bonus": 9,
  "reach": "10 ft.",
  "damage_dice_primary": "2d10 + 5",
  "damage_type_primary": "Slashing"
}
```
- `hit_conditions` **ABSENT**. `escape_dc` **ABSENT**. Manifest row `conditions:["grappled"]` = prose mirror, NOT consumed (§59: plain `conditions:[]` not consumed; MA-0010 seam keys only off authored `hit_conditions`+`escape_dc`).

## Live evidence (FRESH session, chips 4/4 FIRST click, zero-absorb)
Rig: EB exact td-text join Glabrezu idx0 + Bandit idx1 (Captain/Crime Lord/Deceiver avoided §124); Bandit AC12 resistances[] clean Slashing §75, maxHp/currentHp 999 full-store cs POST 200 read-back §181; armed Bandit 1 on Glabrezu OWN initiative-card `[data-testid="target-select"]` sticky §28/§148; Pincer sole "+9" chip §116 (Multiattack zero-chip header §66, Pummel "+3d6 + 5"/"DC 17 Dexterity" out of row).
| # | d20 | total vs AC12 | dice | formula | fd | Δhp | chain |
|---|-----|---------------|------|---------|----|-----|-------|
| 1 | 7 | 16 ✓ HIT | [3,4] | "2d10 + 5" Slashing | 12 | −12 | 999→987 |
| 2 | 7 | 16 ✓ HIT | [1,6] | "2d10 + 5" Slashing | 12 | −12 | 987→975 |
| 3 | 14 | 23 ✓ HIT | [9,4] | "2d10 + 5" Slashing | 18 | −18 | 975→957 |
| 4 | 15 | 24 ✓ HIT | [1,4] | "2d10 + 5" Slashing | 10 | −10 | 957→947 |
- |Δ|==fd 4/4 exact unclamped §181; ΣΔ −52 = Σfd; distinct dice pools every fire §77 (attack dice 7/7/14/15 with distinct d20 pairings [7,4]/[7,10]/[14,·]/[15,·] — no replay; popup-vs-log count reconciled §77).
- Miss integrity: zero nat≤2 in four honest rolls → zero misses, zero-cond-on-miss vacuous-but-clean (0 condition entries anywhere).
- lastAttackRoll machine truth: {attackName:"Pincer", d20:15, bonus:9, targetAc:12, hit:true, effectiveAc:12, coverAcBonus:0} — saveDc/saveType absent = attack-chip decoy-proof §156. rangeReason gridless lenient §42/§115.
- "combined_damage_roll" note cosmetic single-primary §183. Round=1 constancy, no Next clicked §148.

## Grapple audit — ZERO GRANT (the FAIL)
Per-HIT ×4 and whole-log: `condition applied` entries == 0; whole-log /grappl/i == 0; /escape/i == 0; Bandit 1 change-data keys [] (no cd grapple state); Bandit cs `conditions`/`targetEffects` ABSENT; top-level change-data `targetEffects` ABSENT = ZERO GRANT across all channels.
Consumer LIVE key-only: `buildHitConditionClause` (MonsterCardHelpers.js — reads `action.hit_conditions` only, description NEVER read §52 hardened) → null clause → `applyHitClauseConditions` handlePlainDamage stamper never fires; escapeDc meta never stamped.

## Fix (DATA only, two fields — MA-0010/MA-0812/MA-0829 byte-shape, consumer LIVE, no code)
Author on glabrezu actions[1] Pincer:
```json
"hit_conditions": ["grappled"],
"escape_dc": 15
```
"one of two pincers" stacking = sustained grapple state-machine §59/§70 zero-producer advisory (MA-0287/0288/0354 precedent) — single grappled grant is the machine ceiling; not a second defect.

## Console
0 errors (2 pre-existing warnings benign).
