// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPrayerOfHealing } from './prayerOfHealingService.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../combat/rangeCheck.js', () => ({
    isDistanceInRange: vi.fn((dist, range) => dist <= range),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
    markFortifiedHealthUsed: vi.fn(),
    hasHealingMaximization: vi.fn(() => false),
    hasHealingMaximizationForTarget: vi.fn(() => false),
}));

import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';
import {
    resolveHealingBonusesWithDetails,
    markFortifiedHealthUsed,
    hasHealingMaximization,
} from '../../combat/automation/automationService.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const CLERIC_STATS = {
    name: 'Cleric',
    spellAbilities: {
        spellCastingAbility: 'Wisdom',
        modifier: 3,
    },
    proficiency: 3,
    level: 5,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
};
const CLIC_POS = { gridX: 1, gridY: 1 };
const DEFAULT_RANGE_FT = 30;
const DEFAULT_DISTANCE_FT = 10;
const DEFAULT_ROLL_TOTAL = 18;

function buildDefaultCombatContext() {
    return {
        players: [
            { name: 'Cleric', ...CLIC_POS },
            { name: 'Ally1', gridX: 2, gridY: 1 },
            { name: 'Ally2', gridX: 3, gridY: 1 },
            { name: 'Ally3', gridX: 4, gridY: 1 },
        ],
        creatures: [
            { name: 'Ally1', maxHp: 50 },
            { name: 'Ally2', maxHp: 30 },
            { name: 'Ally3', maxHp: 40 },
        ],
        placedItems: [],
        round: 1,
    };
}

function buildPrayerSpell(slotLevel) {
    return {
        name: 'Prayer of Healing',
        level: slotLevel ?? 2,
        range: '30 feet',
        heal_at_slot_level: {
            2: '2d8 + MOD',
            3: '3d8 + MOD',
            4: '4d8 + MOD',
        },
    };
}

function mockDefaults(rollTotal = DEFAULT_ROLL_TOTAL) {
    rollExpression.mockReturnValue({ total: rollTotal, rolls: [9, 9] });
    rollExpressionMaximized.mockReturnValue({ total: rollTotal, rolls: [9, 9] });
    getCombatContext.mockResolvedValue(buildDefaultCombatContext());
    rangeToFeet.mockReturnValue(DEFAULT_RANGE_FT);
    getDistanceFeet.mockReturnValue(DEFAULT_DISTANCE_FT);
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 10;
        return null;
    });
    applyHealingToTarget.mockReturnValue({ actualHeal: rollTotal, oldHp: 10, newHp: 28 });
    addEntry.mockResolvedValue(undefined);
    setRuntimeValue.mockReturnValue(undefined);
    window.dispatchEvent = vi.fn();
}

describe('prayerOfHealingService results/side-effects/errors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDefaults();
    });

    describe('result structure', () => {
        it('returns correct result structure with targets, formula, and totalHealed', async () => {
            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(2),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toHaveProperty('targets');
            expect(result).toHaveProperty('formula');
            expect(result).toHaveProperty('totalHealed');
            expect(Array.isArray(result.targets)).toBe(true);
            expect(typeof result.totalHealed).toBe('number');
        });

        it('calculates totalHealed as sum of individual heals', async () => {
            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const calculatedTotal = result.targets.reduce((sum, r) => sum + r.healAmount, 0);
            expect(result.totalHealed).toBe(calculatedTotal);
        });

        it('includes the correct formula based on slot level', async () => {
            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(2),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.formula).toBe('2d8 + 3');
        });

        it('uses formula from heal_at_slot_level override', async () => {
            const spell = {
                name: 'Prayer of Healing',
                level: 3,
                range: '30 feet',
                heal_at_slot_level: { 3: '5d8 + MOD' },
            };

            const result = await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.formula).toBe('5d8 + 3');
        });

        it('rolls separately for each target', async () => {
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledTimes(3);
        });

        it('includes per-target rolls in result', async () => {
            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets[0]).toHaveProperty('rolls');
            expect(result.targets[0]).toHaveProperty('rawTotal');
        });
    });

    describe('side effects', () => {
        it('calls applyHealingToTarget with correct arguments when actualHeal > 0', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                expect.objectContaining({ players: expect.any(Array) }),
                'Ally1',
                expect.any(Number),
                CAMPAIGN_NAME,
            );
        });

        it('posts hp_change log entry for each healed target', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const hpChangeCalls = vi.mocked(addEntry).mock.calls.filter(
                call => call[1].type === 'hp_change',
            );
            expect(hpChangeCalls.length).toBe(3);
            expect(hpChangeCalls[0][1]).toMatchObject({
                type: 'hp_change',
                targetName: 'Ally1',
                isHealing: true,
                sourceName: 'Cleric',
                note: 'Prayer of Healing',
            });
        });

        it('does not post prayer_of_healing log entries', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const prayerCalls = vi.mocked(addEntry).mock.calls.filter(
                call => call[1].type === 'prayer_of_healing',
            );
            expect(prayerCalls.length).toBe(0);
        });

        it('dispatches combat-summary-updated event', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(window.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'combat-summary-updated' }),
            );
        });

        it('marks Fortified Health used when applicable', async () => {
            resolveHealingBonusesWithDetails.mockReturnValue({
                totalBonus: 5,
                details: [{ name: 'Fortified Health', amount: 5 }],
            });

            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(markFortifiedHealthUsed).toHaveBeenCalledWith(CLERIC_STATS, CAMPAIGN_NAME);
        });
    });

    describe('error resilience', () => {
        it('returns empty results when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeDefined();
            expect(result.targets).toEqual([]);
            expect(result.totalHealed).toBe(0);
        });

        it('handles applyHealingToTarget returning null without crashing', async () => {
            applyHealingToTarget.mockReturnValue(null);

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeDefined();
            expect(result.targets.length).toBe(3);
        });

        it('survives addEntry rejecting without throwing', async () => {
            addEntry.mockRejectedValue(new Error('Log failed'));

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeDefined();
        });

        it('returns null when campaignName is undefined', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                undefined,
                MAP_NAME,
            );

            expect(result).toBeNull();
        });

        it('handles undefined metaCtx gracefully', async () => {
            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                undefined,
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeDefined();
        });

        it('uses maximized rolls when hasHealingMaximization', async () => {
            hasHealingMaximization.mockReturnValue(true);
            rollExpressionMaximized.mockReturnValue({ total: 20, rolls: [10, 10] });

            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpressionMaximized).toHaveBeenCalledWith('2d8 + 3');
            expect(rollExpression).not.toHaveBeenCalled();
        });
    });
});
