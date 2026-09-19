// MA-0427: the block-save transport must carry authored secondary damage
// (monsters.json brazen-gorgon actions[2] damage_dice_secondary "3d8" Fire)
// from the save chip through buildSaveOptions + buildAbilitySaveRollContext
// to saveProcessing. Rows without a secondary keep every secondary field null.
import { describe, it, expect } from 'vitest';
import { buildSaveOptions, buildAbilitySaveRollContext, isCompositeAttackSaveRow, saveLegCarriesSecondaryDamage, saveLegIsConditionRider } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

// MA-0551: Dao Earth Burst — composite attack+save row whose save_effect
// Failure clause carries its own dice ("Failure: 10 (3d6) Thunder damage.").
const daoRow = {
    name: 'Earth Burst',
    description: 'Ranged Attack Roll: +10, range 120 ft. <strong>Hit:</strong> 15 (2d8 + 6) Bludgeoning damage. Hit or Miss: Earth explodes from the target\'s space, creating the following effect. Dexterity Saving Throw: DC 16, each creature in a 10-foot <strong>Emanation</strong> originating from and including the target. <strong>Failure:</strong> 10 (3d6) Thunder damage.',
    attack_bonus: 10,
    range: '120 ft.',
    save_dc: 16,
    save_type: 'Dexterity',
    range_save: '10-foot Emanation originating from and including the target',
    save_effect: 'Failure: 10 (3d6) Thunder damage.',
    dc_success: 'none',
    damage_dice_primary: '2d8 + 6',
    damage_type_primary: 'Bludgeoning',
    damage_dice_secondary: '3d6',
    damage_type_secondary: 'Thunder',
};

const brazenRow = {
    name: 'Smelting Charge',
    description: 'The gorgon moves up to its Speed without provoking Opportunity Attacks...',
    save_dc: 16,
    save_type: 'Dexterity',
    recharge: '5-6',
    save_effect: 'The target is pulled into the gorgon\'s space and has the Grappled condition (escape DC 14); if the gorgon already has a creature Grappled, the target has the Prone condition instead. Until the grapple ends, the target has the Restrained condition.',
    damage_dice_primary: '2d8 + 4',
    damage_type_primary: 'Piercing',
    damage_dice_secondary: '3d8',
    damage_type_secondary: 'Fire',
};

const singleDamageRow = {
    name: 'Frightful Presence',
    description: 'Each creature must succeed on a WIS saving throw or be frightened.',
    save_dc: 15,
    save_type: 'Wisdom',
    save_effect: 'frightened until the end of its next turn',
    damage_dice_primary: null,
    damage_type_primary: null,
};

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Slashing'];

describe('MA-0427 save transport — secondary damage fields', () => {
    it('buildSaveOptions carries secondary formula/type/name when authored', () => {
        const opts = buildSaveOptions(brazenRow);
        expect(opts.autoDamageSecondaryFormula).toBe('3d8');
        expect(opts.autoDamageSecondaryDamageType).toBe('Fire');
        expect(opts.autoDamageSecondaryName).toBe('Smelting Charge');
    });

    it('buildSaveOptions keeps secondary fields null for rows without secondary', () => {
        const opts = buildSaveOptions(singleDamageRow);
        expect(opts.autoDamageSecondaryFormula).toBeNull();
        expect(opts.autoDamageSecondaryDamageType).toBeNull();
        expect(opts.autoDamageSecondaryName).toBeNull();
    });

    it('buildAbilitySaveRollContext threads secondary onto the block-save context alongside primary', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Brazen Gorgon 1',
            target: { name: 'HexWarlock', type: 'player' },
            spellName: null,
            action: brazenRow,
            saveType: 'DEX',
            dcSuccess: 'half',
            saveDamageFormula: '2d8 + 4',
            saveConditions: ['grappled', 'prone', 'restrained'],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.autoDamageFormula).toBe('2d8 + 4');
        expect(ctx.autoDamageDamageType).toBe('Piercing');
        expect(ctx.autoDamageSecondaryFormula).toBe('3d8');
        expect(ctx.autoDamageSecondaryDamageType).toBe('Fire');
        expect(ctx.autoDamageSecondaryName).toBe('Smelting Charge');
    });

    it('buildAbilitySaveRollContext keeps secondary null for single-damage save rows', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Ancient Green Dragon',
            target: { name: 'HexWarlock', type: 'player' },
            spellName: null,
            action: singleDamageRow,
            saveType: 'WIS',
            dcSuccess: 'half',
            saveDamageFormula: null,
            saveConditions: ['frightened'],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.autoDamageSecondaryFormula).toBeNull();
        expect(ctx.autoDamageSecondaryDamageType).toBeNull();
    });
});

