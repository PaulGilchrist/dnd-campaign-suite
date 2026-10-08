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
import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const CLERIC_STATS = {
    name: 'Cleric',
    rules: '2024',
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

describe('prayerOfHealingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDefaults();
    });

    describe('spell name validation', () => {
        it('returns null for non-Prayer of Healing spells', async () => {
            const result = await triggerPrayerOfHealing(
                { name: 'Cure Wounds', level: 1 },
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
            expect(getCombatContext).not.toHaveBeenCalled();
        });

        it('returns null when spell name is missing or empty', async () => {
            const result = await triggerPrayerOfHealing(
                { level: 1 },
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
        });
    });

    describe('combat context failures', () => {
        it('returns null when getCombatContext resolves to falsy', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
        });
    });

    describe('target selection', () => {
        it('returns noTargets when there are no creatures', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', ...CLIC_POS }],
                creatures: [],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('throws when creatures is not an array', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', ...CLIC_POS }],
                creatures: null,
                placedItems: [],
            });

            await expect(triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            )).rejects.toThrow('Expected array, got null');
        });

        it('excludes the caster from targets', async () => {
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', ...CLIC_POS },
                    { name: 'Ally1', gridX: 2, gridY: 1 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 60 },
                    { name: 'Ally1', maxHp: 50 },
                ],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.every(t => t.targetName !== 'Cleric')).toBe(true);
            expect(result.targets.length).toBe(1);
        });

        it('SP-091: stamps the Long-Rest latch + short-rest benefit per 2024 target', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(setRuntimeBatch).toHaveBeenCalledWith(
                'Ally1',
                expect.objectContaining({ prayerOfHealingAffected: 1, channelDivinityCharges: null }),
                CAMPAIGN_NAME,
            );
        });

        it('SP-091: refuses targets already affected, 5e twin stays inert', async () => {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'prayerOfHealingAffected') return name === 'Ally1' ? 1 : undefined;
                return null;
            });

            const refused = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(refused.targets.some(t => t.targetName === 'Ally1')).toBe(false);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, expect.objectContaining({
                automationType: 'prayer_of_healing_refused',
            }));

            getRuntimeValue.mockImplementation((name, prop) => {
                if (prop === 'currentHitPoints') return 10;
                if (prop === 'prayerOfHealingAffected') return name === 'Ally1' ? 1 : undefined;
                return null;
            });
            const twin = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                { ...CLERIC_STATS, rules: '5e' },
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(twin.targets.some(t => t.targetName === 'Ally1')).toBe(true);
        });

        it('limits targets to 5 maximum', async () => {
            const players = [{ name: 'Cleric', ...CLIC_POS }];
            const creatures = [];
            for (let i = 1; i <= 10; i++) {
                creatures.push({ name: `Ally${i}`, maxHp: 50 });
                players.push({ name: `Ally${i}`, gridX: i + 1, gridY: 1 });
            }
            getCombatContext.mockResolvedValue({ players, creatures, placedItems: [] });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.length).toBe(5);
        });

        it('filters creatures outside spell range', async () => {
            getDistanceFeet.mockReturnValue(50);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', ...CLIC_POS },
                    { name: 'Ally1', gridX: 11, gridY: 1 },
                ],
                creatures: [{ name: 'Ally1', maxHp: 50 }],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(30);

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('sorts targets by distance closest first', async () => {
            getDistanceFeet.mockImplementation((_a, pos2) => {
                if (pos2.gridX === 3) return 10;
                if (pos2.gridX === 5) return 20;
                if (pos2.gridX === 2) return 5;
                return 50;
            });

            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', ...CLIC_POS },
                    { name: 'FarAlly', gridX: 3, gridY: 1 },
                    { name: 'MidAlly', gridX: 5, gridY: 1 },
                    { name: 'CloseAlly', gridX: 2, gridY: 1 },
                ],
                creatures: [
                    { name: 'FarAlly', maxHp: 50 },
                    { name: 'MidAlly', maxHp: 50 },
                    { name: 'CloseAlly', maxHp: 50 },
                ],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets[0].targetName).toBe('CloseAlly');
            expect(result.targets[1].targetName).toBe('FarAlly');
            expect(result.targets[2].targetName).toBe('MidAlly');
        });

        it('uses placedItems as fallback for creature grid positions', async () => {
            getDistanceFeet.mockReturnValue(10);
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', ...CLIC_POS }],
                creatures: [{ name: 'PlacedCreature', maxHp: 50 }],
                placedItems: [{ name: 'PlacedCreature', gridX: 3, gridY: 1 }],
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('PlacedCreature');
        });

        it('includes targets with null grid coordinates when caster has grid position', async () => {
            getDistanceFeet.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', ...CLIC_POS }],
                creatures: [{ name: 'Ally1', maxHp: 50, gridX: null, gridY: null }],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('Ally1');
        });
    });

    describe('healing calculation', () => {
        it('returns null when spell has no heal_at_slot_level', async () => {
            const spell = { name: 'Prayer of Healing', level: 2 };

            const result = await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('uses heal_at_slot_level for slot level from metaCtx', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [13, 12] });

            const spell = {
                name: 'Prayer of Healing',
                level: 2,
                range: '30 feet',
                heal_at_slot_level: { 2: '2d8 + MOD', 3: '3d8 + MOD', 4: '4d8 + MOD' },
            };

            await triggerPrayerOfHealing(
                spell,
                { slotLevel: 4 },
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('4d8 + 3');
        });

        it('uses spell.level when metaCtx.slotLevel is not provided', async () => {
            rollExpression.mockReturnValue({ total: 17, rolls: [9, 8] });

            const spell = {
                name: 'Prayer of Healing',
                level: 2,
                range: '30 feet',
                heal_at_slot_level: { 2: '2d8 + MOD', 3: '3d8 + MOD' },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8 + 3');
        });

        it('falls back to lowest slot level when metaCtx.slotLevel exceeds available', async () => {
            rollExpression.mockReturnValue({ total: 15, rolls: [8, 7] });

            const spell = {
                name: 'Prayer of Healing',
                level: 2,
                range: '30 feet',
                heal_at_slot_level: { 2: '2d8 + MOD', 3: '3d8 + MOD' },
            };

            await triggerPrayerOfHealing(
                spell,
                { slotLevel: 9 },
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            // Should use highest available (3d8 + MOD) since 9 > 3
            expect(rollExpression).toHaveBeenCalledWith('3d8 + 3');
        });

        it('uses spellCastingAbility from spell object when provided', async () => {
            rollExpression.mockReturnValue({ total: 15, rolls: [8, 7] });

            const spell = {
                name: 'Prayer of Healing',
                level: 2,
                range: '30 feet',
                spellCastingAbility: 'Charisma',
                heal_at_slot_level: { 2: '2d8 + MOD' },
            };

            const stats = {
                ...CLERIC_STATS,
                spellAbilities: {
                    spellCastingAbility: 'Wisdom',
                    modifier: 3,
                },
                abilities: [
                    { name: 'Wisdom', bonus: 3 },
                    { name: 'Charisma', bonus: 5 },
                ],
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                stats,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8 + 5');
        });

        it('uses spell.range for range calculation', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1, range: '60 feet', heal_at_slot_level: { 1: '2d8 + MOD' } },
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('60 feet');
        });

        it('uses default 30 feet when spell has no range', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1, heal_at_slot_level: { 1: '2d8 + MOD' } },
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
        });
    });

    describe('healing application', () => {
        it('clamps healing to target max HP', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 45;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets[0].healAmount).toBe(5);
        });

        it('does not heal targets at full HP', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 50;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.targets.length).toBe(3);
        });

        it('uses 0 as maxHp fallback when neither creature nor playerStats has HP', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', ...CLIC_POS },
                    { name: 'NoHpCreature', gridX: 2, gridY: 1 },
                ],
                creatures: [{ name: 'NoHpCreature' }],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].healAmount).toBe(0);
        });
    });
});
