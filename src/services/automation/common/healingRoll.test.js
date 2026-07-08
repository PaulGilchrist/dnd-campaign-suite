// @cleaned-by-ai
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

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

const { addEntry } = await import('../../ui/logService.js');

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

        it('returns null when dice roll returns null', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue(null);

            const result = await rollHealingForAction(makeAuto(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });

        it('returns null when maximized dice roll returns null', async () => {
            hasHealingMaximization.mockReturnValue(true);
            rollExpressionMaximized.mockReturnValue(null);

            const result = await rollHealingForAction(makeAuto(), makePlayerStats(), campaignName);

            expect(result).toBeNull();
        });
    });

    describe('dice rolling', () => {
        it('returns correct result object from rollExpression in normal mode', async () => {
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

    describe('target resolution', () => {
        it('uses player name as target when isSelf is true', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Ally' }),
                campaignName,
                true,
            );

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
        });

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
        });

        it('falls back to player name when target is not found or combat context is null', async () => {
            hasHealingMaximization.mockReturnValue(false);
            rollExpression.mockReturnValue({ total: 9, rolls: [9] });
            getCombatContext.mockResolvedValue(null);

            await rollHealingForAction(
                makeAuto(),
                makePlayerStats({ name: 'Cleric' }),
                campaignName,
                false,
            );

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
        });
    });
});

// ─── applyHealingDirectly ────────────────────────────────────────

describe('applyHealingDirectly', () => {
    const playerStats = makePlayerStats({ name: 'Hero', hitPoints: 30 });
    const targetName = 'Ally';

    describe('HP calculation', () => {
        it('heals by the full amount when under max', () => {
            getRuntimeValue.mockReturnValue(15);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result).toEqual({ maxHp: 30, newHp: 25, actualHeal: 10 });
        });

        it('caps HP at maxHitPoints and calculates actualHeal', () => {
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

        it('defaults to maxHitPoints when stored HP is null or empty string', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName);

            expect(result.newHp).toBe(30);
            expect(result.actualHeal).toBe(0);
        });

        it('parses stored HP from a numeric string', () => {
            getRuntimeValue.mockReturnValue('20');

            const result = applyHealingDirectly(playerStats, targetName, 7, campaignName);

            expect(result.newHp).toBe(27);
            expect(result.actualHeal).toBe(7);
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

    describe('side effects', () => {
        it('persists new HP via setRuntimeValue', () => {
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

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'hp_change',
            targetName: 'Goblin',
            sourceName: 'Cleric',
            delta: 12,
            currentHp: 27,
            maxHp: 30,
            isHealing: true,
            isUnconscious: false,
            rollInfo: null,
            maximizeHealingDice: false,
        });
    });

    it('dispatches combat-summary-updated event', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

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

    it('dispatches healing-popup event when healingName is provided', () => {
        const customEventSpy = vi.spyOn(window, 'CustomEvent');
        logHealingToSSE(campaignName, {
            targetName: 'Goblin',
            sourceName: 'Healing Hands',
            actualHeal: 24,
            newHp: 49,
            maxHp: 163,
            rollInfo: '6d4=24 (maximized)',
            maximize: true,
            healingName: 'Healing Hands',
            remainingUses: 0,
            maxUses: 1,
        });

        expect(addEntry).toHaveBeenCalledTimes(1);
        const popupEvent = customEventSpy.mock.calls.find(
            call => call[0] === 'healing-popup'
        );
        expect(popupEvent).toBeDefined();
        expect(popupEvent[1].detail.popupText).toContain('Healing Hands on Goblin');
        expect(popupEvent[1].detail.popupText).toContain('24');
        expect(popupEvent[1].detail.popupText).toContain('maximized');
        expect(popupEvent[1].detail.popupText).toContain('no uses remaining');
        customEventSpy.mockRestore();
    });

    it('dispatches healing-popup event without uses info when not provided', () => {
        const customEventSpy = vi.spyOn(window, 'CustomEvent');
        logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Cure Wounds',
            actualHeal: 8,
            newHp: 28,
            maxHp: 30,
            rollInfo: '1d8+1=8 (5, 3)',
            maximize: false,
            healingName: 'Cure Wounds',
        });

        expect(addEntry).toHaveBeenCalledTimes(1);
        const popupEvent = customEventSpy.mock.calls.find(
            call => call[0] === 'healing-popup'
        );
        expect(popupEvent).toBeDefined();
        expect(popupEvent[1].detail.popupText).toContain('Cure Wounds on Ally');
        expect(popupEvent[1].detail.popupText).toContain('Regained 8 HP');
        customEventSpy.mockRestore();
    });
});
