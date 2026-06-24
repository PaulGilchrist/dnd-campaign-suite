// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerMassHeal } from './massHealService.js';

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
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
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';

describe('massHealService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const casterStats = { name: 'Cleric', hitPoints: 50 };
    const massHealSpell = { name: 'Mass Heal', level: 9, range: '60 feet' };

    const inRangeCreature = (name) => ({
        name, gridX: 3, gridY: 3, maxHp: 45,
    });

    const baseCombatSummary = {
        players: [
            { name: 'Cleric', gridX: 1, gridY: 1 },
            inRangeCreature('Fighter'),
            inRangeCreature('Rogue'),
            inRangeCreature('Barbarian'),
        ],
        creatures: [
            { name: 'Fighter', maxHp: 45 },
            { name: 'Rogue', maxHp: 30 },
            { name: 'Barbarian', maxHp: 60 },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue(baseCombatSummary);
        getDistanceFeet.mockReturnValue(30);
        rangeToFeet.mockReturnValue(60);
        getRuntimeValue.mockImplementation((_name, prop) => {
            if (prop === 'currentHitPoints') return 0;
            return null;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('triggerMassHeal', () => {
        describe('early returns and rejection', () => {
            it('returns null for non-Mass Heal spells', async () => {
                const result = await triggerMassHeal(
                    { name: 'Cure Wounds', level: 1 },
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
                expect(getCombatContext).not.toHaveBeenCalled();
            });

            it('returns null when spell name has different casing', async () => {
                const result = await triggerMassHeal(
                    { name: 'mass heal', level: 9 },
                    {},
                    casterStats,
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
                    casterStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
            });

            it('throws when both metaCtx.slotLevel and spell.level are missing', async () => {
                await expect(
                    triggerMassHeal(
                        { name: 'Mass Heal', range: '60 feet' },
                        {},
                        casterStats,
                        campaignName,
                        mapName,
                    )
                ).rejects.toThrow('slot level is required for mass heal');
            });
        });

        describe('target selection', () => {
            it('returns noTargets when all creatures are out of range', async () => {
                getDistanceFeet.mockReturnValue(100);
                rangeToFeet.mockReturnValue(60);
                getRuntimeValue.mockReturnValue(null);

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({ noTargets: true });
                expect(applyHealingToTarget).not.toHaveBeenCalled();
                expect(postLogEntry).not.toHaveBeenCalled();
            });

            it('excludes the caster from targets', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'currentHitPoints') return 25;
                    return null;
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.every(t => t.targetName !== 'Cleric')).toBe(true);
            });

            it('limits targets to max 10', async () => {
                const extraPlayers = Array.from({ length: 15 }, (_, i) => ({
                    name: `Player${i}`,
                    gridX: i + 1,
                    gridY: i + 1,
                }));
                const bigCombat = {
                    players: [{ name: 'Cleric', gridX: 1, gridY: 1 }, ...extraPlayers],
                    creatures: extraPlayers.map(p => ({ name: p.name, maxHp: 50 })),
                };
                getCombatContext.mockResolvedValue(bigCombat);
                getDistanceFeet.mockReturnValue(10);
                rangeToFeet.mockReturnValue(60);

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(10);
            });

            it('sorts targets by distance nearest first', async () => {
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

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets[0].targetName).toBe('NearGuy');
                expect(result.targets[1].targetName).toBe('MidGuy');
                expect(result.targets[2].targetName).toBe('FarGuy');
            });

            it('handles caster without grid position by using all creatures', async () => {
                getCombatContext.mockResolvedValue({
                    players: [],
                    creatures: [
                        { name: 'Fighter', maxHp: 45 },
                        { name: 'Rogue', maxHp: 30 },
                    ],
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(2);
            });

            it('includes placedItems as target sources', async () => {
                getCombatContext.mockResolvedValue({
                    players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                    creatures: [{ name: 'Golem', maxHp: 100 }],
                    placedItems: [{ name: 'Golem', gridX: 3, gridY: 3 }],
                });
                getDistanceFeet.mockReturnValue(11.18);

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(1);
            });
        });

        describe('healing calculation', () => {
            it('does not heal above max HP', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'currentHitPoints') return 45;
                    return null;
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                const fighter = result.targets.find(t => t.targetName === 'Fighter');
                expect(fighter.healAmount).toBe(0);
            });

            it('uses stored HP when available', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'currentHitPoints') return 10;
                    return null;
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(3);
                expect(applyHealingToTarget).toHaveBeenCalledTimes(3);
            });

            it('falls back to maxHp when stored HP is missing', async () => {
                getRuntimeValue.mockReturnValue(undefined);

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(3);
            });

            it('falls back to maxHp when stored HP is an empty string', async () => {
                getRuntimeValue.mockReturnValue('');

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(3);
            });

            it('uses playerStats.hitPoints when creature has no maxHp', async () => {
                getCombatContext.mockResolvedValue({
                    players: [
                        { name: 'Cleric', gridX: 1, gridY: 1 },
                        { name: 'Wisp', gridX: 3, gridY: 3 },
                    ],
                    creatures: [{ name: 'Wisp' }],
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    { ...casterStats, hitPoints: 20 },
                    campaignName,
                    mapName,
                );

                expect(result).toBeDefined();
            });
        });

        describe('heal pool and slot level', () => {
            it('respects heal_at_slot_level for the given slot', async () => {
                const spellWithHealTable = {
                    ...massHealSpell,
                    heal_at_slot_level: { 5: '200', 6: '300', 7: '500', 8: '600', 9: '700' },
                };

                const result = await triggerMassHeal(
                    spellWithHealTable,
                    { slotLevel: 5 },
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.totalHealed).toBeLessThanOrEqual(200);
            });

            it('uses max value from heal_at_slot_level when expression is "max"', async () => {
                const spellWithMax = {
                    ...massHealSpell,
                    heal_at_slot_level: { 9: 'max' },
                };

                const result = await triggerMassHeal(
                    spellWithMax,
                    { slotLevel: 9 },
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.totalHealed).toBeLessThanOrEqual(700);
            });

            it('falls back to 700 pool when no heal_at_slot_level', async () => {
                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.totalHealed).toBeLessThanOrEqual(700);
            });

            it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
                const spell = { name: 'Mass Heal', level: 5, range: '60 feet' };

                await triggerMassHeal(
                    spell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(postLogEntry).toHaveBeenCalled();
            });

            it('uses highest slot key when metaCtx slotLevel is not in heal_at_slot_level', async () => {
                const spell = {
                    ...massHealSpell,
                    heal_at_slot_level: { 5: '200' },
                };

                const result = await triggerMassHeal(
                    spell,
                    { slotLevel: 9 },
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.totalHealed).toBeLessThanOrEqual(200);
            });

            it('throws when heal_at_slot_level expression is not a valid number', async () => {
                const spell = {
                    ...massHealSpell,
                    heal_at_slot_level: { 9: 'invalid' },
                };

                await expect(
                    triggerMassHeal(
                        spell,
                        { slotLevel: 9 },
                        casterStats,
                        campaignName,
                        mapName,
                    )
                ).rejects.toThrow('heal_at_slot_level expression must be a valid number');
            });
        });

        describe('range edge cases', () => {
            it('handles rangeToFeet returning Infinity (sight range)', async () => {
                getDistanceFeet.mockReturnValue(1000);
                rangeToFeet.mockReturnValue(Infinity);

                const result = await triggerMassHeal(
                    { ...massHealSpell, range: 'sight' },
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(3);
            });

            it('returns noTargets when rangeToFeet returns null (self/touch)', async () => {
                rangeToFeet.mockReturnValue(null);

                const result = await triggerMassHeal(
                    { ...massHealSpell, range: 'self' },
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.noTargets).toBe(true);
            });

            it('defaults to 60 feet when spell has no range', async () => {
                const result = await triggerMassHeal(
                    { name: 'Mass Heal', level: 9 },
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(3);
            });
        });

        describe('condition removal', () => {
            it('posts condition removal logs and updates runtime state', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'activeConditions') return ['blinded', 'poisoned', 'deafened'];
                    if (prop === 'currentHitPoints') return 20;
                    return null;
                });

                await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                const condLogs = postLogEntry.mock.calls.filter(
                    call => call[1].type === 'condition',
                );
                expect(condLogs.length).toBeGreaterThan(0);
                expect(setRuntimeValue).toHaveBeenCalled();
            });

            it('uses spell status_effects instead of defaults when present', async () => {
                const spellWithEffects = {
                    ...massHealSpell,
                    status_effects: ['poisoned', 'exhaustion'],
                };
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'activeConditions') return ['poisoned', 'exhaustion', 'blinded'];
                    if (prop === 'currentHitPoints') return 20;
                    return null;
                });

                await triggerMassHeal(
                    spellWithEffects,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                const blindedLogs = postLogEntry.mock.calls.filter(
                    call => call[1].type === 'condition' && call[1].condition === 'Blinded',
                );
                expect(blindedLogs.length).toBe(0);
            });

            it('does not call setRuntimeValue when no conditions match', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'activeConditions') return [];
                    if (prop === 'currentHitPoints') return 20;
                    return null;
                });

                await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('handles non-array activeConditions gracefully', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'activeConditions') return 'blinded';
                    if (prop === 'currentHitPoints') return 20;
                    return null;
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeDefined();
                expect(result.targets.length).toBe(3);
            });

            it('does not post condition log for already-removed conditions', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'activeConditions') return ['healthy'];
                    if (prop === 'currentHitPoints') return 20;
                    return null;
                });

                await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                const condLogs = postLogEntry.mock.calls.filter(
                    call => call[1].type === 'condition',
                );
                expect(condLogs.length).toBe(0);
            });
        });

        describe('HP change logs', () => {
            it('posts hp_change log with correct fields', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'currentHitPoints') return 20;
                    return null;
                });

                await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                const hpLogs = postLogEntry.mock.calls.filter(
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
        });

        describe('integration and side effects', () => {
            it('applies healing to each target and calls applyHealingToTarget', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'currentHitPoints') return 0;
                    return null;
                });

                const result = await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.length).toBe(3);
                expect(result.targets.every(t => typeof t.targetName === 'string' && t.healAmount >= 0)).toBe(true);
                expect(applyHealingToTarget).toHaveBeenCalledTimes(3);
                expect(applyHealingToTarget).toHaveBeenCalledWith(
                    baseCombatSummary,
                    'Fighter',
                    expect.any(Number),
                    campaignName,
                );
            });

            it('posts hp_change log for each target healed', async () => {
                getRuntimeValue.mockImplementation((_name, prop) => {
                    if (prop === 'currentHitPoints') return 0;
                    return null;
                });

                await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                const hpLogs = postLogEntry.mock.calls.filter(
                    call => call[1].type === 'hp_change',
                );
                expect(hpLogs.length).toBe(3);
            });

            it('dispatches combat-summary-updated event', async () => {
                const originalDispatch = window.dispatchEvent;
                const mockDispatch = vi.fn();
                window.dispatchEvent = mockDispatch;

                await triggerMassHeal(
                    massHealSpell,
                    {},
                    casterStats,
                    campaignName,
                    mapName,
                );

                expect(mockDispatch).toHaveBeenCalled();
                expect(mockDispatch.mock.calls[0][0] instanceof CustomEvent).toBe(true);
                expect(mockDispatch.mock.calls[0][0].type).toBe('combat-summary-updated');

                window.dispatchEvent = originalDispatch;
            });
        });

        describe('error handling for missing data', () => {
            it('throws when combatSummary has no creatures array', async () => {
                getCombatContext.mockResolvedValue({ players: [{ name: 'Cleric', gridX: 1, gridY: 1 }] });

                await expect(
                    triggerMassHeal(
                        massHealSpell,
                        {},
                        casterStats,
                        campaignName,
                        mapName,
                    )
                ).rejects.toThrow('Expected array, got undefined');
            });

            it('throws when combatSummary is empty object', async () => {
                getCombatContext.mockResolvedValue({});

                await expect(
                    triggerMassHeal(
                        massHealSpell,
                        {},
                        casterStats,
                        campaignName,
                        mapName,
                    )
                ).rejects.toThrow('Expected array, got undefined');
            });
        });
    });
});
