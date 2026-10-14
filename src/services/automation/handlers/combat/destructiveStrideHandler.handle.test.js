import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './destructiveStrideHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestMonk',
        level: 5,
        class: {
            class_levels: [
                { level: 1, martial_arts_die: 4 },
                { level: 5, martial_arts_die: 6 },
            ],
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Destructive Stride',
        automation: {
            type: 'destructive_stride',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupRuntimeMocks(mocks) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
}

describe('destructiveStrideHandler — handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when Elemental Epitome is not active', () => {
        it('returns a popup with info message when epitomeActive is false', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': false,
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Destructive Stride');
            expect(result.payload.description).toBe('Elemental Epitome must be active to use Destructive Stride.');
            expect(result.payload.automation).toEqual(action.automation);
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns a popup when epitomeActive is undefined', async () => {
            setupRuntimeMocks({});

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Elemental Epitome must be active to use Destructive Stride.');
        });

        it('returns a popup when epitomeActive is null', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': null,
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Elemental Epitome must be active to use Destructive Stride.');
        });

        it('passes through action properties in payload', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': false,
            });

            const action = makeAction({
                name: 'Custom Destructive Stride',
                automation: { type: 'destructive_stride', variant: 'fire' },
            });
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('Custom Destructive Stride');
            expect(result.payload.automation).toEqual({ type: 'destructive_stride', variant: 'fire' });
            expect(result.payload.automationType).toBe('destructive_stride');
        });
    });

    describe('when Elemental Epitome is active', () => {
        it('returns a modal for destructiveStride when epitomeActive is true', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': true,
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('destructiveStride');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBeDefined();
            expect(result.payload.campaignName).toBe(campaignName);
        });

        it('works with epitomeActive set to true even with minimal playerStats', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': true,
            });

            const minimalStats = { name: 'TestMonk' };
            const action = makeAction();
            const result = await handle(action, minimalStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('destructiveStride');
        });
    });
});
