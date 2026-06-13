import { handle, confirmCreateThrall } from './createThrallHandler.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Create Thrall',
    automation: { type: 'create_thrall', action: 'action', spell: 'Summon Aberration', usesMax: 1, recharge: 'long_rest', ...auto },
});

const makePlayerStats = (name = 'Test Warlock') => ({ name });

describe('createThrallHandler', () => {
    describe('handle', () => {
        it('should return popup when no uses remaining', async () => {
            const { getRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('should default to usesMax when no stored value', async () => {
            const { getRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('createThrall');
        });

        it('should show modal with noConcentrationOption', async () => {
            const { getRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('createThrall');
            expect(result.payload.noConcentrationOption).toBe(true);
        });
    });

    describe('confirmCreateThrall', () => {
        it('should decrement counter and return success', async () => {
            const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Free cast of Summon Aberration (0 remaining)');
            expect(result.payload.description).not.toContain('Does not require Concentration');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Warlock', '_Create_Thrall_freeCastCount', 0, 'campaign');
        });

        it('should indicate no concentration when noConcentration=true', async () => {
            const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', true);

            expect(result.payload.description).toContain('Does not require Concentration');
            expect(result.payload.description).toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBe(true);
        });

        it('should return error when no uses remaining', async () => {
            const { getRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No free casts remaining');
        });
    });
});
