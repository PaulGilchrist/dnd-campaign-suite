// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './naturesVeilHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { getCombatSummary } = await import('../../../encounters/combatData.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerGirl',
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        level: 14,
        class: { name: 'Ranger' },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Nature's Veil",
        automation: {
            type: 'natures_veil',
            resourceKey: 'naturesVeilUses',
            recharge: 'long_rest',
            ...overrides.automation,
        },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'naturesVeilUses') return 3;
        if (key === 'activeConditions') return [];
        return undefined;
    });
});

describe('naturesVeilHandler', () => {
    describe('guard: no uses remaining', () => {
        it('returns popup when uses are 0', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'naturesVeilUses') return 0;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('cannot be used again until a Long Rest');
        });

        it('returns popup when uses are negative', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'naturesVeilUses') return -1;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('cannot be used again until a Long Rest');
        });
    });

    describe('invisible condition', () => {
        it('decrements uses and applies invisible condition', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'naturesVeilUses',
                2,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'activeConditions',
                ['invisible'],
                'test-campaign'
            );
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Invisible');
        });

        it('adds invisible to existing conditions', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'naturesVeilUses') return 3;
                if (key === 'activeConditions') return ['fatigued'];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'activeConditions',
                ['fatigued', 'invisible'],
                'test-campaign'
            );
        });

        it('skips duplicate invisible condition', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'naturesVeilUses') return 3;
                if (key === 'activeConditions') return ['invisible'];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // setRuntimeValue should still be called for _activeInvisibility_ and uses
            // but the activeConditions call should NOT add another invisible
            const conditionCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                c => c[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('sets _activeInvisibility_ key for hostile action detection', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_activeInvisibility_RangerGirl',
                'RangerGirl',
                'test-campaign'
            );
        });

        it('sets expiration for invisible condition (1 round + next creature)', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: null });
        });
    });

    describe('popup result', () => {
        it('returns automation_info popup with correct name and description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe("Nature's Veil");
            expect(result.payload.description).toContain("Nature's Veil");
            expect(result.payload.description).toContain('Invisible');
            expect(result.payload.description).toContain('Uses remaining: 2');
        });

        it('respects custom feature name from action', async () => {
            const result = await handle(
                makeAction({ name: 'Veil of Shadows' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Veil of Shadows');
            expect(result.payload.description).toContain('Veil of Shadows');
        });
    });

    describe('logging', () => {
        it('logs ability use with correct type, character, and feature name', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'RangerGirl',
                abilityName: "Nature's Veil",
            }));
        });
    });

    describe('combat summary expiration', () => {
        it('sets expireOnCreatureName when player is in combat summary', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'RangerGirl' },
                    { name: 'Goblin1' },
                    { name: 'Goblin2' },
                ],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'Goblin1' });
        });

        it('wraps to start of list when player is last in combat summary', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Goblin1' },
                    { name: 'RangerGirl' },
                ],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'Goblin1' });
        });

        it('sets expireOnCreatureName to null when player is not in combat summary', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Goblin1' },
                    { name: 'Goblin2' },
                ],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: null });
        });

        it('sets expireOnCreatureName to null when combat summary has no creatures', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: null });
        });

        it('sets expireOnCreatureName to null when combat summary is null', async () => {
            getCombatSummary.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: null });
        });

        it('sets expireOnCreatureName to null when combat summary is undefined', async () => {
            getCombatSummary.mockReturnValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: null });
        });
    });

    describe('tracked resources', () => {
        it('uses tracked resource max when no stored uses', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return null;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            const playerStats = makePlayerStats({
                _trackedResources: {
                    naturesVeilUses: { current: 5 },
                },
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'naturesVeilUses',
                4,
                'test-campaign'
            );
        });

        it('falls back to Wisdom bonus when no stored uses and no tracked resources', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return null;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            const playerStats = makePlayerStats({
                _trackedResources: null,
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'naturesVeilUses',
                2,
                'test-campaign'
            );
        });

        it('uses min 1 for Wisdom bonus fallback when Wisdom bonus is 0', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return null;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            const playerStats = makePlayerStats({
                abilities: [],
                _trackedResources: null,
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'naturesVeilUses',
                0,
                'test-campaign'
            );
        });
    });

    describe('custom resource key', () => {
        it('uses custom resourceKey from automation config', async () => {
            const action = makeAction({
                automation: {
                    resourceKey: 'customVeilUses',
                },
            });

            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'customVeilUses') return 3;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'customVeilUses',
                2,
                'test-campaign'
            );
        });

        it('uses default resource key when no automation config', async () => {
            const action = makeAction({ automation: {} });

            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return 3;
                if (key === 'activeConditions') return [];
                return undefined;
            });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'naturesVeilUses',
                2,
                'test-campaign'
            );
        });
    });

    describe('stored uses as string', () => {
        it('converts string stored uses to number', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return '3';
                if (key === 'activeConditions') return [];
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Uses remaining: 2');
        });
    });

    describe('no action name fallback', () => {
        it('uses default feature name when action has no name', async () => {
            const action = makeAction({ name: undefined });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe("Nature's Veil");
        });
    });

    describe('edge cases for activeConditions', () => {
        it('handles null activeConditions from runtime store', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return 3;
                if (key === 'activeConditions') return null;
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'activeConditions',
                ['invisible'],
                'test-campaign'
            );
        });

        it('handles non-array activeConditions from runtime store', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'naturesVeilUses') return 3;
                if (key === 'activeConditions') return 'invisible';
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'activeConditions',
                ['invisible'],
                'test-campaign'
            );
        });
    });
});
