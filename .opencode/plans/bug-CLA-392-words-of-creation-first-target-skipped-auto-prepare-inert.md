# Bug — CLA-392 Words of Creation: spread kills only the SECOND target; auto-prepare inert on base Bard lv20

## Title
CLA-392 Words of Creation (Bard lv20, 2024): second-target chooser fires but the FIRST target is silently skipped; and Power Word Heal/Kill are never auto-prepared (major-feature gate rejects the base class feature).

## Overview
Words of Creation is BASE Bard lv20 in app 2024 data (`public/data/2024/classes.json` class_levels[19], automation `{type:'passive_rule', effect:'always_prepared_spells', spells:['Power Word Heal','Power Word Kill'], multi_target_spread:{spellFilter:[…], range:'10 ft'}}`). Two independent defects, each live-proven on lv20 HeroesFeastBard (College of Glamour, test-campaign):

1. **Auto-prepare inert.** The only consumer of `always_prepared_spells` on the 2024 path is `src/services/rules/core/spellCalc2024.js:298`, which injects `prepared:'Always'` ONLY when `majorFeatureNames.includes(feature.name)` (major/subclass features — the Telekinetic Master pattern). Words of Creation is a base CLASS feature, never in `class.major.features`, so the injection never runs. Live: at lv20 the sheet shows no Power Word Heal / Power Word Kill rows at all (the only "Power Word" text on the sheet is the feature description inside `.char-special-actions`). The spells became castable ONLY after manually ticking Power Word Kill in Edit-wizard tab "14Spells" (persisted to disk `spells[]`).
2. **Spread overwrites the first target.** The chooser is hardcoded by spell name in `src/hooks/combat/useSpellMetamagicGates.js:50` (`isPowerWordSpell`) and does render ("Words of Creation — Choose Second Target"), pay the lv9 slot, and apply to the chosen SECOND target — but `src/services/rules/spells/spellCastService/execution/modalSpells.js:19-26 handlePowerWordKill` (and :3-13 for Heal) is `if (metaCtx?.multiTarget) { apply ONLY to multiTarget } else { apply to first target }`. Choosing a second target makes the spell affect ONLY that second creature; the original target is never processed.

## Expected (canonical quote, classes.json lv20)
"You have mastered two of the Words of Creation: the words of life and death. You therefore always have the Power Word Heal and Power Word Kill spells prepared. When you cast either spell, you can target a second creature with it if that creature is within 10 feet of the first target."
⇒ Auto-prepared rows without manual prep; cast affects FIRST target AND (optionally) a second creature within 10 ft.

## Actual (live, 2026-09-10)
- Lv18→20 via Edit wizard (trusted Save, disk level:20). Reload: no PWH/PWK rows (half 1 FAIL).
- After manually preparing PW Kill: cast chain row → SpellDetailPopup "Cast Spell" → chooser rendered with all 16 combatants (incl. caster; NO within-10-ft filtering in `getCreatureTargets`, gridless lenient accepted).
- Pick Thug 2 + "Cast Spell": slot9 1→0 + `ability_use "Power Word Kill: Expended a level 9 spell slot."` + `spell tn:Thug 2` + `spell tn:Thug 1` log line + **hp_change ONLY Thug 2 (32→0 slain)**. **Thug 1: 32→32, untouched.** Popup: "Power Word Kill on Thug 2 / Thug 2 was slain".
- Control (Long Rest refill slot9→1, arm Thug 1, cast, "Skip" chooser): **Thug 1 32→0 slain**, slot9 1→0. Single-target leg healthy → the drop-out is exactly the multiTarget branch.

## Steps
1. test-campaign, lv20 2024 Bard (HeroesFeastBard bumped lv18→20 via Edit wizard, subclass Glamour — any college, feature is base lv20). Reload.
2. Observe sheet: no Power Word Heal / Power Word Kill rows → half 1 FAIL.
3. Manually tick Power Word Kill (wizard tab "14Spells") + Save; EB-join Thug 1 + Thug 2; arm bard card target-select → Thug 1.
4. Cast Power Word Kill → chooser "Words of Creation — Choose Second Target" → pick Thug 2 → "Cast Spell".
5. Observe: Thug 2 dies (hp_change 32→0), Thug 1 unchanged (32); slot9 1→0 logged.
6. Control: Long Rest (slot9→1), re-arm Thug 1, cast again, "Skip" chooser → Thug 1 dies → proves single-target leg works, spread branch drops the first target.

## Likely Location
- `src/services/rules/spells/spellCastService/execution/modalSpells.js` `handlePowerWordKill` (~:19-26) / `handlePowerWordHeal` (~:3-13): `if/else` should apply to BOTH first target and `metaCtx.multiTarget` (e.g. always apply to the resolved first target, plus multiTarget when present).
- `src/services/rules/core/spellCalc2024.js:298` (and 5e twin `spellCalc.js:227`): `majorFeatureNames.includes(feature.name)` gate excludes base-class features; needs base-class feature names included (or drop the gate for base features).
- Attribution note: `useSpellMetamagicGates.js:50` is a spell-NAME hardcode — the chooser fires for ANY caster of PW Heal/Kill (Cleric/Sorcerer/Warlock/Wizard), not gated on the Words of Creation passive; the feature's own `multi_target_spread` data has ZERO live producers (core-handlers.js:425 info keyed by `auto.type:'multi_target_spread'` never runs since this feature's `auto.type` is `passive_rule`; router never flattens the nested key; `postCastRiderService.getMultiTargetSpreads` filters `automation.passives` by `type==='multi_target_spread'` — zero pushes of that type; `automation/index.js:366 handleMultiTarget` + `multiTargetHandler.js` = zero reachable producers).

## Notes
- Slot accounting EXACT: lv9 1→0 at confirm with `ability_use` log; Long Rest refills to 1; refusal-free.
- Chooser lists the caster + first target as second-target options; no within-10-ft filter (gridless lenient accepted per §7, but code has no range check at all on this path — multiTargetHandler's isWithinRange gate sits in the dead generic path).
- Host left lv20, Glamour, `spells[]` +Power Word Kill (permanent, reusable for post-fix retest); campaign change-data + log cleared after run.
- Manifest paths stale as usual: real chain is gateMetamagic → modalSpells (not classFeatureHandler/Router/infoBuilder trio).
