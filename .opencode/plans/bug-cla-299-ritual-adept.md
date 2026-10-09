# BUG CLA-299 — Ritual Adept (Wizard class feature): ritual cast consumes a spell slot; no slotless cast-as-ritual channel

**Verdict:** FAIL
**Date:** 2026-10-09 | **Host:** DivinationWizard (test-campaign, lv20, 2024, Abjurer — subclass irrelevant; Ritual Adept = base Wizard feature, 2024 `classes.json` level 1 `automation {type:'passive_rule', effect:'ritual_spells', casting_time:'passive'}`; manifest lv6 + classFeatureHandler/router/infoBuilder paths stale — actual consumers below)

## Expected (2024 PHB / manifest)
Cast any Ritual-tagged spell **in your spellbook** as a Ritual — **needn't be prepared**, no spell slot consumed (+10 min casting time), must read from the book.

## What is LIVE (partial affordance — grep + control recorded)
- **Gate live-exact (both faces):** `CharSpells.jsx:113-116` `isGrayedNonCastable = is2024 && isWizard && !isPrepared && !spell.ritual`.
  - Un-prepare Sleep (lv1 non-ritual) → row `spell-name not-castable`, title `"Not prepared"`, click inert (no popup). LIVE-verified.
  - Un-prepare Identify (lv1 ritual, `ritual:true` data) → row stays `clickable`; cast popup allowed; `preparedSpells` runtime array written without Identify/Sleep (`CharSheet.jsx:334-358` toggle → runtime).
- **Ritual tag display live:** sheet + popup casting time verbatim composite `"1 minute or Ritual"` / `"1 min or Ritual"` / `"Action or Ritual"` (2024 `spells.json`; `castingTimeUtils.js:16` returns composite unchanged). Known rituals: Identify lv1, Augury lv2, Divination lv4.
- **Feature row:** sheet class-features renders `"Ritual Adept:"` + full RAW text verbatim (`automationInfoBuilder/passive.js:136` ritual_spells passive).
- **No-spam design:** `spellCalc2024.js:405` `applyRitualSpellPassives` skips name `'Ritual Adept'` (spellbook spells already in list) — prevents full-game ritual injection, NOT a slotless channel.

## Defect (a) CORE: ritual cast consumes a spell slot (RAW violation)
Cast Identify UNPREPARED (the only possible mode for a not-prepared wizard spell — RAW = ritual-only, slotless):
- change-data `spell_slots_level_1` **4 → 3** (`spell_slots_level_2` 3 unchanged); log `spell` entry `spell:'Identify'`, `castingTime:'1 minute or Ritual'` (utility spell = log-only effect, no automation data).
- Zero-slot probe (UI pip toggles, lv1 4→0): popup now `"Slots Remaining: 0"`, `"No spell slots available for this level."`, **Cast Spell DISABLED** — RAW: Ritual Adept must still cast (11 min, slotless).

## Defect (b): no "Cast as Ritual" affordance
`SpellDetailPopup.jsx`: NO ritual checkbox/toggle for wizard spellbook rituals; casting time is a static composite label; no +10-minute mode switch, no book-reading note, no ritual-mode log. Only ritual toggles app-wide belong to OTHER channels: FT-068 Ritual Master `Quick Ritual` checkbox (`_ritualMasterRitual`, `spellPreparationService.js:798-806`, feat-holder HexWarlock) and CLA-234 `_ritualOnly` Wild Heart banner (`SpellDetailPopup.jsx:45-46`). `FREE_CAST_CHECKS` (`spellPreparationService.js:232-266`) has **no wizard spellbook-ritual check** → slot consumption via generic `consumeSpellResource`.

## Gap (c, advisory): "must read from the book" — feature-text only, no state.

## Suggested fix shape
Slotless free-cast channel in `FREE_CAST_CHECKS`: wizard + `spell.ritual` + name in spellbook (`playerStats.spellAbilities.spells` / disk `spells[]`) + not prepared → authorize free cast; popup banner `"Ritual Cast — no spell slot consumed"` (reuse `_ritualOnly` banner pattern) or explicit "Cast as Ritual" checkbox (+10 min note) with slot payment only when unchecked; ritual-mode log entry via `ability_use` `abilityName:'Ritual Casting'` (CLA-234 `spellPreparationService.js:700-708` template).

## Evidence session
Header `test-campaign` verified after select. No combat, no monsters, no data edits. preparedSpells runtime array left with Identify/Sleep unprepared — admin cleared change-data + log GET-verified after, campaign deselected quiet.
