// WM-003: canonical weapon→mastery mapping through the real collectWeaponMastery
// kind gate. Nick latched this round must surface the Nick off-hand row as
// 'Action'; non-Nick Light (Vex Shortsword) stays 'Bonus Action'.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    getCurrentCombatRound: vi.fn(() => 1),
}));

// Canonical 2024 equipment.json subsets (Scimitar/Dagger = Nick, Shortsword = Vex).
const EQUIPMENT = [
    { name: 'Scimitar', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Slashing' }, range: { normal: 5 }, properties: ['Finesse', 'Light'], mastery: 'Nick' },
    { name: 'Shortsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Finesse', 'Light', 'Monk'], mastery: 'Vex' },
    { name: 'Dagger', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 }, properties: ['Finesse', 'Light', 'Thrown', 'Monk'], mastery: 'Nick' },
];

const playerStats = (overrides = {}) => ({
    name: 'EvasiveFighter',
    campaignName: 'test-campaign',
    rules: '2024',
    level: 18,
    abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 2 },
    ],
    inventory: { equipped: ['Scimitar', 'Shortsword', 'Dagger'] },
    equipment: EQUIPMENT,
    automation: { passives: [{ type: 'weapon_kind_mastery', name: 'Weapon Mastery', meleeOnly: false }], bonusActions: [] },
    ...overrides,
});

describe('attackCalc2024 WM-003 Nick — canonical mapping via real collectWeaponMastery', () => {
    let getRuntimeValue;
    let getCurrentCombatRound;

    beforeEach(async () => {
        vi.clearAllMocks();
        getRuntimeValue = (await import('../../../hooks/runtime/useRuntimeState.js')).getRuntimeValue;
        getCurrentCombatRound = (await import('../../encounters/combatData.js')).getCurrentCombatRound;
        vi.mocked(getCurrentCombatRound).mockReturnValue(1);
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Scimitar', 'Shortsword', 'Dagger'];
            return null;
        });
    });

    it('keeps Nick off-hand rows as Bonus Action before the latch (pre-apply compute)', () => {
        const attacks = getAttacks(EQUIPMENT, [], playerStats());
        const dagger = attacks.find(a => a.name === 'Dagger');
        expect(dagger.type).toBe('Bonus Action');
        const shortsword = attacks.find(a => a.name === 'Shortsword');
        expect(shortsword.type).toBe('Bonus Action');
    });

    it('promotes the Nick Light off-hand row to Action once _Nick_UsedRound latches this round', () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Scimitar', 'Shortsword', 'Dagger'];
            if (key === '_Nick_UsedRound') return 1;
            return null;
        });

        const attacks = getAttacks(EQUIPMENT, [], playerStats());
        const dagger = attacks.find(a => a.name === 'Dagger');
        expect(dagger.type).toBe('Action');
        expect(dagger.mastery).toBe('Nick');
    });

    it('keeps the non-Nick Light off-hand row (Vex Shortsword) as Bonus Action while Nick is latched', () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Scimitar', 'Shortsword', 'Dagger'];
            if (key === '_Nick_UsedRound') return 1;
            return null;
        });

        const attacks = getAttacks(EQUIPMENT, [], playerStats());
        const shortsword = attacks.find(a => a.name === 'Shortsword');
        expect(shortsword.type).toBe('Bonus Action');
        expect(shortsword.mastery).toBe('Vex');
    });

    it('keeps off-hand as Bonus Action when the kind bucket excludes the Nick weapon (WM-008 gate)', () => {
        vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
            if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Shortsword'];
            if (key === '_Nick_UsedRound') return 1;
            return null;
        });

        const attacks = getAttacks(EQUIPMENT, [], playerStats());
        const dagger = attacks.find(a => a.name === 'Dagger');
        expect(dagger.type).toBe('Bonus Action');
    });
});
