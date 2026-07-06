// @cleaned-by-ai
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

                const result = await handle(
                    makeAction(),
                    makePlayerStats(),
                    'test-campaign',
                );

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('hunterPrey');
                expect(result.payload.action).toBeDefined();
                expect(result.payload.playerStats).toBeDefined();
                expect(result.payload.campaignName).toBe('test-campaign');
            }
        });

        it.each([
            ['Colossus Slayer', ['1d8 damage', 'Once per turn']],
            ['Horde Breaker', ['another attack']],
        ])('returns popup with %s info when already chosen', async (choice, expectedTexts) => {
            getRuntimeValue.mockReturnValue(choice);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain(choice);
            for (const text of expectedTexts) {
                expect(result.payload.description).toContain(text);
            }
            expect(result.payload.automation).toBeDefined();
        });
    });

    describe('applyChoice', () => {
        it('returns null for invalid choices', async () => {
            for (const choice of ['Invalid Choice', '']) {
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
        ])('stores %s and returns confirmation popup', async (choice, description) => {
            const result = await applyChoice(
                makePlayerStats(),
                'test-campaign',
                choice,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain(choice);
            expect(result.payload.description).toContain('Short or Long Rest');

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
                description,
            });
        });
    });
});
