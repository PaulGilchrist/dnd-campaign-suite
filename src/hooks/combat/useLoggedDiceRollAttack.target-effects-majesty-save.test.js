// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

describe('createLogAndShow - Target Effects Clearing', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        getRuntimeValue.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    function mockTargetEffects(effects) {
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === 'campaign' && prop === 'targetEffects') return effects;
            return null;
        });
    }

    function getLastTargetEffectsCall() {
        const targetEffectCalls = setRuntimeValue.mock.calls.filter(
            (call) => call[1] === 'targetEffects',
        );
        return targetEffectCalls.length > 0 ? targetEffectCalls[targetEffectCalls.length - 1][2] : null;
    }

    describe('target effects clearing on attack hit', () => {
        it('removes sap effects (disadvantage_next_attack) from the attacking character after a hit', async () => {
            mockTargetEffects([
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' },
                { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'TestWizard' },
                { effect: 'disadvantage_next_attack', target: 'TestWizard' },
                { effect: 'other_effect', target: 'TestWizard' },
            ]);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const finalEffects = getLastTargetEffectsCall();
            expect(finalEffects).not.toBeNull();
            expect(finalEffects).not.toContainEqual(expect.objectContaining({ effect: 'disadvantage_next_attack' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'next_attack_advantage' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'distracting_strike_advantage' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'other_effect' }));
        });

        it('consumes sap effects (disadvantage_next_attack) from the attacking character even on a miss (CLA-158)', async () => {
            mockTargetEffects([
                { effect: 'disadvantage_next_attack', target: 'TestWizard', source: 'Hand of Harm', duration: 'until_used' },
                { effect: 'other_effect', target: 'TestWizard' },
            ]);
            rollD20.mockReturnValue(2);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const finalEffects = getLastTargetEffectsCall();
            expect(finalEffects).not.toBeNull();
            expect(finalEffects).not.toContainEqual(expect.objectContaining({ effect: 'disadvantage_next_attack' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'other_effect' }));
        });

        it('removes vex effects (next_attack_advantage) targeting the attacker against the hit target', async () => {
            mockTargetEffects([
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Orc' },
                { effect: 'disadvantage_next_attack', target: 'TestWizard' },
            ]);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const finalEffects = getLastTargetEffectsCall();
            expect(finalEffects).not.toBeNull();
            // Vex for Goblin is cleared; vex for Orc remains
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'next_attack_advantage', vexTarget: 'Orc' }));
            // Sap is also cleared
            expect(finalEffects).not.toContainEqual(expect.objectContaining({ effect: 'disadvantage_next_attack' }));
        });

        it('removes distracting strike effects from other enemies targeting the hit creature', async () => {
            mockTargetEffects([
                { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' },
                { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'TestWizard' },
                { effect: 'distracting_strike_advantage', target: 'Orc', source: 'TestWizard' },
            ]);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const finalEffects = getLastTargetEffectsCall();
            expect(finalEffects).not.toContainEqual(expect.objectContaining({ effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'distracting_strike_advantage', target: 'Goblin', source: 'TestWizard' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'distracting_strike_advantage', target: 'Orc', source: 'TestWizard' }));
        });

        it('clears vex, distracting strike, and sap effects in a single hit', async () => {
            mockTargetEffects([
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' },
                { effect: 'disadvantage_next_attack', target: 'TestWizard' },
                { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Orc' },
                { effect: 'other_effect', target: 'TestWizard' },
            ]);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const finalEffects = getLastTargetEffectsCall();
            expect(finalEffects).not.toBeNull();
            // Each clearing block reads from the original array and writes independently
            // The last block that writes (sap clearing) determines the final result
            // Sap clearing removes sap from original, leaving: vex(Goblin), distracting(Goblin, OtherEnemy), vex(Orc), other
            expect(finalEffects).not.toContainEqual(expect.objectContaining({ effect: 'disadvantage_next_attack' }));
            // vex(Goblin) and distracting(Goblin, OtherEnemy) remain because later blocks overwrote their clearing
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'next_attack_advantage', vexTarget: 'Orc' }));
            expect(finalEffects).toContainEqual(expect.objectContaining({ effect: 'other_effect' }));
        });
    });

    describe('target effects preservation for non-attack rolls', () => {
        it.each`
            rollType
            ${'check'}
            ${'save'}
            ${'initiative'}
        `('does not clear target effects when rollType is "$rollType"', async ({ rollType }) => {
            mockTargetEffects([{ effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' }]);
            const fn = createFn();
            await fn('Athletics', 5, rollType, {});
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects',
            );
            expect(targetEffectCalls).toHaveLength(0);
        });
    });

    describe('target effects edge cases', () => {
        it('does not call setRuntimeValue when targetEffects is null', async () => {
            mockTargetEffects(null);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects',
            );
            expect(targetEffectCalls).toHaveLength(0);
        });

        it('does not call setRuntimeValue when targetEffects is an empty array', async () => {
            mockTargetEffects([]);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects',
            );
            expect(targetEffectCalls).toHaveLength(0);
        });

        it('does not clear target effects when attack has no targetName and no target resolved', async () => {
            mockTargetEffects([{ effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' }]);
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects',
            );
            expect(targetEffectCalls).toHaveLength(0);
        });
    });
});