// MA-0551: composite attack+save — attack chip context carries NO saveDc,
// the SAVE chip adjudicates the save_effect secondary dice (3d6 Thunder) with
// dc_success:'none' zero-on-success. Pure-save twins stay byte-identical.
describe('MA-0551 — Dao Earth Burst composite attack+save fork', () => {
    it('isCompositeAttackSaveRow: attack_bonus + numeric save_dc only', () => {
        expect(isCompositeAttackSaveRow(daoRow)).toBe(true);
        expect(isCompositeAttackSaveRow(brazenRow)).toBe(false); // pure save
        expect(isCompositeAttackSaveRow({ name: 'Club', attack_bonus: 4 })).toBe(false);
        expect(isCompositeAttackSaveRow({ name: 'Multiattack', attack_bonus: 5, save_dc: 0 })).toBe(false);
    });

    it('saveLegCarriesSecondaryDamage: secondary dice inside save_effect only', () => {
        expect(saveLegCarriesSecondaryDamage(daoRow)).toBe(true);
        // Banishing-claw style: secondary rides the HIT clause, save gates a
        // condition only — the secondary must keep riding the attack chip.
        expect(saveLegCarriesSecondaryDamage({
            name: 'Banishing Claw', attack_bonus: 9, save_dc: 17, save_type: 'Charisma',
            save_effect: 'Failure: The target is trapped in a demiplane.',
            damage_dice_secondary: '3d12',
        })).toBe(false);
        expect(saveLegCarriesSecondaryDamage(brazenRow)).toBe(false);
    });

    it('save chip context pays 3d6 Thunder full-on-fail, no save hijack keys dropped', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Dao 1',
            target: { name: 'Bandit 1', type: 'npc' },
            spellName: null,
            action: daoRow,
            saveType: 'DEX',
            dcSuccess: 'none',
            saveDamageFormula: '2d8 + 6',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.saveDc).toBe(16);
        expect(ctx.saveType).toBe('DEX');
        expect(ctx.dcSuccess).toBe('none');
        // save leg rides the secondary dice, NOT the fixed attack primary
        expect(ctx.autoDamageFormula).toBe('3d6');
        expect(ctx.autoDamageDamageType).toBe('Thunder');
        // promoted to primary — transport suppressed so it rolls exactly once
        expect(ctx.autoDamageSecondaryFormula).toBeNull();
        expect(ctx.autoDamageSecondaryDamageType).toBeNull();
    });

    it('buildSaveOptions keeps saveDc/saveType/dc_success for the save affordance', () => {
        const opts = buildSaveOptions(daoRow);
        expect(opts.saveDc).toBe(16);
        expect(opts.saveType).toBe('dex');
        expect(opts.dcSuccess).toBe('none');
    });
});

