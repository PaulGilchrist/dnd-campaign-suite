# Bug — SP-069 Hypnotic Pattern: spell slot never consumed on confirm lane; damage does not end charm

## Overview
Casting Hypnotic Pattern from the DivinationWizard sheet (test-campaign) correctly fires per-target WIS DC19 saves, stamps `charmed/incapacitated/speed_zero`, registers concentration and logs — but the level-3 spell slot is never decremented (23 casts, `spell_slots_level_3` stayed at 2), and a charmed target taking damage does NOT have the conditions end.

## Expected Behavior (canonical app-data, public/data/2024/spells.json "hypnotic-pattern")
> "Each creature in the area who can see the pattern must succeed on a Wisdom saving throw or have the Charmed condition for the duration. While Charmed, the creature has the Incapacitated condition and a Speed of 0. The spell ends for an affected creature if it takes any damage or if someone else uses an action to shake the creature out of its stupor."

Plus standard casting: a 3rd-level spell slot is consumed (and the app modal should describe a 30-foot Cube per the same data file).

## Actual Behavior
- Save/condition/concentration seam WORKS:
  - change-data: `Bandit 1.activeConditions = ["charmed","incapacitated","speed_zero"]`, same for `Bandit Captain 1`.
  - combatSummary caster concentration: `{spell:"Hypnotic Pattern", dc:19}`.
  - logs: `ability_use` ("Selecting 2 target(s) for save (DC 19 WIS)"), `save_result` fails ("Bandit 1 failed WIS save (DC 19, rolled 10 + 0 = 10)"), `condition applied` entries.
- SLOT LEAK (no consumption): `DivinationWizard.spell_slots_level_3` remained **2** across 23 cast-log cycles (before=2, one clean click → after=2, re-checked >12 s later = 2). `HypnoticPatternModal.jsx` `handleCreatureSelectionConfirm` (src/components/char-sheet/modals/shared/HypnoticPatternModal.jsx:186-191) only logs + `resolveAllSaves` — no `spell_slots_level_*` write anywhere in the modal (grep zero). Compare §SP-050's confirm-lane slot-leak family (§9) — same shape: casts complete, slots untouched.
- DAMAGE-BREAK UNGATED: Bandit 1 HP 11→5 via card HP input (`spinbutton "Bandit 1 current HP"`, real keystrokes + Enter; combatSummary currentHp=5 confirmed) — `Bandit 1.activeConditions` remained `["charmed","incapacitated","speed_zero"]`. No producer exists that removes hypnotic conditions on damage (only the `hypnotic_pattern_shake` action handler clears them; no damage pipeline consumer found).
- AREA TEXT WRONG: modal description says "Select creatures in the **20-foot-radius sphere**" (HypnoticPatternModal.jsx:207) but app data says **30-foot Cube**.

## Steps to Reproduce
1. test-campaign, localhost:5173. EB-join Bandit + Bandit (captain suffixed "Bandit 1"/"Bandit Captain 1").
2. DivinationWizard (lv20, add Hypnotic Pattern via wizard Spells step if absent) → sheet spell row → Cast Spell → confirm "Hypnotic Pattern (N)" in .sp-modal.
3. Observe inline auto-saves, conditions + concentration + logs land — but `spell_slots_level_3` unchanged in change-data.
4. Edit charmed Bandit card HP input down (damage) → conditions persist.

## Likely Location
- `src/components/char-sheet/modals/shared/HypnoticPatternModal.jsx:186` — confirm lane consumes nothing (add slot spend at confirm/pending like §SP-049 lane; also area text line 207).
- Damage-break: needs a damage-pipeline hook removing hypno te/conditions (addExpiration tags effects but no damage-triggered removal producer; `src/services/automation/handlers/spells/hypnoticPatternShake.js` covers only the shake action).
- Note: mission row paths (`src/services/combat/automation/handlers/spellHandler.js` etc.) are stale; real chain is modal → `routeSaveStyle`/`automation/index.js hypnotic_pattern` → `src/services/automation/handlers/spells/hypnoticPatternHandler.js`.

## Notes
- Test artifact: confirm button repeated clicks each re-cast (23 log cycles) — that spam proves the no-decrement invariant (zero consumption over 23 casts).
- PASS-subset was NOT available: orchestrator gate requires slot stamp exact; it is inert.
