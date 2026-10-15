// @maintained-by-ai: 2026-10-15
// Deterministic contract tests for auraOfVitalityHandler: every external
// boundary (runtime store, dice, healing, expirations, log, combat data,
// concentration, targetEffects registry) is mocked at module level, so these
// tests do not churn when unrelated app code moves.
// NB: registerTargetEffect update/append/dedup semantics are owned by
// targetEffectDefinitions.test.js — here we only pin the handler's call shape.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// registerTargetEffect update/append/dedup semantics are covered directly in
// targetEffectDefinitions.test.js — here we only pin the handler's call shape.
vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
}));

import { handle, applyAuraOfVitality, isAuraOfVitalityActive } from './auraOfVitalityHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const campaignName = 'test-campaign';
const casterName = 'Cleric';
const defaultAction = { name: 'Aura of Vitality', automation: { type: 'aura_of_vitality' } };

function makePlayerStats(overrides = {}) {
    return { name: casterName, concentrationBonus: 2, ...overrides };
}

function mockCreatures(creatures) {
    combatData.getCombatSummary.mockReturnValue({ creatures });
}

function mockDefaultCombat() {
    mockCreatures([
        { name: 'Cleric', maxHp: 50, currentHp: 25 },
        { name: 'Ally1', type: 'npc', maxHp: 50, currentHp: 40 },
    ]);
}

function mockHealDice(total, rolls = [4, 3]) {
    diceRoller.rollExpression.mockReturnValue({ total, rolls, modifier: 0, formula: '2d6' });
}

