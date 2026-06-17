import { handle, isGloriousDefenseActive, hasGloriousDefenseActive } from './gloriousDefenseHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

describe('Glorious Defense Handler', () => {
    const mockPlayerStats = {
        name: 'Test Paladin',
        abilities: [{ name: 'Charisma', bonus: 3 }],
        attacks: [
            { name: 'Longsword', type: 'Action', range: '5_ft', hitBonus: 7, damage: '1d8+3' },
        ],
    };

    const mockAction = {
        name: 'Glorious Defense',
        automation: {
            type: 'glorious_defense',
            effect: 'ac_bonus',
            range: '10_ft',
            casting_time: '1 reaction',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(4);
    });

    it('should activate AC bonus and consume a use', async () => {
        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', undefined);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Glorious Defense');
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Paladin', 'gloriousDefenseActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Paladin', 'gloriousDefenseBonus', 3, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Paladin', 'gloriousDefenseUses', 3, 'test-campaign');
        expect(addEntry).toHaveBeenCalled();
    });

    it('should deny when no uses remaining', async () => {
        getRuntimeValue.mockReturnValue(0);

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign', undefined);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no uses remaining');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Test Paladin', 'gloriousDefenseActive', true, 'test-campaign');
    });

    it('should use minimum 1 when CHA modifier is negative', async () => {
        const lowChaStats = {
            ...mockPlayerStats,
            abilities: [{ name: 'Charisma', bonus: -2 }],
        };

        await handle(mockAction, lowChaStats, 'test-campaign', undefined);

        expect(setRuntimeValue).toHaveBeenCalledWith('Test Paladin', 'gloriousDefenseBonus', 1, 'test-campaign');
    });

    it('should handle counter_attack effect with melee attack available', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
        getRuntimeValue.mockReturnValue(4);

        const counterAction = {
            name: 'Glorious Defense',
            automation: {
                type: 'glorious_defense',
                effect: 'counter_attack',
                range: '10_ft',
                casting_time: '1 reaction',
            },
        };

        const result = await handle(counterAction, mockPlayerStats, 'test-campaign', undefined);

        expect(result.type).toBe('attack_roll');
        expect(result.payload.attack.name).toBe('Longsword');
        expect(result.payload.targetName).toBe('Orc');
        expect(result.payload.sourceName).toBe('Glorious Defense');
    });

    it('should deny counter_attack when no uses remaining', async () => {
        getRuntimeValue.mockReturnValue(0);

        const counterAction = {
            name: 'Glorious Defense',
            automation: {
                type: 'glorious_defense',
                effect: 'counter_attack',
            },
        };

        const result = await handle(counterAction, mockPlayerStats, 'test-campaign', undefined);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('no uses remaining');
    });

    it('should fall back to first attack when no melee attacks', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
        getRuntimeValue.mockReturnValue(4);

        const stats = {
            ...mockPlayerStats,
            attacks: [{ name: 'Longbow', type: 'Action', range: 150, hitBonus: 7, damage: '1d8+3' }],
        };

        const counterAction = {
            name: 'Glorious Defense',
            automation: {
                type: 'glorious_defense',
                effect: 'counter_attack',
            },
        };

        const result = await handle(counterAction, stats, 'test-campaign', undefined);

        expect(result.type).toBe('attack_roll');
        expect(result.payload.attack.name).toBe('Longbow');
    });

    it('should return popup when no attacks at all', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
        getRuntimeValue.mockReturnValue(4);

        const noAttacksStats = {
            ...mockPlayerStats,
            attacks: [],
        };

        const counterAction = {
            name: 'Glorious Defense',
            automation: {
                type: 'glorious_defense',
                effect: 'counter_attack',
            },
        };

        const result = await handle(counterAction, noAttacksStats, 'test-campaign', undefined);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No melee attack available');
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Paladin', 'gloriousDefenseUses', 4, 'test-campaign');
    });

    it('should default to ac_bonus when unknown effect', async () => {
        getRuntimeValue.mockReturnValue(4);

        const unknownAction = {
            name: 'Glorious Defense',
            automation: {
                type: 'glorious_defense',
                effect: 'some_unknown_effect',
            },
        };

        const result = await handle(unknownAction, mockPlayerStats, 'test-campaign', undefined);

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Glorious Defense');
    });

    it('should detect active glorious defense', () => {
        getRuntimeValue.mockReturnValue(true);
        expect(isGloriousDefenseActive('Test Paladin', 'test-campaign')).toBe(true);
    });

    it('should detect inactive glorious defense', () => {
        getRuntimeValue.mockReturnValue(false);
        expect(isGloriousDefenseActive('Test Paladin', 'test-campaign')).toBe(false);
    });

    it('should return false for hasGloriousDefenseActive when no passives', () => {
        const stats = { automation: { passives: [] } };
        expect(hasGloriousDefenseActive(stats)).toBe(false);
    });

    it('should return true for hasGloriousDefenseActive when passive matches', () => {
        const stats = {
            automation: {
                passives: [
                    { name: 'Glorious Defense', effect: 'glorious_defense_ac' },
                    { name: 'Other', effect: 'other' },
                ],
            },
        };
        expect(hasGloriousDefenseActive(stats)).toBe(true);
    });

    it('should return false when passive name matches but effect differs', () => {
        const stats = {
            automation: {
                passives: [{ name: 'Glorious Defense', effect: 'wrong_effect' }],
            },
        };
        expect(hasGloriousDefenseActive(stats)).toBe(false);
    });
});
