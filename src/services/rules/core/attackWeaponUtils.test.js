// @maintained-by-ai
// attackWeaponUtils BODY lane (fix#362, ledger :1253 rec #1234): byte-pins for
// the three pure helpers previously covered only transitively through the
// attackCalc builders — parseDamageDice (:34-39), pickHighestDamageWeapon
// (:67-81, strict > keeps FIRST on ties), buildFallbackUnarmedAttacks
// (:108-125, sign split + TWF twin + Blessed Warrior +2).
import { describe, it, expect } from 'vitest';
import { parseDamageDice, pickHighestDamageWeapon, buildFallbackUnarmedAttacks } from './attackWeaponUtils.js';

const EQUIPMENT = [
    { name: 'Dagger', damage: { damage_dice: '1d4' } },
    { name: 'Longsword', damage: { damage_dice: '1d8' } },
    { name: 'Greataxe', damage: { damage_dice: '1d12' } },
];

describe('parseDamageDice', () => {
    it.each([
        ['1d8', 4.5],
        ['2d6', 7],
        ['1d12', 6.5],
        ['2d6 + 3', 7],
        ['bludgeoning', 0],
        [null, 0],
    ])('%s -> %s', (input, avg) => expect(parseDamageDice(input)).toBe(avg));
});

describe('pickHighestDamageWeapon', () => {
    it('resolves magic prefixes, skips unresolvable names, picks the true highest average', () => {
        const best = pickHighestDamageWeapon(EQUIPMENT, ['+1 Dagger', 'Mithral Longsword', 'Greataxe']);
        expect(best).toMatchObject({ name: 'Greataxe', baseName: 'Greataxe' });
    });

    it('returns null when nothing resolves and keeps the FIRST entry on ties (strict >)', () => {
        expect(pickHighestDamageWeapon(EQUIPMENT, ['Mithral Blade'])).toBeNull();
        expect(pickHighestDamageWeapon(EQUIPMENT, ['Longsword', '+1 Longsword']).name).toBe('Longsword');
    });
});

describe('buildFallbackUnarmedAttacks', () => {
    it('positive STR: signed damage string, prof-inclusive hit bonus, single Action attack', () => {
        const attacks = buildFallbackUnarmedAttacks(2, 3, false, false);
        expect(attacks).toHaveLength(1);
        expect(attacks[0]).toMatchObject({
            name: 'Unarmed Strike', damage: '1d4+2', damageType: 'Bludgeoning',
            hitBonus: 5, range: 5, weaponType: 'unarmed', type: 'Action',
        });
        expect(attacks[0].hitBonusFormula).toBe('To Hit Bonus Formula = Strength Bonus (2) + Proficiency (3)');
    });

    it('negative STR sign split, Blessed Warrior +2 in the bonus, TWF pushes the Bonus-Action twin', () => {
        const attacks = buildFallbackUnarmedAttacks(-1, 2, true, true);
        expect(attacks.map(a => a.type)).toEqual(['Action', 'Bonus Action']);
        expect(attacks[0].damage).toBe('1d4-1');
        expect(attacks[0].hitBonus).toBe(3);
        expect(attacks[0].hitBonusFormula).toContain('+ Blessed Warrior (2)');
        expect(attacks[1].damage).toBe(attacks[0].damage);
    });
});
