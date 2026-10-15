// @maintained-by-ai
// Steady Aim (bonus action): blocked after moving (legacy stamp or authoritative
// engine turnState when enforcement+movementBudget are on), toggles a speed_zero
// latch, and grants next_attack_advantage via targetEffects. Roving Aim
// (Infiltration Expertise) skips the speed reduction. Deterministic over mocked
// runtime/log boundaries — pin stable contract, update only if the rules change.
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

const BLOCKED_DESCRIPTION = 'Steady Aim — You must not have moved this turn to use this feature.';
const ACTIVATED_DESCRIPTION = 'Steady Aim activated! You have Advantage on your next attack roll. Your Speed is 0 until the end of the current turn.';
const ROVING_ACTIVATED_DESCRIPTION = 'Steady Aim activated! You have Advantage on your next attack roll. (Roving Aim: Speed not reduced to 0)';

describe('steadyAimHandler', () => {
    describe('handle', () => {
        it('blocks use when player has moved this turn', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                ...idleState(),
                steadyAimMovedThisTurn: true,
            }));

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toBe(BLOCKED_DESCRIPTION);
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        // Authoritative engine-movement path (plan §7.3): with enforcement mode
        // ON + movementBudget, turnState.hasMoved overrides the legacy stamp.
        it.each([
            ['blocks when engine turnState reports moved, legacy stamp false',
                { enforcement: { mode: 'on', movementBudget: true }, turnState: { TestRogue: { hasMoved: true } } },
                true],
            ['allows when enforcement is on and engine reports not moved',
                { enforcement: { mode: 'on', movementBudget: true }, turnState: { TestRogue: { hasMoved: false } } },
                false],
            ['falls back to legacy stamp when enforcement is off',
                { enforcement: { mode: 'off' }, turnState: { TestRogue: { hasMoved: true } } },
                false],
            ['falls back to legacy stamp when enforcement has no movementBudget',
                { enforcement: { mode: 'on' }, turnState: { TestRogue: { hasMoved: true } } },
                false],
        ])('%s', async (_label, engineState, expectBlocked) => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                ...idleState(),
                ...engineState,
            }));

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign'
            );

            if (expectBlocked) {
                expect(result.payload.description).toBe(BLOCKED_DESCRIPTION);
                expect(setRuntimeValue).not.toHaveBeenCalled();
            } else {
                expect(result.payload.description).toBe(ACTIVATED_DESCRIPTION);
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestRogue',
                    'steadyAimMovedThisTurn',
                    true,
                    'test-campaign'
                );
            }
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
            expect(result.payload.description).toBe(ACTIVATED_DESCRIPTION);

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
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{
                    target: 'TestRogue',
                    source: 'Steady Aim',
                    effect: 'next_attack_advantage',
                    value: null,
                    duration: 'until_end_of_turn',
                }],
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestRogue',
                    abilityName: 'Steady Aim',
                    description: 'TestRogue used Steady Aim — Speed 0 until end of turn, Advantage on next attack roll.',
                })
            );
        });

        it('does not duplicate speed_zero when it is already an active condition', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                ...idleState(),
                activeConditions: ['speed_zero'],
            }));

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimSpeedZero',
                true,
                'test-campaign'
            );
        });

        it('cancels when already active, preserving other conditions', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                ...idleState(),
                steadyAimSpeedZero: true,
                activeConditions: ['speed_zero', 'blinded'],
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
                ['blinded'],
                'test-campaign'
            );
        });

        it('does not remove conditions when toggling off with Roving Aim', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                ...idleState(),
                steadyAimSpeedZero: true,
                activeConditions: ['speed_zero', 'blinded'],
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
            ['Infiltration Expertise passive', { name: 'Infiltration Expertise', effect: 'roving_aim' }],
            ['roving_aim passive without the name', { effect: 'roving_aim' }],
        ])('applies Roving Aim via %s: advantage without speed reduction', async (_label, passive) => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            const stats = makePlayerStats({ automation: { passives: [passive] } });

            const result = await handle(makeAction(), stats, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steady Aim');
            expect(result.payload.description).toBe(ROVING_ACTIVATED_DESCRIPTION);

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [expect.objectContaining({
                    target: 'TestRogue',
                    source: 'Steady Aim',
                    effect: 'next_attack_advantage',
                })],
                'test-campaign'
            );
        });

        it.each([
            ['provided', 'until_end_of_encounter', 'until_end_of_encounter'],
            ['missing', undefined, 'until_end_of_turn'],
            ['null', null, 'until_end_of_turn'],
        ])('applies %s duration as %s', async (_label, duration, expectedDuration) => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            await handle(
                makeAction({ automation: { type: 'steady_aim', duration } }),
                makePlayerStats(),
                'test-campaign'
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls).toHaveLength(1);
            expect(effectCalls[0][2][0].duration).toBe(expectedDuration);
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
            expect(result.payload.description).toBe(ACTIVATED_DESCRIPTION);
        });

        it('logs error when addEntry rejects', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());
            const testError = new Error('log failed');
            addEntry.mockRejectedValueOnce(testError);

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

    it.each([
        ['markAsMoved', markAsMoved, 'steadyAimMovedThisTurn', true],
        ['clearMovementFlag', clearMovementFlag, 'steadyAimMovedThisTurn', false],
        ['clearSpeedZero', clearSpeedZero, 'steadyAimSpeedZero', false],
    ])('%s writes %s = %s', (_label, fn, key, value) => {
        fn('TestRogue', 'test-campaign');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue',
            key,
            value,
            'test-campaign'
        );
    });
});