describe('auraOfVitalityHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHealDice(7);
    });

    describe('handle', () => {
        it('returns popup with all creature targets and maxTargets 1', async () => {
            mockCreatures([
                { name: 'Cleric' },
                { name: 'Ally1' },
                { name: 'Ally2' },
                { name: 'Enemy1' },
            ]);
            const result = await handle(defaultAction, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Vitality',
                    creatureTargets: ['Cleric', 'Ally1', 'Ally2', 'Enemy1'],
                    maxTargets: 1,
                }),
            });
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);
            const result = await handle(defaultAction, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns popup with empty creatureTargets when combat has no creatures', async () => {
            mockCreatures([]);
            const result = await handle(defaultAction, makePlayerStats(), campaignName, null);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    creatureTargets: [],
                    maxTargets: 1,
                }),
            });
        });

        it('passes automation through to the popup payload, defaulting to {}', async () => {
            mockDefaultCombat();
            const custom = { type: 'aura_of_vitality', healExpression: '3d6', customFlag: true };
            const withAutomation = await handle({ ...defaultAction, automation: custom }, makePlayerStats(), campaignName, null);
            expect(withAutomation.payload.automation).toEqual(custom);

            const bare = await handle({ name: 'Aura of Vitality' }, makePlayerStats(), campaignName, null);
            expect(bare.payload.automation).toEqual({});
        });
    });

    describe('applyAuraOfVitality', () => {
        it('returns null without rolling for an empty, null, or non-array target list', async () => {
            for (const targets of [[], null, 'Ally1']) {
                expect(await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, targets)).toBeNull();
            }
            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(registerTargetEffect).not.toHaveBeenCalled();
        });

        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('No combat context found'),
                }),
            });
        });

        it('returns error popup when target not found in combat', async () => {
            mockDefaultCombat();
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Unknown']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Target Unknown not found in combat'),
                }),
            });
        });

        it('returns error popup when rollExpression fails', async () => {
            mockDefaultCombat();
            diceRoller.rollExpression.mockReturnValue(null);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Failed to roll healing'),
                }),
            });
        });

        it.each([
            ['npc', { type: 'npc', maxHp: null, currentHp: 30 }],
            ['player', { type: 'player', maxHp: null, currentHp: 30 }],
        ])('returns error popup when maxHp is null for a %s creature', async (_label, creature) => {
            mockCreatures([{ name: 'Ally1', ...creature }]);
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Could not determine max HP'),
                }),
            });
            consoleSpy.mockRestore();
        });

        it.each([
            ['npc', { type: 'npc', maxHp: 50, currentHp: null }],
            ['player', { type: 'player', maxHp: 50, currentHp: null }],
        ])('returns error popup when currentHp is null for a %s creature', async (_label, creature) => {
            mockCreatures([{ name: 'Ally1', ...creature }]);
            // Player path reads HP from the runtime store — give it a valid
            // maxHp so the test exercises the currentHp guard, not maxHp's.
            useRuntimeState.getRuntimeValue.mockImplementation((entity, key) => {
                if (entity === 'Ally1' && key === 'hitPoints') return creature.maxHp;
                return null;
            });
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    description: expect.stringContaining('Could not determine current HP'),
                }),
            });
            consoleSpy.mockRestore();
        });

        // Heal-expression resolution table: every expected value is distinct
        // from the '2d6' fallback where a specific branch is under test.
        it.each([
            ['default 2d6 when nothing supplies an expression', undefined, undefined, undefined, '2d6'],
            ['custom automation healExpression', { healExpression: '2d8' }, undefined, undefined, '2d8'],
            ['spell table exact match beats default', undefined, { heal_at_slot_level: { '3': '3d6' } }, 3, '3d6'],
            ['spell table highestBelow when no exact match', undefined, { heal_at_slot_level: { '2': '2d6+bonus', '4': '4d6' } }, 3, '2d6+bonus'],
            ['falls back to default when all table levels are above slot level', undefined, { heal_at_slot_level: { '5': '6d6' } }, 3, '2d6'],
            ['falls back to default when spell has no heal_at_slot_level', undefined, { someOtherProp: true }, 3, '2d6'],
            ['spell table beats automation healExpression', { healExpression: '2d8' }, { heal_at_slot_level: { '3': '3d6' } }, 3, '3d6'],
            ['automation slotLevel overrides spellSlotLevel', { slotLevel: 3 }, { heal_at_slot_level: { '3': '3d6', '5': '5d6' } }, 5, '3d6'],
            ['defaults to slot level 3 when neither slot source is given', undefined, { heal_at_slot_level: { '3': '3d6' } }, undefined, '3d6'],
        ])('resolves heal expression: %s', async (_label, automation, spell, spellSlotLevel, expected) => {
            mockDefaultCombat();
            mockHealDice(10);
            const action = {
                name: 'Aura of Vitality',
                automation: { type: 'aura_of_vitality', ...automation },
                ...(spell ? { spell } : {}),
                ...(spellSlotLevel !== undefined ? { spellSlotLevel } : {}),
            };
            await applyAuraOfVitality(action, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(diceRoller.rollExpression).toHaveBeenCalledWith(expected);
        });

        it('does not call applyHealingToTarget when target is at full health', async () => {
            mockCreatures([{ name: 'Ally1', type: 'npc', maxHp: 50, currentHp: 50 }]);
            mockHealDice(10);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result.payload.description).toContain('Ally1');
            expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledTimes(2);
        });

        it('clamps healAmount to remaining HP when target is partially healed', async () => {
            mockCreatures([{ name: 'Ally1', type: 'npc', maxHp: 50, currentHp: 45 }]);
            mockHealDice(10);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 5, campaignName);
            expect(result.payload.description).toContain('Target heals 5 HP');
        });

        it('applies healing, registers targetEffect on target and caster, adds expirations and concentration', async () => {
            mockDefaultCombat();
            mockHealDice(8, [5, 3]);
            const result = await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Aura of Vitality',
                    description: expect.stringContaining('Ally1'),
                    automation: defaultAction.automation,
                }),
            });
            expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 8, campaignName);
            // Badge on the healed creature + same marker on the caster (free-cast check).
            expect(registerTargetEffect).toHaveBeenCalledTimes(2);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally1', 'aura_of_vitality', casterName);
            expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, casterName, 'aura_of_vitality', casterName);
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: casterName,
                targetName: 'Ally1',
                effects: [{ type: 'remove_active_buff', buffName: 'Aura of Vitality' }],
                campaignName,
                rounds: undefined,
                expireOnCreatureName: casterName,
            });
            expect(concentrationService.addConcentration).toHaveBeenCalledWith(expect.any(Object), casterName, 'Aura of Vitality', 12);
            expect(logService.addEntry).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['player', true],
            ['npc', false],
        ])('reads HP from the runtime store for %s creatures: %s', async (type, usesRuntime) => {
            mockCreatures([{ name: 'Ally1', type, maxHp: 50, currentHp: 30 }]);
            if (usesRuntime) {
                useRuntimeState.getRuntimeValue.mockImplementation((entity, key) => {
                    if (entity !== 'Ally1') return null;
                    if (key === 'hitPoints') return 50;
                    if (key === 'currentHitPoints') return 30;
                    return null;
                });
            } else {
                useRuntimeState.getRuntimeValue.mockReturnValue(null);
            }
            mockHealDice(8);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            if (usesRuntime) {
                expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Ally1', 'hitPoints');
                expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Ally1', 'currentHitPoints', campaignName);
            } else {
                expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalledWith('Ally1', 'hitPoints');
                expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalledWith('Ally1', 'currentHitPoints', campaignName);
            }
        });

        it.each([
            [null, 10],
            [5, 15],
        ])('passes concentration DC 10+bonus (%s bonus -> DC %s)', async (bonus, expectedDc) => {
            mockDefaultCombat();
            mockHealDice(8);
            await applyAuraOfVitality(defaultAction, makePlayerStats({ concentrationBonus: bonus }), campaignName, null, ['Ally1']);
            expect(concentrationService.addConcentration).toHaveBeenCalledWith(expect.any(Object), casterName, 'Aura of Vitality', expectedDc);
        });

        it('logs ability_use entry with correct description format', async () => {
            mockDefaultCombat();
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            const abilityUseCall = logService.addEntry.mock.calls[1][1];
            expect(abilityUseCall.type).toBe('ability_use');
            expect(abilityUseCall.characterName).toBe(casterName);
            expect(abilityUseCall.abilityName).toBe('Aura of Vitality');
            expect(abilityUseCall.description).toContain('Cleric casts Aura of Vitality on Ally1');
            expect(abilityUseCall.description).toContain('Target heals 8 HP');
            expect(abilityUseCall.description).toContain('rolled 2d6: 8');
        });

        it('logs hp_change entry with correct data', async () => {
            mockDefaultCombat();
            mockHealDice(8, [5, 3]);
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            const hpChangeCall = logService.addEntry.mock.calls[0][1];
            expect(hpChangeCall.type).toBe('hp_change');
            expect(hpChangeCall.targetName).toBe('Ally1');
            expect(hpChangeCall.delta).toBe(8);
            expect(hpChangeCall.currentHp).toBe(48);
            expect(hpChangeCall.maxHp).toBe(50);
            expect(hpChangeCall.isHealing).toBe(true);
            expect(hpChangeCall.sourceName).toBe(casterName);
            expect(hpChangeCall.formula).toBe('2d6');
        });

        it('swallows addEntry rejection with console.error (log failure never breaks the heal)', async () => {
            mockDefaultCombat();
            mockHealDice(8);
            const logError = new Error('log failed');
            logService.addEntry.mockRejectedValue(logError);
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            await applyAuraOfVitality(defaultAction, makePlayerStats(), campaignName, null, ['Ally1']);
            expect(console.error).toHaveBeenCalledWith('[auraOfVitality] Error:', logError);
            consoleSpy.mockRestore();
        });
    });

    describe('isAuraOfVitalityActive', () => {
        it('returns true when aura effect is active on target', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { target: 'Ally1', effect: 'aura_of_vitality', source: casterName, duration: 'concentration' },
                { target: 'Ally2', effect: 'haste', source: casterName },
            ]);
            expect(isAuraOfVitalityActive('Ally1', campaignName)).toBe(true);
        });

        it.each([
            ['aura is on another target', [{ target: 'Ally2', effect: 'aura_of_vitality', source: casterName }]],
            ['no target effects', []],
            ['targetEffects is null', null],
        ])('returns false when %s', (_label, effects) => {
            useRuntimeState.getRuntimeValue.mockReturnValue(effects);
            expect(isAuraOfVitalityActive('Ally1', campaignName)).toBe(false);
        });
    });
});
