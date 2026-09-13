// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

describe('useInitiativeEffects - turn-undead-result event', () => {
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

    const searingUndeadAction = {
        name: 'Searing Undead',
        type: 'damage_bonus',
        trigger: 'turn_undead_fail',
        damageType: 'Radiant',
    };

    function createClericStats(overrides = {}) {
        return {
            ...defaultPlayerStats,
            name: 'Cleric',
            automation: {
                ...defaultPlayerStats.automation,
                actions: [searingUndeadAction],
            },
            abilities: [{ name: 'Wisdom', bonus: 4 }],
            ...overrides,
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    function dispatchTurnUndeadResult(detail) {
        window.dispatchEvent(
            new CustomEvent('turn-undead-result', { detail })
        );
    }

    // CLA-303: multi-target damage is applied via sequential awaits — flush
    // microtasks so all rollDamage calls have landed before asserting.
    async function flushSequentialDamage() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    describe('guard clauses', () => {
        it('does nothing when playerStats is null', () => {
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

        it('does nothing when playerStats is undefined', () => {
            const rollDamage = vi.fn();
            renderHook(() =>
                useInitiativeEffects(undefined, campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
                campaignName,
                failedTargets: ['Goblin'],
            });
            expect(rollDamage).not.toHaveBeenCalled();
        });

        it('does nothing when event detail is null', () => {
            const rollDamage = vi.fn();
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult(null);
            expect(rollDamage).not.toHaveBeenCalled();
        });

        it('does nothing when event detail is undefined', () => {
            const rollDamage = vi.fn();
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult(undefined);
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

        it('does nothing when event attackerName is undefined', () => {
            const rollDamage = vi.fn();
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
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

        it('does nothing when event campaignName is undefined', () => {
            const rollDamage = vi.fn();
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
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

        it('does nothing when rollExpression returns undefined', () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue(undefined);
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

    describe('empty/missing targets', () => {
        it('does not apply damage when failedTargets is an empty array', () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({
                total: 4,
                rolls: [4],
                modifier: 0,
            });
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
                campaignName,
                failedTargets: [],
            });
            expect(rollDamage).not.toHaveBeenCalled();
        });

    });

    describe('successful damage application', () => {
        it('applies radiant damage to each failed target', async () => {
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
            await flushSequentialDamage();
            expect(rollDamage).toHaveBeenCalledTimes(2);
            expect(rollDamage).toHaveBeenCalledWith(
                { name: 'Searing Undead', formula: '4d8', total: 4, rolls: [4], modifier: 0, context: expect.objectContaining({
                    damageType: 'Radiant',
                    attackerName: 'Cleric',
                    targetName: 'Goblin',
                }) }
            );
            expect(rollDamage).toHaveBeenCalledWith(
                { name: 'Searing Undead', formula: '4d8', total: 4, rolls: [4], modifier: 0, context: expect.objectContaining({
                    targetName: 'Zombie',
                }) }
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
                { name: 'Searing Undead', formula: '3d8', total: 3, rolls: [3], modifier: 0, context: expect.any(Object) }
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
                { name: 'Searing Undead', formula: '1d8', total: 1, rolls: [1], modifier: 0, context: expect.any(Object) }
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
                { name: expect.any(String), formula: expect.any(String), total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.objectContaining({
                    damageType: 'Radiant',
                }) }
            );
        });

        it('CLA-303: sends plain damage — no saveDc/saveType/dcSuccess (save already resolved by the modal)', async () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({
                total: 4,
                rolls: [4],
                modifier: 0,
            });
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
                campaignName,
                failedTargets: ['Goblin', 'Skeleton'],
                saveDc: 11,
                saveType: 'CHA',
            });
            await flushSequentialDamage();
            const contextArg = rollDamage.mock.calls[0][0].context;
            expect(contextArg.dcSuccess).toBeUndefined();
            expect(contextArg.saveDc).toBeUndefined();
            expect(contextArg.saveType).toBeUndefined();
            // full roll total must be passed as damage for every failed target
            expect(rollDamage.mock.calls[1][0].total).toBe(4);
        });

        it('sets attackerName to player name in context', () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({
                total: 4,
                rolls: [4],
                modifier: 0,
            });
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
                campaignName,
                failedTargets: ['Goblin'],
            });
            const contextArg = rollDamage.mock.calls[0][0].context;
            expect(contextArg.attackerName).toBe('Cleric');
        });

        it('sets targetName in context for each target', async () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({
                total: 4,
                rolls: [4],
                modifier: 0,
            });
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
                campaignName,
                failedTargets: ['Goblin', 'Zombie'],
            });
            await flushSequentialDamage();
            expect(rollDamage.mock.calls[0][0].context.targetName).toBe('Goblin');
            expect(rollDamage.mock.calls[1][0].context.targetName).toBe('Zombie');
        });

        it('handles missing Wisdom ability gracefully', () => {
            const rollDamage = vi.fn();
            const stats = {
                ...createClericStats(),
                abilities: [],
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
                { name: 'Searing Undead', formula: '1d8', total: 1, rolls: [1], modifier: 0, context: expect.any(Object) }
            );
        });

        it('handles zero damage total from rollExpression', () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({
                total: 0,
                rolls: [0],
                modifier: 0,
            });
            renderHook(() =>
                useInitiativeEffects(createClericStats(), campaignName, rollDamage)
            );
            dispatchTurnUndeadResult({
                attackerName: 'Cleric',
                campaignName,
                failedTargets: ['Goblin'],
            });
            expect(rollDamage).toHaveBeenCalledWith(
                { name: 'Searing Undead', formula: '4d8', total: 0, rolls: [0], modifier: 0, context: expect.any(Object) }
            );
        });
    });
});
