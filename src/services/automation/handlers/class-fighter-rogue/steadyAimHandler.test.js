import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, markAsMoved, clearMovementFlag, clearSpeedZero } from './steadyAimHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makeAction(overrides = {}) {
    return {
        name: 'Steady Aim',
        automation: { type: 'steady_aim', duration: 'until_end_of_turn', ...overrides.automation },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        automation: { passives: [] },
        ...overrides,
    };
}

function idleState() {
    return {
        steadyAimMovedThisTurn: false,
        steadyAimSpeedZero: false,
        activeConditions: [],
        targetEffects: [],
    };
}

function makeGetRuntime(state = idleState()) {
    return vi.fn((_playerName, key) => state[key]);
}

describe('steadyAimHandler', () => {
    describe('handle', () => {
        it('blocks use when player has moved this turn', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'steadyAimMovedThisTurn' ? true : undefined
            );

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toContain('must not have moved');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('grants advantage and sets speed_zero on activation', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toContain('Advantage');
            expect(result.payload.description).toContain('Speed is 0');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimMovedThisTurn',
                true,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimSpeedZero',
                true,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeConditions',
                ['speed_zero'],
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestRogue',
                    abilityName: 'Steady Aim',
                })
            );
        });

        it('cancels when already active', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                steadyAimMovedThisTurn: false,
                steadyAimSpeedZero: true,
                activeConditions: ['speed_zero'],
                targetEffects: [],
            }));

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toBe('Steady Aim cancelled.');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimSpeedZero',
                false,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimMovedThisTurn',
                false,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeConditions',
                [],
                'test-campaign'
            );
        });

        it('preserves other conditions when cancelling steady_aim', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                steadyAimMovedThisTurn: false,
                steadyAimSpeedZero: true,
                activeConditions: ['speed_zero', 'blinded'],
                targetEffects: [],
            }));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeConditions',
                ['blinded'],
                'test-campaign'
            );
        });

        it('applies Roving Aim: no speed_zero condition but still grants advantage', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            const stats = makePlayerStats({
                automation: {
                    passives: [{ name: 'Infiltration Expertise', effect: 'roving_aim' }],
                },
            });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toContain('Roving Aim');
            expect(result.payload.description).toContain('Speed not reduced to 0');

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                expect.any(String),
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'next_attack_advantage' }),
                ]),
                expect.any(String)
            );
        });

        it('does not remove conditions when toggling off with Roving Aim', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                steadyAimMovedThisTurn: false,
                steadyAimSpeedZero: true,
                activeConditions: ['speed_zero', 'blinded'],
                targetEffects: [],
            }));

            const stats = makePlayerStats({
                automation: {
                    passives: [{ name: 'Infiltration Expertise', effect: 'roving_aim' }],
                },
            });

            await handle(makeAction(), stats, 'test-campaign');

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);
        });

        it.each([
            ['provided', 'until_end_of_encounter'],
            ['default', 'until_end_of_turn'],
        ])('uses %s duration: %s', async (_label, expectedDuration) => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            const automation = { type: 'steady_aim' };
            if (_label === 'provided') {
                automation.duration = 'until_end_of_encounter';
            }

            await handle(
                makeAction({ automation }),
                makePlayerStats(),
                'test-campaign'
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls[0][2][0].duration).toBe(expectedDuration);
        });

        it('uses default duration when automation.duration is null', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            await handle(
                makeAction({ automation: { type: 'steady_aim', duration: null } }),
                makePlayerStats(),
                'test-campaign'
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls[0][2][0].duration).toBe('until_end_of_turn');
        });

        it('applies Roving Aim when roving_aim exists without Infiltration Expertise name', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            const stats = makePlayerStats({
                automation: {
                    passives: [{ effect: 'roving_aim' }],
                },
            });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.payload.description).toContain('Roving Aim');
            expect(result.payload.description).toContain('Speed not reduced to 0');

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);
        });

        it('handles undefined playerStats.automation', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            const stats = {
                name: 'TestRogue',
                automation: undefined,
            };

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toContain('Speed is 0');
        });

        it('logs error when addEntry rejects', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());
            const testError = new Error('log failed');
            addEntry.mockRejectedValue(testError);

            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[steadyAim] Error:',
                testError
            );

            consoleSpy.mockRestore();
        });
    });

    describe('markAsMoved', () => {
        it('sets steadyAimMovedThisTurn to true', () => {
            markAsMoved('TestRogue', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimMovedThisTurn',
                true,
                'test-campaign'
            );
        });
    });

    describe('clearMovementFlag', () => {
        it('sets steadyAimMovedThisTurn to false', () => {
            clearMovementFlag('TestRogue', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimMovedThisTurn',
                false,
                'test-campaign'
            );
        });
    });

    describe('clearSpeedZero', () => {
        it('sets steadyAimSpeedZero to false', () => {
            clearSpeedZero('TestRogue', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimSpeedZero',
                false,
                'test-campaign'
            );
        });
    });
});
