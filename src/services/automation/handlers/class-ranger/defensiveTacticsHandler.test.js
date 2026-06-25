// @improved-by-ai
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

const VALID_CHOICES = ['Escape the Horde', 'Multiattack Defense'];

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

        it('returns modal when runtime value is empty string', async () => {
            getRuntimeValue.mockReturnValue('');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('defensiveTactics');
        });

        it('returns info popup for Escape the Horde', async () => {
            getRuntimeValue.mockReturnValue('Escape the Horde');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain('Escape the Horde');
            expect(result.payload.description).toContain('Opportunity Attacks have Disadvantage');
            expect(result.payload.automation).toBeDefined();
        });

        it('returns info popup for Multiattack Defense', async () => {
            getRuntimeValue.mockReturnValue('Multiattack Defense');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain('Multiattack Defense');
            expect(result.payload.description).toContain('Disadvantage on all other attack rolls');
            expect(result.payload.automation).toBeDefined();
        });

        it('passes campaignName through to getRuntimeValue', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'my-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('RangerBoy', '_Defensive_Tactics_choice', 'my-campaign');
        });

        it('does not show modal when a valid choice is already stored', async () => {
            for (const choice of VALID_CHOICES) {
                getRuntimeValue.mockReturnValue(choice);

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
            }
        });
    });

    describe('applyChoice', () => {
        it('returns null for invalid choice', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Invalid Choice');

            expect(result).toBeNull();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns null for empty string choice', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', '');

            expect(result).toBeNull();
        });

        it('returns null for null choice', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', null);

            expect(result).toBeNull();
        });

        it('returns null for undefined choice', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', undefined);

            expect(result).toBeNull();
        });

        it('returns popup for Escape the Horde', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Escape the Horde');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain('Escape the Horde');
            expect(result.payload.description).toContain('Short or Long Rest');
            expect(result.payload.automation).toBeUndefined();
        });

        it('returns popup for Multiattack Defense', async () => {
            const result = await applyChoice(makePlayerStats(), 'test-campaign', 'Multiattack Defense');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain('Multiattack Defense');
            expect(result.payload.description).toContain('Short or Long Rest');
            expect(result.payload.automation).toBeUndefined();
        });

        it('stores the chosen value in runtime state', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Escape the Horde');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerBoy',
                '_Defensive_Tactics_choice',
                'Escape the Horde',
                'test-campaign'
            );
        });

        it('logs the ability use to the campaign log', async () => {
            await applyChoice(makePlayerStats(), 'test-campaign', 'Multiattack Defense');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerBoy',
                abilityName: 'Defensive Tactics',
                description: 'Defensive Tactics choice: Multiattack Defense',
            });
        });

        it('uses the character name from playerStats for runtime key and log', async () => {
            const stats = makePlayerStats({ name: 'OtherRanger' });
            await applyChoice(stats, 'test-campaign', 'Escape the Horde');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'OtherRanger',
                '_Defensive_Tactics_choice',
                'Escape the Horde',
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'OtherRanger',
                abilityName: 'Defensive Tactics',
                description: 'Defensive Tactics choice: Escape the Horde',
            });
        });

        it('handles all valid choices without error', async () => {
            for (const choice of VALID_CHOICES) {
                const result = await applyChoice(makePlayerStats(), 'test-campaign', choice);
                expect(result).not.toBeNull();
                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
            }
        });
    });
});
