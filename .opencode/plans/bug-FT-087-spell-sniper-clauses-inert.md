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

## Fix options

Verdict 2026-09-07: SKIPPED overall — clause (d) FIXED cleanly at the Distant-Metamagic precedent seam (uncommitted); clauses (b) cover and (c) melee need a human architecture decision (whole new spell-cover/melee subsystems). Manifest `verified` field NOT touched (orchestrator owns it).

### Live re-verification findings (post-repro, this session)
- Reproduced pre-fix: holder DivinationWizard Poison Spray (30 ft) at ~124 ft → `mode:normal, isAutoMiss:false, no rangeReason`; control AberrantSorcerer Ray of Frost (60 ft) at ~127 ft → identical shape. Both HIT.
- NEW stronger finding: even at 127 ft vs Ray of Frost's 120 ft auto-miss threshold, live engine logs NO auto-miss — `attackerPos/targetPos` are never populated for `executeSpellCast` in ANY sheet cast flow (popup "Cast Spell", Actions-grid, Metamagic confirm all forward `castAction` with an unresolved/empty position ref; `useSpellPositionResolver` never lands positions there). So the spell path enforces range (and the disadvantage band) not at all live; +60 is therefore **latent-but-correctly-computed** at the seam. Range-band plumbing for spells is OUT OF SCOPE here (would be a new enforcement subsystem, not a feat fix).

### Clause (d) Increased Range +60 — FIXED NOW (clean seam, verified)
- Verified seam: `spellCastService/execution/damageCalculation.js:computeRange` — the only spell-path range computation, already the consumption point for Distant Metamagic (`computeEffectiveSpellRange`, rangeValidation.js:96) and cantrip range bonuses (`cantripRangeBonus`, the Improved Elemental Fury precedent, same ≥10 ft gate shape).
- Fix applied (uncommitted): consume `featEffects.spellRangeBonus` in `computeRange` mirroring the cantrip-block structure — added to `effectiveRange` after Distant doubling, gated to attack-roll spells (`spell.attack_type && !spell.dc`) with base range ≥ 10 ft. `featEffects` (= featRangeService `computeFeatRangeEffects` output incl. Spell Sniper's 60) is already forwarded by the CharActions `actionCastAction` executor.
- Locked by new co-located test `damageCalculation.test.js` (6 tests: eligible +60 flips auto-miss→normal, control unchanged, DC spells excluded, <10 ft excluded, Distant-then-+60 stacking order, cantripRangeBonus behavior preserved). Green: new test, `src/services/rules/spells` (907), `src/services/rules/combat` (354), lint zero warnings.
- 5e parity: 5e spell-sniper declares range-doubling via automation `effect:'spell_range_doubled'` — ZERO consumers app-wide (grep) and no `spellRangeBonus` key in 5e rangeEffects, so 5e holders get 0 from the seam (unchanged, safe). A 5e doubling consumer would need its own seam decision.
- Residual (accepted): engine-wide spell range enforcement (disadvantage band beyond normal range, auto-miss beyond double) is ignored on this path (`computeRange` inspects only `mode==='miss'`) AND positions are null in live flows — until that plumbing exists, the +60 changes only the computed threshold, unobservable live. Do NOT build it under this ticket.

### Clause (b) Bypass Cover — requires NEW spell-cover subsystem (human decision)
- Confirmed: spell path (`spellCastService/execution/index.js` damage/save/no-save paths) never calls `computeCover`; the only exemption for `ignore_cover_ranged` is contextBuilder-map.js:190-197, deliberately scoped to ranged NON-spell attacks by the verified FT-071 Sharpshooter fix.
- Fix options: (1) Add cover computation to the spell attack path (call `computeCover` at the noSavePath/savePath damage seam, apply `coverAcBonus`, then nullify Half/¾ when holder has the passive) — cleanly fixable ONLY as part of a shared spell-attack-context builder that weapons already use; re-scoping the FT-071 block to also accept spells would regress Sharpshooter (5e Sharpshooter does NOT bypass cover for spells… in 2024 it doesn't either) unless attribution is added.
- Sharpshooter-attribution problem: both feats emit the SAME passive key `ignore_cover_ranged` with NO source/attribution field. If spells become cover-aware while the key stays shared, either Sharpshooter wrongly bypasses cover on spells or Spell Sniper stays dead. Fix requires an attribution field on the passive (e.g. `source:'Spell Sniper'` / `appliesTo:'spell'|'weapon'` — 2024 feats.json already carries `rangeEffects.appliesToAttackType:'spell'` which featRangeService currently drops), or split effect keys per feat. Trade-off: data migration of existing character JSON passives vs. fragile name-matching.

### Clause (c) Casting in Melee — requires NEW spell melee-disadvantage subsystem (human decision)
- Confirmed: `computeMeleeProximityEffect` has zero spell-path callers; spells never receive melee disadvantage, so the feat's `rangeEffects.ignoresMeleeDisadvantage:true` cancels nothing.
- Fix options: (1) wire `computeMeleeProximityEffect` into the same future spell-attack context seam (it already honors `featEffects.ignoresMeleeDisadvantage` — ready-made consumer once spells compute melee proximity; needs nearbyThreats sourcing on the spell path); blocked by the SAME subsystem absence as (b).
- BONUS attribution leak found (same class of problem, opposite direction): `contextBuilder-map.js:154-273` feeds the shared `featRangeEffects.ignoresMeleeDisadvantage` into WEAPON attack context unconditionally — a Spell Sniper holder's weapon ranged attacks currently get the feat's melee-disadvantage cancellation they shouldn't have (Sharpshooter shares the key, so it's invisible today; becomes a bug the moment only one feat is held). Any attribution fix should gate this by `appliesToAttackType`.

### Summary of tree left uncommitted
- FIXED (clean, test-locked): clause (d) `spellRangeBonus` consumption in `damageCalculation.js:computeRange` + new `damageCalculation.test.js`.
- MANUAL DECISION: clauses (b)/(c) (spell-cover + spell melee-proximity subsystems + `ignore_cover_ranged` attribution schema), spell range-band/position plumbing, 5e `spell_range_doubled`, weapon-side feat leak above.
- ASI untouched (works). Campaign left via Admin Full Reset (change-data `{}`, log 0, verified stable); feat registry drift (Spell Sniper + INT ASI) remains as documented above — orchestrator to reconcile.
- PRE-EXISTING glitches observed (NOT fixed, unrelated): Poison Spray logged `spellLevel:17 / 4d12` and Ray of Frost `3d10 Fire` (wrong die/type/scaling in sheet rows); sorcerer Metamagic modal showed "14 SP available" at lv14 (max 2).
