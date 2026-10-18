// @maintained-by-ai
// MA-0530: Cultist Ritual Sickle flat "plus 1 Necrotic" rider — authored flat_damage_secondary: 1
// rides the MA-0426 autoDamageSecondaryFormula transport as the dice-less constant formula "1" (Necrotic);
// dice-bearing twins (MA-0426/0427) stay byte-identical. CLA-281 constant/crit locks owned upstream
// (diceRoller.test.js:290/:354, ma0747-composite-damage.test.jsx:54-57; seam: secondaryDamage.test.js:292) — cut here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

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

    it('transport emits constant "1" Necrotic — exact MA-0426 triple + MA-0889 null condition default', () => {
        const t = buildSecondaryDamageTransport(cultistRow, 'Ritual Sickle');
        expect(t).toEqual({ autoDamageSecondaryFormula: '1', autoDamageSecondaryName: 'Ritual Sickle', autoDamageSecondaryDamageType: 'Necrotic', secondaryCondition: null });
        // fallbackName wins over the row name for synthesized chips (MA-0427):
        expect(buildSecondaryDamageTransport(cultistRow, 'Chip').autoDamageSecondaryName).toBe('Chip');
    });

    it('dice-bearing secondary rows keep the dice formula byte-identical (MA-0426 twin) — dice beat flat', () => {
        const diceRow = { name: 'Smelting Charge', damage_dice_secondary: '3d8', damage_type_secondary: 'Fire', flat_damage_secondary: 5 };
        expect(buildSecondaryDamageTransport(diceRow)).toEqual({ autoDamageSecondaryFormula: '3d8', autoDamageSecondaryName: 'Smelting Charge', autoDamageSecondaryDamageType: 'Fire', secondaryCondition: null });
    });

    it('rows without any secondary keep the null triple byte-identical', () => {
        const nullRow = { name: 'Claw', damage_dice_primary: '1d6' };
        expect(buildSecondaryDamageTransport(nullRow)).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });

    it('empty-string dice/flat secondaries are byte-inert null triples (guard edges of :38)', () => {
        expect(buildSecondaryDamageTransport({ name: 'Claw', damage_dice_secondary: '', flat_damage_secondary: '' })).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });
});
