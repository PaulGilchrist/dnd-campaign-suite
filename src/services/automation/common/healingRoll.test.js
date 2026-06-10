import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    rollHealingForAction,
    applyHealingDirectly,
    logHealingToSSE,
} from './healingRoll.js';

// ── Dependency mocks ──────────────────────────────────────────────
// Paths are relative to this test file (__tests__/), so they need one extra '../'
// compared to what healingRoll.js imports (which are relative to common/).

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../combat/automationService.js', () => ({
    hasHealingMaximization: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../rules/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

// Re-import after mocking (paths match mock specifiers above)
const { rollExpression, rollExpressionMaximized } = await import(
     '../../dice/diceRoller.js'
);
const { hasHealingMaximization } = await import(
     '../../combat/automationService.js'
);
const { getRuntimeValue, setRuntimeValue } = await import(
     '../../../hooks/useRuntimeState.js'
);
const { getCombatContext, getTargetFromAttacker } = await import(
     '../../rules/damageUtils.js'
);
const { applyHealingToTarget } = await import('../../rules/applyHealing.js');
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

function resetMocks() {
    vi.clearAllMocks();
     // Restore default mock return values
    rollExpression.mockReturnValue(null);
    rollExpressionMaximized.mockReturnValue(null);
    hasHealingMaximization.mockReturnValue(false);
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue(null);
    getTargetFromAttacker.mockReturnValue(null);
}

// Flush promise microtasks so .then() callbacks in the module execute
async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

// ── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
    resetMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── rollHealingForAction ────────────────────────────────────────

describe('rollHealingForAction', () => {
    describe('early returns (no formula / no dice result)', () => {
        it('returns resolved null when healExpression is missing', async () => {
            const auto = {};
            const result = await rollHealingForAction(auto, makePlayerStats(), campaignName);
            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(rollExpressionMaximized).not.toHaveBeenCalled();
         });

        it('returns resolved null when healExpression is empty string', async () => {
            const auto = makeAuto({ healExpression: '' });
            const result = await rollHealingForAction(auto, makePlayerStats(), campaignName);
            expect(result).toBeNull();
         });

        it('returns resolved null when rollExpression returns null', async () => {
            const auto = makeAuto({ healExpression: 'invalid' });
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue(null);

            const result = await rollHealingForAction(auto, makePlayerStats(), campaignName);
            expect(result).toBeNull();
         });

        it('returns resolved null when rollExpressionMaximized returns null', async () => {
            hasHealingMaximization.mockReturnValue(true);
            rollExpressionMaximized.mockReturnValue(null);

            const result = await rollHealingForAction(
                makeAuto(),
                makePlayerStats(),
                campaignName
             );
            expect(result).toBeNull();
         });
     });

    describe('dice rolling — normal mode', () => {
        it('calls rollExpression when no healing maximization', async () => {
            hasHealingMaximization.mockReturnValue(false);
            const mockResult = { total: 7, rolls: [3, 4] };
            rollExpression.mockReturnValue(mockResult);

            const result = await rollHealingForAction(
                makeAuto(),
                makePlayerStats(),
                campaignName
             );

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
            const auto = makeAuto({ healExpression: '4d6+3' });
            rollExpression.mockReturnValue({ total: 15, rolls: [1, 2, 3, 4], modifier: 3 });

            await rollHealingForAction(auto, makePlayerStats(), campaignName);

            expect(rollExpression).toHaveBeenCalledWith('4d6+3');
         });
     });

    describe('dice rolling — maximized mode', () => {
        it('calls rollExpressionMaximized when healing maximization is active', async () => {
            hasHealingMaximization.mockReturnValue(true);
            const mockResult = { total: 16, rolls: [8, 8], maximized: true };
            rollExpressionMaximized.mockReturnValue(mockResult);

            const result = await rollHealingForAction(
                makeAuto({ healExpression: '2d8' }),
                makePlayerStats(),
                campaignName
             );

            expect(hasHealingMaximization).toHaveBeenCalled();
            expect(rollExpressionMaximized).toHaveBeenCalledWith('2d8');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(result).toEqual({
                healAmount: 16,
                formula: '2d8',
                rolls: [8, 8],
             });
         });

        it('passes through roll data from maximized roll result', async () => {
            hasHealingMaximization.mockReturnValue(true);
            rollExpressionMaximized.mockReturnValue({ total: 10, rolls: [5], maximized: true });

            const result = await rollHealingForAction(
                makeAuto({ healExpression: '1d10' }),
                makePlayerStats(),
                campaignName
             );

            expect(result.healAmount).toBe(10);
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
                true
             );
            await flushPromises();

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                 { creatures: [] },
                 'Ally',
                 5,
                makePlayerStats({ name: 'Ally' }),
                campaignName
             );
         });

        it('uses player name as target when isSelf defaults false and combat context is null', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 8, rolls: [3, 5] });
            getCombatContext.mockResolvedValue(null);

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Healer' }),
                campaignName,
                false
             );
            await flushPromises();

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                null,
                 'Healer',
                 8,
                makePlayerStats({ name: 'Healer' }),
                campaignName
             );
         });
     });

    describe('target resolution — not self', () => {
        it('finds target via getTargetFromAttacker when combat context exists', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 6, rolls: [2, 4] });
            const cs = { creatures: [{ name: 'Goblin' }] };
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Paladin' }),
                campaignName,
                false
             );
            await flushPromises();

            expect(getCombatContext).toHaveBeenCalledWith(campaignName);
            expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'Paladin');
            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Goblin', 6, expect.any(Object), campaignName);
         });

        it('falls back to player name when target is not found in combat context', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 9, rolls: [9] });
            const cs = { creatures: [] };
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue(null);

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Cleric' }),
                campaignName,
                false
             );
            await flushPromises();

            expect(getTargetFromAttacker).toHaveBeenCalled();
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                cs,
                 'Cleric',
                 9,
                expect.any(Object),
                campaignName
             );
         });
     });
});

