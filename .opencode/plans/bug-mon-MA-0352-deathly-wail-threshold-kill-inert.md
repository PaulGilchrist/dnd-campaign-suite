# Bug MA-0352 — Banshee Deathly Wail (1/Day): threshold-kill inert, success deals damage, 1/Day gate absent

Row: MA-0352 | Banshee (monsterIndex banshee) | actions[3] | Deathly Wail (1/Day) | save DC 13 CON | 30-ft auditory aura, non-Construct/Undead

## Data (monsters.json actions[3], disk-verified)
save_effect: "Failure: If the target has 25 Hit Points or fewer, it drops to 0 Hit Points. Otherwise, the target takes 10 (3d6) Psychic damage. Success: The target takes no damage."
Keys present: save_dc 13, save_type Constitution, damage_dice_primary 3d6, damage_type_primary Psychic. Keys ABSENT: any hp/threshold/kill key, dc_success, uses.

## Defect 1 (CRITICAL, DIFFERENTIATOR): "HP ≤25 → drops to 0" has NO consumer
- Grep src/ (non-test): instantKill / hpThreshold / "drops to 0" / "Hit Points or fewer" / "Deathly Wail" → ZERO matches. Fail seam applies generic damage_dice_primary (3d6) via saveProcessing/handleNpcSaveDamage; no HP-threshold branch exists.
- LIVE proof (test-campaign): target LightfootHalfling GM-stamped to 20 HP (cs verified currentHitPoints 20 ≤ 25), fired Deathly Wail, SAVE FAIL nat7+4=11 vs DC 13 → damage roll 3d6 [1,3,2]=6, finalDamage 6, HP 20 → 14, isUnconscious false. Target took mere 3d6 and survived — advertised instakill clause never executes.
- Same with ElderPaladin at 221 HP (HP>25 leg works: fail 3d6 [1,4,1]=6, resist → 3, exact).

## Defect 2: "Success: no damage" violated — app applies half-damage default
- No authored dc_success on row → resolveBlockSaveDcSuccess (MonsterCardModal.jsx:146) returns 'half'; prompt literally renders "Half damage on successful save".
- LIVE: EP nat19 total 29 SUCCESS → finalDamage 1 (hpΔ -1). LH (no resist) SUCCESSes: raw [1,3,6]=10 → final 5 (hpΔ -5); raw [2,3,4]=9 → final 4 (hpΔ -4). HP drained to 0-cap territory purely on successful saves (EP 224→3, LH 20→5).
- Fix needs authored dc_success "none" key (MA-0030 Yeti precedent) or clause parse for "Success: The target takes no damage".

## Defect 3: 1/Day gate never engages
- 15 save prompts fired in one session, zero refusals; cs shows NO monsterSpellUses spend for "Banshee 1" (only lastSaveRoll/_lastRollContext). Name-suffix "(1/Day)" is not parsed into the usesGate (no authored uses key); buildMonsterSpellRefusalEntry (MonsterCardModal.jsx:897) never reached.

## Cosmetic
- Prompt boilerplate "Half damage on successful save" contradicts row prose.
- Automation log "has resistance to Psychic — X halved" also fires as mislabel for success-halving on non-resistant targets (LH).

## Verdict: FAIL — DIFFERENTIATOR clause inert (MA-0007/MV-7 bar), plus success-damage and gate gaps.
Cleanup performed: Admin Clear Change Data + Clear Campaign Log (test-campaign), verified {} / [].
