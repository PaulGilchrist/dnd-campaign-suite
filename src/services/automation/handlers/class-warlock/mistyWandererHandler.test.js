// @improved-by-ai
import { handle, confirmMistyWanderer } from './mistyWandererHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
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
    ],
    ...overrides,
});

describe('mistyWandererHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        evaluateAutoExpression.mockReturnValue(3);
    });

    describe('handle', () => {
        it('should return modal with usesMax when free casts are available', async () => {
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

        it('should return modal when stored count is null (fallback to usesMax)', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.usesMax).toBe(3);
        });

        it('should return info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
        });

        it('should return info popup when stored count is negative', async () => {
            getRuntimeValue.mockReturnValue(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('should pass unused mapName parameter without error', async () => {
            getRuntimeValue.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'some-map');

            expect(result.type).toBe('modal');
        });

        it('should evaluate custom uses_expression via evaluateAutoExpression', async () => {
            evaluateAutoExpression.mockReturnValue(5);

            const customAction = makeAction({ uses_expression: 'WIS modifier' });

            const result = await handle(customAction, makePlayerStats(), 'campaign', 'map');

            expect(evaluateAutoExpression).toHaveBeenCalledWith('WIS modifier', expect.any(Object));
            expect(result.payload.usesMax).toBe(5);
        });

        it('should pass action and playerStats objects through in modal payload', async () => {
            getRuntimeValue.mockReturnValue(1);
            const stats = makePlayerStats({ name: 'Other Character' });

            const result = await handle(makeAction(), stats, 'campaign', 'map');

            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.playerStats.name).toBe('Other Character');
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
                'campaign',
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Misty Wanderer: Cast Misty Step (2 remaining).');
            expect(result.payload.triggerMistyStep).toBe(true);
        });

        it('should include ally in description when bringing ally', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, 'Ally Name');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                2,
                'campaign',
            );
            expect(result.payload.description).toBe(
                'Misty Wanderer: Cast Misty Step (2 remaining). Brought Ally Name to an unoccupied space within 5 feet of your destination.',
            );
        });

        it('should not include ally text when bringAlly is true but allyName is empty', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, '');

            expect(result.payload.description).not.toContain('Brought');
            expect(result.payload.description).toBe('Misty Wanderer: Cast Misty Step (2 remaining).');
        });

        it('should return info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should decrement to zero when one use remains', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                0,
                'campaign',
            );
            expect(result.payload.description).toBe('Misty Wanderer: Cast Misty Step (0 remaining).');
        });

        it('should use custom feature name in the storage key', async () => {
            getRuntimeValue.mockReturnValue(2);
            const customAction = {
                name: 'Custom Feature',
                description: 'Cast Misty Step without spell slot.',
                automation: {
                    type: 'misty_wanderer',
                    uses_expression: 'WIS modifier_min_1',
                    recharge: 'long_rest',
                    range: '5_ft',
                    casting_time: '1 bonus action',
                },
            };

            await confirmMistyWanderer(customAction, makePlayerStats(), 'campaign', false, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Custom_Feature_freeCastCount',
                1,
                'campaign',
            );
        });

        it('should fall back to usesMax of 1 when expression evaluation returns falsy', async () => {
            evaluateAutoExpression.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.usesMax).toBe(1);
        });
    });
});
