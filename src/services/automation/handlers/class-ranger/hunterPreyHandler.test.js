// @improved-by-ai
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
        it('returns modal when no choice has been made (undefined)', async () => {
            getRuntimeValue.mockReturnValue(undefined);

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
        });

        it('returns modal when no choice has been made (null)', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('hunterPrey');
        });

        it('returns modal when no choice has been made (empty string)', async () => {
            getRuntimeValue.mockReturnValue('');

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('hunterPrey');
        });

        it('returns popup with Colossus Slayer info when already chosen', async () => {
            getRuntimeValue.mockReturnValue('Colossus Slayer');

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain('Colossus Slayer');
            expect(result.payload.description).toContain('1d8 damage');
            expect(result.payload.description).toContain('Once per turn');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('returns popup with Horde Breaker info when already chosen', async () => {
            getRuntimeValue.mockReturnValue('Horde Breaker');

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain('Horde Breaker');
            expect(result.payload.description).toContain('another attack');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });

    describe('applyChoice', () => {
        it('returns null for invalid choice', async () => {
            const result = await applyChoice(
                makePlayerStats(),
                'test-campaign',
                'Invalid Choice',
            );

            expect(result).toBeNull();
        });

        it('returns null for empty string choice', async () => {
            const result = await applyChoice(
                makePlayerStats(),
                'test-campaign',
                '',
            );

            expect(result).toBeNull();
        });

        it('stores Colossus Slayer and returns confirmation popup', async () => {
            const result = await applyChoice(
                makePlayerStats(),
                'test-campaign',
                'Colossus Slayer',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain('Colossus Slayer');
            expect(result.payload.description).toContain('Short or Long Rest');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                "_Hunter's_Prey_choice",
                'Colossus Slayer',
                'test-campaign',
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerBoy',
                abilityName: "Hunter's Prey",
                description: "Hunter's Prey choice: Colossus Slayer",
            });
        });

        it('stores Horde Breaker and returns confirmation popup', async () => {
            const result = await applyChoice(
                makePlayerStats(),
                'test-campaign',
                'Horde Breaker',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain('Horde Breaker');
            expect(result.payload.description).toContain('Short or Long Rest');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                "_Hunter's_Prey_choice",
                'Horde Breaker',
                'test-campaign',
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerBoy',
                abilityName: "Hunter's Prey",
                description: "Hunter's Prey choice: Horde Breaker",
            });
        });

        it('does not call setRuntimeValue for invalid choice', async () => {
            await applyChoice(
                makePlayerStats(),
                'test-campaign',
                'Nonexistent',
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('uses playerStats name for runtime key and log entry', async () => {
            const playerStats = makePlayerStats({ name: 'OtherRanger' });

            await applyChoice(playerStats, 'test-campaign', 'Colossus Slayer');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'OtherRanger',
                "_Hunter's_Prey_choice",
                'Colossus Slayer',
                'test-campaign',
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'OtherRanger',
                abilityName: "Hunter's Prey",
                description: "Hunter's Prey choice: Colossus Slayer",
            });
        });
    });
});
