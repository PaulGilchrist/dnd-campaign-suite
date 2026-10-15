// @maintained-by-ai
// handle() is a deterministic entry guard: one runtime read of
// elementalEpitomeActive → automation_info popup (falsy) or destructiveStride
// opener modal (truthy). No writes, no timers, stable contract.
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

function setupRuntimeMocks(mocks = {}) {
    runtimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
        const key = `${player}:${prop}:${camp}`;
        if (key in mocks) {
            return mocks[key];
        }
        return undefined;
    });
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
}

describe('destructiveStrideHandler — handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupRuntimeMocks();
    });

    describe('when Elemental Epitome is not active', () => {
        it('returns an automation_info popup with no runtime writes for every falsy epitomeActive state', async () => {
            const action = makeAction();
            // undefined = never stored, null = cleared, false = explicitly off.
            for (const epitomeActive of [undefined, null, false]) {
                setupRuntimeMocks({
                    'TestMonk:elementalEpitomeActive:TestCampaign': epitomeActive,
                });

                const result = await handle(action, makePlayerStats(), campaignName);

                expect(result.type).toBe('popup');
                expect(result.payload).toEqual({
                    type: 'automation_info',
                    name: 'Destructive Stride',
                    automationType: 'destructive_stride',
                    description: 'Elemental Epitome must be active to use Destructive Stride.',
                    automation: action.automation,
                });
            }
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'elementalEpitomeActive', campaignName,
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('echoes the action name and automation through the popup payload instead of hardcoding them', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': false,
            });

            const action = makeAction({
                name: 'Custom Destructive Stride',
                automation: { type: 'destructive_stride', variant: 'fire' },
            });
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Custom Destructive Stride');
            expect(result.payload.automation).toBe(action.automation);
            expect(result.payload.automationType).toBe('destructive_stride');
        });
    });

    describe('when Elemental Epitome is active', () => {
        it('opens the destructiveStride modal with the exact pass-through payload and no runtime writes', async () => {
            setupRuntimeMocks({
                'TestMonk:elementalEpitomeActive:TestCampaign': true,
            });

            const action = makeAction();
            // handle() only reads playerStats.name — full and minimal stats
            // must both open the same modal with identical structure.
            for (const playerStats of [makePlayerStats(), { name: 'TestMonk' }]) {
                const result = await handle(action, playerStats, campaignName);

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('destructiveStride');
                expect(result.payload.action).toBe(action);
                expect(result.payload.playerStats).toBe(playerStats);
                expect(result.payload.campaignName).toBe(campaignName);
            }
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(2);
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
                'TestMonk', 'elementalEpitomeActive', campaignName,
            );
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
