// @maintained-by-ai: 2026-10-15 — deterministic mocked-seam lane; every external
// module (runtime store, dice, log, damage, findLastAttack, expirations) is mocked,
// so only the Frost's Chill handler composition runs under test and no churn is
// needed unless the Frost's Chill handler contract itself moves.
//
// Seam vs. firesBurn: frostsChill has NO .regression sibling (firesBurn pushed its
// miss / no-damage parser-shape locks to giantAncestry-firesBurn.regression.test.js).
// Until a frostsChill.regression sibling runs the REAL findLastAttack parser, THIS
// lane carries the CLA-141/CLA-148 miss-refusal + zero-spend gate lock (the only
// place that contract lives for Frost's Chill). If such a sibling is added, move the
// miss branch here to it following the firesBurn seam recipe.
//
// Gate refusal branches are pinned once, through dispatch — handleFrostsChill and
// handleFrostsChillDirect call the identical shared frostsChillAttackerGate (a thin
// wrapper over attackerRollGate) and the same resolveAncestryUses /
// applySpeedReductionEffect chain, so the direct lane keeps only its distinct log
// composition (lowercase 'cold damage' vs the shared helper's 'Cold damage') plus one
// refusal to prove the shared gate is wired at the direct entry.
//
// Frost's Chill is the one ancestor that rides the shared damage lane AND stamps a
// speed_reduction targetEffect with an attacker-anchored clock (CLA-148: RAW
// "until the start of your next turn"), so its happy-path pins carry that extra shape.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_expr) => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 15, oldHp: 20, damageReduced: false })),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => ({ actualHeal: 12, oldHp: 10, newHp: 22 })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(async () => ({
        // CLA-169: attackerRollGate requires hit===true (CLA-141 lane) — the
        // default trigger must be a valid HIT for hit-triggered ancestry rows.
        attackEvent: { rollType: 'attack', attackerName: 'TestHero', hit: true },
        attackerName: 'TestHero',
        targetName: 'Goblin',
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: ['slashing'],
    })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

import {
    handleFrostsChill,
    handleFrostsChillDirect,
} from './giantAncestryHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { makeAction, makePlayerStats } from './giantAncestry.test.setup.js';

// resetAllMocks restores the factory defaults above (incl. the full-hit findLastAttack
// record) after per-test mockResolvedValue overrides, and clears call counts.
beforeEach(() => { vi.resetAllMocks(); });

function makeUsesMock(usesKey, value) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === usesKey) return value;
        return null;
    });
}

