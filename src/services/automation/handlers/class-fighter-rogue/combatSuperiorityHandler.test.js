// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './combatSuperiorityHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

const makeAction = (auto = {}) => ({
    name: 'Combat Superiority',
    automation: {
        type: 'combat_superiority',
        saveType: 'WIS',
        saveDc: 'ability',
        dieExpression: 'superiority_die',
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

const defaultGetRuntimeValue = (_playerName, key, _campaignName) => {
    if (key === 'superiorityDice') return 4;
    if (key === SELECTION_KEY) return [];
    return undefined;
};

describe('combatSuperiorityHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation(defaultGetRuntimeValue);
    });

    describe('no maneuver data', () => {
        it('returns popup when loadManeuvers resolves to empty array', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No maneuver data available.');
            expect(result.payload.name).toBe('Combat Superiority');
        });

        it('passes automation into popup payload when no maneuvers', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            const result = await handle(
                makeAction({ maxOptions: 5 }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.automation).toEqual({
                type: 'combat_superiority',
                saveType: 'WIS',
                saveDc: 'ability',
                dieExpression: 'superiority_die',
                maxOptions: 5,
            });
        });
    });

    describe('no superiority dice', () => {
        it('returns popup when superiority dice is zero', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 0;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No Superiority Dice remaining. Recharges on a Short or Long Rest.');
        });

        it('returns popup when superiority dice is negative', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return -1;
                if (key === SELECTION_KEY) return [];
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Superiority Dice remaining');
        });
    });

    describe('modal with maneuver selection', () => {
        it('returns modal with all maneuvers when none known', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone', saveType: 'STR' },
                { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
            ]);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('combatSuperiority');
            expect(result.payload.allManeuvers).toHaveLength(2);
            expect(result.payload.knownManeuvers).toEqual([]);
            expect(result.payload.maxOptions).toBe(3);
            expect(result.payload.selectionMode).toBe(true);
            expect(result.payload.saveDc).toBe('ability');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.dieExpression).toBe('superiority_die');
        });

        it('returns modal without selectionMode when all maneuvers are known', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone', saveType: 'STR' },
                { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack', 'Pushing Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('modal');
            expect(result.payload.selectionMode).toBe(false);
            expect(result.payload.knownManeuvers).toEqual(['Trip Attack', 'Pushing Attack']);
        });

        it('enables selectionMode when some but not all maneuvers are known', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone', saveType: 'STR' },
                { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
                { name: 'Rally', effect: 'temp_hp' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('modal');
            expect(result.payload.selectionMode).toBe(true);
            expect(result.payload.knownManeuvers).toEqual(['Trip Attack']);
        });

        it('enables selectionMode when forceSelectionMode is true', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
                { name: 'Pushing Attack', effect: 'push' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack', 'Pushing Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction({ forceSelectionMode: true }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('modal');
            expect(result.payload.selectionMode).toBe(true);
        });

        it('respects maxOptions from automation config', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
                { name: 'Pushing Attack', effect: 'push' },
                { name: 'Rally', effect: 'temp_hp' },
                { name: 'Riposte', effect: 'melee_attack_reaction' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction({ maxOptions: 2 }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.maxOptions).toBe(2);
            expect(result.payload.selectionMode).toBe(true);
        });

        it('applies level-based scaling to maxOptions', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
                { name: 'Pushing Attack', effect: 'push' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return [];
                return undefined;
            });

            const result = await handle(
                makeAction({ maxOptions: 2, maxOptionsScaling: { 10: 1, 15: 1 } }),
                makePlayerStats({ level: 12 }),
                'test-campaign',
                null
            );

            expect(result.payload.maxOptions).toBe(3);
        });

        it('omits selectionMode when all maneuvers are known and no forced mode', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
                { name: 'Pushing Attack', effect: 'push' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack', 'Pushing Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction({ maxOptions: 3 }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('modal');
            expect(result.payload.selectionMode).toBe(false);
        });
    });

    describe('payload contents', () => {
        it('passes action and playerStats by reference in modal payload', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(
                action,
                playerStats,
                'test-campaign',
                null
            );

            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
        });

        it('passes campaignName into handler but does not include in modal payload', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'my-campaign',
                null
            );

            expect(result.payload).not.toHaveProperty('campaignName');
        });

        it('includes all maneuvers in allManeuvers payload field', async () => {
            const maneuvers = [
                { name: 'Trip Attack', effect: 'knock_prone' },
                { name: 'Pushing Attack', effect: 'push' },
                { name: 'Rally', effect: 'temp_hp' },
            ];
            dataLoader.loadManeuvers.mockResolvedValue(maneuvers);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.allManeuvers).toBe(maneuvers);
        });
    });

    describe('ruleset handling', () => {
        it('loads maneuvers for 5e ruleset', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            await handle(
                makeAction(),
                makePlayerStats({ rules: '5e' }),
                'test-campaign',
                null
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('5e');
        });

        it('defaults to 2024 ruleset when playerStats.rules is undefined', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            const playerStats = makePlayerStats();
            delete playerStats.rules;

            await handle(
                makeAction(),
                playerStats,
                'test-campaign',
                null
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('2024');
        });

        it('defaults to 2024 ruleset when playerStats.rules is null', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            await handle(
                makeAction(),
                makePlayerStats({ rules: null }),
                'test-campaign',
                null
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('2024');
        });

        it('uses 2024 ruleset by default when playerStats has no rules field', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([]);

            const playerStats = makePlayerStats();
            delete playerStats.rules;

            await handle(
                makeAction(),
                playerStats,
                'test-campaign',
                null
            );

            expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('2024');
        });
    });

    describe('save configuration', () => {
        it('uses default saveType WIS when not specified', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const result = await handle(
                makeAction({ saveType: undefined }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.saveType).toBe('WIS');
        });

        it('uses default saveType WIS when saveType is null', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const result = await handle(
                makeAction({ saveType: null }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.saveType).toBe('WIS');
        });

        it('uses custom saveType from automation when specified', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const result = await handle(
                makeAction({ saveType: 'STR' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.saveType).toBe('STR');
        });

        it('passes saveDc from automation into payload', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const result = await handle(
                makeAction({ saveDc: 16 }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.saveDc).toBe(16);
        });

        it('passes dieExpression from automation into payload', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const result = await handle(
                makeAction({ dieExpression: '2d6' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.dieExpression).toBe('2d6');
        });
    });

    describe('known maneuvers tracking', () => {
        it('returns empty knownManeuvers array when none stored', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.knownManeuvers).toEqual([]);
        });

        it('returns known maneuver names from runtime storage', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
                { name: 'Pushing Attack', effect: 'push' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return ['Trip Attack'];
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.knownManeuvers).toEqual(['Trip Attack']);
        });

        it('handles non-array stored selection by treating as empty', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 4;
                if (key === SELECTION_KEY) return 'not-an-array';
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.knownManeuvers).toEqual([]);
        });
    });

    describe('relentless interaction', () => {
        it('returns modal when relentless passive exists and dice are zero but not used this round', async () => {
            dataLoader.loadManeuvers.mockResolvedValue([
                { name: 'Trip Attack', effect: 'knock_prone' },
            ]);
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'superiorityDice') return 0;
                if (key === SELECTION_KEY) return [];
                if (key === 'relentlessUsedRound') return undefined;
                return undefined;
            });

            const result = await handle(
                makeAction(),
                makePlayerStats({
                    automation: {
                        passives: [{ type: 'passive_rule', effect: 'relentless', name: 'Relentless' }],
                    },
                }),
                'test-campaign',
                null
            );

            expect(result.type).toBe('modal');
        });
    });
});
