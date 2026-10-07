import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/dataLoader.js', () => ({
    loadEquipment: vi.fn(async () => []),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { endMageArmorOnDonning } from './mageArmorService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { loadEquipment } from '../../ui/dataLoader.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';

const EQUIPMENT = [
    { name: 'Leather', equipment_category: 'Armor', armor_category: 'Light' },
    { name: 'Scale Mail', equipment_category: 'Armor', armor_category: 'Medium' },
    { name: 'Shield', equipment_category: 'Armor', armor_category: 'Shield' },
    { name: 'Longsword', equipment_category: 'Weapon' },
];

const MAGE_ARMOR_BUFF = { name: 'Mage Armor', effect: 'mage_armor', baseAc: 13, duration: '8 hours', sourceCharacter: 'DivinationWizard' };

function char(equipped) {
    return { name: 'HexWarlock', inventory: { equipped } };
}

describe('SP-074 endMageArmorOnDonning — ends-on-donning strip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadEquipment.mockResolvedValue(EQUIPMENT);
    });

    it('strips the mage_armor buff (spread new array) and logs when armor is newly equipped', async () => {
        getRuntimeValue.mockReturnValue([MAGE_ARMOR_BUFF, { name: 'Bless', effect: 'bless' }]);

        const ended = await endMageArmorOnDonning(char([]), char(['Leather']), CAMPAIGN);

        expect(ended).toBe(true);
        const write = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
        expect(write).toBeDefined();
        expect(write[0]).toBe('HexWarlock');
        expect(write[2]).toEqual([{ name: 'Bless', effect: 'bless' }]);
        expect(write[2]).not.toContainEqual(expect.objectContaining({ effect: 'mage_armor' }));
        const log = addEntry.mock.calls.find(c => c[1]?.automationType === 'mage_armor_ends');
        expect(log).toBeDefined();
        expect(log[1].description).toContain('Mage Armor ends early');
        expect(log[1].description).toContain('Leather');
    });

    it('unequipping armor never re-grants and never writes', async () => {
        getRuntimeValue.mockReturnValue([]);

        const ended = await endMageArmorOnDonning(char(['Leather']), char([]), CAMPAIGN);

        expect(ended).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('no-op when the character has no mage_armor buff (never strips, never logs)', async () => {
        getRuntimeValue.mockReturnValue([{ name: 'Bless', effect: 'bless' }]);

        const ended = await endMageArmorOnDonning(char([]), char(['Scale Mail']), CAMPAIGN);

        expect(ended).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('non-armor additions (weapons, shields) do not end the buff', async () => {
        getRuntimeValue.mockReturnValue([MAGE_ARMOR_BUFF]);

        const ended = await endMageArmorOnDonning(char([]), char(['Longsword', 'Shield']), CAMPAIGN);

        expect(ended).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('already-equipped armor re-saved unchanged does not end the buff', async () => {
        getRuntimeValue.mockReturnValue([MAGE_ARMOR_BUFF]);

        const ended = await endMageArmorOnDonning(char(['Leather']), char(['Leather']), CAMPAIGN);

        expect(ended).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('magic-suffix armor names resolve through the catalog (CLA-225 parse, not name heuristics)', async () => {
        getRuntimeValue.mockReturnValue([MAGE_ARMOR_BUFF]);

        const ended = await endMageArmorOnDonning(char([]), char(['+1 Leather (Rare)']), CAMPAIGN);

        expect(ended).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalled();
        expect(addEntry.mock.calls.find(c => c[1]?.automationType === 'mage_armor_ends')[1].description).toContain('+1 Leather (Rare)');
    });
});
