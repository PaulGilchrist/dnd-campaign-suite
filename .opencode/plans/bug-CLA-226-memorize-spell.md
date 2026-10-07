# bug-CLA-226-memorize-spell — FAIL (once-per-Short-Rest latch absent + spellbook filter unapplied)

Date: 2026-10-07 | Host: DivinationWizard lv20 Wizard (Illusionist) @ test-campaign (header verified)
Data grant: 2024 classes.json Wizard class_feature lv5, `automation: {type:'memorize_spell', casting_time:'passive'}`.
Canonical: "Whenever you finish a Short Rest, you can study your spellbook and replace ONE of the level 1+ Wizard spells you have prepared with another level 1+ spell FROM THE BOOK."

## PASS legs (live-verified)
- Sheet passive row "Memorize Spell:" with canonical text (CharSummary.jsx:492; row click dispatches `open-short-rest` CharSpecialActions.jsx:320).
- ShortRestModal Memorize Spell section renders (gate fixed: ShortRestModal.jsx:210 reads `automation.specialActions`, not `passives` — 2026-08-30 regression resolved).
- Swap #1 exact: Magic Missile OUT, Shield IN; runtime `DivinationWizard.preparedSpells` written; log "DivinationWizard swapped prepared spell Magic Missile for Shield (short rest)."
- Cantrips excluded from both selects (`level >= 1` filter, ShortRestModal.jsx:578-586).
- Re-arm face after real SR: section re-offered (canonical per-SR trigger).
- Control War_Cleric (Cleric lv8): zero Memorize rows.

## FAIL 1 — once-per-Short-Rest never enforced (core clause)
Swap #2 in the SAME un-completed rest accepted: Sleep OUT, Mirror Image IN, runtime updated, log
"DivinationWizard swapped prepared spell Sleep for Mirror Image (short rest)." — no refusal face.
Root cause:
- No runtime use-counter key (grep: zero `memorize*Used*` producers/consumers src+server).
- `handleMemorizeSwap` (ShortRestModal.jsx:587-604) resets mode/from/to only; `memorizeSpellAvailable`
  (:576 = `hasMemorizeSpell && !mode && preparedSpells.length > 0`) goes back true immediately —
  "Swap Prepared Spell" button re-offers inside the same modal.
- Row click opens the swap UI WITHOUT any rest occurring (`open-short-rest`), so rest-anchored gating
  is also bypassable without pressing Complete Short Rest.

## FAIL 2 — "from the book" = full class list, not character spellbook
`toOptions` built from `loadSpellData(...).filter(s => s.classes.includes('Wizard'))`
(ShortRestModal.jsx:557-563) — entire Wizard list. Swapped IN Shield and Mirror Image, neither of
which is in the character's disk known-spells[] (61 spells). Known-list exclusion NOT applied.

## Fix sketch
Stamp a per-rest latch (e.g. runtime `memorizeSpellUsedSinceRest`) in handleMemorizeSwap; gate
`memorizeSpellAvailable` on it; null it in SHORT_REST/LONG_REST resource reset lists
(restRules-shortRest.js / restRules-constants.js). Filter `toOptions` by `playerStats.spells` known.

## Cleanup
Admin cleared change-data {} + log [] GET-verified; disk spells[] 61 intact (Magic Missile, Maze,
Mass Suggestion, Mage Hand present; Shield/Mirror Image never leaked to disk). Runtime cleared, so
derived prepared list restored.
