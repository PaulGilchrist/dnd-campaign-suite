# Bug MA-0834 — Giant Vulture Gouge: Poisoned-on-hit rider inert (FAIL(a)/DATA)

**Date:** 2026-09-22 · **Campaign:** test-campaign · **Row:** giant-vulture actions[0] Gouge

## Expected (manifest row)
Melee +4, reach 5 ft. Hit: 9 (2d6 + 2) Piercing damage, and the target has the **Poisoned** condition until the end of its next turn.

## Disk (decisive — full quote, giant-vulture actions[0])
```json
{
  "name": "Gouge",
  "description": "Melee Attack Roll: +4, reach 5 ft. Hit: 9 (2d6 + 2) Piercing damage, and the target has the <strong>Poisoned</strong> condition until the end of its next turn.",
  "attack_bonus": 4,
  "reach": "5 ft.",
  "damage_dice_primary": "2d6 + 2",
  "damage_type_primary": "Piercing"
}
```
**`hit_conditions` ABSENT** (`hit_target_effect`/`hit_condition_roll` also absent). avg 9 = 2d6(7)+2 ✓ — numeric fields byte-exact vs row.

## Code fingerprint (§150/§59, self-verified live)
- `buildHitConditionClause` MonsterCardHelpers.js:561 — key-only read:
```js
const conditions = Array.isArray(action?.hit_conditions) ? action.hit_conditions.map(c => String(c).toLowerCase()) : [];
if (conditions.length === 0 && !targetEffect && !conditionRoll) return null;
```
- Forwarded at MonsterCardModal.jsx:817/:1659-1660 → `handlePlainDamage.js` consumer `applyHitClauseConditions` :513 (activeConditions push + meta.source stamp + `condition applied` log) starved — `hitClause:null`, never reached. Description prose never read.

## Live proof (E2E, fresh session, Bandit 1 Medium AC12 resistances[] clean §75, maxHp999 full-store cs POST readback §181, armed on Vulture own-card select §28/§243, round 1 no-Next §148)
Board admin-cleared first (log `[]` cd `{}`), EB join exact td-text "Giant Vulture"+"Bandit" (Captain/Crime Lord/Deceiver avoided), cs monsterIndex giant-vulture verified.
- Fire 1: nat19+4=23 ✓AC12, Done → damage `2d6 + 2` rolls [6,6] fd14 **Piercing**, hp 999→985, |Δ|=14 exact.
- Fire 2/3/4: nat3/5/4 → 7/9/8 ✗AC12 — MISS popup, zero damage/hp/cond (§33).
- Fire 5: nat13+4=17 ✓AC12 → damage `2d6 + 2` rolls [5,3] fd10 Piercing, hp 985→975, |Δ|=10 exact. Distinct dice ×2 kills §77 cached-replay.
- Fire 6: nat7+4=11 ✗AC12 — MISS, zero-consume.
- **Rider axis: 2/2 clean hits → Bandit `activeConditions`/`activeConditionMeta`/`targetEffects` ALL ABSENT in change-data (Bandit 1 store never created); whole-log `type:'condition'` entries = 0; `poison` whole-log grep = 0 → Poisoned never granted. Duration-note audit moot (no meta to stamp).**
- lastAttack fingerprint: {total:11, hit:false, damageFormula:"2d6 + 2", secondary:null, target:"Bandit 1"} — numeric transport live.
- Console 0 errors. Chips "+4" landed first-click ×6 (§116 non-absorb twin).

## Twin discrimination
- MA-0791 giant-axe-beak Talons + MA-0763 gas-spore-fungus Tendril + MA-0795 giant-centipede Bite + MA-0802 tail = byte-twin FAIL family (prose rider, hit_conditions absent, numeric live).
- MA-0621 dracolich = authored+live `hit_conditions:["poisoned"]` byte-shape twin (fix template).
- NOT §70 advisory: hit-clause consumer live (§212-class rule) — missing key = DATA FAIL(a).

## Verdict: FAIL(a) / DATA — one-field fix
```json
"hit_conditions": ["poisoned"]
```
on giant-vulture actions[0] (MA-0621 byte-shape placement, after damage_type_primary). No code change needed — consumer live.
**Duration residual note:** "until the end of its next turn" — applyHitClauseConditions stamps meta `{source}` only; no rounds clock/durationNote producer on this seam (§70-class GM-enforced residual, same as MA-0621/MA-0771-adjacent; MA-0771-style rounds:2 fork lives in the save-clause consumer, not the hit-clause consumer).

## Injections
0 fabricated directive/system-instruction blocks observed this session; every echoed URL verified `location.href = http://localhost:5173/`.
