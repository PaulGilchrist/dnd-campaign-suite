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

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

describe('combatSuperiorityHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return [];
            return undefined;
        });
    });

    it('returns popup when no maneuvers available', async () => {
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
    });

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

    it('returns modal with selectionMode false when all maneuvers known', async () => {
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

    it('returns modal with selectionMode true when some but not all known', async () => {
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

    it('respects maxOptions from automation', async () => {
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

    it('returns modal without selectionMode when no unknown maneuvers', async () => {
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

    it('includes action and playerStats in modal payload', async () => {
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

    it('loads maneuvers with correct ruleset', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([]);

        await handle(
            makeAction(),
            makePlayerStats({ rules: '5e' }),
            'test-campaign',
            null
        );

        expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('5e');
    });

    it('defaults to 2024 rules when playerStats has no rules field', async () => {
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

    it('returns popup when no superiority dice remaining', async () => {
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
});
