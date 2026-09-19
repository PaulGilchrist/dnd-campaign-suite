// MA-0427: the block-save transport must carry authored secondary damage
// (monsters.json brazen-gorgon actions[2] damage_dice_secondary "3d8" Fire)
// from the save chip through buildSaveOptions + buildAbilitySaveRollContext
// to saveProcessing. Rows without a secondary keep every secondary field null.
import { describe, it, expect } from 'vitest';
import { buildSaveOptions, buildAbilitySaveRollContext, isCompositeAttackSaveRow, saveLegCarriesSecondaryDamage } from './MonsterCardModal.jsx';

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
