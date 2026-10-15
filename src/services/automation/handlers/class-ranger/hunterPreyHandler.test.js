// @maintained-by-ai
// hunterPreyHandler — deterministic choice gate (modal vs info popup) over one
// runtime key. Stable contracts pinned here: exact-key read/write
// ("_Hunter's_Prey_choice" — shared with colossusSlayer step and
// CharClassFeatures.ranger readers), full-string own-composition popup pins,
// no-side-effect guard on invalid choices, log entry on applyChoice.
// Turn-based only; rest-based choice reset is UI/rest-rules owned.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyChoice } from './hunterPreyHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
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

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Hunter's Prey",
        automation: {
            type: 'hunters_prey',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('hunterPreyHandler', () => {
    describe('handle', () => {
        it('returns modal when no choice has been made (falsy values)', async () => {
            for (const falsy of [undefined, null, '']) {
                getRuntimeValue.mockReturnValue(falsy);

                const action = makeAction();
                const playerStats = makePlayerStats();
                const result = await handle(action, playerStats, 'test-campaign');

                // Exact-key pin: read path derives the same runtime key the
                // colossusSlayer attack step and CharClassFeatures readers use.
                expect(getRuntimeValue).toHaveBeenCalledWith(
                    'RangerBoy',
                    "_Hunter's_Prey_choice",
                    'test-campaign',
                );
                expect(result).toEqual({
                    type: 'modal',
                    modalName: 'hunterPrey',
                    payload: { action, playerStats, campaignName: 'test-campaign' },
                });
            }
        });

        it.each([
            [
                'Colossus Slayer',
                'Selected: <b>Colossus Slayer</b><br/><br/>Colossus Slayer active: When you hit a creature with a weapon attack, it takes an extra 1d8 damage if it is below its hit point maximum. Once per turn.',
            ],
            [
                'Horde Breaker',
                'Selected: <b>Horde Breaker</b><br/><br/>Horde Breaker active: Once per turn, when you make a weapon attack, you can make another attack with the same weapon against a different creature within 5 feet of the original target and within range.',
            ],
        ])('returns full info popup when %s already chosen', async (choice, description) => {
            getRuntimeValue.mockReturnValue(choice);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: "Hunter's Prey",
                    description,
                    automation: { type: 'hunters_prey' },
                },
            });
        });
    });

    describe('applyChoice', () => {
        it('returns null for invalid choices with no side effects', async () => {
            for (const choice of ['Invalid Choice', '', undefined]) {
                const result = await applyChoice(
                    makePlayerStats(),
                    'test-campaign',
                    choice,
                );

                expect(result).toBeNull();
                expect(setRuntimeValue).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            }
        });

        it.each([
            ['Colossus Slayer', "Hunter's Prey choice: Colossus Slayer"],
            ['Horde Breaker', "Hunter's Prey choice: Horde Breaker"],
        ])('stores %s and returns confirmation popup', async (choice, logDescription) => {
            const result = await applyChoice(
                makePlayerStats(),
                'test-campaign',
                choice,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: "Hunter's Prey",
                    description: `Selected: <b>${choice}</b>. This choice can be changed on a Short or Long Rest.`,
                },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                "_Hunter's_Prey_choice",
                choice,
                'test-campaign',
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerBoy',
                abilityName: "Hunter's Prey",
                description: logDescription,
            });
        });
    });
});
