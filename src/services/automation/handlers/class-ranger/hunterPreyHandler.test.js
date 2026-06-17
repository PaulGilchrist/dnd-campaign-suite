import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyChoice } from './hunterPreyHandler.js';

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
        it('returns modal when no choice has been made', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('hunterPrey');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns popup with info when Colossus Slayer is chosen', async () => {
            getRuntimeValue.mockReturnValue('Colossus Slayer');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Colossus Slayer');
            expect(result.payload.description).toContain('1d8 damage');
            expect(result.payload.description).toContain('Once per turn');
        });

        it('returns popup with info when Horde Breaker is chosen', async () => {
            getRuntimeValue.mockReturnValue('Horde Breaker');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Horde Breaker');
            expect(result.payload.description).toContain('another attack');
        });

        it('includes automation in popup payload', async () => {
            getRuntimeValue.mockReturnValue('Colossus Slayer');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.automation).toBeInstanceOf(Object);
        });
    });

    describe('applyChoice', () => {
        it('returns null for invalid choice', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Invalid Choice');

            expect(result).toBeNull();
        });

        it('returns popup for Colossus Slayer', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Colossus Slayer');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain('Colossus Slayer');
            expect(result.payload.description).toContain('Short or Long Rest');
        });

        it('returns popup for Horde Breaker', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Horde Breaker');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe("Hunter's Prey");
            expect(result.payload.description).toContain('Horde Breaker');
        });

        it('calls setRuntimeValue with the correct key', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Colossus Slayer');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                "_Hunter's_Prey_choice",
                'Colossus Slayer',
                'test-campaign'
            );
        });

        it('calls addEntry with ability_use type', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Horde Breaker');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerBoy',
                abilityName: "Hunter's Prey",
                description: "Hunter's Prey choice: Horde Breaker",
            });
        });

        it('stores the chosen choice value', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Colossus Slayer');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                "_Hunter's_Prey_choice",
                'Colossus Slayer',
                'test-campaign'
            );
        });
    });
});
