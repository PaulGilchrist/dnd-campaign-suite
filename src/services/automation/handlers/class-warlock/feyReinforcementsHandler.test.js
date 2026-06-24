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

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('feyReinforcements');
            expect(result.payload.action).toEqual(expect.objectContaining({ name: 'Fey Reinforcements' }));
            expect(result.payload.playerStats).toEqual(expect.objectContaining({ name: 'Test Character' }));
            expect(result.payload.campaignName).toBe('campaign');
            expect(result.payload.noConcentrationOption).toBe(true);
        });

        it('returns modal when free casts > 1', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('feyReinforcements');
        });

        it('returns modal when runtime value is null (defaults to usesMax)', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { usesMax: 1 } });

            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('feyReinforcements');
        });

        it('returns popup when no free casts remain', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fey Reinforcements');
            expect(result.payload.description).toContain('No free casts remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns popup when free casts are negative', async () => {
            getRuntimeValue.mockReturnValue(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('uses custom action name in runtime key and popup', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({ name: 'Custom Fey Feature' });

            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Custom Fey Feature');
            expect(result.payload.description).toContain('No free casts remaining');
        });

        it('uses custom spell name in popup when confirmed', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { spell: 'Call Fey' } });

            const result = await confirmFeyReinforcement(action, makePlayerStats(), 'campaign', false);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Free cast of Call Fey');
        });

        it('passes custom usesMax through to automation in popup', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({ automation: { usesMax: 2, spell: 'Summon Fey' } });

            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.automation.usesMax).toBe(2);
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

        it('uses 2 usesMax and decrements from 2', async () => {
            getRuntimeValue.mockReturnValue(2);

            const result = await confirmFeyReinforcement(makeAction({ automation: { usesMax: 2 } }), makePlayerStats(), 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Fey_Reinforcements_freeCastCount',
                1,
                'campaign'
            );
            expect(result.payload.description).toContain('(1 remaining)');
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

        it('passes automation with noConcentration flag through to popup', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', true);

            expect(result.payload.automation.noConcentration).toBe(true);
        });

        it('passes automation with noConcentration=false when false', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.payload.automation.noConcentration).toBe(false);
        });

        it('uses default spell name when automation.spell is missing', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({ automation: { spell: undefined } });

            const result = await confirmFeyReinforcement(action, makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Free cast of Summon Fey');
        });

        it('uses correct campaign name in setRuntimeValue', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'my-campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Fey_Reinforcements_freeCastCount',
                0,
                'my-campaign'
            );
        });

        it('uses correct player name from stats in setRuntimeValue', async () => {
            getRuntimeValue.mockReturnValue(1);
            const stats = makePlayerStats({ name: 'Elven Warlock' });

            await confirmFeyReinforcement(makeAction(), stats, 'campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Elven Warlock',
                '_Fey_Reinforcements_freeCastCount',
                0,
                'campaign'
            );
        });

        it('includes hint text about opening spell sheet in popup description', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmFeyReinforcement(makeAction(), makePlayerStats(), 'campaign', false);

            expect(result.payload.description).toContain('Open your spell sheet');
            expect(result.payload.description).toContain('no spell slot will be consumed');
        });
    });
});
