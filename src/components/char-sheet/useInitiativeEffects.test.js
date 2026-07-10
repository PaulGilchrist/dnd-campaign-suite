// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';

describe('useInitiativeEffects', () => {
    const campaignName = 'test-campaign';
    const defaultPlayerStats = {
        name: 'TestMonk',
        level: 15,
        class: {
            name: 'Monk',
            class_levels: [{ level: 15, focus_points: 6 }],
        },
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        automation: {
            passives: [],
            actions: [],
        },
        actions: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
    });

    afterEach(() => {
        utils.getName.mockRestore?.();
    });

    function renderHookWithStats(stats = defaultPlayerStats) {
        return renderHook(() =>
            useInitiativeEffects(stats, campaignName, vi.fn())
        );
    }

    function dispatchInitiativeRoll(detail) {
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', { detail })
        );
    }

    function dispatchTurnUndeadResult(detail) {
        window.dispatchEvent(
            new CustomEvent('turn-undead-result', { detail })
        );
    }

    describe('initiative-rolled event', () => {
        describe('guard clauses', () => {
            it('does nothing when playerStats is null or undefined', () => {
                renderHook(() =>
                    useInitiativeEffects(null, campaignName, vi.fn())
                );
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('does nothing when event detail is null or undefined', () => {
                renderHookWithStats();
                dispatchInitiativeRoll(null);
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('does nothing when detail has no characterName or characterName is empty', () => {
                renderHookWithStats();
                dispatchInitiativeRoll({ roll: 15 });
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });

            it('does nothing when rolling name does not match player name', () => {
                renderHookWithStats();
                dispatchInitiativeRoll({
                    characterName: 'OtherPlayer',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalled();
            });
        });

        describe('focus points recovery (Uncanny Metabolism)', () => {
            it('recovers to max when current is below max and names match', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'uncannyMetabolismUsed') return null;
                    if (key === 'focusPoints') return 3;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'other',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    6,
                    campaignName
                );
            });

            it('does not recover when already at max', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'uncannyMetabolismUsed') return null;
                    if (key === 'focusPoints') return 6;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'other',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover when no focus points action exists', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'focusPoints') return 2;
                    return null;
                });
                renderHookWithStats();
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover when max focus points is 0', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'focusPoints') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [{ level: 15, focus_points: 0 }],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'other',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    expect.any(Number),
                    campaignName
                );
            });

            it('excludes wild_shape_regen_on_initiative from focus points check', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'focusPoints') return 3;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'wild_shape_regen_on_initiative',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    expect.any(Number),
                    campaignName
                );
            });
        });

        describe('perfect focus (Monk level 15 passive)', () => {
            it('recovers to 4 when current is <= 3 and below max', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'uncannyMetabolismUsed') return null;
                    if (key === 'focusPoints') return 2;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'perfect_focus',
                            },
                        ],
                    },
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [
                            { level: 15, focus_points: 4 },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    4,
                    campaignName
                );
            });

            it('recovers to max when max is less than 4', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'uncannyMetabolismUsed') return null;
                    if (key === 'focusPoints') return 2;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'perfect_focus',
                            },
                        ],
                    },
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [
                            { level: 15, focus_points: 3 },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    3,
                    campaignName
                );
            });

            it('does not recover when current is above threshold', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'uncannyMetabolismUsed') return null;
                    if (key === 'focusPoints') return 4;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'perfect_focus',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover when uncanny metabolism was used', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'uncannyMetabolismUsed') return true;
                    if (key === 'focusPoints') return 2;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'perfect_focus',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'focusPoints',
                    expect.any(Number),
                    campaignName
                );
            });
        });

        describe('wild shape recovery (Archdruid)', () => {
            it('recovers 1 use when all uses expended', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'wildShapeUses') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    level: 18,
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'wild_shape_regen_on_initiative',
                            },
                        ],
                    },
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [
                            { level: 18, wild_shape: 3 },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestMonk',
                    'wildShapeUses',
                    1,
                    campaignName
                );
            });

            it('does not recover when uses remain', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'wildShapeUses') return 1;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    level: 18,
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'wild_shape_regen_on_initiative',
                            },
                        ],
                    },
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [
                            { level: 18, wild_shape: 3 },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'wildShapeUses',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover when max wild shape is 0', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'wildShapeUses') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    level: 18,
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect: 'wild_shape_regen_on_initiative',
                            },
                        ],
                    },
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [
                            { level: 18, wild_shape: 0 },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'wildShapeUses',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover when no evergreen action exists', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'wildShapeUses') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    level: 18,
                    class: {
                        ...defaultPlayerStats.class,
                        class_levels: [
                            { level: 18, wild_shape: 3 },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'wildShapeUses',
                    expect.any(Number),
                    campaignName
                );
            });
        });

        describe('rage recovery (Persistent Rage)', () => {
            it('recovers to max when below max', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'ragePoints') return 1;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Barbarian',
                        class_levels: [{ level: 15, rages: 4 }],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'persistent_rage',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestMonk',
                    'ragePoints',
                    4,
                    campaignName
                );
            });

            it('does not recover when already at max', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'ragePoints') return 4;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Barbarian',
                        class_levels: [{ level: 15, rages: 4 }],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'persistent_rage',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'ragePoints',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover when rage count is 0', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'ragePoints') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Barbarian',
                        class_levels: [{ level: 15, rages: 0 }],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'persistent_rage',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'ragePoints',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover for non-Barbarian classes', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'ragePoints') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Monk',
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        passives: [
                            {
                                type: 'passive_rule',
                                effect: 'persistent_rage',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'ragePoints',
                    expect.any(Number),
                    campaignName
                );
            });
        });

        describe('bardic inspiration recovery (Superior Inspiration)', () => {
            it('recovers to min target when below target', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'bardicInspirationUses') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Bard',
                        class_levels: [{ level: 20 }],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect:
                                    'regain_bardic_inspiration_on_initiative',
                            },
                        ],
                    },
                    proficiency: 6,
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestMonk',
                    'bardicInspirationUses',
                    2,
                    campaignName
                );
            });

            it('caps at max when max is less than target', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'bardicInspirationUses') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    name: 'Bard',
                    level: 20,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Bard',
                        class_levels: [
                            {
                                level: 20,
                                bardic_inspiration_uses: 1,
                            },
                        ],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect:
                                    'regain_bardic_inspiration_on_initiative',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'Bard',
                    roll: 15,
                });
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'Bard',
                    'bardicInspirationUses',
                    1,
                    campaignName
                );
            });

            it('does not recover when already at or above target', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'bardicInspirationUses') return 2;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Bard',
                        class_levels: [{ level: 20 }],
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect:
                                    'regain_bardic_inspiration_on_initiative',
                            },
                        ],
                    },
                    proficiency: 6,
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'bardicInspirationUses',
                    expect.any(Number),
                    campaignName
                );
            });

            it('does not recover for non-Bard classes', () => {
                getRuntimeValue.mockImplementation((_name, key) => {
                    if (key === 'bardicInspirationUses') return 0;
                    return null;
                });
                const stats = {
                    ...defaultPlayerStats,
                    class: {
                        ...defaultPlayerStats.class,
                        name: 'Monk',
                    },
                    automation: {
                        ...defaultPlayerStats.automation,
                        actions: [
                            {
                                type: 'initiative_action',
                                effect:
                                    'regain_bardic_inspiration_on_initiative',
                            },
                        ],
                    },
                };
                renderHookWithStats(stats);
                dispatchInitiativeRoll({
                    characterName: 'TestMonk',
                    roll: 15,
                });
                expect(setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestMonk',
                    'bardicInspirationUses',
                    expect.any(Number),
                    campaignName
                );
            });
        });
    });

    describe('turn-undead-result event', () => {
        function createClericStats() {
            return {
                ...defaultPlayerStats,
                name: 'Cleric',
                automation: {
                    ...defaultPlayerStats.automation,
                    actions: [
                        {
                            name: 'Searing Undead',
                            type: 'damage_bonus',
                            trigger: 'turn_undead_fail',
                            damageType: 'Radiant',
                        },
                    ],
                },
                abilities: [{ name: 'Wisdom', bonus: 4 }],
            };
        }

        describe('guard clauses', () => {
            it('does nothing when playerStats is null or undefined', () => {
                const rollDamage = vi.fn();
                renderHook(() =>
                    useInitiativeEffects(null, campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName,
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('does nothing when event detail is null or undefined', () => {
                const rollDamage = vi.fn();
                renderHook(() =>
                    useInitiativeEffects(createClericStats(), campaignName, rollDamage)
                );
                dispatchTurnUndeadResult(null);
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('does nothing when attackerName does not match player', () => {
                const rollDamage = vi.fn();
                renderHook(() =>
                    useInitiativeEffects(createClericStats(), campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'OtherCleric',
                    campaignName,
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('does nothing when campaignName does not match', () => {
                const rollDamage = vi.fn();
                renderHook(() =>
                    useInitiativeEffects(createClericStats(), campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName: 'other-campaign',
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('does nothing when no searing undead action exists', () => {
                const rollDamage = vi.fn();
                renderHook(() =>
                    useInitiativeEffects(defaultPlayerStats, campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'TestMonk',
                    campaignName,
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).not.toHaveBeenCalled();
            });

            it('does nothing when rollExpression returns null', () => {
                const rollDamage = vi.fn();
                rollExpression.mockReturnValue(null);
                renderHook(() =>
                    useInitiativeEffects(createClericStats(), campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName,
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).not.toHaveBeenCalled();
            });
        });

        describe('successful damage application', () => {
            it('applies radiant damage to each failed target', () => {
                const rollDamage = vi.fn();
                const stats = createClericStats();
                rollExpression.mockReturnValue({
                    total: 4,
                    rolls: [4],
                    modifier: 0,
                });
                renderHook(() =>
                    useInitiativeEffects(stats, campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName,
                    failedTargets: ['Goblin', 'Zombie'],
                    saveDc: 13,
                    saveType: 'WIS',
                });
                expect(rollDamage).toHaveBeenCalledTimes(2);
                expect(rollDamage).toHaveBeenCalledWith(
                    'Searing Undead',
                    '4d8',
                    4,
                    [4],
                    0,
                    expect.objectContaining({
                        damageType: 'Radiant',
                        attackerName: 'Cleric',
                        targetName: 'Goblin',
                        saveDc: 13,
                        saveType: 'WIS',
                        dcSuccess: false,
                    })
                );
                expect(rollDamage).toHaveBeenCalledWith(
                    'Searing Undead',
                    '4d8',
                    4,
                    [4],
                    0,
                    expect.objectContaining({
                        targetName: 'Zombie',
                    })
                );
            });

            it('uses Wisdom bonus for damage dice count', () => {
                const rollDamage = vi.fn();
                const stats = {
                    ...createClericStats(),
                    abilities: [{ name: 'Wisdom', bonus: 3 }],
                };
                rollExpression.mockReturnValue({
                    total: 3,
                    rolls: [3],
                    modifier: 0,
                });
                renderHook(() =>
                    useInitiativeEffects(stats, campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName,
                    failedTargets: ['Goblin'],
                    saveDc: 13,
                    saveType: 'WIS',
                });
                expect(rollDamage).toHaveBeenCalledWith(
                    'Searing Undead',
                    '3d8',
                    3,
                    [3],
                    0,
                    expect.any(Object)
                );
            });

            it('uses minimum 1 Wisdom modifier for dice count', () => {
                const rollDamage = vi.fn();
                const stats = {
                    ...createClericStats(),
                    abilities: [{ name: 'Wisdom', bonus: -2 }],
                };
                rollExpression.mockReturnValue({
                    total: 1,
                    rolls: [1],
                    modifier: 0,
                });
                renderHook(() =>
                    useInitiativeEffects(stats, campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName,
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).toHaveBeenCalledWith(
                    'Searing Undead',
                    '1d8',
                    1,
                    [1],
                    0,
                    expect.any(Object)
                );
            });

            it('uses damageType from action or defaults to Radiant', () => {
                const rollDamage = vi.fn();
                const stats = {
                    ...createClericStats(),
                    automation: {
                        ...createClericStats().automation,
                        actions: [
                            {
                                name: 'Searing Undead',
                                type: 'damage_bonus',
                                trigger: 'turn_undead_fail',
                                // no damageType specified
                            },
                        ],
                    },
                };
                rollExpression.mockReturnValue({
                    total: 4,
                    rolls: [4],
                    modifier: 0,
                });
                renderHook(() =>
                    useInitiativeEffects(stats, campaignName, rollDamage)
                );
                dispatchTurnUndeadResult({
                    attackerName: 'Cleric',
                    campaignName,
                    failedTargets: ['Goblin'],
                });
                expect(rollDamage).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.any(String),
                    expect.any(Number),
                    expect.any(Array),
                    expect.any(Number),
                    expect.objectContaining({
                        damageType: 'Radiant',
                    })
                );
            });

        });
    });
});
