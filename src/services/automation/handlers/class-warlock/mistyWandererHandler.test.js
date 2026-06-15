import { handle, confirmMistyWanderer } from './mistyWandererHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Misty Wanderer',
    description: 'Cast Misty Step without spell slot.',
    automation: {
        type: 'misty_wanderer',
        uses_expression: 'WIS modifier_min_1',
        recharge: 'long_rest',
        range: '5_ft',
        casting_time: '1 bonus action',
        ...auto,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Character',
    abilities: [
        { name: 'Strength', bonus: 0 },
        { name: 'Dexterity', bonus: 0 },
        { name: 'Constitution', bonus: 0 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 3 },
        { name: 'Charisma', bonus: 0 },
        ...overrides.abilities ? [] : [],
    ],
    ...overrides,
});

describe('mistyWandererHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal for available free cast', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'mistyWanderer',
                payload: {
                    action: expect.objectContaining({
                        name: 'Misty Wanderer',
                    }),
                    playerStats: expect.objectContaining({
                        name: 'Test Character',
                    }),
                    campaignName: 'campaign',
                    usesMax: 3,
                },
            });
        });

        it('should return info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('should default to usesMax when no stored value', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
        });

        it('should evaluate WIS modifier expression', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.usesMax).toBe(3);
        });
    });

    describe('confirmMistyWanderer', () => {
        it('should decrement counter and return success without ally', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                2,
                'campaign'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Cast Misty Step (2 remaining)');
            expect(result.payload.description).not.toContain('Brought');
        });

        it('should include ally in description when bringing ally', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, 'Ally Name');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                2,
                'campaign'
            );
            expect(result.payload.description).toContain('Brought Ally Name');
            expect(result.payload.description).toContain('within 5 feet');
        });

        it('should return info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('should handle minimum 1 use', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                0,
                'campaign'
            );
            expect(result.payload.description).toContain('(0 remaining)');
        });
    });
});
