// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmCreateThrall } from './createThrallHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

function makeAction(auto = {}) {
    return {
        name: 'Create Thrall',
        automation: { type: 'create_thrall', action: 'action', spell: 'Summon Aberration', usesMax: 1, recharge: 'long_rest', ...auto },
    };
}

function makePlayerStats(name = 'Test Warlock') {
    return { name };
}

describe('createThrallHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns popup when no uses remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('returns modal for both null/undefined stored value and positive stored value', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            let result = await handle(makeAction(), makePlayerStats(), 'campaign');
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('createThrall');

            getRuntimeValue.mockReturnValue(1);
            result = await handle(makeAction(), makePlayerStats(), 'campaign');
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('createThrall');
        });

        it('passes noConcentrationOption true in modal payload', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.payload.noConcentrationOption).toBe(true);
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('campaign');
        });
    });

    describe('confirmCreateThrall', () => {
        it('decrements counter and returns success popup', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Free cast of Summon Aberration (0 remaining)');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Warlock',
                '_Create_Thrall_freeCastCount',
                0,
                'campaign'
            );
        });

        it('does not call setRuntimeValue when no uses remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('includes concentration info when noConcentration is true', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', true);

            expect(result.payload.description).toContain('Does not require Concentration');
            expect(result.payload.description).toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBe(true);
        });

        it('omits concentration info when noConcentration is false', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.payload.description).not.toContain('Does not require Concentration');
            expect(result.payload.description).not.toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBe(false);
        });

        it('uses custom spell name from automation', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const customAction = makeAction({ spell: 'Summon Shadow' });
            const result = await confirmCreateThrall(customAction, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Free cast of Summon Shadow (0 remaining)');
        });

        it('uses default spell name when automation has no spell field', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const actionWithoutSpell = makeAction({ spell: undefined });
            const result = await confirmCreateThrall(actionWithoutSpell, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Summon Aberration');
        });

        it('uses action name in popup description', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const customAction = makeAction();
            customAction.name = 'Custom Thrall';
            const result = await confirmCreateThrall(customAction, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Custom Thrall: Free cast');
            expect(result.payload.name).toBe('Custom Thrall');
        });
    });
});
