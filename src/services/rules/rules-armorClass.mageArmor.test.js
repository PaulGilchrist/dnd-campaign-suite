import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

import { getArmorClass } from './rules-armorClass.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const EQUIPMENT = [
    { name: 'Leather', equipment_category: 'Armor', armor_category: 'Light', armor_class: { base: 11, dex_bonus: true, max_bonus: 2 } },
    { name: 'Shield', equipment_category: 'Armor', armor_category: 'Shield' },
];

function stats(equipped) {
    return {
        name: 'HexWarlock',
        rules: '2024',
        class: { name: 'Warlock' },
        abilities: [
            { name: 'Constitution', bonus: 0 },
            { name: 'Dexterity', bonus: -1 },
            { name: 'Charisma', bonus: 5 },
        ],
        inventory: { equipped: equipped || [] },
        automation: { passives: [] },
    };
}

const MAGE_ARMOR = { name: 'Mage Armor', effect: 'mage_armor', baseAc: 13, duration: '8 hours' };

describe('SP-074 cosmetic — Mage Armor threaded into computeBaseArmorClass contributions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('buff active: popup AC and contribution both show 13 + Dex (agrees with the cell)', () => {
        getRuntimeValue.mockReturnValue([MAGE_ARMOR]);

        const [ac, formula] = getArmorClass(EQUIPMENT, stats([]), {});

        expect(ac).toBe(12);
        expect(formula).toContain('Mage Armor (13)');
        expect(formula).toContain('Dexterity Bonus (-1)');
        expect(formula).not.toContain('Unarmored AC (10)');
        expect(getRuntimeValue).toHaveBeenCalledWith('HexWarlock', 'activeBuffs');
    });

    it('no buff: legacy unarmored lane byte-identical', () => {
        const [ac, formula] = getArmorClass(EQUIPMENT, stats([]), {});
        expect(ac).toBe(9);
        expect(formula).toContain('Unarmored AC (10) + Dexterity Bonus (-1)');
    });

    it('non-mage_armor buffs never override the base lane', () => {
        getRuntimeValue.mockReturnValue([{ name: 'Bless', effect: 'bless' }]);

        const [ac, formula] = getArmorClass(EQUIPMENT, stats([]), {});
        expect(ac).toBe(9);
        expect(formula).not.toContain('Mage Armor');
    });

    it('shield still stacks on the mage armor base', () => {
        getRuntimeValue.mockReturnValue([MAGE_ARMOR]);

        const [ac] = getArmorClass(EQUIPMENT, stats(['Shield']), {});
        expect(ac).toBe(14);
    });

    it('non-array runtime value is handled without crashing', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        const [ac] = getArmorClass(EQUIPMENT, stats([]), {});
        expect(ac).toBe(9);
    });
});
