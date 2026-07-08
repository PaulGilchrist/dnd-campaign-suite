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
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 5 })),
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
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { getEmpoweredEvocationFeatures } from '../../services/rules/spells/postCastRiderService.js';
import {
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';

describe('createLogAndShow - Target Effects', () => {
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
        rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        getEmpoweredEvocationFeatures.mockReturnValue([]);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    function getLastTargetEffectsCall() {
        const targetEffectCalls = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'targetEffects'
        );
        return targetEffectCalls.length > 0 ? targetEffectCalls[targetEffectCalls.length - 1][2] : null;
    }

    describe('target effects clearing on attack hit', () => {
        it('removes sap effects from targetEffects after a hit', async () => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') {
                    return [
                        { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                        { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' },
                        { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'TestWizard' },
                        { effect: 'disadvantage_next_attack', target: 'TestWizard' },
                        { effect: 'other_effect', target: 'TestWizard' },
                    ];
                }
                return null;
            });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const finalEffects = getLastTargetEffectsCall();
            expect(finalEffects).not.toBeNull();
            expect(finalEffects.every(e => e.effect !== 'disadvantage_next_attack')).toBe(true);
            expect(finalEffects.some(e => e.effect === 'next_attack_advantage')).toBe(true);
            expect(finalEffects.some(e => e.effect === 'distracting_strike_advantage')).toBe(true);
            expect(finalEffects.some(e => e.effect === 'other_effect')).toBe(true);
        });

        it.each`
            rollType     | context
            ${'check'}   | ${{}}
            ${'save'}    | ${{}}
            ${'initiative'} | ${{}}
        `('does not clear target effects when rollType is "$rollType"', async ({ rollType }) => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') {
                    return [{ effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' }];
                }
                return null;
            });
            const fn = createFn();
            await fn('Athletics', 5, rollType, {});
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });

        it('does not clear target effects when targetEffects is empty', async () => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') return [];
                return null;
            });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });

        it('does not clear target effects when no targetName', async () => {
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                autoDamageFormula: '1d10',
                damageType: 'fire',
            });
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBe(0);
        });
    });
});
