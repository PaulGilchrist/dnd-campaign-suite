// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getSuperiorityDice,
    rollManeuverDie,
    getSkillCheckManeuversForSkill,
    getManeuversForRules,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../../services/ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

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
    size: 'Medium',
    ...overrides,
});

// ── getSuperiorityDice ─────────────────────────────────────────────────

describe('getSuperiorityDice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns stored value when available', () => {
        getRuntimeValue.mockReturnValue(6);

        const result = getSuperiorityDice(makePlayerStats(), 'test-campaign');

        expect(result).toBe(6);
        expect(getRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 'test-campaign');
    });

    it('returns default of 4 when no value stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getSuperiorityDice(makePlayerStats(), 'test-campaign');

        expect(result).toBe(4);
    });

    it('returns default of 4 when value is undefined', () => {
        getRuntimeValue.mockReturnValue(undefined);

        const result = getSuperiorityDice(makePlayerStats(), 'test-campaign');

        expect(result).toBe(4);
    });
});

// ── rollManeuverDie ────────────────────────────────────────────────────

describe('rollManeuverDie', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rolls a die and returns dieValue, dieDescription, expendedDie=true', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return [];
            return undefined;
        });

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            makePlayerStats(),
            'test-campaign'
        );

        expect(result).toHaveProperty('dieValue');
        expect(typeof result.dieValue).toBe('number');
        expect(result.dieValue).toBeGreaterThanOrEqual(1);
        expect(result.dieValue).toBeLessThanOrEqual(8);
        expect(result.expendedDie).toBe(true);
        expect(result).toHaveProperty('dieDescription');
        expect(result).toHaveProperty('relentlessUsed');
        expect(result.relentlessUsed).toBe(false);
    });

    it('uses Relentless when passive exists and not used this round', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === SELECTION_KEY) return [];
            if (key === 'relentlessUsedRound') return undefined;
            return undefined;
        });

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            makePlayerStats({
                automation: { passives: [{ type: 'passive_rule', effect: 'relentless' }] },
            }),
            'test-campaign'
        );

        expect(result.expendedDie).toBe(false);
        expect(result.relentlessUsed).toBe(false);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestFighter',
            'relentlessUsedRound',
            1,
            'test-campaign'
        );
    });

    it('does not use Relentless when already used this round', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 0;
            if (key === SELECTION_KEY) return [];
            if (key === 'relentlessUsedRound') return 1;
            return undefined;
        });

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            makePlayerStats({
                automation: { passives: [{ type: 'passive_rule', effect: 'relentless' }] },
            }),
            'test-campaign'
        );

        expect(result.expendedDie).toBe(true);
        expect(result.relentlessUsed).toBe(true);
    });

    it('uses default superiority_die when dieExpression is falsy', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return [];
            return undefined;
        });

        const result = rollManeuverDie(
            {},
            makePlayerStats(),
            'test-campaign'
        );

        expect(result.dieValue).toBeGreaterThanOrEqual(1);
        expect(result.dieValue).toBeLessThanOrEqual(8);
        expect(result.dieDescription).toContain('d8');
    });
});

// ── getSkillCheckManeuversForSkill ─────────────────────────────────────

describe('getSkillCheckManeuversForSkill', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns formatted maneuver info for available skill check maneuvers', async () => {
        dataLoader.loadManeuvers.mockResolvedValue([
            { name: 'Ambush', actionType: 'skill_check', skills: ['Stealth'], initiativeBonus: false, dieExpression: 'superiority_die' },
        ]);
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return ['Ambush'];
            return undefined;
        });

        await getManeuversForRules('2024');

        const result = getSkillCheckManeuversForSkill(
            makePlayerStats(),
            'test-campaign',
            'Stealth',
            false
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
            expect.objectContaining({
                name: 'Ambush',
                dieExpression: 'superiority_die',
                skills: ['Stealth'],
                isInitiative: false,
            })
        );
    });

    it('returns empty array when no maneuvers match', () => {
        getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
            if (key === 'superiorityDice') return 4;
            if (key === SELECTION_KEY) return [];
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
