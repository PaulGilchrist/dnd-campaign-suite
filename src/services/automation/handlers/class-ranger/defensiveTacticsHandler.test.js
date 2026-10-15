// @maintained-by-ai
// Steady-state handle/applyChoice composition for defensiveTacticsHandler (2024 Ranger).
// CLA-081 regression lane (cla-081-defensive-tactics.test.js) owns the exact-key read pin,
// Map-backed round-trip, full-string description pins, and automation/index.js registry wiring —
// do not absorb those here. This lane stays: falsy→modal branch, popup composition per choice
// (toContain — CLA owns verbatim strings), invalid-choice guard, and write/log pins per choice.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyChoice } from './defensiveTacticsHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Defensive Tactics',
        automation: {
            type: 'defensive_tactics',
        },
        ...overrides,
    };
}

describe('defensiveTacticsHandler', () => {
    describe('handle', () => {
        it.each([undefined, '', null])(
            'returns modal with full payload for falsy runtime value %s',
            async (falsy) => {
                getRuntimeValue.mockReturnValue(falsy);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('defensiveTactics');
                expect(result.payload.action).toBeDefined();
                expect(result.payload.playerStats).toBeDefined();
                expect(result.payload.campaignName).toBe('test-campaign');
            }
        );

        it.each(['Escape the Horde', 'Multiattack Defense'])(
            'returns info popup for %s',
            async (choice) => {
                getRuntimeValue.mockReturnValue(choice);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Defensive Tactics');
                expect(result.payload.description).toContain(choice);
                expect(result.payload.description).toContain('Short Rest or Long Rest');
                expect(result.payload.automation).toBeDefined();
            }
        );
    });

    describe('applyChoice', () => {
        it('returns null for invalid choices', async () => {
            for (const choice of ['Invalid Choice', '', null, undefined]) {
                const result = await applyChoice(makePlayerStats(), 'test-campaign', choice);

                expect(result).toBeNull();
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            }
        });

        it.each(['Escape the Horde', 'Multiattack Defense'])(
            'stores %s and returns confirmation popup',
            async (choice) => {
                const result = await applyChoice(makePlayerStats(), 'test-campaign', choice);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Defensive Tactics');
                expect(result.payload.description).toContain(choice);
                expect(result.payload.description).toContain('Short Rest or Long Rest');
                expect(result.payload.automation).toBeUndefined();

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'RangerBoy',
                    '_Defensive_Tactics_choice',
                    choice,
                    'test-campaign',
                );

                expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                    type: 'ability_use',
                    characterName: 'RangerBoy',
                    abilityName: 'Defensive Tactics',
                    description: `Defensive Tactics choice: ${choice}`,
                });
            }
        );
    });
});
