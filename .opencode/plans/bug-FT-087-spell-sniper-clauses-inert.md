# Bug FT-087 — Spell Sniper: 3 of 4 clauses inert (no consumers; holder == non-holder)

## Title
Spell Sniper (FT-087) — only the ASI clause works; Bypass Cover, Casting in Melee, and Increased Range have zero feat-specific effect for spell attacks.

## Overview
The 2024 Spell Sniper feat (public/data/2024/feats.json index `spell-sniper`) declares four benefits. Verified live in test-campaign with holder **DivinationWizard** (lv20 Wizard, feat added via Edit wizard, ASI Intelligence) vs non-holder control **AberrantSorcerer** (lv14, Fire Bolt known). Map rig on Test Map (activeMapName=test-map): caster at (1,1), Thug 1 adjacent at (2,1) (5 ft melee contact), barrel (½ cover) mid-line at (10,10), Zombie 1 (AC 8) at (19,19) ≈ 127 ft (> Fire Bolt's 120 ft base range).

Only the Ability Score Increase clause has a real consumer. The cover, melee-disadvantage, and +60 range clauses are dead for spell attacks: the engine never applies cover, melee proximity, or normal-range gating on the spell path, so a holder and a non-holder behave identically — zero feat-specific delta.

## Expected Behavior (canonical, public/data/2024/feats.json wording)
- "Ability Score Increase. Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20."
- "Bypass Cover. Your attack rolls for spells ignore Half Cover and Three-Quarters Cover."
- "Casting in Melee. Being within 5 feet of an enemy doesn't impose Disadvantage on your attack rolls with spells."
- "Increased Range. When you cast a spell that has a range of at least 10 feet and requires you to make an attack roll, you can increase the spell's range by 60 feet."

## Actual Behavior
1. ASI — WORKS. Disk: feats ['Magic Initiate','Spell Sniper'], featAbilityChoices {"Spell Sniper-0":{"assignment":"Intelligence"}}, Intelligence featIncrease 1 exactly once (16+1bg+1=18). Sheet INT 17→18, Fire Bolt hit +9→+10, spell DC 17→18.
2. Bypass Cover — DEAD for spells. Holder Fire Bolt log: `targetAc:8, effectiveAc:8, mode:"normal"`, no `coverAcBonus`/`coverLevel` — identical to control (`targetAc:8, effectiveAc:8`). Cover was never applied to the spell roll in the first place, so the feat bypasses nothing. Grep: `ignore_cover_ranged` exemption in `src/services/automation/contextBuilder-map.js:190-197` is scoped to `isRanged && !attack.school && attack.weaponType !== 'spell'` (the FT-071 Sharpshooter fix); spell attacks are explicitly excluded, and the spell path (`spellCastService/execution/index.js`) never calls `computeCover`.
3. Casting in Melee — DEAD. Holder and control both log `mode:"normal"` with Thug 1 adjacent. `computeMeleeProximityEffect` (which honors `rangeEffects.ignoresMeleeDisadvantage`) has zero spell-path callers — only `contextBuilder-map.js:273` (weapon rows) and `automation/common/damageRoll.js:120` (monsters, featEffects `{}`). `rg ignoresMeleeDisadvantage|computeMeleeProximityEffect src/services/rules/spells` = zero hits. The feat grants cancellation of a penalty the engine never applies.
4. Increased Range +60 ft — DEAD. Both holder and control cast Fire Bolt at ~127 ft (> 120 ft base) with `mode:"normal"`, no `rangeReason`, no auto-miss. `spellRangeBonus` from the feat's `rangeEffects` is computed into `featRangeEffects` by `featRangeService.js` and forwarded to the spell path as `featEffects`, but `spellCastService/execution/damageCalculation.js:computeRange` consumes only `cantripRangeBonus` and rangeMultiplier — `spellRangeBonus` is never added (`rg spellRangeBonus src/services/rules/spells` = zero hits); `computeEffectiveSpellRange` handles only Distant Metamagic. Bonus-range enforcement (disadvantage band) is also ignored on this path (only `isAutoMiss` inspected).

## Steps to Reproduce
1. test-campaign; EDIT DivinationWizard → Feats tab tick "Spell Sniper" → Ability Scores tab set Spell Sniper combobox = Intelligence → Save (INT 17→18).
2. Maps → Test Map → Activate + Open; place barrel at (10,10); drag DivinationWizard to (1,1); drag Thug 1 to (2,1); drop NPC token, rename "Zombie 1", drag to (19,19).
3. Encounter Builder → tick Zombie → Join Encounter; arm Zombie 1 on the wizard's initiative card `[data-testid="target-select"]`.
4. Wizard sheet → Fire Bolt → Cast Spell → Done. Log: `mode:"normal"`, `effectiveAc:8`, no cover fields, hits at ~127 ft.
5. Revive Zombie 1 (card `input.hp-inline-input`); swap tokens (AberrantSorcerer to (1,1)); arm Zombie 1 on Sorcerer card; cast Fire Bolt → identical field shape (`mode:"normal"`, `effectiveAc:8`, cast at 127 ft). Control == holder for clauses 2–4.

## Likely Location
- `src/services/automation/contextBuilder-map.js:190-197` — `ignore_cover_ranged` scoped to non-spell ranged weapon attacks only (spell exemption for Spell Sniper removed by the FT-071 Sharpshooter fix; the shared effect key cannot distinguish Sharpshooter from Spell Sniper — no attribution/level field).
- `src/services/rules/combat/rangeValidation.js:108` `computeMeleeProximityEffect` — never invoked from any spell cast path.
- `src/services/rules/spells/spellCastService/execution/damageCalculation.js:5-22` `computeRange` / `computeEffectiveSpellRange` — ignores `featEffects.spellRangeBonus`.
- Manifest paths `src/services/combat/automation/handlers/featHandler.js`, `routers/featRouter.js`, `infoBuilders/featInfoBuilder.js` are FICTITIOUS (directory does not exist); real consumers as above (house-rule confirmed).

## Notes
- Clause status: (a) ASI PASS; (b) FAIL (no spell-cover consumer; exemption explicitly excludes spells); (c) FAIL (zero consumers — spells never get melee disadvantage); (d) FAIL (spellRangeBonus never consumed on spell path; range band not enforced for anyone).
- `rangeEffects.spellRangeBonus:60` and `ignoresMeleeDisadvantage:true` are collected into `featRangeEffects` by `computeFeatRangeEffects` (featRangeService.js) — supply live, consumption dead for spells.
- Spell passive `automation {type:'passive_rule', effect:'ignore_cover_ranged'}` is collected into the holder's passives but is weapon-scoped by the FT-071 fix.
- Session pitfall hit: spell cast throws `activeConditions must be an array for caster` (spellCastService/execution/index.js:106-108) if the caster's runtime `activeConditions` key was never hydrated (e.g. after Admin clear / fresh sheet); fix = POST merged store `activeConditions:[]` then reload.
- Registry drift: original DivinationWizard feats were `['Magic Initiate']`; Spell Sniper + INT ASI left PERMANENT. Map left: barrel(10,10), Thug 1(2,1), Zombie 1(19,19), Wizard(1,2), Sorcerer(1,1), Divine_Cleric displaced to (2,6).
