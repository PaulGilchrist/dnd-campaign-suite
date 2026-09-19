# bug-mon-MA-0485-bite-advantage-variant-inert

**Row:** MA-0485 — Chimera / Bite (monsterIndex `chimera`, actions[1])
**Verdict:** FAIL(b) DATA — conditional damage rule gate ignored

## Disk (public/data/monsters.json, actions[1], verbatim)

```json
{
  "name": "Bite",
  "description": "Melee Attack Roll: +7, reach 5 ft. <strong>Hit:</strong> 11 (2d6 + 4) Piercing damage, or 18 (4d6 + 4) Piercing damage if the chimera had Advantage on the attack roll.",
  "attack_bonus": 7,
  "reach": "5 ft.",
  "damage_dice_primary": "2d6 + 4",
  "damage_type_primary": "Piercing"
}
```

Keys: attack_bonus, damage_dice_primary, damage_type_primary, description, name, reach.
**No `conditional_damage` field.** (Manifest row description also has a double-nested "18 (18 (4d6 + 4))" typo; disk is "18 (4d6 + 4)" — orchestrator re-stamp candidate.)

## Root cause

The MA-0007 conditional-damage seam consumes ONLY the structured `action.conditional_damage` field:
- `buildChargeBonusOffer` (src/components/encounter/MonsterCardHelpers.js:503) — `if (!cd?.dice) return null;`
- Forwarded via `chargeBonusOffer` (MonsterCardModal.jsx:727) → HIT-popup `ChargeBonusOffer` (src/components/char-sheet/DiceRollResult.jsx:838) → grant/decline logs (MonsterCardHelpers.js:642/653).
- Zero prose parser for "or N (XdY+M) damage if ... Advantage" (grep-zero for `had Advantage|Advantage on the attack` outside prose; no consumer in MonsterCardHelpers/MonsterCardModal/useLoggedDiceRollAttack reads the description for damage variants).

→ The Chimera Bite advantage-variant (4d6 + 4) can NEVER be offered or applied, even when the attacker genuinely has advantage. Class twin: MA-0436 (Javelin ranged variant inert), MA-0451 band-inert; missing-structured-hit-clause precedent: MA-0477/0434 DATA FAIL.

## Live proof (test-campaign, 2026-09-18, dev :5173)

Rig: EB Join → Chimera 1 (cs idx 0, HP 114, init 12) + Bandit 1 AC12 resistances[] HP-staged 999; own-card target-select armed Bandit 1; gridless lenient.

### Default leg (PASS)
7 Bite rolls vs AC12: hits nat 5(=12)/7(=14)/17/13/7/6, miss nat4(=11):
| damage rolls | formula | total | finalDamage | hp_change |
|---|---|---|---|---|
| [4,4] | 2d6 + 4 | 12 | 12 | −12 |
| [6,1] | 2d6 + 4 | 11 | 11 | −11 |
| — | 2d6 + 4 | 8 | 8 | −8 |
| — | 2d6 + 4 | 7 | 7 | −7 |
| — | 2d6 + 4 | 11 | 11 | −11 |
| — | 2d6 + 4 | 9 | 9 | −9 |
| miss | none | — | — | 0 |

total==finalDamage==|hpΔ|, Piercing, resisted:false; hpSum −58 (999→941); miss logged zero damage, stage-1 popup no Done.

### Advantage probe (FAIL evidence)
GM Add→Effects te `next_attack_advantage` applied to Chimera 1 (change-data `targetEffects:[{target:"Chimera 1",effect:"next_attack_advantage"}]`). Bite chip fired:
- Attack log: `rolls:[16,16], total:16, mode:"advantage"` — popup "d20 16, 16 → 16 +7 ✓ HIT (23 vs AC 12)" + "Adv (conditions)" badge → adv channel live and consumed (te self-erased post-roll, teAfter []).
- Damage log SAME attack: `formula:"2d6 + 4", rolls:[5,2], total:11, finalDamage:11, Piercing`, hp −11. **Not 4d6 + 4.**
- HIT popup buttons: only `Done` — **no ChargeBonusOffer** despite advantage hit (buildChargeBonusOffer returns null without structured field).

→ Adv-branch of the authored damage rule is unreachable even when its stated precondition is met.

## Fix (DATA template MA-0007)

Author on monsters.json chimera actions[1]:
```json
"conditional_damage": { "dice": "4d6", "modifier": 4, "damage_type": "Piercing", "condition": "advantage" }
```
and verify ChargeBonusOffer offers "4d6 + 4 Piercing?" upgrade on an advantage HIT popup (Offer→grant rolls 4d6+4; decline keeps 2d6+4; both logged conditional_damage_granted/declined). Consumer seam exists verbatim (MA-0007 Aarakocra Skirmisher precedent); no code change needed unless `condition:"advantage"` predicate handling is absent from the offer/apply path — verify live.

## Cleanup
Admin clear-change-data + clear-log both `{message:"...cleared"}`; 15s debounce + reload-quiet verification: change-data keys [], log count 0, combatSummary creatures 0. Registry merged (107 keys, JSON.parse-guarded).
