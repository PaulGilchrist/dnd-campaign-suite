// @maintained-by-ai
// Nature's Veil handler unit tests. Fully deterministic: every external
// dependency (runtime store, expiration queue, log, combat summary) is mocked;
// assertions are exact-key / full-args / full-string own-composition pins on
// the handler's stable contract (resource accounting, invisible condition,
// _activeInvisibility_ tracking key, expire-on-next-creature resolution).
// Lanes owned elsewhere: _activeInvisibility_ CONSUMPTION by hostile-action
// end-of-invisibility (invisibilityService.test.js), tracked-resource max
// DEFINITION (trackedResourcesSubclass.test.js), sanctuary keys + land
// resistance (naturesSanctuaryHandler.test.js — veil-scoped, no overlap),
// expiration queue internals (expirations_expireStaleEffects.test.js).
// Policy note (mirrors sanctuary lane): duration here is combat-scoped —
// addExpiration is called with rounds: undefined and expireOnCreatureName
// resolved from initiative order, not a wall-clock or minutes×rounds timer.
// Pinned as-is; no parseDurationRounds(1_minute→rounds:10) pattern present.
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

const CAMPAIGN = 'test-campaign';
const NAME = "Nature's Veil";
const FULL_POPUP_DESC = `<b>${NAME}</b><br/><br/>You invoke spirits of nature to magically hide yourself. You gain the <b>Invisible</b> condition until the end of your next turn.<br/><br/>Uses remaining: 2`;

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
        name: NAME,
        automation: {
            type: 'natures_veil',
            resourceKey: 'naturesVeilUses',
            recharge: 'long_rest',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// Runtime-store router: only the keys the handler reads return values.
function mockStore({ uses = 3, conditions = [], usesKey = 'naturesVeilUses' } = {}) {
    getRuntimeValue.mockImplementation((_playerName, key) => {
        if (key === usesKey) return uses;
        if (key === 'activeConditions') return conditions;
        return undefined;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockStore();
    getCombatSummary.mockReturnValue(null);
});

describe('naturesVeilHandler', () => {
    describe('guard: no uses remaining', () => {
        it.each([0, -1])('returns popup and writes nothing when uses are %i', async (uses) => {
            mockStore({ uses });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: NAME,
                    description: `${NAME} has been used and cannot be used again until a Long Rest.`,
                    automation: makeAction().automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('invisible condition', () => {
        it('decrements uses and applies invisible condition', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'naturesVeilUses', 2, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'activeConditions', ['invisible'], CAMPAIGN);
        });

        it('adds invisible to existing conditions', async () => {
            mockStore({ conditions: ['fatigued'] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'activeConditions', ['fatigued', 'invisible'], CAMPAIGN);
        });

        it('skips duplicate invisible condition', async () => {
            mockStore({ conditions: ['invisible'] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            const conditionCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
                c => c[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(0);
        });

        it('sets _activeInvisibility_ key for hostile action detection', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeInvisibility_RangerGirl', 'RangerGirl', CAMPAIGN);
        });

        it('sets expiration for invisible condition (1 round + next creature)', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: CAMPAIGN, rounds: undefined, expireOnCreatureName: null });
        });
    });

    describe('popup result', () => {
        it('returns automation_info popup with full composed name and description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe(NAME);
            expect(result.payload.description).toBe(FULL_POPUP_DESC);
        });

        it('respects custom feature name from action', async () => {
            const result = await handle(
                makeAction({ name: 'Veil of Shadows' }),
                makePlayerStats(),
                CAMPAIGN,
                null
            );

            expect(result.payload.name).toBe('Veil of Shadows');
            expect(result.payload.description).toContain('Veil of Shadows');
        });

        it('uses default feature name when action has no name', async () => {
            const result = await handle(makeAction({ name: undefined }), makePlayerStats(), CAMPAIGN, null);

            expect(result.payload.name).toBe(NAME);
        });
    });

    describe('logging', () => {
        it('logs ability use with full composed description', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
                type: 'ability_use',
                characterName: 'RangerGirl',
                abilityName: NAME,
                description: 'RangerGirl used Nature\'s Veil — Bonus Action, gained Invisible condition until end of next turn. Uses remaining: 2.',
            });
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

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: CAMPAIGN, rounds: undefined, expireOnCreatureName: 'Goblin1' });
        });

        it('wraps to start of list when player is last in combat summary', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Goblin1' },
                    { name: 'RangerGirl' },
                ],
            });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: CAMPAIGN, rounds: undefined, expireOnCreatureName: 'Goblin1' });
        });

        it('sets expireOnCreatureName to null when player is not in combat summary', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Goblin1' },
                    { name: 'Goblin2' },
                ],
            });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'RangerGirl', targetName: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], campaignName: CAMPAIGN, rounds: undefined, expireOnCreatureName: null });
        });
    });

    describe('tracked resources', () => {
        it('uses tracked resource max when no stored uses', async () => {
            mockStore({ uses: null });

            const playerStats = makePlayerStats({
                _trackedResources: { naturesVeilUses: { current: 5 } },
            });

            await handle(makeAction(), playerStats, CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'naturesVeilUses', 4, CAMPAIGN);
        });

        it('falls back to Wisdom bonus when no stored uses and no tracked resources', async () => {
            mockStore({ uses: null });

            await handle(makeAction(), makePlayerStats({ _trackedResources: null }), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'naturesVeilUses', 2, CAMPAIGN);
        });

        it('uses min 1 for Wisdom bonus fallback when Wisdom bonus is 0', async () => {
            mockStore({ uses: null });

            const playerStats = makePlayerStats({ abilities: [], _trackedResources: null });

            await handle(makeAction(), playerStats, CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'naturesVeilUses', 0, CAMPAIGN);
        });

        it('converts string stored uses to number', async () => {
            mockStore({ uses: '3' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'naturesVeilUses', 2, CAMPAIGN);
            expect(result.payload.description).toContain('Uses remaining: 2');
        });
    });

    describe('resource key selection', () => {
        it('uses custom resourceKey from automation config', async () => {
            mockStore({ usesKey: 'customVeilUses' });

            const action = makeAction({ automation: { resourceKey: 'customVeilUses' } });

            await handle(action, makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'customVeilUses', 2, CAMPAIGN);
        });

        it('uses default resource key when no automation config', async () => {
            await handle(makeAction({ automation: {} }), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'naturesVeilUses', 2, CAMPAIGN);
        });
    });

    describe('activeConditions coercion', () => {
        it('handles null activeConditions from runtime store', async () => {
            mockStore({ conditions: null });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'activeConditions', ['invisible'], CAMPAIGN);
        });

        it('handles non-array activeConditions from runtime store', async () => {
            mockStore({ conditions: 'invisible' });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', 'activeConditions', ['invisible'], CAMPAIGN);
        });
    });
});
