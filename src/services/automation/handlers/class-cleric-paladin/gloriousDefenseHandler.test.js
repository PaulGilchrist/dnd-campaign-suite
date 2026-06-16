import { handle, isGloriousDefenseActive } from './gloriousDefenseHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
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

    it('should detect active glorious defense', () => {
        getRuntimeValue.mockReturnValue(true);
        expect(isGloriousDefenseActive('Test Paladin', 'test-campaign')).toBe(true);
    });

    it('should detect inactive glorious defense', () => {
        getRuntimeValue.mockReturnValue(false);
        expect(isGloriousDefenseActive('Test Paladin', 'test-campaign')).toBe(false);
    });
});
