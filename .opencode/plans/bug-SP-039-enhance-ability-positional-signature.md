# Bug SP-039 — Enhance Ability: two-stage apply passes positional args to object-signature handler → te never stamped (silent null)

## Title
Enhance Ability cast completes visually (chooser → self-target → "Cast" → spell log), but the buff is NEVER stamped: useTwoStageHandlers calls applyEnhanceAbilityEffect with 6 positional args against an object-destructure export → targetNames/ability undefined → early return null swallowed. No concentration, no badge, no check advantage ever possible.

## Overview
Verified 2026-10-04, test-campaign, caster Wild_Sage_Druid lv20 (spell temporarily added to book, reverted after). Cast flow UI fully present and executes.

## Expected Behavior
Cast (range Touch, Conc 1h) → choose STR/DEX/INT/WIS/CHA → te `enhance_ability` stamped with chosen ability on targetEffects + concentration set + badge; target gets Advantage on ability checks of chosen ability only (registry targetEffectDefinitions.js:772; consumer conditionEffects.js:527).

## Actual Behavior
1. PASS: two-stage UI: "Cast Spell" popup → "Choose Ability" (.sp-overlay 5 abilities) → Charisma → SecondaryTargetModal (self) → log `spell | Wild_Sage_Druid→Wild_Sage_Druid | Enhance Ability L2`.
2. FAIL: live GET change-data → `targetEffects: null`, no concentration key — te never stamped; no ability_use log.
3. Root cause: `useTwoStageHandlers.js:195-202` calls `applyEnhanceAbilityEffect(action, playerStats, campaignName, null, targets, ability)` POSITIONALLY; `enhanceAbilityHandler.js:48` destructures `({action, playerStats, campaignName, targetNames, ability})` → undefined → `return null` (:49-51), silently swallowed (`if (popup && setPopupHtml)`).
4. Secondary dead lane: popup type `enhance_ability_target_selection` (handler :38 triggerSpells lane) has ZERO renderer consumers anywhere.
5. Checks-only guard (static, correct-by-design): fold writes only `abilityCheckAdvantageAbilities`, consumed only resolveCheckForcedMode (CharAbilities.jsx:311/40, :321 saves separate) — cannot ever fire (no stamp source). All folds/badges (conditionEffects.js:527, CharAbilities.jsx:40, ConditionEffectBadges.jsx:94/272) inert.

## Steps to Reproduce
1. test-campaign; caster with Enhance Ability in book (add to Wild_Sage_Druid via Edit→Spells).
2. Sheet cast → choose Charisma → self → Cast → success popup + spell log.
3. GET `/api/campaigns/test-campaign/__campaign__` change-data → targetEffects null (bug).

## Likely Location
- `src/hooks/combat/useSpellMetamagicFlow/useTwoStageHandlers.js:195-202` — call with object `{action, playerStats, campaignName, targetNames: targets, ability}` (targetNames not targets — match handler key names).
- Optionally wire or remove `enhance_ability_target_selection` popup type.

## Notes
- Fingerprint NEW: "green cast + spell log but GET targetEffects null" — positional-vs-object apply mismatch. Always GET targetEffects after buff casts.
- SecondaryTargetModal: rows `label.secondary-target-row`; confirm `.sp-roll-btn` disabled until pick; handleConfirm silent no-op if none selected. Spell gate `includeCaster:true` (spellGates.js:298) allows Self. Edit-wizard spell select = `.list-item-checkbox-trigger` (verify `selected` class, not counter). Book restored, Admin cleared, GET-empty. Verified 2026-10-04.
