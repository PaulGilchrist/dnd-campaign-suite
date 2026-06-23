import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onCombatSuperioritySelected } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import * as savePrompt from '../../../automation/common/savePrompt.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Trip Attack', effect: 'knock_prone', saveType: 'STR' },
        { name: 'Pushing Attack', effect: 'push', saveType: 'STR', value: 15 },
        { name: 'Rally', effect: 'temp_hp' },
    ]),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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

describe('combatSuperiorityHandler.onCombatSuperioritySelected - selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 5 });
        savePrompt.buildSaveDc.mockReturnValue(15);
        savePrompt.createSaveListener.mockReturnValue({
            promise: Promise.resolve({ success: false }),
        });
    });

    it('returns popup when empty array selected', async () => {
        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            []
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Combat Superiority selection cleared.');
    });

    it('filters out invalid maneuver names', async () => {
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
            'test-campaign',
            true
        );
    });

    it('returns info popup with selected maneuver names', async () => {
        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            ['Trip Attack', 'Pushing Attack']
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Trip Attack');
        expect(result.payload.description).toContain('Pushing Attack');
        expect(result.payload.description).toContain('Combat Superiority');
    });

    it('saves selection via setRuntimeValue', async () => {
        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'my-campaign',
            ['Rally']
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'BattleMasterManeuvers_selection',
            ['Rally'],
            'my-campaign',
            true
        );
    });

    it('returns popup when null selectedManeuverNames and no singleUseManeuverName', async () => {
        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No maneuver selected.');
    });

    it('delegates to executeManeuver when singleUseManeuverName is provided', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 6 });

        const result = await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats(),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.name).toBe('Trip Attack');
        expect(result.payload.description).toContain('Trip Attack');
    });

    it('loads maneuvers with correct ruleset from playerStats', async () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 2;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 6 });
        const { loadManeuvers } = await import('../../../../services/ui/dataLoader.js');
        loadManeuvers.mockResolvedValue([
            { name: 'Trip Attack', effect: 'knock_prone', saveType: 'STR' },
        ]);

        await onCombatSuperioritySelected(
            makeAction(),
            makePlayerStats({ rules: '5e' }),
            'test-campaign',
            null,
            'Trip Attack'
        );

        expect(loadManeuvers).toHaveBeenCalledWith('5e');
    });
});
