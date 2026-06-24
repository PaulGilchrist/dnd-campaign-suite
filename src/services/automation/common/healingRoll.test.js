// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    rollHealingForAction,
    applyHealingDirectly,
    logHealingToSSE,
} from './healingRoll.js';

// ── Dependency mocks ──────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    hasHealingMaximization: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

// Re-import after mocking
const { rollExpression, rollExpressionMaximized } = await import(
    '../../dice/diceRoller.js'
);
const { hasHealingMaximization } = await import(
    '../../combat/automation/automationService.js'
);
const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../hooks/runtime/useRuntimeState.js'
);
const { getCombatContext, getTargetFromAttacker } = await import(
    '../../rules/combat/damageUtils.js'
);
const { applyHealingToTarget } = await import('../../rules/combat/applyHealing.js');
const { postLogEntry } = await import('../../shared/logPoster.js');

// ── Test fixtures ─────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Hero',
        hitPoints: 30,
        level: 5,
        proficiency: 3,
        automation: { passives: [] },
        ...overrides,
    };
}

function makeAuto(overrides = {}) {
    return {
        healExpression: '2d8',
        ...overrides,
    };
}

// ── Helpers ───────────────────────────────────────────────────────

function defaultMocks() {
    hasHealingMaximization.mockReturnValue(false);
    getCombatContext.mockResolvedValue(null);
}

function createDispatchSpy() {
    return vi.spyOn(window, 'dispatchEvent');
}

// ── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
});

// ─── rollHealingForAction ────────────────────────────────────────

describe('rollHealingForAction', () => {
    describe('early returns', () => {
        it.each([
            [undefined],
            [''],
        ])('returns null when healExpression is %s', async (value) => {
            const auto = value === undefined ? {} : makeAuto({ healExpression: value });
            const result = await rollHealingForAction(auto, makePlayerStats(), campaignName);

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(rollExpressionMaximized).not.toHaveBeenCalled();
        });

        it('returns null when rollExpression returns null', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue(null);

            const result = await rollHealingForAction(makeAuto(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });

        it('returns null when rollExpressionMaximized returns null', async () => {
            hasHealingMaximization.mockReturnValue(true);
            rollExpressionMaximized.mockReturnValue(null);

            const result = await rollHealingForAction(makeAuto(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });
    });

    describe('dice rolling — normal mode', () => {
        it('returns correct result object from rollExpression', async () => {
            hasHealingMaximization.mockReturnValue(false);
            const mockResult = { total: 7, rolls: [3, 4] };
            rollExpression.mockReturnValue(mockResult);

            const result = await rollHealingForAction(makeAuto(), makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('2d8');
            expect(rollExpressionMaximized).not.toHaveBeenCalled();
            expect(result).toEqual({
                healAmount: 7,
                formula: '2d8',
                rolls: [3, 4],
            });
        });

        it('passes the healExpression string to rollExpression', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 15, rolls: [1, 2, 3, 4], modifier: 3 });

            await rollHealingForAction(makeAuto({ healExpression: '4d6+3' }), makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('4d6+3');
        });
    });

    describe('dice rolling — maximized mode', () => {
        it('calls rollExpressionMaximized when healing maximization is active', async () => {
            hasHealingMaximization.mockReturnValue(true);
            const mockResult = { total: 16, rolls: [8, 8] };
            rollExpressionMaximized.mockReturnValue(mockResult);

            const result = await rollHealingForAction(
                makeAuto({ healExpression: '2d8' }),
                makePlayerStats(),
                campaignName,
            );

            expect(hasHealingMaximization).toHaveBeenCalledWith(makePlayerStats());
            expect(rollExpressionMaximized).toHaveBeenCalledWith('2d8');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(result).toEqual({
                healAmount: 16,
                formula: '2d8',
                rolls: [8, 8],
            });
        });
    });

    describe('target resolution — isSelf', () => {
        it('uses player name as target when isSelf is true', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 5, rolls: [5] });
            getCombatContext.mockResolvedValue({ creatures: [] });

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Ally' }),
                campaignName,
                true,
            );

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                { creatures: [] },
                'Ally',
                5,
                expect.objectContaining({ name: 'Ally' }),
                campaignName,
            );
        });
    });

    describe('target resolution — not self', () => {
        it('uses combat context to find target via getTargetFromAttacker', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 6, rolls: [2, 4] });
            const cs = { creatures: [{ name: 'Goblin' }] };
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Paladin' }),
                campaignName,
                false,
            );

            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
            expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Paladin');
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                cs,
                'Goblin',
                6,
                expect.objectContaining({ name: 'Paladin' }),
                campaignName,
            );
        });

        it('falls back to player name when target is not found', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 9, rolls: [9] });
            const cs = { creatures: [] };
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue(null);

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Cleric' }),
                campaignName,
                false,
            );

            expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Cleric');
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                cs,
                'Cleric',
                9,
                expect.objectContaining({ name: 'Cleric' }),
                campaignName,
            );
        });

        it('falls back to player name when combat context is null', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 8, rolls: [3, 5] });
            getCombatContext.mockResolvedValue(null);

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Healer' }),
                campaignName,
                false,
            );

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                null,
                'Healer',
                8,
                expect.objectContaining({ name: 'Healer' }),
                campaignName,
            );
        });
    });
});

