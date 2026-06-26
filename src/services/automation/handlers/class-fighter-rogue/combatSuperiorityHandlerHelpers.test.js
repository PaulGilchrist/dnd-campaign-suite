// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getSuperiorityDice,
    getSkillCheckManeuversForSkill,
    getManeuversForRules,
    rollManeuverDie,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 1 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 0 },
        { name: 'Charisma', bonus: 0 },
    ],
    level: 5,
    rules: '2024',
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

describe('getSuperiorityDice', () => {
    it('returns stored value when available', () => {
        getRuntimeValue.mockReturnValue(3);
        const result = getSuperiorityDice(makePlayerStats(), 'test-campaign');
        expect(result).toBe(3);
    });

    it('returns default of 4 when no value stored', () => {
        getRuntimeValue.mockReturnValue(undefined);
        const result = getSuperiorityDice(makePlayerStats(), 'test-campaign');
        expect(result).toBe(4);
    });

    it('returns default of 4 when null stored', () => {
        getRuntimeValue.mockReturnValue(null);
        const result = getSuperiorityDice(makePlayerStats(), 'test-campaign');
        expect(result).toBe(4);
    });
});

describe('getSkillCheckManeuversForSkill', () => {
    it('returns empty array when no maneuvers are known', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === 'BattleMasterManeuvers_selection') return [];
            return undefined;
        });

        const result = getSkillCheckManeuversForSkill(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toEqual([]);
    });

    it('returns empty array when superiority dice are zero', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === 'BattleMasterManeuvers_selection') return ['Ambush'];
            return undefined;
        });

        const result = getSkillCheckManeuversForSkill(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toEqual([]);
    });
});

describe('getManeuversForRules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('caches maneuvers by rules key', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([{ name: 'Test' }]);

        const result1 = await getManeuversForRules('2024');
        expect(result1).toEqual([{ name: 'Test' }]);

        // Second call should use cache
        const result2 = await getManeuversForRules('2024');
        expect(result2).toEqual([{ name: 'Test' }]);
        expect(dataLoader.loadManeuvers).toHaveBeenCalledTimes(1);
    });

    it('loads maneuvers for a different ruleset key', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([{ name: 'New Maneuver' }]);

        await getManeuversForRules('5e');

        expect(dataLoader.loadManeuvers).toHaveBeenCalledWith('5e');
    });
});

describe('rollManeuverDie', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        automationService.evaluateAutoExpression.mockReturnValue(10);
    });

    it('rolls die and returns value when no relentless', () => {
        rollExpression.mockReturnValue({ total: 7 });
        getRuntimeValue.mockReturnValue(undefined);

        const result = rollManeuverDie(
            { name: 'Trip Attack', dieExpression: 'superiority_die' },
            makePlayerStats(),
            'test-campaign'
        );

        expect(result.dieValue).toBe(7);
        expect(result.dieDescription).toContain('Rolled d10 for 7');
        expect(result.expendedDie).toBe(true);
        expect(result.relentlessUsed).toBe(false);
    });

    it('rolls die without expending when relentless is available', () => {
        getCurrentCombatRound.mockReturnValue(5);
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 3 });

        const result = rollManeuverDie(
            { name: 'Trip Attack', dieExpression: 'superiority_die' },
            makePlayerStats({
                automation: { passives: [{ type: 'passive_rule', effect: 'relentless' }] },
            }),
            'test-campaign'
        );

        expect(result.dieValue).toBe(3);
        expect(result.dieDescription).toContain('Relentless');
        expect(result.expendedDie).toBe(false);
        expect(result.relentlessUsed).toBe(false);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'relentlessUsedRound',
            5,
            'test-campaign'
        );
    });

    it('does not use relentless when already used this round', () => {
        getCurrentCombatRound.mockReturnValue(5);
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'relentlessUsedRound') return 5;
            return undefined;
        });
        rollExpression.mockReturnValue({ total: 8 });

        const result = rollManeuverDie(
            { name: 'Trip Attack', dieExpression: 'superiority_die' },
            makePlayerStats({
                automation: { passives: [{ type: 'passive_rule', effect: 'relentless' }] },
            }),
            'test-campaign'
        );

        expect(result.expendedDie).toBe(true);
        expect(result.relentlessUsed).toBe(true);
    });

    it('falls back to die size when rollExpression returns null', () => {
        rollExpression.mockReturnValue(null);
        automationService.evaluateAutoExpression.mockReturnValue(8);
        getRuntimeValue.mockReturnValue(undefined);

        const result = rollManeuverDie(
            { name: 'Trip Attack', dieExpression: '1d8' },
            makePlayerStats(),
            'test-campaign'
        );

        expect(result.dieValue).toBe(8);
    });
});
