// @cleaned-by-ai
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
        it('returns modal when no choice has been made', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('defensiveTactics');
            expect(result.payload.action).toBeDefined();
            expect(result.payload.playerStats).toBeDefined();
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it.each([
            ['Escape the Horde'],
            ['Multiattack Defense'],
        ])('returns info popup for %s', async (choice) => {
            getRuntimeValue.mockReturnValue(choice);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain(choice);
            expect(result.payload.description).toContain('Short Rest or Long Rest');
            expect(result.payload.automation).toBeDefined();
        });

        it('returns modal for falsy runtime values', async () => {
            for (const falsy of [undefined, '', null]) {
                getRuntimeValue.mockReturnValue(falsy);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('defensiveTactics');
            }
        });
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

        it.each([
            ['Escape the Horde', 'Escape the Horde'],
            ['Multiattack Defense', 'Multiattack Defense'],
        ])('stores %s and returns confirmation popup', async (choice, expectedText) => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', choice);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain(expectedText);
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
        });
    });
});
