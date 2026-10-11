# Bug MA-1846 — Apep "Venomous Sting" (legendary_actions, attack) — FAIL

Date: 2026-10-10 | Campaign: test-campaign | Server :80 | Verdict: **FAIL (a)+FAIL (b) — row not structured; hit lane + condition rider + damage-type + avg text all broken**

## Expected (manifest + RAW)
Melee Attack Roll: +18, reach 25 ft., one target. Hit: 24 (4d6+9) Poison damage and the target has the Poisoned condition until the end of its next turn. Legendary action (spend 1 of 3, once per boundary, regain at turn start).

## Authored data (public/data/monsters.json → apep.legendary_actions[2])
```json
{ "name": "Venomous Sting",
  "description": "Melee Attack Roll: +18, reach 25 ft., one target. Hit: 24 (4d6+9) Poison damage and the target has the Poisoned condition until the end of its next turn." }
```
ABSENT: `attack_bonus`, `reach`, `damage_dice_primary`, `damage_type_primary`, `hit_conditions`, `delegates_to`, `automation`. Row is name+prose only.

## Defects
1. **FAIL(b)/DATA — avg-text drift (math-check):** `Hit: 24 (4d6+9)` — avg(4d6+9) = 4×3.5+9 = **23**, not 24. Cited authored value "24 (4d6+9)".
2. **FAIL(a) — to-hit lane never resolves:** live press in a valid LA window produced **ZERO `roll attack` entries**, no "+18 vs AC", no hit/miss adjudication. Chip is a plain `.mc-dice-link` "4d6+9" (ActionDamageLinks dice-extraction from prose; §64 `attackRowMissingToHit` suppresses the +18 chip) and applies damage **unconditionally** to the armed target. Cause: absent `attack_bonus:18` — one-field-each DATA fix; MA-1845 Coils twin proves the attack lane renders and adjudicates when delegated/structured.
3. **FAIL(b)/DATA — Poison damage type lost:** damage log `damageType:""`, hp_change `damageBreakdown:[{damageType:"",amount:22,resisted:false}]`. Absent `damage_type_primary:"Poison"`.
4. **FAIL(b)/DATA — Poisoned condition never applied:** `condition applied` log count 0; ElderPaladin change-data `activeConditions:[]`, `activeConditionMeta` absent, no badge, cs `conditions` empty. Absent `hit_conditions:["poisoned"]` (§153: prose conditions never consumed; `buildHitConditionClause` reads structured `hit_conditions` only). "Until the end of its next turn" duration therefore untracked/unobservable (pure hit_conditions lane carries no expiry clock per §Condition channels — would need hit_target_effect lane; note only).
5. **Damage applied with no Done/hit stage** (damage chip auto-resolves ~25 ms after spend) — consequence of #2.

## What DID work (live evidence, 2026-10-10)
- **Legendary economy IS wired to this row** (counter-intuitive for a prose-only child): first click in LA window (round 2 start, after prior creature's turn) spent exactly 1 use: `ability_use` "Apep 1 expends a legendary use for Venomous Sting after AasimarTest's turn — 2 of 3 left …", `change-data['Apep 1'].monsterLegendaryUses={max:3,used:1}`, card counter "(2 left)", `_legendaryUses_usedRound` stamped.
- Second click same-boundary → correct refusal popup "Legendary Action Refused … Nothing spent, no roll." + `automation/legendary_use_refused` "(turn) — zero spend, no roll." Economy honest: no double-spend.
- **Dice are genuine 4d6+9:** damage entry `formula:"4d6+9" rolls:[6,2,1,4] modifier:9 total:22 finalDamage:22`; hp chain 224→202, `hp_change delta:-22` exact, resisted:false. Victim ElderPaladin AC19 NON-poison-immune (Apep's own poison immunity is attacker-side, respected/not applicable).

## Fix (DATA, single row)
Add to legendary_actions[2]: `"attack_bonus": 18, "reach": "25 ft.", "damage_dice_primary": "4d6 + 9", "damage_type_primary": "Poison", "hit_conditions": ["poisoned"]` + correct avg text 24→23. (Poisoned-until-end-of-next-turn expiry needs hit_target_effect lane for a clock — note as engine residual; application is the core requirement.)

## NEW PITFALLS
- Prose-only legendary child with dice-in-description renders a **live ungated-damage `.mc-dice-link` chip** ("4d6+9") that ALSO rides the legendary spend latch: it spends + auto-applies damage with zero hit resolution — damage chip ≠ inert, and it silently burns LA uses on hit-less hits. Chip class audit (`-legendary` vs plain) distinguishes lanes.
- A `page.evaluate` that throws mid-run still executes prior clicks in the same `run_code_unsafe` call — audit log deltas before assuming an errored call did nothing (a first "phantom spend" was logged 9 s before the visible refusal click).

## Cleanup
Admin-clear change-data + log via API; re-join not required; server left up. Registry MA-1846 verdict appended.