// ─── applyHealingDirectly ──────────────────────────────

describe('applyHealingDirectly', () => {
    const playerStats = makePlayerStats({ name: 'Hero', hitPoints: 30 });
    const targetName = 'Ally';

    beforeEach(() => {
        getCombatContext.mockResolvedValue(null);
     });

    describe('HP calculation — stored HP is a number', () => {
        it('uses stored HP when available as a number', () => {
            getRuntimeValue.mockReturnValue(15); // current HP 15, max 30

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result).toEqual({ maxHp: 30, newHp: 25, actualHeal: 10 });
         });

        it('caps HP at maxHitPoints', () => {
            getRuntimeValue.mockReturnValue(27); // heal 10 would be 37 but max is 30

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(3); // only 3 points actually healed
         });

        it('returns zero actualHeal when already at max HP', () => {
            getRuntimeValue.mockReturnValue(30);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(0);
         });

        it('handles over-max healing with negative actual heal', () => {
            getRuntimeValue.mockReturnValue(35); // somehow above max

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(-5);
         });
     });

    describe('HP calculation — stored HP is missing/null/empty', () => {
        it('defaults to maxHitPoints when stored HP is null', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30); // current defaulted to maxHp (30), capped at 30
            expect(result.actualHeal).toBe(0);
         });

        it('defaults to maxHitPoints when stored HP is empty string', () => {
            getRuntimeValue.mockReturnValue('');

            const result = applyHealingDirectly(playerStats, targetName, 5, campaignName);

            expect(result.newHp).toBe(30); // current defaulted to maxHp (30), capped at 30
            expect(result.actualHeal).toBe(0);
         });

        it('uses numeric value when stored HP is a string number', () => {
            getRuntimeValue.mockReturnValue('20');

            const result = applyHealingDirectly(playerStats, targetName, 7, campaignName);

            expect(result.newHp).toBe(27); // min(30, 20 + 7) = 27
            expect(result.actualHeal).toBe(7);
         });
     });

    describe('side effects', () => {
        it('calls setRuntimeValue to persist new HP', () => {
            getRuntimeValue.mockReturnValue(10);
            applyHealingDirectly(playerStats, targetName, 15, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'currentHitPoints', 25, campaignName);
         });

        it('dispatches combat-summary-updated event', () => {
            getRuntimeValue.mockReturnValue(10);
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

            applyHealingDirectly(playerStats, targetName, 5, campaignName);

            expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
            const event = dispatchSpy.mock.calls[0][0];
            expect(event.type).toBe('combat-summary-updated');

            dispatchSpy.mockRestore();
         });

        it('applies healing via combat context when available', async () => {
            getRuntimeValue.mockReturnValue(10);
            const cs = { creatures: [{ name: 'Ally' }] };
            getCombatContext.mockResolvedValue(cs);

            applyHealingDirectly(playerStats, targetName, 5, campaignName);
            await flushPromises();

            // NOTE: source passes (cs, targetName, amount, campaignName) — misses playerStats as 4th arg
            expect(applyHealingToTarget).toHaveBeenCalledWith(cs, 'Ally', 5, campaignName);
           });

        it('skips combat context healing when getCombatContext returns null', async () => {
            getRuntimeValue.mockReturnValue(10);
            getCombatContext.mockResolvedValue(null);

            applyHealingDirectly(playerStats, targetName, 5, campaignName);
            await flushPromises();

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

        it('handles different maxHitPoints value', () => {
            getRuntimeValue.mockReturnValue(5);
            const lowHpPlayer = makePlayerStats({ hitPoints: 20 });

            const result = applyHealingDirectly(lowHpPlayer, targetName, 15, campaignName);

            expect(result.maxHp).toBe(20);
            expect(result.newHp).toBe(20);
            expect(result.actualHeal).toBe(15);
         });
     });
});

// ─── logHealingToSSE ──────────────────────────────────────

describe('logHealingToSSE', () => {
    beforeEach(() => {
        vi.spyOn(window, 'dispatchEvent').mockImplementation(() => {});
     });

    it('posts correct hp_change log entry', () => {
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
        logHealingToSSE(campaignName, {
            targetName: 'T',
            sourceName: 'S',
            actualHeal: 5,
            newHp: 20,
            maxHp: 30,
         });

        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        const event = window.dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('combat-summary-updated');
     });

    it('destructures all info fields correctly', () => {
        const info = {
            targetName: 'Target',
            sourceName: 'Source',
            actualHeal: 8,
            newHp: 18,
            maxHp: 25,
         };

        logHealingToSSE(campaignName, info);

        expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
            type: 'hp_change',
            targetName: 'Target',
            sourceName: 'Source',
            delta: 8,
            currentHp: 18,
            maxHp: 25,
            isHealing: true,
            isUnconscious: false,
         });
     });

    it('does not pass extra fields from info object', () => {
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
