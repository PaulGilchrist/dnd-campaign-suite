# BUG SP-114 — Summon Aberration (2024, summon_spirit)

## Overview
Summon Aberration's summoning pipeline IS live (real combatant entity, variant chooser, slot payment, summons log, initiative row), but `summonSpiritHandler.js` contains an explicit `isSummonAberration` hardcode that **strips the spell's concentration** — the app's own spells.json says "Concentration, up to 1 hour" — and injects uncanonical data onto the summoned Aberrant Spirit (AC +slot scaling, temp HP = level+CHA, a "Psychic Strike" thrall bonus action). Removal at 0 HP and at spell end are both non-functional for this spell.

## Expected (canonical quote, public/data/2024/spells.json, index `summon-aberration`)
> "You call forth an aberrant spirit… choose Beholderkin, Mind Flayer, or Slaad… The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your allies. In combat, it shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required from you). If you don't issue any, it takes the Dodge action…"
- Level 4, range 90 ft, Action, **Duration: Concentration, up to 1 hour (concentration: TRUE)**, school Conjuration, automation.type `summon_spirit`, variants aberrant-spirit-beholderkin/-mind-flayer/-slaad (monsters.json: HP 40, **AC 11**, type aberration).

## Actual (live-proved 2026-09-07, DivinationWizard lv20 Abjurer, test-campaign, EB Thug 1 joined)
WORKS:
- Variant chooser modal (`SummonSpiritModal`) offered all 3 forms; Mind Flayer picked.
- lv4 slot paid 3→2 (base level, numeric ledger).
- Real combatant created in combatSummary: "Aberrant Spirit (Mind Flayer)", HP 40/40, `summonedBy: DivinationWizard`, `summonSource: spell`; initiative 16.9 → sorted immediately after count 17 (caster init was un-rolled; handler derived 17, spirit = caster−0.1).
- Campaign log `summons` entry: "DivinationWizard casts Summon Aberration (slot level 4), summoning Aberrant Spirit (Mind Flayer) (40/40 HP)."

FAILS:
1. **No concentration** — `cs.concentration: None`, no badge; te `summoned` duration `1_minute` not `concentration`. Cause: summonSpiritHandler.js:168-169 forces `noConcentration = true` when `action.name === 'Summon Aberration'`, skipping `addConcentration` (:212-214).
2. **AC 15 vs canonical 11** — buildSpiritCreature ac = baseAc + slotLevel (11+4); canonical scales HP only (:74-80).
3. **Uncanonical temp HP 19** written to spirit change-data key (level 20 + CHA −1) — Summon Aberration grants no temp HP (:185-190).
4. **Uncanonical "Psychic Strike" bonus-action action** pushed onto the spirit (Create-Thall-style, via the forced noConcentration branch) (:94-103). Stat block should have only Psychic Slam.
5. **No disappearance at 0 HP** — set spirit currentHp 0 via initiative card; it remains in combatSummary with te `summoned` intact; no death-triggered removal consumer anywhere (grep: `removeSummonedCreatures` only consumed by concentrationService.js:122 + clearAllExpirationEffects.js).
6. **Spell-end removal never fires** — `pendingExpirations: []` (no addExpiration registered); the only real removal seam is concentration break, which cannot exist because (1). Duration "up to 1 hour" unenforced.
7. Command/Dodge model: absent app-wide (te `summoned` has zero consumers) — advisory.

## Steps (repro)
1. test-campaign, prepare Summon Aberration on DivinationWizard (Edit → tab 14 Spells → tick row → mi-skip → ✓Save; reload). Hydrate activeConditions (pitfall 40).
2. EB: Select Thug → Join Encounter. Sheet → Summon Aberration row → Cast Spell (lv4 slots 3→2) → chooser → pick Mind Flayer → Summon.
3. Observe cs: spirit init 16.9, AC 15, tempHp 19, actions [Psychic Slam, Psychic Strike]; cs.concentration None; te summoned duration 1_minute; pendingExpirations [].
4. Set spirit card HP 0 → persists in cs, te remains.

## Likely Location
- `src/services/automation/handlers/spells/summonSpiritHandler.js` :168-169 (remove the `isSummonAberration` noConcentration force — canonical app data says concentration), :74-80 (AC must not scale with slot), :94-103 (Psychic Strike belongs to Create Thrall only, gate on its own flag), :185-190 (drop aberration temp-HP grant), :192-204 (register addExpiration for the concentration-hour clock + removeSummonedCreatures on expiry / concentration break / caster death), HP-0 removal consumer in damage pipeline.

## Notes / design options
- The aberration-specific hardcode looks like homebrew miswired into the generic summon handler — every other summon_spirit spell (Create Thrall etc.) keeps concentration semantics per its own data.
- Fix should route duration through `auto.duration`/spells.json concentration flag rather than spell-name strings.
- Manifest row SP-114 name has a leading "- " dash (data cosmetic bug); manifest handler/router/infoBuilder paths are fictitious — real chain: automation/index.js:610 → summonSpiritHandler.js → SummonSpiritModal.jsx → confirmSummonSpirit.
- Playbook SP-112 note "No summon entity / no later-turn producers" is now partially superseded: summonSpiritHandler DOES create cs entities (the SP-112 note applied to Spiritual Weapon's separate path).
