# bug-SP-092 — Prismatic Spray: all damage rays roll 10d6 instead of canonical 12d6

Verdict: FAIL — dice count wrong on every damage ray (10d6 vs 12d6); save gate, 1d8 ray selection, Indigo tracking and Special-8 all exact.

## Expected Behavior (canonical, public/data/2024/spells.json live prose + manifest row)
"Red/Orange/Yellow/Green/Blue. Failed Save: **12d6** [Fire/Acid/Lightning/Poison/Cold] damage. Successful Save: Half as much damage."

## Actual Behavior (live 2026-10-07, AberrantSorcerer lv20 2024 Sorcerer, DC 13, test-campaign)
Every `save_result` logged `damageFormula:"10d6"`:
| Target | 1d8 | Ray | DEX save | Applied | Expected at 12d6 |
|---|---|---|---|---|---|
| Thug 1 | 8→Special(3,2) | Yellow | 15 pass | −17 (half of 34) | half of 12d6 |
| Thug 1 | →2 | Orange | 5 fail | −36 (full) | full 12d6 |
| Bandit 1 | 2 | Orange | 14 pass | −12 (half of 24) | half of 12d6 |
| Guard 1 | 6 | Indigo | 8 fail | Restrained + tracker 2/3 succ 1/3 fail exact | ✓ |
Exact halves/fulls — only the DIE COUNT is wrong. 10d6 floor 10 vs 12d6 floor 12.

Root sources: `public/data/2024/spells.json` `automation.damage:"10d6"` and `prismaticSprayHandler.js` `PRISMATIC_RAYS` `'10d6'`×5 (fallback `auto.damage||'10d6'` :72).

## Steps to Reproduce
1. AberrantSorcerer learns Prismatic Spray (step-14), EB-join Bandit/Thug/Guard, cast (cone = all combatants).
2. Inspect any damage-ray save_result log: `damageFormula:"10d6"`.

## Likely Location
- `public/data/2024/spells.json` prismatic-spray `automation.damage` → "12d6"
- `src/services/automation/handlers/**/prismaticSprayHandler.js` PRISMATIC_RAYS constants (:72 fallback) → "12d6". One-field-each fix.

## Notes
- Rays live: Yellow/Orange/Indigo(+save-tracking)/Special-8 double-ray (auto re-roll of 8s works, logs "rolled 8, then…"). Red/Green/Blue share identical code path (unobserved, same constants). Violet implemented (Blinded + WIS tracker + banish advisory; DM-choice teleport = sanctioned advisory). Zero missing consumers: chain prismaticSprayHandler.js → spellGates.js:187 → useComplexSpellHandlers.js:192 → automation/index.js:590 → savePrompt/saveResultHandlers.js:133-350 → CreatureCard SaveTrackingPrompt → clearAllExpirationEffects.
- Cosmetic: picker prose "roll 2d7" (functional roll correct 1d8, CreatureTargetPopups.jsx:52); "full undefined restrained damage" prose.
- Pitfalls: Magic Initiate overlay absorbs picker clicks; Leading Evasion modal queues after Done (Skip); save prompts queue one-at-a-time; HP-input accepts 999 unclamped (§76).
