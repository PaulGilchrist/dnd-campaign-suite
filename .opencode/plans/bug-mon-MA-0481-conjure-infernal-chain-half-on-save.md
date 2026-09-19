# bug-mon-MA-0481 — Chain Devil "Conjure Infernal Chain" pays HALF damage on save success

**Verdict:** FAIL(a) data drift — MV-20 half-default leak on success leg.
**Campaign:** test-campaign (lockdown honored). **Date:** 2026-09-18.

## Row
- Manifest MA-0481, chain-devil actions[2], save DC 15 Dexterity, 2d4 + 4 Fire, range 60 ft.
- RAW prose: "Success: The chain disappears." = ZERO damage + no condition on success.

## Disk (public/data/monsters.json, chain-devil actions[2])
- save_dc:15, save_type:"Dexterity", damage_dice_primary:"2d4 + 4", damage_type_primary:"Fire", save_effect carries canonical "Restrained" — all verbatim correct.
- **DEFECT: `dc_success` field ABSENT.** `resolveBlockSaveDcSuccess` (src/components/encounter/MonsterCardModal.jsx:149) → `action.dc_success ?? 'half'` → success pays HALF.

## Live proof (EB join, victim Bandit 1 AC12 resistances[] clean, HP-staged 999, armed via own-card target-select, round 1 const, no turn-advance)
- Chip "DC 15 Dexterity" (mc-dice-link-save-clickable) LIVE; fired first-click (no absorption).
- SUCCESS leg: Bandit roll d20 15 (+0) vs DC 15 = saveSuccess:true → save-damage rolls [2,4]=10 raw, **finalDamage 5 (half)**, hp_change 999→994. RAW demands 0. ← FAIL(a).
- FAIL leg: d20 4 (+0) fails → rolls [4,1]=5+4, finalDamage 9 = |hpΔ| exact (994→985); condition applied "Restrained" logged w/ source Chain Devil 1 + ability; activeConditions ["restrained"]; lastAttack machine-truth saveResult:"failure" saveDc:15 saveConditions:["restrained"] rawDamage 9.
- No condition entry on success leg ✓ (success-side condition gate correct).
- Save bonus prints +0 though cs saves.dex=1 — MA-0303 picker-key seam (saveBonuses['dexterity'] vs live 'dex'); boundary unharmed (15 and 4 flip identically with +1). Not row-defect.
- Expiry: activeConditionMeta.restrained durationNote "until the end of the devil's next turn… (GM-enforced)" + condition_clauses_advisory log; NO structured expiry clock/anchor te authored on row (advisory family, MA-0479 shape; §38 anchor caveats accepted).
- Move-target-30ft: advisory only, no token-move — accepted MA-0079 family residual.

## Fix
DATA: add `"dc_success": "none"` to chain-devil actions[2] (precedent MA-0218/0229; MA-0030 per-action override seam live at MonsterCardModal.jsx:146-150). Half/none branches byte-identical otherwise. Zero code change needed. Post-fix honest copy: success "no damage, chain disappears" on popup + save-damage finalDamage:0.

## Cleanup
Admin cleared change-data + log; API both empty {} / [].
