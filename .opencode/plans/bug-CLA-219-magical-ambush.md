# bug-CLA-219 — Magical Ambush: gate fires, disadvantage never enforced on target saves (FAIL b — zero save-prompt consumer)

**Feature:** 2024 Arcane Trickster lv9 passive (public/data/2024/classes.json[8] Rogue majors[0].features[2], automation {type:'passive_rule', effect:'magical_ambush'}).
**Manifest expected:** "If you have Invisible condition when you cast a spell on a creature, it has Disadvantage on saving throws against that spell on the same turn."

## Live-verified WORKING half (gate supply)
- passive supplied live: fiber probe of running playerStats.automation.passives contains {type:'passive_rule', effect:'magical_ambush', name:'Magical Ambush'} (collector route automationRouter.js:264 → passives bucket).
- gate computes live: resolveMagicalAmbushInvisible (execution/index.js:115) + resolveAmbushFlags (spellResolution.js:34) read passive + caster runtime activeConditions 'invisible'.
- flag threaded into AoE condition modal: Color Spray (lv1 slot cast lane, invisible active) popup actually rendered "Heightened Spell: one target will have disadvantage" — metamagicHeighten payload = hasInvisible = TRUE (savePath.js:112/143/224).

## Defect (both faces probed live, test-campaign, 2026-10-07, host AasimarTest lv20 2024 Arcane Trickster, EB Bandit 1)
Every actual save adjudication rolls a SINGLE d20 — disadvantage never applied to the target's save:

1. Command lv1 (control, not invisible): saveResult-Bandit 1 {promptId 13bd1187-d821-41f8-99bc-fbfd8e9cfc7a, mode:"normal", rawRolls:[6,6], saveBonus:0} — ledger honest. Dedicated-lane structural gap: commandHandler.js:93 `disadvantage: !!action.metaCtx?.metamagicHeighten` — metaCtx only (sorcerer Heightened Spell), runNoDamagePath never forwards hasInvisible to handleCommand (execution/index.js ~:287 invocation {spell, metaCtx, spellSaveDc, getTargetInfo, playerStats, campaignName, mapName}).
2. Invisibility lv2 self x2 live: GET activeConditions ['invisible'], lv2 3->2, log "cast Invisibility on themself"; cleared by hostile action per design (invisibilityService endInvisibilityOnHostileAction) AFTER gate evaluation.
3. Phantasmal Killer lv4 (illusion, ungated -> runDamagePath -> handleSavePath -> buildSingleTargetSaveContext metamagicHeighten=hasInvisible, savePath.js:224) vs Bandit 1 WHILE invisible: lv4 1->0 consumed, save adjudicated INLINE NPC lane: popup "(d20 16 + 0) SAVE SUCCESS 11 damage HP 11->0", lastAttack {d20:16, d20Rolls:[16,16]} = normal-duplicate shape, no mode recorded, no 2d20 (handleNpcSaveDamage inline adjudicator blind — §MA-0816 family; resolveSaveDisadvantage forceDisadvantage:true at :181/:332/:679 yields no visible effect on the roll).
4. Same spell vs PC victim HexWarlock WHILE invisible (the prompt seam that CAN honor disadvantage — SavePromptModal CLA-042/CLA-275): .sp-modal "Saving Throw Required… Source: Phantasmal Killer … Roll Save" opened, verdict "d20 (12) + 7 SAVE SUCCESS" = SINGLE d20; saveResult-HexWarlock never written; lastAttack.d20Rolls:[12,12] normal shape; save-prompt log rolls:[8,8,7,4]=27 (damage dice, mode:null). => context.metamagicHeighten flag is dropped between buildSingleTargetSaveContext/rollDamage and prompt creation (handlePlayerSaveDamage.js:122/:249 forcedMode never receives it / not the producer of this prompt).
5. Color Spray lv1 save_only AoE modal WHILE invisible: modal text proved flag TRUE ("Heightened Spell: one target will have disadvantage"), but inline adjudication printed single die: save_result "Bandit 1 failed CON save (DC 14, rolled 1 + 1 = 2)", rolls:null, no mode/rawRolls. Heighten-target radio offered was ticked; inline picker math ignores it.

## Root cause sketch
hasInvisible is folded only into rollDamage/save-modal payload flags (`metamagicHeighten`); the live save-roller seams for spell saves (dedicated handlers reading metaCtx only; NPC-inline adjudicator; GM savePrompt payload built without forcedMode/disadvantage from the cast context) have ZERO consumer applying it to the rolled d20. No saveResult anywhere shows mode:"disadvantage" for an invisible-caster spell save.

## Repro
test-campaign; AasimarTest lv20 Arcane Trickster 2024 (INT +0 DC 14; spells added sanctioned step-14: Command, Charm Monster, Color Spray, Phantasmal Killer, Invisibility). EB Join "Bandit". Cast Invisibility on self (GET activeConditions=['invisible']), then cast Phantasmal Killer lv4 on Bandit 1 / on an ally PC: save rolls single d20; ledger mode:"normal"-shape duplicates; expected mode:"disadvantage", 2d20 keep-low.

## Acceptance criteria for fix
- createSaveListener payloads for spell saves receive disadvantage=true when resolveMagicalAmbushInvisible hasInvisible (thread hasInvisible into handleCommand and all dedicated-handler invocations and the savePrompt payload producers / handlePlayerSaveDamage forcedMode seam).
- ledger: saveResult-<Target>.mode=="disadvantage", rawRolls length 2, verdict = lower d20 + mod.
- Control cast without invisible remains mode:"normal".
- Charm Monster gated confirm lane (charmMonsterService.js, zero 'invisible|disadvantage' matches real grep) needs same threading if it owns its prompt.

## Notes / pitfalls encountered
- EB-NPC inline saves emit no saveResult key (§43/§881) — judge NPC legs via 'roll save' + popup dice; PC .sp-modal is the honest mode ledger.
- Stale duplicate aoeCondition sp-overlay survived adjudication; flushed via Close + full page reload (campaign re-select required after reload).
- Post-cast invisibility strip logs "Invisibility ends … hostile action" (expected).
