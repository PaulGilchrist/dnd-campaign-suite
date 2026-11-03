// @maintained-by-ai
// formatWeaponRange — melee-vs-ranged Range-cell label branch for the sheet
// Actions tab (2026-11-03 backlog: bare "5 ft." read as a firing range).
// Pins: melee-lane rows get the explicit "Reach " label, ranged bands and
// rows without range data render exactly as formatRange() did before.
// The melee discriminator is the one the range check uses:
// weaponType !== 'ranged' && rangeToFeet(range) <= MELEE_RANGE_FT.
import { describe, it, expect } from 'vitest';
import { formatWeaponRange } from './formatUtils.js';

describe('formatWeaponRange', () => {
    it.each([
        ['numeric melee lane (no weaponType)', { name: 'Longsword', range: 5 }, 'Reach 5 ft.'],
        ['explicit melee weaponType', { name: 'Glaive', range: 5, weaponType: 'melee' }, 'Reach 5 ft.'],
        ['unarmed strike row', { name: 'Unarmed Strike', range: '5 ft', weaponType: 'unarmed' }, 'Reach 5 ft.'],
        ['string melee range normalised', { name: 'Whip', range: '5 feet', weaponType: 'melee' }, 'Reach 5 ft.'],
    ])('labels melee row (%s)', (_label, attack, expected) => {
        expect(formatWeaponRange(attack)).toBe(expected);
    });

    it.each([
        ['numeric ranged with weaponType', { name: 'Shortbow', range: 80, weaponType: 'ranged' }, '80 ft.'],
        ['numeric ranged legacy row (no weaponType)', { name: 'Shortbow', range: 80 }, '80 ft.'],
        ['normal/long band (no weaponType)', { name: 'Shortbow', range: '20/60 ft.' }, '20/60 ft.'],
        ['ranged weaponType wins over melee-lane number', { name: 'Dagger', range: 5, weaponType: 'ranged' }, '5 ft.'],
    ])('leaves ranged row (%s) unchanged', (_label, attack, expected) => {
        expect(formatWeaponRange(attack)).toBe(expected);
    });

    it.each([
        ['missing range', { name: 'Unarmed Strike' }],
        ['null range', { name: 'Unarmed Strike', range: null }],
        ['empty-string range', { name: 'Unarmed Strike', range: '' }],
        ['undefined attack', undefined],
    ])('renders rows with no range data (%s) as before', (_label, attack) => {
        expect(formatWeaponRange(attack)).toBe('');
    });
});
