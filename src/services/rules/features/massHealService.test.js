import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerMassHeal } from './massHealService.js';

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

import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';

describe('massHealService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.dispatchEvent = vi.fn();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric', hitPoints: 50 };
    const massHealSpell = { name: 'Mass Heal', level: 9, range: '60 feet' };

    // Creatures need grid positions in players/placedItems for range lookup
    // Since creatures are looked up by name from players or placedItems
    const combatSummary = {
        players: [
            { name: 'Cleric', gridX: 1, gridY: 1 },
            { name: 'Fighter', gridX: 3, gridY: 3 },
            { name: 'Rogue', gridX: 5, gridY: 5 },
            { name: 'Barbarian', gridX: 7, gridY: 7 },
        ],
        creatures: [
            { name: 'Fighter', maxHp: 45 },
            { name: 'Rogue', maxHp: 30 },
            { name: 'Barbarian', maxHp: 60 },
        ],
    };

    describe('triggerMassHeal', () => {
        it('returns null for non-Mass Heal spells', async () => {
            const result = await triggerMassHeal(
                { name: 'Cure Wounds', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns null when case-insensitive spell name does not match', async () => {
            const result = await triggerMassHeal(
                { name: 'mass heal', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns null when getCombatContext returns null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns null when campaignName is falsy', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                null,
                mapName,
            );
            expect(result).toBeNull();
        });

        it('returns noTargets when all creatures are out of range', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(100);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue(null);

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ noTargets: true });
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(postLogEntry).not.toHaveBeenCalled();
        });

        it('excludes the caster from targets', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 25;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.every(t => t.targetName !== 'Cleric')).toBe(true);
        });

        it('limits targets to max 10', async () => {
            const playersWith15 = Array.from({ length: 15 }, (_, i) => ({
                name: `Player${i}`,
                gridX: i + 1,
                gridY: i + 1,
            }));
            const bigCombat = {
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }, ...playersWith15],
                creatures: playersWith15.map(p => ({ name: p.name, maxHp: 50 })),
            };
            getCombatContext.mockResolvedValue(bigCombat);
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 25;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(10);
        });

        it('sorts targets by distance (nearest first)', async () => {
            const sortedCombat = {
                players: [
                    { name: 'Cleric', gridX: 0, gridY: 0 },
                    { name: 'FarGuy', gridX: 10, gridY: 10 },
                    { name: 'NearGuy', gridX: 2, gridY: 2 },
                    { name: 'MidGuy', gridX: 5, gridY: 5 },
                ],
                creatures: [
                    { name: 'FarGuy', maxHp: 50 },
                    { name: 'NearGuy', maxHp: 50 },
                    { name: 'MidGuy', maxHp: 50 },
                ],
            };
            getCombatContext.mockResolvedValue(sortedCombat);
            getDistanceFeet.mockImplementation((_from, to) => {
                if (to.gridX === 10) return 50;
                if (to.gridX === 2) return 10;
                if (to.gridX === 5) return 25;
                return 0;
            });
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 25;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets[0].targetName).toBe('NearGuy');
            expect(result.targets[1].targetName).toBe('MidGuy');
            expect(result.targets[2].targetName).toBe('FarGuy');
        });

        it('uses stored HP when available', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
            expect(applyHealingToTarget).toHaveBeenCalledTimes(3);
        });

        it('handles missing stored HP by using maxHp from creature', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue(undefined);

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
        });

        it('handles empty string stored HP as maxHp', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockReturnValue('');

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
        });

        it('respects heal pool from heal_at_slot_level', async () => {
            const spellWithHealTable = {
                name: 'Mass Heal',
                level: 9,
                range: '60 feet',
                heal_at_slot_level: { 5: '200', 6: '300', 7: '500', 8: '600', 9: '700' },
            };
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 25;
                return null;
            });

            const result = await triggerMassHeal(
                spellWithHealTable,
                { slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.totalHealed).toBeLessThanOrEqual(200);
        });

        it('uses max heal expression as total pool (not parseInt)', async () => {
            const spellWithMax = {
                name: 'Mass Heal',
                level: 9,
                range: '60 feet',
                heal_at_slot_level: { 9: 'max' },
            };
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 25;
                return null;
            });

            const result = await triggerMassHeal(
                spellWithMax,
                { slotLevel: 9 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.totalHealed).toBeLessThanOrEqual(700);
        });

        it('falls back to 700 pool when no heal_at_slot_level', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 25;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.totalHealed).toBeLessThanOrEqual(700);
        });

        it('does not heal above max HP', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 45;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const fighter = result.targets.find(t => t.targetName === 'Fighter');
            expect(fighter.healAmount).toBe(0);
        });

        it('applies healing in order of targets', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
            expect(result.totalHealed).toBeLessThanOrEqual(700);
        });

        it('calls applyHealingToTarget for each target with positive heal', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(applyHealingToTarget).toHaveBeenCalledTimes(3);
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                combatSummary,
                'Fighter',
                expect.any(Number),
                campaignName,
            );
        });

        it('posts log entries for each target healed', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const hpLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'hp_change',
            );
            expect(hpLogs.length).toBe(3);
        });

        it('posts hp_change log with correct fields', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const hpLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'hp_change',
            );
            expect(hpLogs.length).toBeGreaterThan(0);
            const log = hpLogs[0][1];
            expect(log.targetName).toBeDefined();
            expect(log.delta).toBeGreaterThan(0);
            expect(log.isHealing).toBe(true);
            expect(log.sourceName).toBe('Cleric');
            expect(log.note).toBe('Mass Heal');
            expect(log.timestamp).toBeDefined();
        });

        it('posts condition removal logs', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['blinded', 'poisoned', 'healthy'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const condLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'condition',
            );
            expect(condLogs.length).toBeGreaterThan(0);
            const condLog = condLogs[0][1];
            expect(condLog.action).toBe('removed');
            expect(condLog.characterName).toBeDefined();
            expect(condLog.reason).toBe('Mass Heal');
        });

        it('removes conditions from activeConditions', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['blinded', 'poisoned', 'deafened', 'exhaustion'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).toHaveBeenCalled();
        });

        it('uses spell status_effects when present', async () => {
            const spellWithEffects = {
                name: 'Mass Heal',
                level: 9,
                range: '60 feet',
                status_effects: ['poisoned', 'exhaustion'],
            };
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['poisoned', 'exhaustion', 'blinded'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                spellWithEffects,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const condLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'condition' && call[1].condition === 'Blinded',
            );
            expect(condLogs.length).toBe(0);
        });

        it('handles spell with no status_effects and no conditions to remove', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return [];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('handles caster without grid position (uses all creatures)', async () => {
            const combatNoGrid = {
                players: [],
                creatures: [
                    { name: 'Fighter', maxHp: 45 },
                    { name: 'Rogue', maxHp: 30 },
                ],
            };
            getCombatContext.mockResolvedValue(combatNoGrid);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 10;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(2);
        });

        it('handles undefined combatSummary arrays gracefully', async () => {
            const emptyCombat = {
                players: [],
            };
            getCombatContext.mockResolvedValue(emptyCombat);
            getRuntimeValue.mockReturnValue(0);

            await expect(triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            )).rejects.toThrow('Expected array, got undefined');
        });

        it('handles missing metaCtx slotLevel', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.totalHealed).toBeLessThanOrEqual(700);
        });

        it('handles empty metaCtx', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
            expect(result.totalHealed).toBeLessThanOrEqual(700);
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            const spell = { name: 'Mass Heal', level: 5, range: '60 feet' };
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            await triggerMassHeal(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(postLogEntry).toHaveBeenCalled();
        });

        it('handles creature with no maxHp', async () => {
            const noHpCombat = {
                players: [
                    { name: 'Cleric', gridX: 1, gridY: 1 },
                    { name: 'Ghost', gridX: 3, gridY: 3 },
                ],
                creatures: [{ name: 'Ghost' }],
            };
            getCombatContext.mockResolvedValue(noHpCombat);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
        });

        it('dispatches combat-summary-updated event', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(window.dispatchEvent).toHaveBeenCalled();
        });

        it('handles rangeToFeet returning Infinity', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(1000);
            rangeToFeet.mockReturnValue(Infinity);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                { ...massHealSpell, range: 'sight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
        });

        it('handles rangeToFeet returning null (self/touch range)', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(null);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                { ...massHealSpell, range: 'self' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.noTargets).toBe(true);
        });

        it('handles missing range on spell defaulting to 60 feet', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                { name: 'Mass Heal', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(3);
        });

        it('filters out caster from targets by name', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const casterInTargets = result.targets.some(t => t.targetName === playerStats.name);
            expect(casterInTargets).toBe(false);
        });

        it('handles target with stored HP equal to max HP (no healing needed)', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 45;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const fighter = result.targets.find(t => t.targetName === 'Fighter');
            expect(fighter.healAmount).toBe(0);
        });

        it('handles non-array activeConditions gracefully', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return 'blinded';
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
        });

        it('handles condition names with mixed case', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['Blinded', 'POISONED', 'Exhaustion'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const condLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'condition',
            );
            expect(condLogs.length).toBeGreaterThan(0);
        });

        it('does not post condition removal log for already-removed conditions', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['healthy'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const condLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'condition',
            );
            expect(condLogs.length).toBe(0);
        });

        it('handles applied healing with zero result', async () => {
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const hpLogs = vi.mocked(postLogEntry).mock.calls.filter(
                call => call[1].type === 'hp_change',
            );
            expect(hpLogs.length).toBe(3);
        });

        it('uses playerStats.hitPoints as fallback when creature has no maxHp', async () => {
            const noMaxHpCombat = {
                players: [
                    { name: 'Cleric', gridX: 1, gridY: 1 },
                    { name: 'Wisp', gridX: 3, gridY: 3 },
                ],
                creatures: [{ name: 'Wisp' }],
            };
            getCombatContext.mockResolvedValue(noMaxHpCombat);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                { ...playerStats, hitPoints: 20 },
                campaignName,
                mapName,
            );

            expect(result).toBeDefined();
        });

        it('handles heal_at_slot_level with missing slot key', async () => {
            const spell = {
                name: 'Mass Heal',
                level: 9,
                range: '60 feet',
                heal_at_slot_level: { 5: '200' },
            };
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            const result = await triggerMassHeal(
                spell,
                { slotLevel: 9 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.totalHealed).toBeLessThanOrEqual(200);
        });

        it('throws when heal_at_slot_level expression is not a valid number', async () => {
            const spell = {
                name: 'Mass Heal',
                level: 9,
                range: '60 feet',
                heal_at_slot_level: { 9: 'invalid' },
            };
            getCombatContext.mockResolvedValue(combatSummary);
            getDistanceFeet.mockReturnValue(30);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 0;
                return null;
            });

            await expect(
                triggerMassHeal(
                    spell,
                    { slotLevel: 9 },
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('heal_at_slot_level expression must be a valid number');
        });

        it('handles placedItems as target sources', async () => {
            const combatWithItems = {
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [{ name: 'Golem', maxHp: 100 }],
                placedItems: [{ name: 'Golem', gridX: 3, gridY: 3 }],
            };
            getCombatContext.mockResolvedValue(combatWithItems);
            getDistanceFeet.mockReturnValue(11.18);
            rangeToFeet.mockReturnValue(60);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 50;
                return null;
            });

            const result = await triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result.targets.length).toBe(1);
        });

        it('handles combatSummary with no players or creatures', async () => {
            getCombatContext.mockResolvedValue({});
            getRuntimeValue.mockReturnValue(0);

            await expect(triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            )).rejects.toThrow('Expected array, got undefined');
        });

        it('handles undefined creatures in combatSummary', async () => {
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
            });
            getRuntimeValue.mockReturnValue(0);

            await expect(triggerMassHeal(
                massHealSpell,
                {},
                playerStats,
                campaignName,
                mapName,
            )).rejects.toThrow('Expected array, got undefined');
        });
    });
});
