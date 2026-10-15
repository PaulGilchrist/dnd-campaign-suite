// @maintained-by-ai
// Contract suite for largeFormHandler (Giant ancestry "Large Form" toggle):
// exact popup strings, exact runtime-key writes (largeFormActive,
// largeFormActive_restUsed, activeBuffs), buff-entry shape, and campaign-log
// pin. Fully deterministic — runtime store and log service mocked, no timers
// (game is strictly turn-based). Update in step with handler source changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, isLargeFormActive } from './largeFormHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';
const playerName = 'Test Character';

const ACTIVATED_DESCRIPTION = 'Large Form activated! Size changes to Large, Speed increases by 10 feet, Advantage on Strength checks for 10 minutes.';
const LOG_DESCRIPTION = `${playerName} activated Large Form! Size changes to Large, Speed increases by 10 feet, Advantage on Strength checks for 10 minutes.`;

function makeAction(overrides = {}) {
    return {
        name: 'Large Form',
        automation: {
            type: 'large_form',
            duration: '10_minutes',
            casting_time: '1_bonus_action',
            resourceCost: 'long_rest',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 5,
        class: { name: 'Giant' },
        ...overrides,
    };
}

// Router over the runtime-store keys the handler reads; unlisted keys -> null.
function mockRuntime(values = {}) {
    getRuntimeValue.mockImplementation((_name, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    );
}

function buffWrites() {
    return vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'activeBuffs');
}

describe('largeFormHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('blocks activation below level 5 — exact info popup, no writes', async () => {
            const result = await handle(makeAction(), makePlayerStats({ level: 4 }), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Large Form',
                    automationType: 'large_form',
                    description: 'Large Form requires character level 5.',
                    automation: makeAction().automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('blocks activation once used until a Long Rest — exact popup, no writes', async () => {
            mockRuntime({ largeFormActive: false, largeFormActive_restUsed: true });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Large Form has been used and cannot be used again until a Long Rest.',
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('toggles off when active — ends form, clears flag, preserves other buffs', async () => {
            mockRuntime({
                largeFormActive: true,
                activeBuffs: [
                    { name: 'Large Form', effect: 'large_form' },
                    { name: 'Other Buff', effect: 'other' },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Large Form ended.');
            // Write order pinned: filtered buffs first, then the flag.
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1, playerName, 'activeBuffs', [{ name: 'Other Buff', effect: 'other' }], campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2, playerName, 'largeFormActive', false, campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        });

        it('coerces non-array stored buffs to [] when toggling off', async () => {
            mockRuntime({ largeFormActive: true, activeBuffs: 'not-an-array' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toBe('Large Form ended.');
            expect(buffWrites()).toHaveLength(1);
            expect(buffWrites()[0][2]).toEqual([]);
        });

        it('activates — full popup, ordered runtime writes, exact buff shape, and log entry', async () => {
            mockRuntime({ largeFormActive: false, activeBuffs: [{ name: 'Other Buff', effect: 'other' }] });
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Large Form',
                    automationType: 'large_form',
                    description: ACTIVATED_DESCRIPTION,
                    automation: action.automation,
                },
            });
            // Write order pinned: flag, rest-used marker, appended buff list.
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1, playerName, 'largeFormActive', true, campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2, playerName, 'largeFormActive_restUsed', true, campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                3, playerName, 'activeBuffs', [
                    { name: 'Other Buff', effect: 'other' },
                    { name: 'Large Form', effect: 'large_form', duration: '10_minutes', hasAutomation: true },
                ], campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledTimes(3);
            // AGENTS.md: every automation logs to the campaign log when triggered.
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Large Form',
                description: LOG_DESCRIPTION,
                timestamp: expect.any(Number),
            });
        });

        it('does not duplicate the buff entry when one already exists', async () => {
            const existing = [{ name: 'Large Form', effect: 'large_form' }];
            mockRuntime({ largeFormActive: false, activeBuffs: existing });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(buffWrites()).toHaveLength(1);
            expect(buffWrites()[0][2]).toHaveLength(1);
            expect(buffWrites()[0][2]).toEqual(existing);
        });

        it('coerces non-array stored buffs to a single fresh buff when activating', async () => {
            mockRuntime({ largeFormActive: false, activeBuffs: 'not-an-array' });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(buffWrites()).toHaveLength(1);
            expect(buffWrites()[0][2]).toHaveLength(1);
            expect(buffWrites()[0][2][0].name).toBe('Large Form');
        });

        it.each([
            ['1_hour', '1_hour'],
            [undefined, '10_minutes'],
        ])('stamps buff duration from automation (duration: %s)', async (duration, expected) => {
            mockRuntime({ largeFormActive: false, activeBuffs: [] });
            const action = makeAction({
                automation: duration === undefined
                    ? { type: 'large_form', casting_time: '1_bonus_action', resourceCost: 'long_rest' }
                    : { duration },
            });

            await handle(action, makePlayerStats(), campaignName, null);

            expect(buffWrites()).toHaveLength(1);
            expect(buffWrites()[0][2][0].duration).toBe(expected);
        });

        it('logs and swallows addEntry rejection — popup still returned', async () => {
            mockRuntime({ largeFormActive: false, activeBuffs: [] });
            addEntry.mockRejectedValueOnce(new Error('db error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(consoleSpy).toHaveBeenCalledWith('[largeForm] Error:', new Error('db error'));
            consoleSpy.mockRestore();
        });
    });

    describe('isLargeFormActive', () => {
        // Strict table over the exported helper's === true guard.
        // NOTE: export currently has no app consumers (only automation/index.js
        // imports handle); trim alongside the export if it is ever removed.
        it.each([
            [true, true],
            [false, false],
            [null, false],
            [undefined, false],
        ])('returns %s for stored largeFormActive %s', (stored, expected) => {
            getRuntimeValue.mockReturnValue(stored);
            expect(isLargeFormActive(playerName, campaignName)).toBe(expected);
        });

        it('reads exactly the largeFormActive runtime key', () => {
            getRuntimeValue.mockReturnValue(true);
            isLargeFormActive(playerName, campaignName);
            expect(getRuntimeValue).toHaveBeenCalledWith(playerName, 'largeFormActive', campaignName);
        });
    });
});