// ─── applyHealingDirectly ────────────────────────────────────────

describe('applyHealingDirectly', () => {
    const playerStats = makePlayerStats({ name: 'Hero', hitPoints: 30 });
    const targetName = 'Ally';

    describe('HP calculation — stored HP is a number', () => {
        it('heals by the full amount when under max', () => {
            getRuntimeValue.mockReturnValue(15);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result).toEqual({ maxHp: 30, newHp: 25, actualHeal: 10 });
        });

        it('caps HP at maxHitPoints', () => {
            getRuntimeValue.mockReturnValue(27);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(3);
        });

        it('returns zero actualHeal when already at max HP', () => {
            getRuntimeValue.mockReturnValue(30);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(0);
        });

        it('caps HP even when stored HP exceeds max', () => {
            getRuntimeValue.mockReturnValue(35);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(-5);
        });
    });

    describe('HP calculation — stored HP is missing or empty', () => {
        it('defaults to maxHitPoints when stored HP is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(0);
        });

        it('defaults to maxHitPoints when stored HP is empty string', () => {
            getRuntimeValue.mockReturnValue('');

            const result = applyHealingDirectly(playerStats, targetName, 5, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(0);
        });

        it('parses stored HP from a numeric string', () => {
            getRuntimeValue.mockReturnValue('20');

            const result = applyHealingDirectly(playerStats, targetName, 7, campaignName);

            expect(result.newHp).toBe(27);
            expect(result.actualHeal).toBe(7);
        });
    });

    describe('side effects', () => {
        it('persists new HP via setRuntimeValue', () => {
            getRuntimeValue.mockReturnValue(10);
            applyHealingDirectly(playerStats, targetName, 15, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'currentHitPoints', 25, campaignName);
        });

        it('dispatches combat-summary-updated event', () => {
            getRuntimeValue.mockReturnValue(10);
            const dispatchSpy = createDispatchSpy();

            applyHealingDirectly(playerStats, targetName, 5, campaignName);

            expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
            const event = dispatchSpy.mock.calls[0][0];
            expect(event.type).toBe('combat-summary-updated');
        });

        it('applies healing via combat context when available', async () => {
            getRuntimeValue.mockReturnValue(10);
            const cs = { creatures: [{ name: 'Ally' }] };
            getCombatContext.mockResolvedValue(cs);

            applyHealingDirectly(playerStats, targetName, 5, campaignName);

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Ally', 5, campaignName);
        });

        it('skips combat context healing when context is null', async () => {
            getRuntimeValue.mockReturnValue(10);
            getCombatContext.mockResolvedValue(null);

            applyHealingDirectly(playerStats, targetName, 5, campaignName);

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('handles zero healing amount', () => {
            getRuntimeValue.mockReturnValue(10);

            const result = applyHealingDirectly(playerStats, targetName, 0, campaignName);

            expect(result.newHp).toBe(10);
            expect(result.actualHeal).toBe(0);
        });

        it('respects different maxHitPoints from playerStats', () => {
            getRuntimeValue.mockReturnValue(5);
            const lowHpPlayer = makePlayerStats({ hitPoints: 20 });

            const result = applyHealingDirectly(lowHpPlayer, targetName, 15, campaignName);

            expect(result.maxHp).toBe(20);
            expect(result.newHp).toBe(20);
            expect(result.actualHeal).toBe(15);
        });
    });
});

// ─── logHealingToSSE ─────────────────────────────────────────────

describe('logHealingToSSE', () => {
    it('posts correct hp_change log entry with all fields', () => {
        const info = {
            targetName: 'Goblin',
            sourceName: 'Cleric',
            actualHeal: 12,
            newHp: 27,
            maxHp: 30,
        };

        logHealingToSSE(campaignName, info);

        expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
            type: 'hp_change',
            targetName: 'Goblin',
            sourceName: 'Cleric',
            delta: 12,
            currentHp: 27,
            maxHp: 30,
            isHealing: true,
            isUnconscious: false,
        });
    });

    it('dispatches combat-summary-updated event', () => {
        const dispatchSpy = createDispatchSpy();

        logHealingToSSE(campaignName, {
            targetName: 'T',
            sourceName: 'S',
            actualHeal: 5,
            newHp: 20,
            maxHp: 30,
        });

        expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
        const event = dispatchSpy.mock.calls[0][0];
        expect(event.type).toBe('combat-summary-updated');
    });

    it('does not pass extra fields from info object to log entry', () => {
        const info = {
            targetName: 'T',
            sourceName: 'S',
            actualHeal: 3,
            newHp: 10,
            maxHp: 20,
            someExtraProp: 'should not appear',
        };

        logHealingToSSE(campaignName, info);

        const call = postLogEntry.mock.calls[0][1];
        expect(call).not.toHaveProperty('someExtraProp');
    });
});
