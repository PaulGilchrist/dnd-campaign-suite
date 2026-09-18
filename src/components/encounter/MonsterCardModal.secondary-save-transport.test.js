// MA-0427: the block-save transport must carry authored secondary damage
// (monsters.json brazen-gorgon actions[2] damage_dice_secondary "3d8" Fire)
// from the save chip through buildSaveOptions + buildAbilitySaveRollContext
// to saveProcessing. Rows without a secondary keep every secondary field null.
import { describe, it, expect } from 'vitest';
import { buildSaveOptions, buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

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
