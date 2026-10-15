// @maintained-by-ai
// Unit coverage for the LIVE exports of healingRoll.js: applyHealingDirectly +
// logHealingToSSE (heal choke points used by healingHandler, bonusAttacksHandler,
// initiativeHandler, postCastHealService, CharActionModals).
//
// Scope notes (test-suite trim, 2026-10-15):
// - rollHealingForAction tests REMOVED: the export has zero call sites repo-wide
//   (dead code — recommend deleting it from healingRoll.js along with its imports
//   of diceRoller/automationService/damageUtils/applyHealing, kept here only as
//   load guards).
// - Heal-block refusal via the REAL applyHealingDirectly is covered in
//   src/services/rules/combat/healingBlock.test.js (not duplicated here).
// - Infernal Wound close/bleed logic is covered in infernalWoundService.test.js;
//   here we only assert the heal-seam wiring (called iff actualHeal > 0).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    applyHealingDirectly,
    logHealingToSSE,
} from './healingRoll.js';

// ── Dependency mocks ──────────────────────────────────────────────

// Live behavior under test uses: useRuntimeState, logService, healingBlock,
// infernalWoundService. The remaining mocks are load guards for healingRoll.js
// top-level imports consumed only by the now-untested dead export.

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    hasHealingMaximization: vi.fn(),
    hasHealingMaximizationForTarget: vi.fn(),
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

vi.mock('../../rules/combat/healingBlock.js', () => ({
    isHealingBlocked: vi.fn(),
    getHealingBlockEffect: vi.fn(),
    blockedHealResult: vi.fn(),
}));

vi.mock('../../rules/features/infernalWoundService.js', () => ({
    removeInfernalWoundOnHeal: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Re-import after mocking
const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../hooks/runtime/useRuntimeState.js'
);
const { isHealingBlocked } = await import('../../rules/combat/healingBlock.js');
const { removeInfernalWoundOnHeal } = await import(
    '../../rules/features/infernalWoundService.js'
);
const { addEntry } = await import('../../ui/logService.js');

// ── Test fixtures ─────────────────────────────────────────────────

const campaignName = 'test-campaign';

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

// Collect healing-popup event details fired while fn() runs.
function popupsDuring(fn) {
    const popups = [];
    const handler = (e) => popups.push(e.detail);
    window.addEventListener('healing-popup', handler);
    try {
        fn();
    } finally {
        window.removeEventListener('healing-popup', handler);
    }
    return popups;
}

// ── Setup ─────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    isHealingBlocked.mockReturnValue(null);
    removeInfernalWoundOnHeal.mockReturnValue(Promise.resolve(false));
    addEntry.mockReturnValue(Promise.resolve());
});

// ─── applyHealingDirectly ────────────────────────────────────────

