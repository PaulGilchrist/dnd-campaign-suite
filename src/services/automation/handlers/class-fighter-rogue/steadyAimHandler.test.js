// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handle,
    clearMovementFlag,
    clearSpeedZero,
    markAsMoved,
} from './steadyAimHandler.js';

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

function makeCampaignName() {
    return 'test-campaign';
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
    return vi.fn((_, key) => state[key]);
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
                makeCampaignName()
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
                makeCampaignName()
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
                makeCampaignName()
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

        it('removes only speed_zero from activeConditions on cancel', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                steadyAimMovedThisTurn: false,
                steadyAimSpeedZero: true,
                activeConditions: ['speed_zero', 'blinded'],
                targetEffects: [],
            }));

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

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

            const result = await handle(makeAction(), stats, makeCampaignName());

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

        it('appends speed_zero to existing activeConditions', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime({
                steadyAimMovedThisTurn: false,
                steadyAimSpeedZero: false,
                activeConditions: ['blinded'],
                targetEffects: [],
            }));

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeConditions',
                ['blinded', 'speed_zero'],
                'test-campaign'
            );
        });

        it('sets targetEffects with correct structure', async () => {
            getRuntimeValue.mockImplementation(makeGetRuntime());

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls.length).toBeGreaterThan(0);
            expect(effectCalls[0][2]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'TestRogue',
                        source: 'Steady Aim',
                        effect: 'next_attack_advantage',
                        value: null,
                        duration: 'until_end_of_turn',
                    }),
                ])
            );
        });

        it.each([
            ['provided', 'until_end_of_encounter'],
            ['default', 'until_end_of_turn'],
        ])('uses %s duration: %s', async (_label, expectedDuration) => {
            getRuntimeValue.mockImplementation((key) => idleState()[key]);

            const automation = { type: 'steady_aim' };
            if (_label === 'provided') {
                automation.duration = 'until_end_of_encounter';
            }

            await handle(
                makeAction({ automation }),
                makePlayerStats(),
                makeCampaignName()
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls[0][2][0].duration).toBe(expectedDuration);
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
        it('sets steadyAimMovedThisTurn to false', async () => {
            await clearMovementFlag('TestRogue', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimMovedThisTurn',
                false,
                'test-campaign'
            );
        });
    });

    describe('clearSpeedZero', () => {
        it('sets steadyAimSpeedZero to false', async () => {
            await clearSpeedZero('TestRogue', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'steadyAimSpeedZero',
                false,
                'test-campaign'
            );
        });
    });
});
