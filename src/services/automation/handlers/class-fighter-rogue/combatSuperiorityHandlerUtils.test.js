// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
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
    loadWildMagicSurgeTable: vi.fn(async () => []),
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

    // FS-010: no stored value derives the character's ACTUAL max — never the
    // old flat 4 (a pure Superior Technique fighter could fuel 4 maneuvers).
    it('derives max 1 for a Superior Technique non-Battle Master when no value stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getSuperiorityDice(
            makePlayerStats({ class: { name: 'Fighter', fightingStyles: ['Superior Technique'] } }),
            'test-campaign'
        );

        expect(result).toBe(1);
    });

    it('derives Battle Master level-table max when value is undefined', () => {
        getRuntimeValue.mockReturnValue(undefined);

        const result = getSuperiorityDice(
            makePlayerStats({
                level: 18,
                class: { name: 'Fighter', subclass: { name: 'Battle Master' }, class_levels: [{ level: 18, superiority_dice: 8 }] },
            }),
            'test-campaign'
        );

        expect(result).toBe(8);
    });

    it('derives 0 for non-fighters when no value stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getSuperiorityDice(makePlayerStats({ class: { name: 'Wizard' } }), 'test-campaign');

        expect(result).toBe(0);
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

// ── FS-010: die face honors style (d6) vs Battle Master level table ──

describe('FS-010 rollManeuverDie die face', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const styleStats = () => makePlayerStats({
        level: 18,
        class: { name: 'Fighter', subclass: { name: 'Champion' }, fightingStyles: ['Superior Technique'] },
    });

    const battleMasterStats = () => makePlayerStats({
        level: 18,
        class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });

    it('uses the numeric die face supplied by the feature (Superior Technique d6)', () => {
        getRuntimeValue.mockReturnValue(undefined);

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            styleStats(),
            'test-campaign',
            '6'
        );

        expect(result.superiorityDieSize).toBe(6);
        expect(result.dieDescription).toContain('Rolled d6');
        expect(result.dieValue).toBeGreaterThanOrEqual(1);
        expect(result.dieValue).toBeLessThanOrEqual(6);
    });

    it('falls back to d6 for a style-only fighter even via the superiority_die token', () => {
        getRuntimeValue.mockReturnValue(undefined);

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            styleStats(),
            'test-campaign'
        );

        expect(result.superiorityDieSize).toBe(6);
        expect(result.dieDescription).toContain('d6');
    });

    it('keeps Battle Master lv18 on the d12 level table', () => {
        getRuntimeValue.mockReturnValue(undefined);

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            battleMasterStats(),
            'test-campaign',
            'superiority_die'
        );

        expect(result.superiorityDieSize).toBe(12);
        expect(result.dieDescription).toContain('d12');
    });
});