describe('giantAncestry Frost\'s Chill (mocked findLastAttack seam)', () => {
    const option = { name: "Frost's Chill", type: 'damage_with_condition', damage: '1d6', damageType: 'Cold', value: '10_ft' };

    describe('handleFrostsChill (dispatch, option-driven)', () => {
        it('deals option-derived 1d6 Cold damage, spends an exact-key use, stamps speed_reduction + one clock, and logs', async () => {
            makeUsesMock('frostsChillUses', 3);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual({
                type: 'damage',
                name: "Frost's Chill",
                formula: '1d6',
                rolls: [5],
                total: 5,
                finalDamage: 5,
                damageApplied: true,
                targetName: 'Goblin',
                targetCurrentHp: 15,
                damageType: 'Cold',
            });
            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'Goblin', 5, ['Cold'], {
                campaignName: 'campaign',
                characters: [],
                ignoreResistance: false,
                attackerName: 'TestHero',
            });

            // Two writes: the exact-key use spend and the speed_reduction te.
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: 'Goblin', source: "Frost's Chill", effect: 'speed_reduction', value: 10, duration: 'until_start_of_next_turn' },
            ], 'campaign');

            // CLA-148: RAW "until the start of your next turn" — ONE attacker-anchored clock.
            expect(addExpiration).toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestHero',
                targetName: 'Goblin',
                campaignName: 'campaign',
                rounds: undefined,
                expireOnCreatureName: 'TestHero',
                effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: "Frost's Chill", target: 'Goblin' }],
            });

            // Shared damage-roll log (capital 'Cold') + condition log.
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                name: "Frost's Chill Damage",
                targetName: 'Goblin',
                damageType: 'Cold',
                total: 5,
                formula: '1d6',
                rolls: [5],
                description: "TestHero used Frost's Chill to deal 5 Cold damage to Goblin.",
            }));
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'condition',
                characterName: 'TestHero',
                targetName: 'Goblin',
                condition: 'speed_reduction',
                source: "Frost's Chill",
                description: "TestHero used Frost's Chill to reduce Goblin's speed by 10 ft until the start of TestHero's next turn.",
            }));
        });

        it('refuses with zero spend when there is no lastAttack', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({ attackEvent: null });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Frost's Chill requires a recent attack. Use it after hitting a creature.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the last attack was made by another creature', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Frost's Chill can only be used after you make an attack. Wait for your turn.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the last roll was not an attack roll', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'check' },
                attackerName: 'TestHero',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Frost's Chill can only be used after an attack roll.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('refuses with zero spend when the last attack has no target', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'TestHero',
                targetName: null,
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Frost's Chill requires a target. No target found from the last attack.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('CLA-141 gate: refuses a MISS lastAttack with zero spend/te/clock and logs frosts_chill_refused', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: false },
                attackerName: 'TestHero',
                targetName: 'Goblin',
                totalDamage: 0,
            });

            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Your last attack missed Goblin. Frost's Chill triggers only when you hit a target with an attack roll and deal damage to it.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'frosts_chill_refused',
                name: "Frost's Chill",
            }));
        });

        it('refuses with no gate probe and zero spend when no uses remain', async () => {
            makeUsesMock('frostsChillUses', 0);
            const result = await handleFrostsChill(makeAction(), makePlayerStats(), 'campaign', option);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Frost's Chill has no uses remaining. Uses will reset on the next Long Rest.");
            expect(findLastAttack).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });

    describe('handleFrostsChillDirect (frosts_chill automation type)', () => {
        const directAction = {
            name: "Frost's Chill",
            automation: {
                type: 'frosts_chill',
                damage: '1d6',
                damageType: 'Cold',
                condition: 'speed_reduction',
                value: '10_ft',
                trigger: 'hit',
                uses: 'proficiency_bonus',
                recharge: 'long_rest',
                casting_time: '1 action',
            },
        };

        it('derives formula from action.automation, spends an exact-key use, stamps speed_reduction, and logs its own composition', async () => {
            makeUsesMock('frostsChillUses', 3);
            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload).toEqual({
                type: 'damage',
                name: "Frost's Chill",
                formula: '1d6',
                rolls: [5],
                total: 5,
                finalDamage: 5,
                damageApplied: true,
                targetName: 'Goblin',
                targetCurrentHp: 15,
                damageType: 'Cold',
            });
            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'frostsChillUses', 2, 'campaign');
            // Shared speed_reduction te stamped via applySpeedReductionEffect at the direct entry.
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({ target: 'Goblin', source: "Frost's Chill", effect: 'speed_reduction', value: 10, duration: 'until_start_of_next_turn' }),
            ]), 'campaign');
            expect(addExpiration).toHaveBeenCalledTimes(1);

            // Direct owns its damage-roll log — lowercase 'cold damage', distinct from the
            // shared logAncestryDamageRoll helper's 'Cold damage' used by dispatch.
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                characterName: 'TestHero',
                name: "Frost's Chill Damage",
                targetName: 'Goblin',
                damageType: 'Cold',
                total: 5,
                formula: '1d6',
                rolls: [5],
                description: "TestHero used Frost's Chill to deal 5 cold damage to Goblin.",
            }));
        });

        it('runs the shared frostsChillAttackerGate at the direct entry with zero spend/te/clock', async () => {
            makeUsesMock('frostsChillUses', 3);
            findLastAttack.mockResolvedValue({
                attackEvent: { rollType: 'attack', hit: true },
                attackerName: 'Orc',
                targetName: 'Goblin',
            });

            const result = await handleFrostsChillDirect(directAction, makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Frost's Chill can only be used after you make an attack. Wait for your turn.");
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });
});
