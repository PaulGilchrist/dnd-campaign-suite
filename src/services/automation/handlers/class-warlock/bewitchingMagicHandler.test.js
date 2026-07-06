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
    it('sets runtime state and returns popup with automation_info type', async () => {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName,
            '_Bewitching_Magic_freeCast',
            ['Misty Step'],
            campaignName
        );
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Bewitching Magic');
        expect(result.payload.description).toContain('Misty Step');
        expect(result.payload.description).toContain('without expending a spell slot');
    });

    it('uses custom player name and action name from stats', async () => {
        const playerStats = { name: 'CustomWarlock' };
        const action = makeAction();
        action.name = 'Custom Feature';

        await handle(action, playerStats, campaignName, 'map');

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
