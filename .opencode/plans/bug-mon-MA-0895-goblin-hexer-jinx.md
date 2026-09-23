# BUG MA-0895 — Goblin Hexer 'Jinx' (goblin-hexer reactions[0]) — FAIL(a) partial

## Verdict
FAIL(a) partial — LIVE DC chip rolls an isolated WIS save vs DC 13 (machine-stamped), but the rule gate 'attack misses instead' has ZERO consumers: a FAILED save negates nothing. Trigger engagement absent on both channels.

## Row (disk truth, public/data/monsters.json goblin-hexer reactions[0])
- name+trigger+description + save_dc:13 + save_type:"Wisdom" + save_effect:"The attack misses instead" — NO automation block.

## (A) AFFORDANCE — EXISTS (§128/§130 generic save-shell family, NOT zero-chip §60)
- DOM live: `<strong>Jinx.</strong><span class="mc-dice-link mc-dice-link-save mc-dice-link-save-clickable" role="button" tabindex="0">DC 13 Wisdom</span>` + prose span. ONE chip, clickable, no counter (no uses authored — raw-unlimited cosmetic-free).
- Renders because MonsterAction.jsx:239 actionHasSave=save_dc!=null → :267 ActionSaveRoll; saveChipPlan: rollable=false (no dice), clickable=!attack_bonus=TRUE → labelled save chip arms LIVE even in reactions category.
- No gated-reaction chip: getGatedMonsterReaction keys ONLY automation.effect (MonsterCardHelpers.js:1475-1478) → null (§60/MA-0891). GATED_MONSTER_REACTIONS registry (Helpers:905+): feather_fall/counterspell/hellish_rebuke/parry — NO miss-negation effect key exists.

## (B) TRIGGER ENGAGEMENT — ABSENT (live ledger)
Rig: Bandit 1 (AC12/WIS-stamped -5) + Goblin Hexer 1 (AC13), four-key HP 999 both (full-store cs POST + reload + re-select), round:1 constant; Bandit selectOption→'Goblin Hexer 1' armed; Hexer select→'Bandit 1' armed (coincidence = triggering attacker).
- Presses: Scimitar "+3" ×5 — nat1 critmiss, nat6, nat5, nat14 (HIT pending 17 vs AC13), nat15 (HIT 18 vs AC13).
- LEG-1 pending route: over live pending HIT popup (Done visible), opened Hexer card (avatar el.click, popup survived), el.click() Jinx DC chip → save rolled WIS nat16+0=16 sr:"success" sdc:13 (log 'roll save' ch:Bandit 1) BUT chip press REPLACED the attacker pending-Done popup with the save popup (popup-overlay count 1→1 swap; MA-0681 elemental-absorption teardown twin) → pending attack ABANDONED without Done, hp unchanged 999, zero hp_change. RAW 'negate THIS pending instance' architecturally unreachable via ActionSaveRoll chip: handleSaveRoll→executeBlockSaveRoll vs getTarget() is an isolated block save (Modal:1911/1958); lastAttack never consulted, never rewritten.
- LEG-2 post-commit route (§239 hellish-rebuke timing): real-pointer Done → hp 999→992, hp_change -7 exact (nat dice 6+1). THEN pressed Jinx chip → WIS nat3 +(-5 folded §212) total -2 → machine stamp sr:"failure" sdc:13 st:"Wisdom" — save FAILED, yet hexerHp held 992 (unchanged after), hp_change count stayed 1, zero refund/miss-conversion entries. save_effect never consumes the committed attack.
- Popup chrome prints cosmetic "DC Unknown — no success or failure" both legs (§138/§218 family) — lastAttack/log decisive per §138.
- Trigger condition (attack roll HIT this goblin) never checked: chip fires anytime, targets Hexer's armed target, save result stored nowhere consumable (no saveResult-Bandit key, no change-data jinx key — EB-NPC inline seam §96).

## §66 grep (static corroboration)
`grep -rin "jinx|misses instead|reaction_save" src/ --include=*.js --include=*.jsx | grep -vi test` → ZERO jinx, ZERO 'misses instead'; reaction_save = PC-class only (reaction.js:95, automationRouter.js:220, automation/index.js:425 handleBeguilingTwist). pendingSaveRegistry.js = aura saves (23 lines), unrelated. No pending-attack miss/negate/retarget consumer app-wide (§MA-0891 retarget grep-zero twin).

## FIX TEMPLATE (design)
Ride the MA-0341 parry gated channel (its gate explicitly reads the PENDING-Done window: 'hit, damage not yet applied') — NOT the generic save-shell: author automation{type:'reaction', trigger:'attacked_by_missable_hit', effect:'jinx_negate'} + register effect in GATED_MONSTER_REACTIONS + chip arms via GatedReactionSlot (§60); resolver gates lastAttack{target:thisMonster, hit:true, damageApplied:false}, rolls attacker WIS vs 13, on failure stamps pending-miss (convert lastAttack to hit:false/zero-damage or null pending damage before Done) — needs new pending-miss consumer since parry only bumps AC, never re-adjudicates hit bool. 1/round latch + RAW unlimited sentinel usage:'At Will'+uses:999 per MA-0329/MA-0725 shape.

## Ledger
hp before Done 999 → after Done 992 (Δ-7) → after FAILED Jinx save 992 (zero refund). Whole-log jinx entries: 2 roll-save (sr success DC13 / sr failure DC13). Clean: admin-clear cd+log 200/200, quiet cd{} log0 cs null, restore header test-campaign, single tab, dev 200.

## Interactions: 8 (Scimitar×5, Jinx chip×2, Done×1) ✓
