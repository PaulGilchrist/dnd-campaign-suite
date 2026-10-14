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

describe('revelationInFleshHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
        metamagic.getCurrentSorceryPoints.mockReturnValue(5);
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    describe('handle', () => {
        describe('no options scenarios', () => {
            it('returns info popup when automation.options is empty or undefined', async () => {
                const result = await handle(makeAction(), makePlayerStats(), campaignName);

                expect(result).toEqual({
                    type: 'popup',
                    payload: expect.objectContaining({
                        type: 'automation_info',
                        name: 'Revelation in Flesh',
                        description: 'Revelation in Flesh has no options available.',
                        automation: expect.objectContaining({ type: 'revelation_in_flesh', options: [] }),
                    }),
                });
            });
        });

        describe('no sorcery points scenarios', () => {
            it('returns info popup when sorcery points are zero or negative', async () => {
                metamagic.getCurrentSorceryPoints.mockReturnValue(0);

                const result = await handle(makeActionWithOptions(), makePlayerStats(), campaignName);

                expect(result).toEqual({
                    type: 'popup',
                    payload: expect.objectContaining({
                        type: 'automation_info',
                        name: 'Revelation in Flesh',
                        automationType: 'revelation_in_flesh',
                        description: 'Revelation in Flesh: No Sorcery Points available. Cost: 1 SP per selection.',
                    }),
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
                expect(result.payload.description).toContain('Custom Revelation');
            });
        });

        describe('modal return', () => {
            it('returns modal with correct payload when options and sorcery points are available', async () => {
                const result = await handle(makeActionWithOptions(), makePlayerStats(), campaignName);

                expect(result).toEqual({
                    type: 'modal',
                    modalName: 'revelationInFlesh',
                    payload: expect.objectContaining({
                        action: expect.objectContaining({ name: 'Revelation in Flesh' }),
                        playerStats: expect.objectContaining({ name: playerName }),
                        campaignName: campaignName,
                    }),
                });
            });
        });
    });

    describe('applyRevelationOptions', () => {
        describe('validation failures', () => {
            it('returns error popup for empty selected options array', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    []
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: expect.objectContaining({
                        type: 'automation_info',
                        name: 'Revelation in Flesh',
                        description: 'No valid options selected.',
                    }),
                });
            });

            it('returns error popup when all selected options are unknown', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Unknown']
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('No valid options selected.');
            });

            it('returns error popup when insufficient sorcery points for selected count', async () => {
                metamagic.getCurrentSorceryPoints.mockReturnValue(1);

                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A', 'Option B']
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Not enough Sorcery Points');
                expect(result.payload.description).toContain('Need 2, have 1');
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
        });

        describe('successful application', () => {
            it('spends correct SP and adds buffs for multiple selections', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A', 'Option B']
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Option A, Option B');
                expect(result.payload.description).toContain('2 SP spent');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'sorceryPoints',
                    8,
                    campaignName
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Revelation in Flesh', effect: 'effect_a' }),
                        expect.objectContaining({ name: 'Revelation in Flesh', effect: 'effect_b' }),
                    ]),
                    campaignName,
                );
            });

            it('spends 1 SP for a single selection', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A']
                );

                expect(result.payload.description).toContain('1 SP spent');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'sorceryPoints',
                    9,
                    campaignName
                );
            });

            it('includes logEntries for each selected option', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A', 'Option B']
                );

                expect(result.logEntries).toEqual([
                    {
                        characterName: playerName,
                        type: 'ability_use',
                        abilityName: 'Revelation in Flesh',
                        description: expect.stringContaining('Option A'),
                    },
                    {
                        characterName: playerName,
                        type: 'ability_use',
                        abilityName: 'Revelation in Flesh',
                        description: expect.stringContaining('Option B'),
                    },
                ]);
            });

            it('includes automationType in popup payload', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A']
                );

                expect(result.payload.automationType).toBe('revelation_in_flesh');
            });

            it('uses custom duration from automation when provided', async () => {
                runtimeState.getRuntimeValue.mockReturnValue(null);
                const action = makeActionWithOptions({ duration: '1_hour' });

                await applyRevelationOptions(action, makePlayerStats(), campaignName, ['Option A']);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Revelation in Flesh', duration: '1_hour' }),
                    ]),
                    campaignName,
                );
            });

            it('defaults duration to 10_minutes when not provided in automation', async () => {
                const action = {
                    name: 'Revelation in Flesh',
                    automation: {
                        type: 'revelation_in_flesh',
                        options: [{ name: 'Option A', effect: 'effect_a' }],
                    },
                };

                await applyRevelationOptions(action, makePlayerStats(), campaignName, ['Option A']);

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ duration: '10_minutes' }),
                    ]),
                    campaignName,
                );
            });

            it('sets hasAutomation flag on each new buff', async () => {
                await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A']
                );

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ hasAutomation: true }),
                    ]),
                    campaignName,
                );
            });

            it('dispatches sorcery-points-updated event', async () => {
                const events = [];
                const originalDispatch = window.dispatchEvent;
                window.dispatchEvent = vi.fn((event) => {
                    events.push(event);
                    return true;
                });

                await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A']
                );

                expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
                expect(events[0]).toBeInstanceOf(CustomEvent);
                expect(events[0].type).toBe('sorcery-points-updated');

                window.dispatchEvent = originalDispatch;
            });
        });

        describe('buff filtering', () => {
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

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'Other Buff', effect: 'other' }),
                    ]),
                    campaignName,
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    expect.not.arrayContaining([
                        expect.objectContaining({ effect: 'old_effect' }),
                    ]),
                    campaignName,
                );
            });

            it('makes copies of existing buffs without mutating them', async () => {
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

                // The stored array should not have been mutated
                expect(existingBuffs[0].extra).toBe('data');
            });
        });

        describe('partial application', () => {
            it('filters out invalid options and only applies valid ones', async () => {
                const result = await applyRevelationOptions(
                    makeActionWithOptions(),
                    makePlayerStats(),
                    campaignName,
                    ['Option A', 'Invalid Option']
                );

                expect(result.logEntries).toHaveLength(1);
                expect(result.logEntries[0].type).toBe('ability_use');
                expect(result.logEntries[0].abilityName).toBe('Revelation in Flesh');
                expect(result.logEntries[0].description).toContain('Option A');
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

                expect(result.logEntries[0].abilityName).toBe('Custom Revelation');
                expect(result.logEntries[0].characterName).toBe(playerName);
            });
        });
    });
});
