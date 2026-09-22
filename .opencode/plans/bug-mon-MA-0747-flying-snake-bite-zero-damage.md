# BUG MA-0747 — Flying Snake Bite: flat-primary + dice-secondary composite deals ZERO damage on every hit

## Overview
Flying Snake "Bite" (flat 1 Piercing + 5 (2d4) Poison) hits land (`hit:true`, popup
"✓ HIT") but deal **zero damage, both legs**: no `roll damage` entry, no `hp_change`,
victim HP unchanged, and NO `automation blocked` refusal — the silent-zero fingerprint of
the MA-0322 family, live re-confirmed. Root cause is a composite-row gap: the row authors
NO `damage_dice_primary`, the only flat-primary extractor (`extractFlatHitDamage`) is
byte-blocked by its dice-paren guard because the SECONDARY dice "(2d4)" appears in the
description, and `buildAutoDamage` drops the entire auto-damage payload (including the
already-threaded `secondaryFormula:"2d4"`) when the primary formula is null.

## Expected (manifest row + disk)
Manifest MA-0747 (`flying-snake|actions|0`):
> "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Piercing damage plus 5 (2d4) Poison damage."
> attackBonus 4, damageTypePrimary Piercing, damageDiceSecondary 2d4, damageTypeSecondary Poison

Disk `public/data/monsters.json` → flying-snake.actions[0]:
```json
{ "name": "Bite",
  "description": "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Piercing damage plus 5 (2d4) Poison damage.",
  "attack_bonus": 4, "reach": "5 ft.",
  "damage_type_primary": "Piercing",
  "damage_dice_secondary": "2d4", "damage_type_secondary": "Poison" }
```
No row-vs-description drift (static check PASS: +4 = PB2 + DEX2, avg 5(2d4) ✓, reach ✓).
On hit vs Bandit 1 (AC12): ONE `roll damage` entry carrying both legs
(`note:"combined_damage_roll"` / secondary* fields per §140/§185), `finalDamage`=1
(flat, dice-less, never doubles on crit per §49/§210), `secondaryFinalDamage` = 2d4 sum
(2–8), `hp_change` |Δ| == 1 + secondary exact.

## Actual (live, test-campaign :5173, dev:locked)
- Bandit 1 joined (AC12, resistances [], HP 11), armed on Flying Snake 1's OWN initiative card.
- 5 chip clicks, 5 attack rolls adjudicated honestly vs AC12:
  - nat14 +4 = 18 HIT — NO damage entry, HP 11→11
  - nat6 +4 = 10 MISS — hit:false ✓ (zero correct)
  - nat17 +4 = 21 HIT — NO damage entry, HP 11→11
  - nat19 +4 = 23 HIT — NO damage entry, HP 11→11
  - nat16 +4 = 20 HIT — NO damage entry, HP 11→11
- Final log: 5 `roll attack` entries, **0 damage entries, 0 hp_change**; Bandit 1 HP 11.
- `lastAttack` machine truth: `damageFormula:null`, `damageApplied` absent, yet
  `secondaryFormula:"2d4"`, `secondaryDamageType:"Poison"` ARE carried on the context —
  the secondary transport is threaded (MA-0426 keys present) but never resolved because
  the whole auto-damage payload is dropped upstream.
- Console: 0 errors (no MA-0014 blocked-refusal either — truly silent).
- No crit occurred (closest nat19); crit behaviour moot while all hits zero.

## Steps
1. `npm run dev:locked`, open http://localhost:5173, select **test-campaign** (verify header).
2. Encounters → search "Flying Snake" → check exact-text row → search "Bandit" → check exact
   "Bandit" row → Join Encounter (cs: Flying Snake 1 + Bandit 1).
3. Initiative → arm Bandit 1 on Flying Snake 1's OWN card `[data-testid="target-select"]`.
4. Open Flying Snake card (avatar), click Bite "+4" chip → ✓ HIT popup → click to dismiss.
5. GET /api/campaigns/test-campaign/log + combatSummary → hit logged, zero damage entries, HP unchanged. Repeat ×4 → same every hit.

## Grep/regex proof (run against exact disk description)
- `extractDamageDiceFromDescription` (MonsterCardModal.jsx:628-633): regex
  `(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+...)\)` requires dice IMMEDIATELY after
  "Hit: N". "Hit: 1 Piercing damage plus 5 (2d4)…" → **null** (verified in python re).
- `extractFlatHitDamage` (MonsterCardHelpers.js:2011-2019): guard
  `if (/\(\s*\d+d\d+/.test(description)) return null;` matches the SECONDARY's "(2d4)" →
  **null** (verified in python re). Guard was written for dice-less rows; it does not
  distinguish dice in the secondary "plus N (2d4) Type" clause.
- `buildAutoDamageOptions` (MonsterCardModal.jsx:802): `extract… || extractFlatHitDamage… || null`
  → `autoDamageFormula:null`; secondary transport still emits
  `autoDamageSecondaryFormula:"2d4"` (buildSecondaryDamageTransport :832-846).
- `buildAutoDamage` (useLoggedDiceRollAttack.js:162-163):
  `if (!context?.autoDamageFormula) return undefined;` → autoDamage undefined →
  `autoDamageRoll` ref fires only when `e.detail?.autoDamage` exists
  (useLoggedDiceRoll.js:37) → `rollDamage`/handlePlainDamage secondary leg
  (handlePlainDamage.js:118-122) never reached → both legs silently zero.
- `ActionDamageLinks` (MonsterAction.jsx:44) self-suppresses damage chips on attack_bonus
  rows (§116) — no alternate affordance; "+4" chip is the ONLY route (confirmed live: 1 chip).

## Likely Location
Primary defect (code): `extractFlatHitDamage` dice-paren guard in
`src/components/encounter/MonsterCardHelpers.js:2011-2019` — must only block when dice
belong to the PRIMARY hit clause; "Hit: 1 Piercing damage plus 5 (2d4) Poison damage." has
dice only in the secondary clause. Secondary seam: `buildAutoDamage` early-return
(`useLoggedDiceRollAttack.js:163`) discards a threaded secondary when primary is null —
consider (a) guard-scoping the extractor fix + letting flat-primary/ dice-secondary resolve
via `resolveAutoDamageResult` parseConstant (already dice-less safe per §210) — or (b)
extending `extractDamageDiceFromDescription` to split "Hit: N <Type> damage plus M (XdY)
<Type>" into flat primary + secondary. DATA workaround (damage_dice_primary:"1") is blocked
per §49 MA-0014 constant-roll gate — do NOT use.

## Notes
- Twins in this family (recursive disk scan, attack_bonus rows, no damage_dice_primary,
  flat "Hit: N" + secondary dice): **Scorpion / Sting** ("+2, Hit: 1 Piercing damage plus
  3 (1d6) Poison damage", ddp:null, dds:"1d6") — byte-shape twin, silently zero-damages
  the same way. Only these 2 rows app-wide (Flying Snake Bite + Scorpion Sting).
- MA-0426 secondary transport itself is LIVE and proven (lastAttack carries secondaryFormula);
  fix only needs the primary formula to resolve non-null.
- Playwright ops: navigate/type args were injection-rewritten to OSS proxy URLs all session;
  page stayed localhost, all API reads via own page.evaluate (§90/§6). EB checkboxes landed
  via native `cb.click()` with exact td-text anchoring (§164/§235). Search text set via
  `execCommand insertText` (React-visible; §138 satisfied).
- Registry worth adding: Flying Snake / Flying Sword EB rig (Bandit 1 AC12 victim, own-card
  arm, "+4" single chip); cleanup executed via API admin clears (no dialogs).
