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

describe('prayerOfHealingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 18, rolls: [9, 9] });
        getCombatContext.mockResolvedValue({
            players: [
                { name: 'Cleric', gridX: 1, gridY: 1 },
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
        });
        rangeToFeet.mockReturnValue(30);
        getDistanceFeet.mockReturnValue(10);
        getRuntimeValue.mockImplementation((_key, _prop, _camp) => null);
        applyHealingToTarget.mockReturnValue({ actualHeal: 18, oldHp: 10, newHp: 28 });
        postLogEntry.mockResolvedValue(undefined);
        setRuntimeValue.mockReturnValue(undefined);
        window.dispatchEvent = vi.fn();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric' };

    describe('triggerPrayerOfHealing', () => {
        it('returns null for non-Prayer of Healing spells', async () => {
            const result = await triggerPrayerOfHealing(
                { name: 'Cure Wounds', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(getCombatContext).not.toHaveBeenCalled();
        });

        it('handles spell with empty string name', async () => {
            const result = await triggerPrayerOfHealing(
                { name: '', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('handles undefined spell name', async () => {
            const result = await triggerPrayerOfHealing(
                { level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns null when getCombatContext returns null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns null when getCombatContext returns undefined', async () => {
            getCombatContext.mockResolvedValue(undefined);

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns noTargets when no creatures exist', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ noTargets: true });
        });

        it('returns noTargets when creatures array is missing', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ noTargets: true });
        });

        it('excludes the caster from targets', async () => {
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 1, gridY: 1 },
                    { name: 'Ally1', gridX: 2, gridY: 1 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 60 },
                    { name: 'Ally1', maxHp: 50 },
                ],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets[0].targetName).toBe('Ally1');
        });

        it('limits targets to 5 max', async () => {
            const players = [{ name: 'Cleric', gridX: 1, gridY: 1 }];
            const creatures = [];
            for (let i = 1; i <= 10; i++) {
                creatures.push({ name: `Ally${i}`, maxHp: 50 });
                players.push({ name: `Ally${i}`, gridX: i + 1, gridY: 1 });
            }
            getCombatContext.mockResolvedValue({
                players,
                creatures,
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(5);
        });

        it('filters creatures by range when grid positions exist', async () => {
            getDistanceFeet.mockReturnValue(50);
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Ally1', maxHp: 50 },
                ],
                placedItems: [],
            });
            rangeToFeet.mockReturnValue(30);

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('sorts targets by distance (closest first)', async () => {
            getDistanceFeet.mockImplementation((_a, pos2) => {
                if (pos2.gridX === 3) return 10;
                if (pos2.gridX === 5) return 20;
                if (pos2.gridX === 2) return 5;
                return 50;
            });

            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 1, gridY: 1 },
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
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets[0].targetName).toBe('CloseAlly');
            expect(result.targets[1].targetName).toBe('FarAlly');
            expect(result.targets[2].targetName).toBe('MidAlly');
        });

        it('uses placedItems as fallback for grid positions', async () => {
            getDistanceFeet.mockReturnValue(10);
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'PlacedCreature', maxHp: 50 },
                ],
                placedItems: [
                    { name: 'PlacedCreature', gridX: 3, gridY: 1 },
                ],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('PlacedCreature');
        });

        it('uses placedItems gridX/gridY when creature has no grid position', async () => {
            getDistanceFeet.mockReturnValue(10);
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'OrphanCreature', maxHp: 50 },
                ],
                placedItems: [
                    { name: 'OrphanCreature', gridX: 3, gridY: 1 },
                ],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
        });

        it('falls back to first-5 creatures when caster has no grid position', async () => {
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
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
        });

        it('uses default 2d8 when spell has no heal_at_slot_level', async () => {
            rollExpression.mockReturnValue({ total: 12, rolls: [6, 6] });
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8');
            expect(result.totalHealed).toBeGreaterThan(0);
        });

        it('uses heal_at_slot_level for lowest slot >= spell level', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [13, 12] });

            const spell = {
                name: 'Prayer of Healing',
                level: 2,
                heal_at_slot_level: {
                    2: '3d8',
                    3: '4d8',
                    4: '5d8',
                },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('3d8');
        });

        it('uses heal_at_slot_level for spell level when exact match', async () => {
            rollExpression.mockReturnValue({ total: 22, rolls: [11, 11] });

            const spell = {
                name: 'Prayer of Healing',
                level: 3,
                heal_at_slot_level: {
                    2: '3d8',
                    3: '4d8',
                },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('4d8');
        });

        it('falls back to first key when no slot >= spell level', async () => {
            rollExpression.mockReturnValue({ total: 15, rolls: [8, 7] });

            const spell = {
                name: 'Prayer of Healing',
                level: 5,
                heal_at_slot_level: {
                    1: '2d8',
                    2: '3d8',
                },
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8');
        });

        it('handles empty heal_at_slot_level object', async () => {
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

            const spell = {
                name: 'Prayer of Healing',
                level: 1,
                heal_at_slot_level: {},
            };

            await triggerPrayerOfHealing(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d8');
        });

        it('returns null when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('skips targets affected by Prayer of Healing within 24 hours', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'prayerOfHealing_lastCast_Ally1') return Date.now() - 3600000;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(2);
            expect(result.targets.find(t => t.targetName === 'Ally1')).toBeUndefined();
        });

        it('allows targets affected after 24 hours', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'prayerOfHealing_lastCast_Ally1') return Date.now() - (25 * 60 * 60 * 1000);
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
            expect(result.targets.find(t => t.targetName === 'Ally1')).toBeDefined();
        });

        it('clamps healing to target max HP', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 45;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets[0].healAmount).toBe(5);
        });

        it('does not heal targets at full HP', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 50;
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.targets.length).toBe(3);
        });

        it('uses playerStats hitPoints as fallback for maxHp', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            const stats = { name: 'Cleric', hitPoints: 100 };
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 1, gridY: 1 },
                    { name: 'Ally1', gridX: 2, gridY: 1 },
                ],
                creatures: [
                    { name: 'Ally1' },
                ],
                placedItems: [],
            });

            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('calls applyHealingToTarget with correct arguments', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                expect.objectContaining({ players: expect.any(Array) }),
                'Ally1',
                expect.any(Number),
                campaignName,
            );
        });

        it('calls setRuntimeValue to mark target as affected', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'prayerOfHealing_lastCast_Ally1',
                expect.any(Number),
                campaignName,
            );
        });

        it('posts hp_change log entry for each healed target', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
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

        it('posts prayer_of_healing log entry for each target', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
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
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(window.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'combat-summary-updated' }),
            );
        });

        it('returns correct result structure with targets, formula, and totalHealed', async () => {
            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toHaveProperty('targets');
            expect(result).toHaveProperty('formula');
            expect(result).toHaveProperty('totalHealed');
            expect(Array.isArray(result.targets)).toBe(true);
            expect(typeof result.totalHealed).toBe('number');
        });

        it('calculates totalHealed as sum of individual heals', async () => {
            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const calculatedTotal = result.targets.reduce((sum, r) => sum + r.healAmount, 0);
            expect(result.totalHealed).toBe(calculatedTotal);
        });

        it('handles target with no maxHp by using 0', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 1, gridY: 1 },
                    { name: 'NoHpCreature', gridX: 2, gridY: 1 },
                ],
                creatures: [
                    { name: 'NoHpCreature' },
                ],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].healAmount).toBe(0);
        });

        it('handles storedHp as string number', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return '20';
                return null;
            });

            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('handles storedHp as empty string (treats as full HP)', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop === 'currentHitPoints') return '';
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.targets.every(t => t.healAmount === 0)).toBe(true);
        });

        it('uses spell.range for range calculation', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1, range: '60 feet' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('60 feet');
        });

        it('uses default 30 feet when spell has no range', async () => {
            await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(rangeToFeet).toHaveBeenCalledWith('30 feet');
        });

        it('handles missing players array in combatContext', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1', maxHp: 50 },
                ],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('Ally1');
        });

        it('handles null gridX/gridY on targets filtering them out', async () => {
            getDistanceFeet.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Ally1', maxHp: 50, gridX: null, gridY: null },
                ],
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('returns result with empty targets array when all targets are affected', async () => {
            getRuntimeValue.mockImplementation((_key, prop) => {
                if (prop.startsWith('prayerOfHealing_lastCast_')) return Date.now() - 3600000;
                if (prop === 'currentHitPoints') return '20';
                return null;
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets).toEqual([]);
            expect(result.totalHealed).toBe(0);
            expect(result.formula).toBeDefined();
        });

        it('handles null combatSummary.creatures', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: null,
                placedItems: [],
            });

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('handles null combatSummary.players and null combatSummary.creatures', async () => {
            getCombatContext.mockResolvedValue({});

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('handles applyHealingToTarget returning null', async () => {
            applyHealingToTarget.mockReturnValue(null);

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
            expect(result.targets.length).toBe(3);
        });

        it('includes formula in result', async () => {
            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.formula).toBe('2d8');
        });

        it('includes formula from heal_at_slot_level in result', async () => {
            const spell = {
                name: 'Prayer of Healing',
                level: 3,
                heal_at_slot_level: {
                    3: '5d8',
                },
            };

            const result = await triggerPrayerOfHealing(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.formula).toBe('5d8');
        });

        it('handles postLogEntry rejecting without throwing', async () => {
            postLogEntry.mockRejectedValue(new Error('Log failed'));

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
        });

        it('handles campaignName undefined gracefully', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                {},
                playerStats,
                undefined,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('handles metaCtx being undefined', async () => {
            const result = await triggerPrayerOfHealing(
                { name: 'Prayer of Healing', level: 1 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
        });

        it('throws when playerStats is undefined', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [],
                placedItems: [],
            });

            await expect(
                triggerPrayerOfHealing(
                    { name: 'Prayer of Healing', level: 1 },
                    {},
                    undefined,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow("Cannot read properties of undefined (reading 'name')");
        });
    });
});
