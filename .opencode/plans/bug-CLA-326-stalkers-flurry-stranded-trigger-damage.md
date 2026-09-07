# BUG CLA-326 — Stalker's Flurry (Ranger, classFeature, 2024) — FAIL

**Verdict: FAIL (bug).** The rider half works live (choice modal, Mass Fear saves at exact DC 17, Dreadful Strike 2d8 upgrade, once-per-turn gate), but the **triggering weapon-hit damage is STRANDED** whenever the Stalker's Flurry modal fires — a HIT that deals zero damage. This is the FT-074 resume-seam explicitly documented as "stalkersFlurry still refused" (playbook §7), now proven live.

## App-data ownership (verified first, from public/data/2024/classes.json, Ranger)
- Stalker's Flurry = **Gloom Stalker major lv11** (`majors[2].features[3]`, automation type `attack_rider`, trigger `weapon_attack_hit`, oncePerTurn, chooseOne, options Sudden Strike (5_ft) / Mass Fear (WIS `spell_save_dc`, frightened, until_start_of_next_turn, 10_ft), `upgrades: "Dread Ambush"`).
- Dreadful Strike (in this app dataset) lives inside **Gloom Stalker lv3 Dread Ambush** (`majors[2].features[0]`, type `dread_ambush_damage`, 2d6 Psychic, `scaling {"11":"2d8"}`, uses = WIS mod min 1). Canonical PHB places Stalker's Flurry under Fey Wanderer — APP-DATA divergence reported, judged against app data per playbook §2.
- Test host: FeyRanger lv17 Gloom Stalker (disk was ALREADY `class.subclass.name='Gloom Stalker'`; registry row was stale claiming Beast Master). No wizard edit required this run.

## Live evidence (test-campaign, 2026-09-06)
Rig: EB Thug 1 (AC11 HP32, init 2) + Thug 2 (AC11 HP32, init 17), gridless lenient ranges (§7 CLA-317 note). WIS 16/+3, lv17 PB+6 → DC 17 predicted & observed.

