# Bug MA-0286 — Animated Object (Medium) · Slam: damage-only auto-hit, no attack roll

## VERDICT: FAIL

## Row (curl GET /data/monsters.json)
- `animated-object-medium` actions[0] "Slam": `attack_bonus: null`, `damage_dice_primary: "1d4+3"` (force), reach 5 ft.
- Description: "Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage."
- Monster is caster-dependent (2024 Animated Objects inherit caster's spell attack) — bonus unauthored, `proficiency_bonus: null`, CR 0.

## Observed (:5173, test-campaign, joined "Animated Object (Medium) 1", target Wild_Sage_Druid)
- Slam row renders exactly ONE affordance: `button.mc-dice-link "1d4+3"` (MonsterAction.jsx:33 `rollablePrimary = canRollExpression("1d4+3")` passes).
- NO "+" to-hit chip: MonsterAction.jsx:162 `actionHasAttack = attack_bonus != null` gate.
- Click 1: popup "Slam — 1d4+3: 2 +3 — 5 damage applied to Wild_Sage_Druid — HP: 137 → 132". Log: `roll rollType:"damage" formula:"1d4+3" total:5 force` + `hp_change delta:-5`. No HIT/MISS, no AC comparison.
- Click 2: popup "1d4+3: 3 +3 — 6 damage applied — HP: 132 → 126". Log: damage roll total 6 + hp_change delta:-6.
- Attack rolls in log since join: **0**. Row auto-hits every click and deals unmitigated damage — cannot miss, no to-hit, caster's spell attack modifier never derived/applied.

## Difference from MA-0284/0285 siblings
- Huge/Large: unparseable prose dice → fully inert rows (MV-12 fingerprint).
- Medium: parseable dice → chip renders but resolves via damage-only path (`handleDamage`, MonsterCardModal.jsx:1122) with zero attack-roll leg — WORSE than inert: silently deals guaranteed damage.

## Fix shape
Derive/authored `attack_bonus` (caster spell attack mod) so MonsterAction.jsx:162 emits to-hit chip + attack seam runs, OR suppress the damage link when `attack_bonus == null` on an attack row (MV-12 suppression extended to the to-hit-less attack case).

## Environment note (tooling)
Playwright navigate echoes showed a routify OSS-proxy URL instead of requested localhost:5173; Page URL/campaign header/curl log deltas all matched the local app — recorded as tool echo artifact.
