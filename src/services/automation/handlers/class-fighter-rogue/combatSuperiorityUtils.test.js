import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    rollManeuverDie,
    checkSuperiorityDice,
} from './combatSuperiorityUtils.js';
import { setCombatSummaryCache } from '../../../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/dice/diceRoller.js', async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })) }
});

const CAMPAIGN = 'test-campaign';

const relentlessStats = (overrides = {}) => ({
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    automation: { passives: [{ type: 'passive_rule', effect: 'relentless' }] },
    ...overrides,
});

const mockStoredRound = (storedRound) => {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'relentlessUsedRound') return storedRound;
        if (key === 'superiorityDice') return 6;
        return undefined;
    });
};

beforeEach(() => {
    vi.clearAllMocks();
    setCombatSummaryCache(null, CAMPAIGN);
});

// ── CLA-286: fixed d8 free roll ───────────────────────────────────────

describe('rollManeuverDie — Relentless free roll die size', () => {
    it('rolls a fixed d8 at lv18 (not the d12 superiority die) on the free use', () => {
        setCombatSummaryCache({ round: 1 }, CAMPAIGN);
        mockStoredRound(null);

        const result = rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.expendedDie).toBe(false);
        expect(result.dieDescription).toBe('Rolled d8 for 5 (Relentless).');
        expect(result.dieValue).toBe(5);
    });

    it('paid rolls still use the lv18 d12 superiority die', () => {
        setCombatSummaryCache({ round: 1 }, CAMPAIGN);
        mockStoredRound(null);
        rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        mockStoredRound(1);
        const paid = rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(rollExpression).toHaveBeenLastCalledWith('1d12');
        expect(paid.expendedDie).toBe(true);
        expect(paid.dieDescription).toBe('Rolled d12 for 5.');
    });

    it('defaults free roll value to 8 when rollExpression returns null', () => {
        setCombatSummaryCache({ round: 1 }, CAMPAIGN);
        mockStoredRound(null);
        rollExpression.mockReturnValueOnce(null);

        const result = rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(result.dieValue).toBe(8);
    });
});

// ── CLA-286: round-keyed self-re-arming latch ─────────────────────────

describe('rollManeuverDie — self-re-arming round latch', () => {
    it('stamps the CURRENT campaign round (not fallback 1) on the free use', () => {
        setCombatSummaryCache({ round: 2 }, CAMPAIGN);
        mockStoredRound(null);

        rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'relentlessUsedRound', 2, CAMPAIGN);
    });

    it('second maneuver in the SAME round pays with the superiority die', () => {
        setCombatSummaryCache({ round: 2 }, CAMPAIGN);
        mockStoredRound(2);

        const result = rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(result.expendedDie).toBe(true);
        expect(result.relentlessUsed).toBe(true);
        expect(rollExpression).toHaveBeenCalledWith('1d12');
    });

    it('re-arms in a NEW round — stale stamp 1 vs round 2 grants a free d8', () => {
        setCombatSummaryCache({ round: 2 }, CAMPAIGN);
        mockStoredRound(1);

        const result = rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(result.expendedDie).toBe(false);
        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.dieDescription).toContain('(Relentless)');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'relentlessUsedRound', 2, CAMPAIGN);
    });

    it('stale future stamp blocks the free use (never over-grants backwards)', () => {
        setCombatSummaryCache({ round: 2 }, CAMPAIGN);
        mockStoredRound(3);

        const result = rollManeuverDie({ dieExpression: 'superiority_die' }, relentlessStats(), CAMPAIGN);

        expect(result.expendedDie).toBe(true);
    });

    it('non-relentless character always pays', () => {
        setCombatSummaryCache({ round: 1 }, CAMPAIGN);
        mockStoredRound(null);

        const result = rollManeuverDie(
            { dieExpression: 'superiority_die' },
            relentlessStats({ automation: { passives: [] } }),
            CAMPAIGN
        );

        expect(result.expendedDie).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

// ── CLA-286: checkSuperiorityDice re-arm semantics ────────────────────

describe('checkSuperiorityDice — re-arm consistency', () => {
    it('grants remaining availability when the latch round is older than the current round', () => {
        setCombatSummaryCache({ round: 2 }, CAMPAIGN);
        mockStoredRound(1);
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'relentlessUsedRound') return 1;
            if (key === 'superiorityDice') return 0;
            return undefined;
        });

        const result = checkSuperiorityDice(relentlessStats(), CAMPAIGN);

        expect(result.relentlessUsed).toBe(false);
        expect(result.hasDiceRemaining).toBe(true);
    });

    it('reports no dice when the latch was stamped this round and pool is empty', () => {
        setCombatSummaryCache({ round: 2 }, CAMPAIGN);
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'relentlessUsedRound') return 2;
            if (key === 'superiorityDice') return 0;
            return undefined;
        });

        const result = checkSuperiorityDice(relentlessStats(), CAMPAIGN);

        expect(result.relentlessUsed).toBe(true);
        expect(result.hasDiceRemaining).toBe(false);
    });
});