1. **TRIGGER + CHOICE MODAL — PASS**: Longbow attack #1 `d20 13 +8 = 21 vs AC 11 ✓ HIT`; popup Done → `.sp-modal` "Stalker's Flurry — Choose an effect against Thug 1: Sudden Strike — Make another attack vs. different creature within 5 ft / Mass Fear — Target + creatures within 10 ft make WIS save or be Frightened" + Apply Effect/Cancel.
2. **TRIGGER-HIT DAMAGE STRANDED — FAIL (core)**: with modal open and even after full Mass Fear resolution, `change-data['combatSummary']` Thug 1 `currentHp` stayed **32/32**; `lastAttack` = `{attackName:"Longbow", hit:true, damageFormula:"1d8+2", primaryDamage:0, actualDamage:0, damageApplied:false}`. No hp_change/damage log for attack #1. Root cause chain:
   - `steps/features/stalkersFlurry.js` returns `modal:{type:'stalkersFlurry'}` from the `featureRiders` step (`attackRollPostDamage.js:26`) → pipeline pauses `_pausedStep:'featureRiders'`, `_modalType:'stalkersFlurry'` BEFORE `proceedToDamage` (step order `attackRollDamageSteps.js:23-27`: featureRiders → damageTypeModifiers → overchannel → proceedToDamage → stalkersFlurryPostDamage).
   - `useAttackDamageResolution.js:298-299` resume allow-list accepts featureRiders ONLY when `_modalType==='shieldBash'` (comment on :297 names stalkersFlurry as refused).
   - `CharActionModals.jsx:259-277 handleAttackRiderClose` (the modal's onClose) resumes ONLY Cunning-Strike variants (:273-276); for Stalker's Flurry it just sets a skip flag. `applyPauseState` (:245-286) has no stalkersFlurry branch. Nobody resumes → `riders:applied` never emits → `proceedToDamage` never runs.
3. **CONTROL PROBE (same turn, decisive)**: Longbow attack #2 (riders already used → module skips, no modal): damage popup "1d8+2 [piercing] … applied to Thug 1 — HP: 32 → 29"; `lastAttack.damageApplied:true, actualDamage:3`. Same attacker, same target, same round — hit #1 (modal) dealt 0, hit #2 (no modal) applied damage cleanly. Stranding is caused by the modal pause path, not by anything else.
4. **MASS FEAR BRANCH — PASS**: radio Mass Fear → Apply Effect → `Saving Throw Required … DC 17` prompts. Log: "FeyRanger uses Mass Fear! Thug N must make a WIS save (DC 17) or become Frightened" per target; `save_result`: Thug 2 nat 20 success; Thug 1 `rolled 9` FAIL → runtime `Thug 1.activeConditions=['frightened']`; `saveResult-Thug 1 {success:false, saveBonus:0}`; summary ability_use log. (Gridless lenient `isWithinRange` made the 10-ft radius include ALL combatants — accepted no-map model §7, noted not blamed.)
5. **ONCE-PER-TURN — PASS**: stamp `_Stalker's_Flurry_usedRound={round:1, activeCreature:'FeyRanger'}` (written by `attackRiderHandler.js:337 markOncePerTurn`); attack #2 same round opened NO modal (skip path — control probe #3).
6. **DREADFUL STRIKE 2d8 UPGRADE — PASS**: sheet Reactions row "Dread Ambush:" → handler `dreadAmbushHandler.js` scaling lv17→2d8. Log: `ability_use Dread Ambush "FeyRanger used Dread Ambush to deal 8 Psychic damage to Thug 1 (rolled 2d8)"` `formula:"2d8" damageType:"Psychic" damageTotal:8`; change-data `dreadambushUses 3→2` (uses=WIS mod), Thug 1 HP 29→21. NOTE the trigger token `after_own_attack_hit` has ZERO consumers in src/server (manual row-invoke model only).
7. **DURATION GAP — noted**: frightened `pendingExpirations` registered but `expiryRounds:null, expireOnCreatureName:null` → "until start of next turn" unenforced (known §7 family).
8. **SUDDEN STRIKE branch — structurally inert in pipeline flow**: modal picker + `pendingSuddenStrike` writes exist (`AttackRiderModal.jsx:140-146`), but its sole consumer `buildStalkersFlurryPostDamageStep` subscribes `damage:applied`, which is never emitted while the pipeline is stranded at featureRiders; keys are cleared by next-attack housekeeping (`attackRollHousekeeping.js:84-88`).

## Grep proofs (recorded)
- `grep -rn "after_own_attack_hit" src server` → **0 hits** (trigger token unconsumed; dread ambush damage manual-row only).
- `grep -n "stalkersFlurry" src/components/char-sheet/useAttackDamageResolution.js` → comment only (:297); resume gate :298-299 refuses.
- `grep -n "resumeAttackPipeline" src/components/char-sheet/CharActionModals.jsx` → :275 (cunning-strike only) and :374 (shieldBash onClose); none for stalkersFlurry.
- Live control probe = #3 above (hit #2 damage lands without the modal).

## Suggested fix
Carry `_modalType:'stalkersFlurry'` through to the resume allow-list (mirroring FT-074 shieldBash) and call `resumeAttackPipeline()` from `handleAttackRiderClose` when the Stalker's Flurry modal resolves, so `proceedToDamage` + `stalkersFlurryPostDamage` execute; re-stamp oncePerTurn there instead of relying on the never-run sideEffects.

## Session cleanup
Admin Full Reset (change-data + log) at end; Thugs removed with combatSummary wipe. FeyRanger config unchanged (already Gloom Stalker lv17 on disk).

## OPERATIONAL INCIDENT (self-inflicted, for awareness)
Manual `element.remove()` of `.sp-overlay/.popup-overlay` DOM nodes (per old playbook flush trick) corrupts React ("NotFoundError: removeChild") and bricks subsequent row clicks until page reload. Use dismiss/Done or reload instead — never remove overlay nodes manually.
