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

        it('does not call setRuntimeValue or addEntry when blocked by movement', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'steadyAimMovedThisTurn' ? true : undefined
            );

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('grants advantage and sets speed_zero on activation', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                return undefined;
            });

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

        it('does not set speed_zero when player has already moved', async () => {
            getRuntimeValue.mockImplementation((_, key) =>
                key === 'steadyAimMovedThisTurn' ? true : undefined
            );

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            const speedZeroCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'steadyAimSpeedZero'
            );
            expect(speedZeroCalls).toHaveLength(0);
        });

        it('cancels when already active', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return true;
                if (key === 'activeConditions') return ['speed_zero'];
                return undefined;
            });

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
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return true;
                if (key === 'activeConditions') return ['speed_zero', 'blinded'];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeConditions',
                ['blinded'],
                'test-campaign'
            );
        });

        it('skips speed_zero removal from activeConditions when Roving Aim is active', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return true;
                if (key === 'activeConditions') return ['speed_zero'];
                return undefined;
            });

            const stats = makePlayerStats({
                automation: {
                    passives: [{ name: 'Infiltration Expertise', effect: 'roving_aim' }],
                },
            });

            await handle(makeAction(), stats, makeCampaignName());

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);
        });

        it('does not apply speed_zero condition when Roving Aim is active', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            const stats = makePlayerStats({
                automation: {
                    passives: [{ name: 'Infiltration Expertise', effect: 'roving_aim' }],
                },
            });

            const result = await handle(
                makeAction(),
                stats,
                makeCampaignName()
            );

            expect(result.payload.description).toContain('Roving Aim');
            expect(result.payload.description).toContain('Speed not reduced to 0');

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);
        });

        it('still grants advantage when Roving Aim prevents speed_zero', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            const stats = makePlayerStats({
                automation: {
                    passives: [{ name: 'Infiltration Expertise', effect: 'roving_aim' }],
                },
            });

            await handle(makeAction(), stats, makeCampaignName());

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
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return ['blinded'];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                'activeConditions',
                ['blinded', 'speed_zero'],
                'test-campaign'
            );
        });

        it('does not duplicate speed_zero if already present', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return ['speed_zero'];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            const condCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(condCalls).toHaveLength(0);
        });

        it('logs the ability use with correct fields', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestRogue',
                    abilityName: 'Steady Aim',
                    description: expect.stringMatching(/Speed 0.*Advantage|Advantage.*Speed 0/),
                    timestamp: expect.any(Number),
                })
            );
        });

        it('sets targetEffects with correct structure', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                if (key === 'targetEffects') return [];
                return undefined;
            });

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

        it('appends to existing targetEffects', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                if (key === 'targetEffects') return [{ effect: 'existing_effect' }];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), makeCampaignName());

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls[0][2]).toHaveLength(2);
            expect(effectCalls[0][2][0]).toEqual({ effect: 'existing_effect' });
        });

        it('uses automation duration when provided', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                if (key === 'targetEffects') return [];
                return undefined;
            });

            await handle(
                makeAction({ automation: { duration: 'until_end_of_encounter' } }),
                makePlayerStats(),
                makeCampaignName()
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls[0][2][0].duration).toBe('until_end_of_encounter');
        });

        it('defaults to until_end_of_turn when automation has no duration', async () => {
            getRuntimeValue.mockImplementation((_, key) => {
                if (key === 'steadyAimMovedThisTurn') return false;
                if (key === 'steadyAimSpeedZero') return false;
                if (key === 'activeConditions') return [];
                if (key === 'targetEffects') return [];
                return undefined;
            });

            await handle(
                makeAction({ automation: { type: 'steady_aim' } }),
                makePlayerStats(),
                makeCampaignName()
            );

            const effectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(effectCalls[0][2][0].duration).toBe('until_end_of_turn');
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