describe('applyHealingDirectly', () => {
    const playerStats = makePlayerStats({ name: 'Hero', hitPoints: 30 });
    const targetName = 'Ally';

    describe('HP calculation', () => {
        it.each([
            // [storedHp, amount, expectedNewHp, expectedActualHeal]
            [15, 10, 25, 10], // full heal under max
            [27, 10, 30, 3],  // capped at max, partial heal
            [30, 10, 30, 0],  // already at max — nothing healed
        ])('stored %i + %i → newHp %i (actualHeal %i)', (storedHp, amount, newHp, actualHeal) => {
            getRuntimeValue.mockReturnValue(storedHp);

            const result = applyHealingDirectly(playerStats, targetName, amount, campaignName);

            expect(result).toEqual({ maxHp: 30, newHp, actualHeal });
        });

        it.each([null, ''])('defaults stored HP %s to maxHitPoints', (storedHp) => {
            getRuntimeValue.mockReturnValue(storedHp);

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

        it('targetMaxHp argument overrides playerStats.hitPoints', () => {
            getRuntimeValue.mockReturnValue(100);

            const result = applyHealingDirectly(playerStats, targetName, 10, campaignName, 143);

            expect(result.maxHp).toBe(143);
            expect(result.newHp).toBe(110);
            expect(result.actualHeal).toBe(10);

            // cap uses targetMaxHp, not playerStats.hitPoints (30)
            getRuntimeValue.mockReturnValue(140);
            const capped = applyHealingDirectly(playerStats, targetName, 10, campaignName, 143);
            expect(capped.maxHp).toBe(143);
            expect(capped.newHp).toBe(143);
            expect(capped.actualHeal).toBe(3);
        });
    });

    describe('side effects', () => {
        it('persists new HP via setRuntimeValue', () => {
            getRuntimeValue.mockReturnValue(10);
            applyHealingDirectly(playerStats, targetName, 15, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'currentHitPoints', 25, campaignName);
        });

        it('consults the heal-block choke point for positive heals', () => {
            getRuntimeValue.mockReturnValue(10);
            applyHealingDirectly(playerStats, targetName, 15, campaignName);

            expect(isHealingBlocked).toHaveBeenCalledWith(targetName, campaignName, 15);
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

        it('closes Infernal Wound on positive heal only', () => {
            getRuntimeValue.mockReturnValue(10);
            applyHealingDirectly(playerStats, targetName, 5, campaignName);
            expect(removeInfernalWoundOnHeal).toHaveBeenCalledWith(targetName, campaignName);

            vi.clearAllMocks();
            getRuntimeValue.mockReturnValue(30);
            applyHealingDirectly(playerStats, targetName, 5, campaignName);
            expect(removeInfernalWoundOnHeal).not.toHaveBeenCalled();
        });
    });
});

// ─── logHealingToSSE ─────────────────────────────────────────────

describe('logHealingToSSE', () => {
    it('posts correct hp_change log entry with all fields', () => {
        logHealingToSSE(campaignName, {
            targetName: 'Goblin',
            sourceName: 'Cleric',
            actualHeal: 12,
            newHp: 27,
            maxHp: 30,
        });

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

    it('passes bonusDetails through to the log entry', () => {
        logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Divine Favor',
            actualHeal: 8,
            newHp: 28,
            maxHp: 30,
            rollInfo: '1d8=8',
            bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
        });

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            rollInfo: '1d8=8',
            bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
        }));
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
        dispatchSpy.mockRestore();
    });

    it('dispatches healing-popup with maximized note and no-uses suffix', () => {
        const popups = popupsDuring(() => logHealingToSSE(campaignName, {
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
        }));

        expect(popups).toHaveLength(1);
        expect(popups[0].popupText).toContain('Healing Hands on Goblin');
        expect(popups[0].popupText).toContain('24');
        expect(popups[0].popupText).toContain('maximized');
        expect(popups[0].popupText).toContain('no uses remaining');
    });

    it('popup without rollInfo/maximize defaults to null/false in detail', () => {
        const popups = popupsDuring(() => logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Cure Wounds',
            actualHeal: 8,
            newHp: 28,
            maxHp: 30,
            healingName: 'Cure Wounds',
        }));

        expect(popups).toHaveLength(1);
        expect(popups[0].popupText).toContain('Cure Wounds on Ally');
        expect(popups[0].popupText).toContain('Regained 8 HP');
        expect(popups[0].rollInfo).toBeNull();
        expect(popups[0].maximizeHealingDice).toBe(false);
    });

    it('includes bonusDetails suffix in popup text', () => {
        const popups = popupsDuring(() => logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Divine Favor',
            actualHeal: 8,
            newHp: 28,
            maxHp: 30,
            rollInfo: '1d8=8',
            maximize: false,
            healingName: 'Divine Favor',
            bonusDetails: [{ amount: 3, name: 'Divine Favor' }],
        }));

        expect(popups).toHaveLength(1);
        expect(popups[0].popupText).toContain('plus 3 [Divine Favor]');
    });

    it('formats uses remaining singular and plural', () => {
        const popups = popupsDuring(() => {
            logHealingToSSE(campaignName, {
                targetName: 'Ally',
                sourceName: 'Lay on Hands',
                actualHeal: 5,
                newHp: 25,
                maxHp: 30,
                healingName: 'Lay on Hands',
                remainingUses: 1,
            });
            logHealingToSSE(campaignName, {
                targetName: 'Friend',
                sourceName: 'Lay on Hands',
                actualHeal: 5,
                newHp: 25,
                maxHp: 30,
                healingName: 'Lay on Hands',
                remainingUses: 3,
            });
        });

        expect(popups).toHaveLength(2);
        expect(popups[0].popupText).toContain('(1 use remaining)');
        expect(popups[1].popupText).toContain('(3 uses remaining)');
    });

    it('shows "Already at full HP" when actualHeal is 0', () => {
        const popups = popupsDuring(() => logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Cure Wounds',
            actualHeal: 0,
            newHp: 30,
            maxHp: 30,
            healingName: 'Cure Wounds',
        }));

        expect(popups).toHaveLength(1);
        expect(popups[0].popupText).toContain('Already at full HP');
    });

    it('skips popup when skipPopup is true', () => {
        const popups = popupsDuring(() => logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Cure Wounds',
            actualHeal: 7,
            newHp: 27,
            maxHp: 30,
            healingName: 'Cure Wounds',
            skipPopup: true,
        }));

        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(popups).toHaveLength(0);
    });

    it('logs error when addEntry rejects', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
        addEntry.mockReturnValue(Promise.reject(new Error('log fail')));

        logHealingToSSE(campaignName, {
            targetName: 'Ally',
            sourceName: 'Cure Wounds',
            actualHeal: 5,
            newHp: 25,
            maxHp: 30,
        });

        await new Promise(r => setTimeout(r, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith('[healingRoll] Error:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
});
