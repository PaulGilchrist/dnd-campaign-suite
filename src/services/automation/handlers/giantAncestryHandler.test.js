import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmGiantAncestry, getGiantAncestrySelection, getGiantAncestryOptions } from './giantAncestryHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

vi.mock('../../combat/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../rules/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Giant Ancestry',
        description: 'Choose a giant ancestry benefit.',
        automation: {
            type: 'resource_pool',
            options: [],
            recharge: 'short_rest',
            casting_time: '1 action',
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Constitution', bonus: 2 },
        ],
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('giantAncestryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should show selection modal when no ancestry is selected', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
            expect(result.payload.action).toBe(action);
        });

        it('should dispatch to the correct sub-handler based on stored selection', async () => {
            getRuntimeValue.mockReturnValue("Cloud's Jaunt");
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });
    });

    describe('confirmGiantAncestry', () => {
        it('should store the selected ancestry and return confirmation', async () => {
            const result = await confirmGiantAncestry(
                makePlayerStats(),
                "Fire's Burn",
                'campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain("Fire's Burn");
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'giantAncestrySelection',
                "Fire's Burn",
                'campaign'
            );
        });

        it('should return error when no option is selected', async () => {
            const result = await confirmGiantAncestry(
                makePlayerStats(),
                'Nonexistent Option',
                'campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No option selected.');
        });
    });

    describe('getGiantAncestrySelection', () => {
        it('should return the stored selection', () => {
            getRuntimeValue.mockReturnValue("Stone's Endurance");
            const selection = getGiantAncestrySelection(makePlayerStats(), 'campaign');
            expect(selection).toBe("Stone's Endurance");
        });

        it('should return null when no selection exists', () => {
            getRuntimeValue.mockReturnValue(null);
            const selection = getGiantAncestrySelection(makePlayerStats(), 'campaign');
            expect(selection).toBe(null);
        });
    });

    describe('getGiantAncestryOptions', () => {
        it('should return all 6 giant ancestry options', () => {
            const options = getGiantAncestryOptions();
            expect(options).toHaveLength(6);
            expect(options.map(o => o.name)).toEqual([
                "Cloud's Jaunt",
                "Fire's Burn",
                "Frost's Chill",
                "Hill's Tumble",
                "Stone's Endurance",
                "Storm's Thunder",
            ]);
        });

        it('should include type and icon for each option', () => {
            const options = getGiantAncestryOptions();
            options.forEach(opt => {
                expect(opt.type).toBeDefined();
                expect(opt.icon).toBeDefined();
                expect(opt.description).toBeDefined();
            });
        });
    });

    describe('resource_pool routing', () => {
        it('should route Giant Ancestry through resourcePoolHandler', async () => {
            const { handle: resourcePoolHandle } = await import('./resourcePoolHandler.js');
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await resourcePoolHandle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('giantAncestry');
        });
    });
});
