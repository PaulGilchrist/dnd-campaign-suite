// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onCombatSuperioritySelected } from './combatSuperiorityHandler.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Combat Superiority',
    automation: {
        type: 'combat_superiority',
        saveType: 'WIS',
        saveDc: 'ability',
        dieExpression: 'superiority_die',
        uses_max: 4,
        ...auto,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'STR', bonus: 4 },
        { name: 'DEX', bonus: 2 },
        { name: 'CON', bonus: 1 },
        { name: 'INT', bonus: 0 },
        { name: 'WIS', bonus: 0 },
        { name: 'CHA', bonus: 0 },
    ],
    level: 5,
    rules: '2024',
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

const allManeuvers = [
    { name: 'Trip Attack', effect: 'knock_prone', saveType: 'STR' },
    { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
    { name: 'Rally', effect: 'temp_hp' },
];

describe('onCombatSuperioritySelected - selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dataLoader.loadManeuvers.mockResolvedValue(allManeuvers);
    });

    describe('empty or cleared selection', () => {
        it('returns info popup when selectedManeuverNames is an empty array', async () => {
            const result = await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                []
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Combat Superiority');
            expect(result.payload.description).toBe('Combat Superiority selection cleared.');
        });
    });

    describe('invalid maneuver filtering', () => {
        it('filters out maneuver names not in the loaded maneuver list', async () => {
            await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                ['Trip Attack', 'Invalid Maneuver', 'Pushing Attack']
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'BattleMasterManeuvers_selection',
                ['Trip Attack', 'Pushing Attack'],
                'test-campaign'
            );
        });

        it('saves only valid maneuver names when all are valid', async () => {
            await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                ['Trip Attack', 'Pushing Attack', 'Rally']
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'BattleMasterManeuvers_selection',
                ['Trip Attack', 'Pushing Attack', 'Rally'],
                'test-campaign'
            );
        });

        it('saves empty array when all selected names are invalid', async () => {
            await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                ['Unknown 1', 'Unknown 2']
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'BattleMasterManeuvers_selection',
                [],
                'test-campaign'
            );
        });
    });

    describe('popup response for selection', () => {
        it('includes valid maneuver names in the popup description', async () => {
            const result = await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                ['Trip Attack', 'Rally']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Combat Superiority');
            expect(result.payload.description).toContain('Trip Attack');
            expect(result.payload.description).toContain('Rally');
            expect(result.payload.description).toContain('Combat Superiority');
        });

        it('includes automation config in popup payload', async () => {
            const result = await onCombatSuperioritySelected(
                makeAction({ maxOptions: 5 }),
                makePlayerStats(),
                'test-campaign',
                ['Trip Attack']
            );

            expect(result.payload.automation).toEqual({
                type: 'combat_superiority',
                saveType: 'WIS',
                saveDc: 'ability',
                dieExpression: 'superiority_die',
                uses_max: 4,
                maxOptions: 5,
            });
        });
    });

    describe('no maneuver selected', () => {
        it('returns info popup when selectedManeuverNames is null', async () => {
            const result = await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No maneuver selected.');
        });

        it('returns info popup when selectedManeuverNames is undefined', async () => {
            const result = await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                undefined
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No maneuver selected.');
        });
    });

    describe('ruleset handling', () => {
        it('loads maneuvers for 5e ruleset from playerStats', async () => {
            await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats({ rules: '5e' }),
                'test-campaign',
                ['Trip Attack']
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('5e');
        });

        it('loads maneuvers for 2024 ruleset by default', async () => {
            await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats({ rules: '2024' }),
                'test-campaign',
                ['Trip Attack']
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('2024');
        });

        it('defaults to 2024 ruleset when playerStats.rules is null', async () => {
            await onCombatSuperioritySelected(
                makeAction(),
                makePlayerStats({ rules: null }),
                'test-campaign',
                ['Trip Attack']
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('2024');
        });

        it('defaults to 2024 ruleset when playerStats.rules is undefined', async () => {
            const playerStats = makePlayerStats();
            delete playerStats.rules;

            await onCombatSuperioritySelected(
                makeAction(),
                playerStats,
                'test-campaign',
                ['Trip Attack']
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('2024');
        });
    });
});
