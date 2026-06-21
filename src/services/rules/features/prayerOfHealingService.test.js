// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPrayerOfHealing } from './prayerOfHealingService.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

import { rollExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const CLERIC_STATS = { name: 'Cleric' };
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
    };
}

function buildPrayerSpell(slotLevel) {
    return {
        name: 'Prayer of Healing',
        level: slotLevel ?? 2,
        heal_at_slot_level: {
            1: '2d8',
            2: '3d8',
            3: '4d8',
        },
    };
}

function mockDefaults(rollTotal = DEFAULT_ROLL_TOTAL) {
    rollExpression.mockReturnValue({ total: rollTotal, rolls: [9, 9] });
    getCombatContext.mockResolvedValue(buildDefaultCombatContext());
    rangeToFeet.mockReturnValue(DEFAULT_RANGE_FT);
    getDistanceFeet.mockReturnValue(DEFAULT_DISTANCE_FT);
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 10;
        return null;
    });
    applyHealingToTarget.mockReturnValue({ actualHeal: rollTotal, oldHp: 10, newHp: 28 });
    postLogEntry.mockResolvedValue(undefined);
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

        it('returns null when spell name is empty string', async () => {
            const result = await triggerPrayerOfHealing(
                { name: '', level: 1 },
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
        });

        it('returns null when spell object has no name property', async () => {
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
        it('returns null when getCombatContext resolves to null', async () => {
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

        it('returns null when getCombatContext resolves to undefined', async () => {
            getCombatContext.mockResolvedValue(undefined);

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

        it('throws when creatures is undefined', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', ...CLIC_POS }],
            });

            await expect(triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            )).rejects.toThrow('Expected array, got undefined');
        });

        it('throws when creatures is null', async () => {
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
                players: [{ name: 'Cleric', ...CLIC_POS }],
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

        it('falls back to first 5 creatures when caster has no grid position', async () => {
            getCombatContext.mockResolvedValue({
                players: [],
                creatures: [
                    { name: 'Ally1', maxHp: 50 },
                    { name: 'Ally2', maxHp: 50 },
                    { name: 'Ally3', maxHp: 50 },
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

            expect(result.targets.length).toBe(3);
        });

        it('skips targets with null grid coordinates when caster has grid position', async () => {
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

            expect(result).toEqual({ noTargets: true });
        });

        it('handles missing players array by falling back to creatures', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1', maxHp: 50 }],
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
        it('uses default 2d8 when spell has no heal_at_slot_level', async () => {
            rollExpression.mockReturnValue({ total: 12, rolls: [6, 6] });

            const spell = { name: 'Prayer of Healing', level: 2 };

            await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8');
        });

        it('uses heal_at_slot_level for lowest slot >= spell level', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [13, 12] });

            const spell = {
                name: 'Prayer of Healing',
                level: 2,
                heal_at_slot_level: { 2: '3d8', 3: '4d8', 4: '5d8' },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('3d8');
        });

        it('uses exact spell level when it matches a slot', async () => {
            rollExpression.mockReturnValue({ total: 22, rolls: [11, 11] });

            const spell = {
                name: 'Prayer of Healing',
                level: 3,
                heal_at_slot_level: { 2: '3d8', 3: '4d8' },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('4d8');
        });

        it('falls back to first slot key when no slot >= spell level', async () => {
            rollExpression.mockReturnValue({ total: 15, rolls: [8, 7] });

            const spell = {
                name: 'Prayer of Healing',
                level: 5,
                heal_at_slot_level: { 1: '2d8', 2: '3d8' },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8');
        });

        it('falls back to 2d8 when heal_at_slot_level is empty', async () => {
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

            const spell = { name: 'Prayer of Healing', level: 1, heal_at_slot_level: {} };

            await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8');
        });

        it('uses spell.range for range calculation', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1, range: '60 feet' },
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('60 feet');
        });

        it('uses default 30 feet when spell has no range', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
        });
    });

    describe('24-hour cooldown', () => {
        it('excludes targets healed within the last 24 hours', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'prayerOfHealing_lastCast_Ally1') return Date.now() - 3600000;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.length).toBe(2);
            expect(result.targets.find(t => t.targetName === 'Ally1')).toBeUndefined();
        });

        it('allows targets healed more than 24 hours ago', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'prayerOfHealing_lastCast_Ally1') return Date.now() - (25 * 60 * 60 * 1000);
                return null;
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.length).toBe(3);
            expect(result.targets.find(t => t.targetName === 'Ally1')).toBeDefined();
        });

        it('returns empty targets when all eligible creatures are on cooldown', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop.startsWith('prayerOfHealing_lastCast_')) return Date.now() - 3600000;
                if (prop === 'currentHitPoints') return '20';
                return null;
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets).toEqual([]);
            expect(result.totalHealed).toBe(0);
            expect(result.formula).toBeDefined();
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

        it('uses playerStats hitPoints when creature has no maxHp', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            const stats = { name: 'Cleric', hitPoints: 100 };
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', ...CLIC_POS },
                    { name: 'Ally1', gridX: 2, gridY: 1 },
                ],
                creatures: [{ name: 'Ally1' }],
                placedItems: [],
            });

            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                stats,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(applyHealingToTarget).toHaveBeenCalled();
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

        it('tolerates non-numeric stored HP values', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return '20';
                return null;
            });

            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('treats empty string HP as full HP (no healing)', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return '';
                return null;
            });

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.targets.every(t => t.healAmount === 0)).toBe(true);
        });
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

        it('includes the correct formula in result', async () => {
            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(2),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.formula).toBe('3d8');
        });

        it('includes formula from heal_at_slot_level in result', async () => {
            const spell = {
                name: 'Prayer of Healing',
                level: 3,
                heal_at_slot_level: { 3: '5d8' },
            };

            const result = await triggerPrayerOfHealing(
                spell,
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result.formula).toBe('5d8');
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

        it('marks each healed target with a cooldown timestamp', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'prayerOfHealing_lastCast_Ally1',
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

            const hpChangeCalls = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'hp_change',
            );
            expect(hpChangeCalls.length).toBeGreaterThan(0);
            expect(hpChangeCalls[0][1]).toMatchObject({
                type: 'hp_change',
                targetName: 'Ally1',
                isHealing: true,
                sourceName: 'Cleric',
                note: 'Prayer of Healing',
            });
        });

        it('posts prayer_of_healing log entry for each healed target', async () => {
            await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const prayerCalls = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'prayer_of_healing',
            );
            expect(prayerCalls.length).toBe(3);
            expect(prayerCalls[0][1]).toMatchObject({
                type: 'prayer_of_healing',
                targetName: 'Ally1',
                casterName: 'Cleric',
                isAffected: true,
            });
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
    });

    describe('error resilience', () => {
        it('returns null when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await triggerPrayerOfHealing(
                buildPrayerSpell(),
                {},
                CLERIC_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
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

        it('survives postLogEntry rejecting without throwing', async () => {
            postLogEntry.mockRejectedValue(new Error('Log failed'));

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
    });
});
