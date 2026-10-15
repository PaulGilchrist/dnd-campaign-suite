// @maintained-by-ai
// Producer-lane unit tests for dragonCompanionHandler (Summon Dragon free cast):
// uses-gate (popup vs modal), confirm decrement pinned to the exact runtime key
// (_<FeatureName>_freeCastCount, spaces → underscores), and popup copy pinned as
// full-string own-composition. Pure functions over mocked runtime state —
// deterministic, no DOM, no timers. Modal wiring is covered separately in
// DragonCompanionModal.test.jsx (which mocks this handler); automation-object
// construction is owned by automationInfoBuilder/spell.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmDragonCompanion, modalName, confirmType } from './dragonCompanionHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const campaignName = 'test-campaign';

const DEPLETED_DESCRIPTION = 'No free casts remaining. Finish a Long Rest to regain them.';
const SUCCESS_TAIL = 'normally — no spell slot or material components will be consumed.</em>';

function makeAction(overrides = {}) {
    return {
        name: 'Dragon Companion',
        automation: { type: 'dragon_companion', action: 'action', spell: 'Summon Dragon', usesMax: 1, recharge: 'long_rest', ...overrides.automation },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'SorcererBoy',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
});

describe('dragonCompanionHandler', () => {
    describe('exports', () => {
        it('exports modalName as dragonCompanion', () => {
            expect(modalName).toBe('dragonCompanion');
        });

        it('exports confirmType as dragon_companion_confirm', () => {
            expect(confirmType).toBe('dragon_companion_confirm');
        });
    });

    describe('handle', () => {
        it('returns popup when no uses remaining (count 0)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dragon Companion',
                    description: DEPLETED_DESCRIPTION,
                    automation: action.automation,
                },
            });
        });

        it('returns modal when uses are available', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('dragonCompanion');
            expect(result.payload.noConcentrationOption).toBe(true);
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.campaignName).toBe(campaignName);
        });
    });

    describe('confirmDragonCompanion', () => {
        it('decrements counter and returns success popup', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = makeAction();
            const result = await confirmDragonCompanion(action, makePlayerStats(), campaignName, false);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dragon Companion',
                    description: `Dragon Companion: Free cast of Summon Dragon (0 remaining).<br/><br/><em>Open your spell sheet and cast Summon Dragon ${SUCCESS_TAIL}`,
                    automation: { ...action.automation, noConcentration: false },
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Dragon_Companion_freeCastCount',
                0,
                campaignName
            );
        });

        it('includes no-concentration info when noConcentration=true', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const result = await confirmDragonCompanion(makeAction(), makePlayerStats(), campaignName, true);

            expect(result.payload.description).toBe(
                `Dragon Companion: Free cast of Summon Dragon (0 remaining). Does not require Concentration. Duration: 1 minute.<br/><br/><em>Open your spell sheet and cast Summon Dragon ${SUCCESS_TAIL}`
            );
            expect(result.payload.automation.noConcentration).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Dragon_Companion_freeCastCount',
                0,
                campaignName
            );
        });

        it('returns error popup and does not decrement when no uses remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const action = makeAction();
            const result = await confirmDragonCompanion(action, makePlayerStats(), campaignName, false);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dragon Companion',
                    description: DEPLETED_DESCRIPTION,
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses custom spell and action names in popup and runtime key', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(1);

            const action = makeAction({ name: 'Custom Dragon', automation: { spell: 'Call Wyrm' } });
            const result = await confirmDragonCompanion(action, makePlayerStats(), campaignName, false);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Custom Dragon',
                    description: `Custom Dragon: Free cast of Call Wyrm (0 remaining).<br/><br/><em>Open your spell sheet and cast Call Wyrm ${SUCCESS_TAIL}`,
                    automation: { ...action.automation, noConcentration: false },
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Custom_Dragon_freeCastCount',
                0,
                campaignName
            );
        });

        it('decrements from usesMax when runtime value is null', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { usesMax: 3 } });
            const result = await confirmDragonCompanion(action, makePlayerStats(), campaignName, false);

            expect(result.payload.description).toContain('Free cast of Summon Dragon (2 remaining)');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'SorcererBoy',
                '_Dragon_Companion_freeCastCount',
                2,
                campaignName
            );
        });
    });
});