// MA-0560: Death Dog Bite — composite attack+save row whose save_effect gates a
// CONDITION rider only (no damage anywhere in the save leg). MA-0551 composite
// fork extension: the DC chip arms NO damage formula (the fixed 1d4+2 primary
// pays FULL on the attack chip, both save outcomes); the save adjudicates the
// Poisoned rider alone. Composites whose save leg DOES carry damage (Salamander/
// Marilith save-effect dice, Dao secondary) and pure-save rows byte-identical.
const deathDogBite = {
    name: 'Bite',
    description: 'Melee Attack Roll: +4, reach 5 ft. <strong>Hit:</strong> 4 (1d4 + 2) Piercing damage. If the target is a creature, it is subjected to the following effect. Constitution Saving Throw: DC 12. First Failure: The target has the <strong>Poisoned</strong> condition. While Poisoned, the target\'s Hit Point maximum doesn\'t return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target\'s Hit Point maximum decreases by 5 (1d10).',
    attack_bonus: 4,
    reach: '5 ft.',
    save_dc: 12,
    save_type: 'Constitution',
    save_effect: 'First Failure: The target has the Poisoned condition. While Poisoned, the target\'s Hit Point maximum doesn\'t return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target\'s Hit Point maximum decreases by 5 (1d10).',
    damage_dice_primary: '1d4 + 2',
    damage_type_primary: 'Piercing',
};

describe('MA-0560 — Death Dog Bite rider-only composite save fork', () => {
    it('composite fork covers the row: attack_bonus + numeric save_dc', () => {
        expect(isCompositeAttackSaveRow(deathDogBite)).toBe(true);
    });

    it('saveLegIsConditionRider: true for rider-only composite, false for damage-carrying twins', () => {
        expect(saveLegIsConditionRider(deathDogBite)).toBe(true);
        // MA-0551 composite whose rider carries secondary dice
        expect(saveLegIsConditionRider(daoRow)).toBe(false);
        // composites whose save_effect prose carries its own damage dice
        expect(saveLegIsConditionRider({
            name: 'Constrict', attack_bonus: 0, save_dc: 15, save_type: 'Strength',
            save_effect: 'Failure: 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the Grappled condition (escape DC 14).',
        })).toBe(false);
        expect(saveLegIsConditionRider({
            name: 'Constrict', attack_bonus: 0, save_dc: 17, save_type: 'Strength',
            save_effect: '15 (2d10 + 4) Bludgeoning damage. The target has the Grappled condition (escape DC 14).',
        })).toBe(false);
        // pure-save rows byte-identical (never forked)
        expect(saveLegIsConditionRider({ name: 'Constrict', save_dc: 12, save_type: 'Strength', save_effect: 'The target has the Grappled condition (escape DC 12).' })).toBe(false);
        expect(saveLegIsConditionRider({ name: 'Club', attack_bonus: 4 })).toBe(false);
    });

    it('save_effect prose extraction yields poisoned rider (byte-carries canonical word)', () => {
        expect(extractConditionsFromSaveEffect(deathDogBite.save_effect)).toEqual(['poisoned']);
    });

    it('save chip context arms NO damage on the rider leg (zero on save success)', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Death Dog 1',
            target: { name: 'Bandit 1', type: 'npc' },
            spellName: null,
            action: deathDogBite,
            saveType: 'CON',
            dcSuccess: 'half',
            saveDamageFormula: null, // ActionSaveRoll forks the formula to null
            saveConditions: ['poisoned'],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.autoDamageFormula).toBeNull();
        // rider save keys stay armed so the DC chip adjudicates conditions
        expect(ctx.saveDc).toBe(12);
        expect(ctx.saveType).toBe('CON');
        expect(ctx.saveConditions).toEqual(['poisoned']);
    });

    it('attack chip full-damage transport keeps primary FULL unhalved (no save keys)', () => {
        // buildSaveOptions stays byte-identical (save affordance source);
        // the attack-chip strip lives in buildAttackChipSaveOptions (MA-0551) —
        // verified via buildSaveOptions still exposing the primary untouched.
        const opts = buildSaveOptions(deathDogBite);
        expect(opts.saveDc).toBe(12);
        expect(opts.saveType).toBe('con');
        // advisory ladder residual: the (1d10) HP-max ladder never enters the
        // damage transport (MA-0483 §70 readers-only, no producer — advisory)
        expect(opts.autoDamageSecondaryFormula).toBeNull();
        expect(opts.autoDamageSecondaryName).toBeNull();
    });
});
