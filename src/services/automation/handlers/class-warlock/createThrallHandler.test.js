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

        it('returns popup when uses are negative', async () => {
            getRuntimeValue.mockReturnValue(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('defaults to usesMax when no stored value exists', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('createThrall');
        });

        it('uses stored value when available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

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

        it('uses action name to build runtime key', async () => {
            getRuntimeValue.mockReturnValue(1);

            const customAction = makeAction();
            customAction.name = 'Custom Thrall';

            await handle(customAction, makePlayerStats(), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'Test Warlock',
                '_Custom_Thrall_freeCastCount',
                'my-campaign'
            );
        });

        it('falls back to stored value when usesMax is missing from automation', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const actionWithoutMax = makeAction({ usesMax: undefined });
            const result = await handle(actionWithoutMax, makePlayerStats(), 'campaign');

            expect(result.type).toBe('modal');
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

        it('uses action name in popup description', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const customAction = makeAction();
            customAction.name = 'Custom Thrall';
            const result = await confirmCreateThrall(customAction, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Custom Thrall: Free cast');
            expect(result.payload.name).toBe('Custom Thrall');
        });

        it('uses default spell name when automation has no spell field', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const actionWithoutSpell = makeAction({ spell: undefined });
            const result = await confirmCreateThrall(actionWithoutSpell, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Summon Aberration');
        });

        it('passes through automation object with noConcentration flag', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', true);

            expect(result.payload.automation.type).toBe('create_thrall');
            expect(result.payload.automation.noConcentration).toBe(true);
        });

        it('handles string count value from runtime store', async () => {
            getRuntimeValue.mockReturnValue('1');

            const result = await confirmCreateThrall(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Warlock',
                '_Create_Thrall_freeCastCount',
                0,
                'campaign'
            );
        });

        it('uses custom runtime key based on action name', async () => {
            getRuntimeValue.mockReturnValue(1);
            setRuntimeValue.mockResolvedValue(undefined);

            const customAction = makeAction();
            customAction.name = 'My Thrall';

            await confirmCreateThrall(customAction, makePlayerStats(), 'my-campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Warlock',
                '_My_Thrall_freeCastCount',
                0,
                'my-campaign'
            );
        });
    });
});
