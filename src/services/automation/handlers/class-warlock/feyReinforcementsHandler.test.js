// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmFeyReinforcement } from './feyReinforcementsHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Fey Reinforcements',
        description: 'Cast Summon Fey without Material component.',
        automation: {
            type: 'fey_reinforcements',
            spell: 'Summon Fey',
            usesMax: 1,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Character',
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('feyReinforcementsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal when free casts are available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('feyReinforcements');
            expect(result.payload.action).toEqual(expect.objectContaining({ name: 'Fey Reinforcements' }));
            expect(result.payload.playerStats).toEqual(expect.objectContaining({ name: 'Test Character' }));
            expect(result.payload.campaignName).toBe('campaign');
            expect(result.payload.noConcentrationOption).toBe(true);
        });

        it('returns popup when no free casts remain', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });

    describe('confirmFeyReinforcement', () => {
        it('decrements counter and returns info popup with noConcentration=false', async () => {
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
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toContain('Free cast of Summon Fey');
            expect(result.payload.description).toContain('(0 remaining)');
            expect(result.payload.description).not.toContain('Does not require Concentration');
            expect(result.payload.description).not.toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBe(false);
        });

        it('decrements counter and includes concentration info when noConcentration=true', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Fey_Reinforcements_freeCastCount',
                0,
                'campaign'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Does not require Concentration');
            expect(result.payload.description).toContain('Duration: 1 minute');
            expect(result.payload.automation.noConcentration).toBe(true);
        });

        it('returns info popup when no free casts remain', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses correct runtime key derived from custom action name', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ name: 'Custom Fey Power' });

            await confirmFeyReinforcement(action, makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Custom_Fey_Power_freeCastCount',
                0,
                'campaign'
            );
        });
    });
});
