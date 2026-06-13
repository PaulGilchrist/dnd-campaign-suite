import { handle, confirmFeyReinforcement } from './feyReinforcementsHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Fey Reinforcements',
    description: 'Cast Summon Fey without Material component.',
    automation: {
        type: 'fey_reinforcements',
        spell: 'Summon Fey',
        uses_expression: '1',
        usesMax: 1,
        recharge: 'long_rest',
        action: 'action',
        duration: 'Concentration, up to 1 hour',
        casting_time: '1 action',
        ...auto,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Character',
    ...overrides,
});

describe('feyReinforcementsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal for available free cast', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'feyReinforcements',
                payload: {
                    action: expect.objectContaining({
                        name: 'Fey Reinforcements',
                    }),
                    playerStats: expect.objectContaining({
                        name: 'Test Character',
                    }),
                    campaignName: 'campaign',
                    noConcentrationOption: true,
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
    });

    describe('confirmFeyReinforcement', () => {
        it('should decrement counter and return success with noConcentration=false', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Fey_Reinforcements_freeCastCount',
                0,
                'campaign'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Free cast of Summon Fey');
            expect(result.payload.description).toContain('(0 remaining)');
            expect(result.payload.description).not.toContain('Does not require Concentration');
        });

        it('should return success with noConcentration=true', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Fey_Reinforcements_freeCastCount',
                0,
                'campaign'
            );
            expect(result.payload.description).toContain('Does not require Concentration');
            expect(result.payload.description).toContain('Duration: 1 minute');
        });

        it('should return info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('should use 2 uses when usesMax is 2', async () => {
            getRuntimeValue.mockReturnValue(2);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Fey_Reinforcements_freeCastCount',
                1,
                'campaign'
            );
            expect(result.payload.description).toContain('(1 remaining)');
        });
    });
});
