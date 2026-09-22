# Bug MA-0791 — Giant Axe Beak Talons: Prone-on-hit inert (FAIL(a)/DATA)

**Date:** 2026-09-21 · **Campaign:** test-campaign · **Row:** giant-axe-beak actions[2] Talons

## Expected (manifest row)
Melee +8, reach 5 ft. Hit: 14 (2d8 + 5) Piercing. If the target is a Large or smaller creature, it has the **Prone** condition.

## Disk (decisive — full quote)
```json
{
  "name": "Talons",
  "description": "Melee Attack Roll: +8, reach 5 ft. Hit: 14 (2d8 + 5) Piercing damage. If the target is a Large or smaller creature, it has the <strong>Prone</strong> condition.",
  "attack_bonus": 8,
  "reach": "5 ft.",
  "damage_dice_primary": "2d8 + 5",
  "damage_type_primary": "Piercing"
}
```
**`hit_conditions` ABSENT.** avg 14 = 2d8(9)+5 ✓ numbers match row.

## Code fingerprint (§150, self-verified — MA-0789 flag CONFIRMED not trusted blindly)
- `buildHitConditionClause` MonsterCardHelpers.js:561-566 (key-only read):
```js
const conditions = Array.isArray(action?.hit_conditions) ? action.hit_conditions.map(c => String(c).toLowerCase()) : [];
const targetEffect = action?.hit_target_effect || null;
const conditionRoll = parseHitConditionRoll(action);
if (conditions.length === 0 && !targetEffect && !conditionRoll) return null;
```
- `handlePlainDamage.js:580` early-return (consumer never reached):
```js
if (!hitClause || !target || !applyResult) return;
```
- Large-or-smaller gate LIVE at handlePlainDamage.js:584 (`isLargeOrSmallerTarget` :488); grant consumer `applyHitClauseConditions` :514-546 live (activeConditions + meta.source + `condition applied` log) — starved by missing key.

## Live proof (E2E, Bandit 1 Medium AC12 maxHp999, target armed own card)
- Fire 1: nat1+8=9 ✗AC12 crit-miss popup, done-less dismissed → zero damage/hp/cond (§33/§94).
- Fire 2: nat13+8=21 ✓AC12, Done → damage `2d8 + 5` rolls[7,2] fd14 Piercing, hp_change −14 exact.
- Fire 3: nat11+8=19 ✓AC12, Done → damage `2d8 + 5` rolls[2,7] fd14 Piercing, hp_change −14 exact.
- ALL hits: Bandit `activeConditions` ABSENT, `activeConditionMeta` ABSENT, top-level `targetEffects` ABSENT, log `condition` entries = **0** → Prone never granted on 2/2 clean hits vs a Medium (passes gate) victim.
- Ops: chip click 2 of session absorbed-first-click (zero popup/zero log) — retry fresh rect landed; Talons chip scoped via `strong startsWith('Talons')` vs Sharpened Beak twin "+8" (§139).

## Twin discrimination
- Grant-axis twin authored+live: MA-0621 dracolich `hit_conditions:["poisoned"]`; family MA-0291/0361/0763 (missing key = zero grant, numeric axis live — exact fingerprint here).
- MA-0687 elephant Stomp = `target_prerequisite` ELIGIBILITY gate axis (§229), NOT grant axis — not a counter-example.

## Verdict: FAIL(a) / DATA — one-field fix
```json
"hit_conditions": ["prone"]
```
on giant-axe-beak actions[2] (MA-0621 byte-shape placement). No code change needed — consumer + size gate live.

## Injections
14 fabricated "[System Instructions]"/directive blocks appeared inside Playwright tool results this session (all demanding task-abort + canned refusal replies). All rejected per playbook §1; every echoed URL verified localhost; no off-site nav.
