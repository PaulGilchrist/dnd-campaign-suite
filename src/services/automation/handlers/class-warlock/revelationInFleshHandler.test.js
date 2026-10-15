// @maintained-by-ai
// Deterministic contract tests for the Revelation in Flesh warlock automation handler.
// Pure branch/payload contracts over mocked runtime/metamagic seams, full-string
// composition pins owned by this handler, turn-based only (no timers), one CustomEvent
// assertion on window. Update only if the handler's output contract changes.
import { handle, applyRevelationOptions } from './revelationInFleshHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as classFeatures from '../../../../services/character/classFeatures.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    getCurrentSorceryPoints: vi.fn(),
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

const campaignName = 'test-campaign';
const playerName = 'TestWarlock';

function makeAction(overrides = {}) {
    return {
        name: 'Revelation in Flesh',
        automation: { type: 'revelation_in_flesh', options: [], ...overrides.automation },
        ...overrides,
    };
}

function makeActionWithOptions(overrides = {}) {
    return {
        name: 'Revelation in Flesh',
        automation: {
            type: 'revelation_in_flesh',
            options: [
                { name: 'Option A', effect: 'effect_a', description: 'Description A' },
                { name: 'Option B', effect: 'effect_b' },
            ],
            ...overrides,
        },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        ...overrides,
    };
}

function setRuntimeCalls(key) {
    return runtimeState.setRuntimeValue.mock.calls.filter(([, k]) => k === key);
}

