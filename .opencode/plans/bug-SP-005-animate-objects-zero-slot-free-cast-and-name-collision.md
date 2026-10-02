# SP-005 Animate Objects — summon-lane multi-cast: zero-slot free cast + duplicate bare-name collision + te loss

## Overview
Animate Objects rides the `summon_spirit` lane (single-variant chooser, one construct per cast). Multi-cast within one combat exhibits two confirmed live defects: (A) with `spell_slots_level_5 = 0` the sheet panel prints "No spell slots available for this level." yet **Cast Spell still fully executes** — construct spawns, `spell` + `summons` logs fire, and NO slot is consumed at any level (lv6 untouched — no auto-upcast); (B) repeat summons of the same variant collide on the bare variant name — multiple cs combatants named "Animated Object (Medium)", `pushSummonedEffect` dedup (target+source) drops te markers for dupes, te observed emptied, ~80 React duplicate-key console errors. Same defect family as bug-SP-004 (animate-dead multicast), reproduced on the summon lane.

## Expected (canonical)
- 5th-level spell: each cast expends one lv5 slot; with none available the cast is REFUSED (no spawn, no log) or auto-upcasts to an available higher slot per app precedent (SP-117 pitfall 43).
- Upcast lv6: +2 objects (count) — not modeled at all (gap, advisory).
- Each summoned object unique combatant identity; te `summoned` marker per spawned combatant, surviving for the concentration duration.

## Actual
- Cast #4 at lv5=0: panel "No spell slots available for this level." + Cast Spell → popup "casts Animate Objects (slot level 5), summoning…" + construct spawned (init 10.9); change-data lv5:0, lv6:2 unchanged; `spell`(spellLevel 5) + `summons` logs written. Free cast.
- 3 live combatants share name "Animated Object (Medium)"; `targetEffects` ended `[]` (dedup + concentration-replace cleanup race); remove-NPC clicks produced ~80 console errors (React duplicate keys).

## Steps
1. test-campaign, DivinationWizard lv20 (INT +5, DC 19), Animate Objects prepared; EB join Bandit; seed Deafened→Apply→×.
2. Cast Animate Objects lv5 three times (variant Medium). Slots 3→2→1→0 (spends correct while slots exist).
3. With lv5=0 re-open spell → panel warns no slots → click Cast Spell → construct spawns anyway, lv6 unchanged, logs written.
4. GET /change-data: 3 cs entries named "Animated Object (Medium)", te [].

## Likely Location
- Slot gate: spell cast executor path for `{type:'modal'}` summon flows — the "No spell slots available" sentinel (spell detail/executeSpellCast gate) is advisory-only before the modal; `performSummon` (src/services/automation/handlers/spells/summonSpiritHandler.js:257) never re-checks slots and never reads variant counts.
- te/name: `pushSummonedEffect` dedup-by-name (summonSpiritHandler.js:243-255) + `displayName = variant.name` (:158) — no per-cast idx suffix (compare animate-dead lane / bug-SP-004).

## Notes
- Core CAST-path PASS-subset (see checkpoint-SP-005.md): spawn AC15/HP10, merged spell-attack +11 fold, concentration linked dc 19, cnp DC 10 break → "Animate Objects ends" log + full cleanup — all live.
- Object-count gate (≤ spellcasting mod) and size ledger (Large=2/Huge=3) grep-zero in lane code — honest unmodeled gap, not filed as FAIL per CAST-path rule.
- Cosmetic: generic concentration-break log prose "Concentration broken; Flesh to Stone ends." ×2 fires for non-F2S breaks.
