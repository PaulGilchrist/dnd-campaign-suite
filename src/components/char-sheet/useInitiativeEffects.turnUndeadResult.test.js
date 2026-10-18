// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Mock surface probed against modules loaded by this test: useInitiativeEffects
// imports getRuntimeValue/setRuntimeBatch/setRuntimeValue/getAllStoreKeys; transitive
// importers (combatData, invisibility/polymorph/shapechange services, boonOfCombatProwess)
// only reach getRuntimeValue/setRuntimeValue/(setRuntimeObject, never invoked here).
// getStore/useSyncedState/listeners from the old mock were dead — removed.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// utils default is a live module-level import (storage.js + the initiative-rolled
// lane); this lane never calls it, so a plain pass-through suffices.
vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: (n) => n || 'Unknown',
    },
}));

import { rollExpression } from '../../services/dice/diceRoller.js';

describe('useInitiativeEffects - turn-undead-result (Searing Undead damage)', () => {
    const campaignName = 'test-campaign';

    // Fresh fixture per test. searing action deliberately OMITS damageType so the
    // main-path test pins the 'Radiant' fallback branch.
    function searingStats(overrides = {}) {
        return {
            name: 'Cleric',
            level: 15,
            abilities: [{ name: 'Wisdom', bonus: 4 }],
            automation: {
                passives: [],
                actions: [{
                    name: 'Searing Undead',
                    type: 'damage_bonus',
                    trigger: 'turn_undead_fail',
                }],
            },
            ...overrides,
        };
    }

    function validDetail(overrides = {}) {
        return {
            attackerName: 'Cleric',
            campaignName,
            failedTargets: ['Goblin'],
            ...overrides,
        };
    }

    function dispatchTurnUndeadResult(detail) {
        window.dispatchEvent(new CustomEvent('turn-undead-result', { detail }));
    }

    // Handler awaits rollDamage per target (CLA-303 sequential path) — flush
    // microtasks so every call has landed before asserting.
    async function flush() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe.each([
        ['playerStats null', null, validDetail()],
        ['playerStats undefined', undefined, validDetail()],
        ['event detail null', searingStats(), null],
        ['event detail undefined', searingStats(), undefined],
        ['attackerName mismatch', searingStats(), validDetail({ attackerName: 'OtherCleric' })],
        ['attackerName undefined', searingStats(), { campaignName, failedTargets: ['Goblin'] }],
        ['campaignName mismatch', searingStats(), validDetail({ campaignName: 'other-campaign' })],
        ['campaignName undefined', searingStats(), { attackerName: 'Cleric', failedTargets: ['Goblin'] }],
        // Predicate matches type+trigger, not name: same-named action with wrong
        // metadata must not satisfy the searing-undead lookup.
        ['action type/trigger mismatch', searingStats({
            automation: {
                passives: [],
                actions: [{ name: 'Searing Undead', type: 'attack', trigger: 'attack' }],
            },
        }), validDetail()],
    ])('early-return guard: %s', (_label, stats, detail) => {
        it('never rolls dice and never deals damage', async () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
            renderHook(() => useInitiativeEffects(stats, campaignName, rollDamage));

            dispatchTurnUndeadResult(detail);
            await flush();

            expect(rollExpression).not.toHaveBeenCalled();
            expect(rollDamage).not.toHaveBeenCalled();
        });
    });

    describe.each([
        ['rollExpression returns null', null],
        ['rollExpression returns undefined', undefined],
        ['failedTargets empty array', { total: 4, rolls: [4], modifier: 0 }],
    ])('dice rolled but no damage: %s', (_label, rollResult) => {
        it('skips rollDamage entirely', async () => {
            const rollDamage = vi.fn();
            const isTargetless = rollResult !== null && rollResult !== undefined;
            rollExpression.mockReturnValue(rollResult);
            renderHook(() => useInitiativeEffects(searingStats(), campaignName, rollDamage));

            dispatchTurnUndeadResult(validDetail({
                failedTargets: isTargetless ? [] : ['Goblin'],
            }));
            await flush();

            expect(rollExpression).toHaveBeenCalledWith('4d8');
            expect(rollDamage).not.toHaveBeenCalled();
        });
    });

    it('deals one shared roll to every failed target, byte-exact plain-damage payload (CLA-303)', async () => {
        const rollDamage = vi.fn();
        rollExpression.mockReturnValue({ total: 11, rolls: [6, 5], modifier: 0 });
        renderHook(() => useInitiativeEffects(searingStats(), campaignName, rollDamage));

        // saveDc/saveType on the event must be IGNORED — passing them downstream
        // makes handleNpcSaveDamage re-roll a phantom second save (CLA-303).
        dispatchTurnUndeadResult(validDetail({
            failedTargets: ['Goblin', 'Zombie'],
            saveDc: 13,
            saveType: 'WIS',
        }));
        await flush();

        // One roll per event, reused for every target, applied in event order.
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('4d8');
        expect(rollDamage).toHaveBeenCalledTimes(2);
        expect(rollDamage.mock.calls[0][0]).toEqual({
            name: 'Searing Undead',
            formula: '4d8',
            total: 11,
            rolls: [6, 5],
            modifier: 0,
            context: { damageType: 'Radiant', attackerName: 'Cleric', targetName: 'Goblin' },
        });
        expect(rollDamage.mock.calls[1][0]).toEqual({
            name: 'Searing Undead',
            formula: '4d8',
            total: 11,
            rolls: [6, 5],
            modifier: 0,
            context: { damageType: 'Radiant', attackerName: 'Cleric', targetName: 'Zombie' },
        });
    });

    describe.each([
        ['Wisdom 3 rolls 3d8', [{ name: 'Wisdom', bonus: 3 }], '3d8'],
        ['negative Wisdom floors at 1 die', [{ name: 'Wisdom', bonus: -2 }], '1d8'],
        ['zero Wisdom floors at 1 die', [{ name: 'Wisdom', bonus: 0 }], '1d8'],
        ['missing Wisdom ability rolls 1d8', [], '1d8'],
    ])('dice formula from Wisdom: %s', (_label, abilities, expectedFormula) => {
        it('rolls and submits the floored formula', async () => {
            const rollDamage = vi.fn();
            rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
            renderHook(() =>
                useInitiativeEffects(searingStats({ abilities }), campaignName, rollDamage)
            );

            dispatchTurnUndeadResult(validDetail());
            await flush();

            expect(rollExpression).toHaveBeenCalledWith(expectedFormula);
            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage.mock.calls[0][0]).toEqual(
                expect.objectContaining({ formula: expectedFormula, total: 4 })
            );
        });
    });

    it('takes damageType from the action when declared', async () => {
        const rollDamage = vi.fn();
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
        const stats = searingStats({
            automation: {
                passives: [],
                actions: [{
                    name: 'Searing Undead',
                    type: 'damage_bonus',
                    trigger: 'turn_undead_fail',
                    damageType: 'Fire',
                }],
            },
        });
        renderHook(() => useInitiativeEffects(stats, campaignName, rollDamage));

        dispatchTurnUndeadResult(validDetail());
        await flush();

        expect(rollDamage.mock.calls[0][0].context).toEqual({
            damageType: 'Fire',
            attackerName: 'Cleric',
            targetName: 'Goblin',
        });
    });

    it('still applies a zero-total roll (no falsy-total suppression)', async () => {
        const rollDamage = vi.fn();
        rollExpression.mockReturnValue({ total: 0, rolls: [0], modifier: 0 });
        renderHook(() => useInitiativeEffects(searingStats(), campaignName, rollDamage));

        dispatchTurnUndeadResult(validDetail());
        await flush();

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage.mock.calls[0][0]).toEqual({
            name: 'Searing Undead',
            formula: '4d8',
            total: 0,
            rolls: [0],
            modifier: 0,
            context: { damageType: 'Radiant', attackerName: 'Cleric', targetName: 'Goblin' },
        });
    });
});
