# MA-1872 — Cthulhu "Madness Whisper (Costs 2 Actions)" — delegate mis-routes save (data)

## Title
Madness Whisper delegates_to Psychic Shatter, substituting the wrong save (INT DC 24 / 6d10 / Stunned / half-on-success) for the authored Wisdom DC 24 / 4d6 / no-reactions / no-damage-on-success clause, and costs 1 LA instead of 2.

## Overview
Row MA-1872 (`cthulhu|legendary_actions|3`), actionType `save`, verified E2E localhost/test-campaign 2026-10-10. The chip IS resolvable (no console-error burn — distinct from MA-1863), but the `delegates_to:"Psychic Shatter"` routes into a structurally different save pool. MA-1847 save-delegate mis-route family.

## Expected Behavior
Row description: "Cthulhu projects a maddening whisper at one creature within 120 ft. The target must succeed on a DC 24 Wisdom saving throw or take 14 (4d6) Psychic damage and be unable to take Reactions until the end of its next turn. No damage on a success."
Expected: DC 24 **Wisdom** save; fail → 4d6 Psychic full + no_reactions te; success → NO damage; cost 2 legendary uses.

## Actual Behavior
- Save type axis-WRONG: prompt "INTELLIGENCE saving throw DC 24 — Half damage on successful save" (Wisdom required; half required = none).
- Fail leg dice WRONG: 6d10 (delegate Psychic Shatter's pool, from STUNNED rider) → e.g. [4,9,10,1,1,5]=30 Psychic, hp 224→194 chain exact — ticket is 4d6 (avg 14 ✓ prose).
- Rider WRONG: Stunned applied; ticket's `no_reactions` te (registered targetEffectDefinitions.js:290, consumers conditionEffects.js:383 + SaveAttackAoeModal) never fires.
- LA cost spends 1 per press ("2 of 3 → 1 of 3 → 0 of 3"), "Costs 2" name-text only (MA-1847 twin).
- Static: legendary_actions[3] authors ONLY name/delegates_to/description — zero save_dc/save_type/damage_dice/cost-token; numeric gate false (no `Failure/Failure):N (XdY)` anchor).

## Steps to Reproduce
1. localhost → test-campaign → EB Cthulhu → Join Encounter; arm PC victim.
2. After a PC turn, press the Madness Whisper legendary child chip (row-idx ~10, `.mc-dice-link-legendary`).
3. Observe INT DC 24 prompt with half-on-success, 6d10 damage + Stunned on fail, LA −1 not −2.

## Likely Location
`public/data/monsters.json` — author structured `save_dc:24`, `save_type:"Wisdom"`, `damage_dice_primary:"4d6"`, `damage_type_primary:"Psychic"`, proper `save_effect` (fail: no_reactions te; success: no damage) and drop/redirect the incorrect `delegates_to:"Psychic Shatter"`. Engine-side: cost-token "Costs 2" unparsed (MA-1847 precedent).

## Notes
- Burn-then-refuse pitfall surfaced: `psychic_shatter_refused (no target)` logs AFTER the ability_use spend — a targetless delegate burns the LA.
- Synthetic selectOption arms DOM but never server `cs.targetName` — arm via real select interaction.
- Families: MA-1847 (Devour the Boat) save-delegate mis-route twin; MA-1863 prose-only legendary inert (not this case).