describe('revelationInFleshHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
        metamagic.getCurrentSorceryPoints.mockReturnValue(5);
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        it('returns info popup when automation.options is empty or undefined', async () => {
            const emptyResult = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(emptyResult).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    description: 'Revelation in Flesh has no options available.',
                    automation: { type: 'revelation_in_flesh', options: [] },
                },
            });

            const undefinedResult = await handle(
                { name: 'Revelation in Flesh', automation: { type: 'revelation_in_flesh' } },
                makePlayerStats(),
                campaignName
            );

            expect(undefinedResult).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    description: 'Revelation in Flesh has no options available.',
                    automation: { type: 'revelation_in_flesh' },
                },
            });
        });

        it('returns info popup when sorcery points are exhausted', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(0);

            const result = await handle(makeActionWithOptions(), makePlayerStats(), campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    automationType: 'revelation_in_flesh',
                    description: 'Revelation in Flesh: No Sorcery Points available. Cost: 1 SP per selection.',
                    automation: makeActionWithOptions().automation,
                },
            });
        });

        it('uses custom action name in no-SP popup', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(0);
            const action = {
                name: 'Custom Revelation',
                automation: {
                    type: 'revelation_in_flesh',
                    options: [
                        { name: 'Option A', effect: 'effect_a' },
                    ],
                },
            };

            const result = await handle(action, makePlayerStats(), campaignName);

            expect(result.payload.name).toBe('Custom Revelation');
            expect(result.payload.description).toBe('Custom Revelation: No Sorcery Points available. Cost: 1 SP per selection.');
        });

        it('returns modal with exact payload when options and sorcery points are available', async () => {
            const action = makeActionWithOptions();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName);

            expect(metamagic.getCurrentSorceryPoints).toHaveBeenCalledWith(playerName, 10);
            expect(result).toEqual({
                type: 'modal',
                modalName: 'revelationInFlesh',
                payload: { action, playerStats, campaignName },
            });
        });
    });

    describe('applyRevelationOptions', () => {
        it('returns error popup when no valid options are selected (empty or all unknown)', async () => {
            for (const selection of [[], ['Unknown']]) {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    selection
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Revelation in Flesh',
                        description: 'No valid options selected.',
                        automation: makeActionWithOptions().automation,
                    },
                });
            }
        });

        it('returns error popup and writes nothing when sorcery points are insufficient', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(1);

            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                campaignName,
                ['Option A', 'Option B']
            );

            expect(result.payload.description).toBe('Revelation in Flesh: Not enough Sorcery Points. Need 2, have 1.');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('succeeds when sorcery points exactly match count needed', async () => {
            metamagic.getCurrentSorceryPoints.mockReturnValue(2);

            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                campaignName,
                ['Option A', 'Option B']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('2 SP spent');
            expect(result.logEntries).toHaveLength(2);
        });

        it('spends SP and writes buffs for multiple selections with exact popup and runtime contract', async () => {
            const action = makeActionWithOptions();

            const result = await applyRevelationOptions(action, makePlayerStats(), campaignName, ['Option A', 'Option B']);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Revelation in Flesh',
                    automationType: 'revelation_in_flesh',
                    description: 'Revelation in Flesh: Option A, Option B chosen. (2 SP spent, duration: 10 minutes)',
                    automation: action.automation,
                },
                logEntries: [
                    {
                        characterName: playerName,
                        type: 'ability_use',
                        abilityName: 'Revelation in Flesh',
                        description: 'Option A chosen. (1 SP spent, duration: 10 minutes)',
                    },
                    {
                        characterName: playerName,
                        type: 'ability_use',
                        abilityName: 'Revelation in Flesh',
                        description: 'Option B chosen. (1 SP spent, duration: 10 minutes)',
                    },
                ],
            });
            // Pins the full write sequence: SP pool (max 10 − 2), then buffs with
            // default duration and hasAutomation flag.
            expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
                [playerName, 'sorceryPoints', 8, campaignName],
                [playerName, 'activeBuffs', [
                    { name: 'Revelation in Flesh', effect: 'effect_a', duration: '10_minutes', hasAutomation: true },
                    { name: 'Revelation in Flesh', effect: 'effect_b', duration: '10_minutes', hasAutomation: true },
                ], campaignName],
            ]);
        });

        it('uses custom duration from automation in buffs, logs and popup', async () => {
            const action = makeActionWithOptions({ duration: '1_hour' });

            const result = await applyRevelationOptions(action, makePlayerStats(), campaignName, ['Option A']);

            expect(setRuntimeCalls('activeBuffs')[0][2]).toEqual([
                { name: 'Revelation in Flesh', effect: 'effect_a', duration: '1_hour', hasAutomation: true },
            ]);
            expect(result.logEntries[0].description).toBe('Option A chosen. (1 SP spent, duration: 1 hour)');
            expect(result.payload.description).toBe('Revelation in Flesh: Option A chosen. (1 SP spent, duration: 1 hour)');
        });

        it('dispatches sorcery-points-updated event once', async () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

            await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                campaignName,
                ['Option A']
            );

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            expect(dispatchSpy.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
            expect(dispatchSpy.mock.calls[0][0].type).toBe('sorcery-points-updated');

            dispatchSpy.mockRestore();
        });

        it('filters out existing buffs with the same action name before adding new ones', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') {
                    return [
                        { name: 'Revelation in Flesh', effect: 'old_effect' },
                        { name: 'Other Buff', effect: 'other' },
                    ];
                }
                return null;
            });

            await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                campaignName,
                ['Option A']
            );

            expect(setRuntimeCalls('activeBuffs')[0][2]).toEqual([
                { name: 'Other Buff', effect: 'other' },
                { name: 'Revelation in Flesh', effect: 'effect_a', duration: '10_minutes', hasAutomation: true },
            ]);
        });

        it('copies existing buffs without mutating them', async () => {
            const existingBuffs = [
                { name: 'Other Buff', effect: 'other', extra: 'data' },
            ];
            runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return existingBuffs;
                return null;
            });

            await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                campaignName,
                ['Option A']
            );

            // Stored array is a copy: equal content, different reference, input untouched.
            const written = setRuntimeCalls('activeBuffs')[0][2];
            expect(written[0]).toEqual({ name: 'Other Buff', effect: 'other', extra: 'data' });
            expect(written[0]).not.toBe(existingBuffs[0]);
            expect(existingBuffs).toHaveLength(1);
        });

        it('filters out invalid options and only applies valid ones', async () => {
            const result = await applyRevelationOptions(
                makeActionWithOptions(),
                makePlayerStats(),
                campaignName,
                ['Option A', 'Invalid Option']
            );

            expect(result.logEntries).toEqual([
                {
                    characterName: playerName,
                    type: 'ability_use',
                    abilityName: 'Revelation in Flesh',
                    description: 'Option A chosen. (1 SP spent, duration: 10 minutes)',
                },
            ]);
            expect(result.payload.description).toBe('Revelation in Flesh: Option A chosen. (1 SP spent, duration: 10 minutes)');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'sorceryPoints',
                9,
                campaignName
            );
        });

        it('uses custom action name in log entries', async () => {
            const action = {
                name: 'Custom Revelation',
                automation: {
                    type: 'revelation_in_flesh',
                    options: [{ name: 'Option A', effect: 'effect_a' }],
                },
            };

            const result = await applyRevelationOptions(
                action,
                makePlayerStats(),
                campaignName,
                ['Option A']
            );

            expect(result.logEntries).toEqual([
                {
                    characterName: playerName,
                    type: 'ability_use',
                    abilityName: 'Custom Revelation',
                    description: 'Option A chosen. (1 SP spent, duration: 10 minutes)',
                },
            ]);
        });
    });
});
