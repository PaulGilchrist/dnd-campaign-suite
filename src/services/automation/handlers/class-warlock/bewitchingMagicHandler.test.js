// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './bewitchingMagicHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const campaignName = 'test-campaign';
const playerName = 'TestWarlock';

beforeEach(() => {
    vi.clearAllMocks();
});

function makeAction(overrides = {}) {
    return {
        name: 'Bewitching Magic',
        automation: { type: 'bewitching_magic', ...overrides },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        ...overrides,
    };
}

describe('bewitchingMagicHandler', () => {
    describe('runtime state', () => {
        it('sets freeCastKey to Misty Step for the correct player', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Bewitching_Magic_freeCast',
                ['Misty Step'],
                campaignName
            );
        });

        it('uses custom player name from stats', async () => {
            const playerStats = { name: 'CustomWarlock' };

            await handle(makeAction(), playerStats, campaignName, 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'CustomWarlock',
                '_Bewitching_Magic_freeCast',
                ['Misty Step'],
                campaignName
            );
        });

        it('passes campaign name to setRuntimeValue', async () => {
            await handle(makeAction(), makePlayerStats(), 'my-campaign', 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_Bewitching_Magic_freeCast',
                ['Misty Step'],
                'my-campaign'
            );
        });
    });

    describe('popup result', () => {
        it('returns popup with automation_info type', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('includes the action name in the popup', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.name).toBe('Bewitching Magic');
        });

        it('uses custom action name when provided', async () => {
            const action = makeAction({});
            action.name = 'Custom Feature';

            const result = await handle(action, makePlayerStats(), campaignName, 'map');

            expect(result.payload.name).toBe('Custom Feature');
        });

        it('includes Misty Step spell name in description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.description).toContain('Misty Step');
        });

        it('includes "without expending a spell slot" in description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.description).toContain('without expending a spell slot');
        });

        it('includes action type reference in description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.description).toContain('same action');
        });
    });
});
