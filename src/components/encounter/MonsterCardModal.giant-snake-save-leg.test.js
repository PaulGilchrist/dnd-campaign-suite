// MA-0816: Giant Poisonous Snake Bite — save_leg was rolling the attack
// primary dice ("1d4 + 4" Piercing) because the row lacked damage_dice_secondary,
// so saveLegCarriesSecondaryDamage was false and resolveSaveLegDamageFields
// fell through to the legacy branch. DATA fix: author damage_dice_secondary
// "3d6" + damage_type_secondary "Poison" (save_effect failure clause byte
// carries "3d6"), mirroring the Salamander Constrict / Dao Earth Burst twins.
// Attack chip stays fixed "1d4 + 4" Piercing (buildAttackChipSaveOptions drops
// the save keys + secondary transport on composite save-leg-rider rows —
// no MA-0427 double-charge).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAbilitySaveRollContext, isCompositeAttackSaveRow, saveLegCarriesSecondaryDamage } from './MonsterCardModal.jsx';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];

const snakeRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
    .find((m) => m.index === 'giant-poisonous-snake').actions[0];

describe('MA-0816 giant-poisonous-snake Bite — save-leg secondary data', () => {
    it('disk row authors damage_dice_secondary "3d6" + damage_type_secondary "Poison"', () => {
        expect(snakeRow.name).toBe('Bite');
        expect(snakeRow.damage_dice_primary).toBe('1d4 + 4');
        expect(snakeRow.damage_type_primary).toBe('Piercing');
        expect(snakeRow.damage_dice_secondary).toBe('3d6');
        expect(snakeRow.damage_type_secondary).toBe('Poison');
    });

    it('saveLegCarriesSecondaryDamage: true — "3d6" byte lives inside save_effect', () => {
        expect(isCompositeAttackSaveRow(snakeRow)).toBe(true);
        expect(snakeRow.save_effect.includes('3d6')).toBe(true);
        expect(saveLegCarriesSecondaryDamage(snakeRow)).toBe(true);
    });

    it('save chip adjudicates 3d6 Poison, NOT the attack primary "1d4 + 4"', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Giant Poisonous Snake 1',
            target: { name: 'Bandit 1', type: 'monster' },
            spellName: null,
            action: snakeRow,
            saveType: 'CON',
            dcSuccess: 'half',
            saveDamageFormula: '1d4 + 4',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.autoDamageFormula).toBe('3d6');
        expect(ctx.autoDamageDamageType).toBe('Poison');
        expect(ctx.autoDamageSecondaryFormula).toBeNull();
        expect(ctx.autoDamageSecondaryDamageType).toBeNull();
    });
});
