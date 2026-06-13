import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, clearMovementFlag, clearSpeedZero } from './steadyAimHandler.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/useRuntimeState.js');
const { addEntry } = await import('../../ui/logService.js');

const makeAction = () => ({
    name: 'Steady Aim',
    automation: { type: 'steady_aim', duration: 'until_end_of_turn' },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestRogue',
    automation: { passives: [] },
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('steadyAimHandler', () => {
    it('should block use when player has moved this turn', async () => {
        getRuntimeValue.mockImplementation((playerName, runtimeKey) => {
            if (runtimeKey === 'steadyAimMovedThisTurn') return true;
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('must not have moved');
    });

    it('should grant advantage and set speed_zero on activation', async () => {
        getRuntimeValue.mockImplementation((playerName, runtimeKey) => {
            if (runtimeKey === 'steadyAimMovedThisTurn') return false;
            if (runtimeKey === 'steadyAimSpeedZero') return false;
            if (runtimeKey === 'activeConditions') return [];
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Advantage');
        expect(result.payload.description).toContain('Speed is 0');

        // Verify setRuntimeValue calls for movement flag and speed zero
        const calls = setRuntimeValue.mock.calls;
        const movedCalls = calls.filter(c => c[1] === 'steadyAimMovedThisTurn');
        const speedZeroCalls = calls.filter(c => c[1] === 'steadyAimSpeedZero');
        expect(movedCalls.length).toBeGreaterThan(0);
        expect(speedZeroCalls.length).toBeGreaterThan(0);

        // Verify speed_zero condition was added
        const condCalls = calls.filter(c => c[1] === 'activeConditions');
        expect(condCalls.length).toBeGreaterThan(0);
        expect(condCalls[0][2]).toContain('speed_zero');

        // Verify targetEffects was set with next_attack_advantage
        const effectCalls = calls.filter(c => c[1] === 'targetEffects');
        expect(effectCalls.length).toBeGreaterThan(0);
        expect(effectCalls[0][2]).toContainEqual(
            expect.objectContaining({ effect: 'next_attack_advantage' })
        );
    });

    it('should cancel when toggled off', async () => {
        getRuntimeValue.mockImplementation((playerName, runtimeKey) => {
            if (runtimeKey === 'steadyAimMovedThisTurn') return false;
            if (runtimeKey === 'steadyAimSpeedZero') return true;
            if (runtimeKey === 'activeConditions') return ['speed_zero'];
            return null;
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('cancelled');
    });

    it('should not apply speed_zero when Roving Aim is active', async () => {
        getRuntimeValue.mockImplementation((playerName, runtimeKey) => {
            if (runtimeKey === 'steadyAimMovedThisTurn') return false;
            if (runtimeKey === 'steadyAimSpeedZero') return false;
            if (runtimeKey === 'activeConditions') return [];
            return null;
        });

        const playerStats = makePlayerStats({
            automation: {
                passives: [
                    { name: 'Infiltration Expertise', effect: 'roving_aim' },
                ],
            },
        });

        const result = await handle(makeAction(), playerStats, 'test-campaign', null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Roving Aim');
        expect(result.payload.description).toContain('Speed not reduced to 0');

        // Verify speed_zero condition was NOT added
        const calls = setRuntimeValue.mock.calls;
        const condCalls = calls.filter(c => c[2] === 'activeConditions');
        condCalls.forEach(call => {
            expect(call[3]).not.toContain('speed_zero');
        });
    });

    it('should log the ability use', async () => {
        getRuntimeValue.mockImplementation((playerName, runtimeKey) => {
            if (runtimeKey === 'steadyAimMovedThisTurn') return false;
            if (runtimeKey === 'steadyAimSpeedZero') return false;
            if (runtimeKey === 'activeConditions') return [];
            return null;
        });

        await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

        expect(addEntry).toHaveBeenCalled();
        expect(addEntry.mock.calls[0][1].type).toBe('ability_use');
        expect(addEntry.mock.calls[0][1].abilityName).toBe('Steady Aim');
    });
});

describe('clearMovementFlag', () => {
    it('should set steadyAimMovedThisTurn to false', async () => {
        clearMovementFlag('TestRogue', 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', 'steadyAimMovedThisTurn', false, 'test-campaign');
    });
});

describe('clearSpeedZero', () => {
    it('should set steadyAimSpeedZero to false', async () => {
        clearSpeedZero('TestRogue', 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestRogue', 'steadyAimSpeedZero', false, 'test-campaign');
    });
});
