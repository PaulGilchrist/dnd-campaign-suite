// MA-0530: Cultist Ritual Sickle flat "plus 1 Necrotic" rider — authored
// flat_damage_secondary: 1 must ride the MA-0426 autoDamageSecondaryFormula
// transport as the dice-less constant formula "1" (Necrotic). Dice-bearing
// secondary rows (MA-0426/0427 twins) stay byte-identical.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';
import { rollExpression, rollExpressionDoubled, parseConstant } from '../../services/dice/diceRoller.js';

const cultistRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
    .find(m => m.name === 'Cultist').actions[0];

describe('MA-0530 Cultist Ritual Sickle flat secondary', () => {
    it('data-lock: flat_damage_secondary 1 + Necrotic secondary authored on actions[0]', () => {
        expect(cultistRow.name).toBe('Ritual Sickle');
        expect(cultistRow.attack_bonus).toBe(3);
        expect(cultistRow.damage_dice_primary).toBe('1d4 + 1');
        expect(cultistRow.damage_type_primary).toBe('Slashing');
        expect(cultistRow.flat_damage_secondary).toBe(1);
        expect(cultistRow.damage_type_secondary).toBe('Necrotic');
    });

    it('transport emits constant "1" Necrotic for the flat rider', () => {
        const t = buildSecondaryDamageTransport(cultistRow, 'Ritual Sickle');
        expect(t.autoDamageSecondaryFormula).toBe('1');
        expect(t.autoDamageSecondaryDamageType).toBe('Necrotic');
        expect(t.autoDamageSecondaryName).toBe('Ritual Sickle');
    });

    it('dice-bearing secondary rows keep the dice formula byte-identical (MA-0426 twin)', () => {
        const diceRow = { name: 'Smelting Charge', damage_dice_secondary: '3d8', damage_type_secondary: 'Fire', flat_damage_secondary: 5 };
        expect(buildSecondaryDamageTransport(diceRow).autoDamageSecondaryFormula).toBe('3d8');
    });

    it('rows without any secondary keep the null triple byte-identical', () => {
        const nullRow = { name: 'Claw', damage_dice_primary: '1d6' };
        expect(buildSecondaryDamageTransport(nullRow)).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });

    it('crit lock: constants are unrollable and flat-not-doubled (CLA-281) — consumer resolves via parseConstant', () => {
        expect(rollExpression('1')).toBeNull();
        expect(rollExpressionDoubled('1')).toBeNull();
        expect(parseConstant('1')).toBe(1);
        expect(rollExpressionDoubled('1d6 plus 1').modifier).toBe(1);
    });
});
