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
            ...overrides.automation,
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
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns popup with info when Escape the Horde is chosen', async () => {
            getRuntimeValue.mockReturnValue('Escape the Horde');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Escape the Horde');
            expect(result.payload.description).toContain('Opportunity Attacks have Disadvantage');
        });

        it('returns popup with info when Multiattack Defense is chosen', async () => {
            getRuntimeValue.mockReturnValue('Multiattack Defense');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Multiattack Defense');
            expect(result.payload.description).toContain('Disadvantage on all other attack rolls');
        });

        it('includes automation in popup payload', async () => {
            getRuntimeValue.mockReturnValue('Escape the Horde');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.automation).toBeInstanceOf(Object);
        });
    });

    describe('applyChoice', () => {
        it('returns null for invalid choice', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Invalid Choice');

            expect(result).toBeNull();
        });

        it('returns popup for Escape the Horde', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Escape the Horde');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Defensive Tactics");
            expect(result.payload.description).toContain('Escape the Horde');
            expect(result.payload.description).toContain('Short or Long Rest');
        });

        it('returns popup for Multiattack Defense', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Multiattack Defense');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe("Defensive Tactics");
            expect(result.payload.description).toContain('Multiattack Defense');
        });

        it('calls setRuntimeValue with the correct key', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Escape the Horde');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                '_Defensive_Tactics_choice',
                'Escape the Horde',
                'test-campaign'
            );
        });

        it('calls addEntry with ability_use type', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Multiattack Defense');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerBoy',
                abilityName: "Defensive Tactics",
                description: 'Defensive Tactics choice: Multiattack Defense',
            });
        });

        it('stores the chosen choice value', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Escape the Horde');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                '_Defensive_Tactics_choice',
                'Escape the Horde',
                'test-campaign'
            );
        });
    });
});
