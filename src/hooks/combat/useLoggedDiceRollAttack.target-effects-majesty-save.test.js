// @improved-by-ai
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

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
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
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
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

describe('createLogAndShow - Target Effects & Empowered Evocation', () => {
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

    describe('target effects on attack', () => {
        it('clears vex effects (next_attack_advantage) when attacking the vex target', async () => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') {
                    return [
                        { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                        { effect: 'other_effect', target: 'TestWizard', vexTarget: 'Goblin' },
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
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBeGreaterThan(0);
            // Should only keep the other_effect, not the next_attack_advantage
            const clearedEffects = targetEffectCalls[0][2];
            expect(clearedEffects).toHaveLength(1);
            expect(clearedEffects[0].effect).toBe('other_effect');
        });

        it('clears distracting strike effects when attacking (source is not attacker)', async () => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') {
                    return [
                        { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'OtherEnemy' },
                        { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'TestWizard' },
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
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBeGreaterThan(0);
            const clearedEffects = targetEffectCalls[0][2];
            // Should only keep the one where source === TestWizard (attacker)
            expect(clearedEffects).toHaveLength(1);
            expect(clearedEffects[0].source).toBe('TestWizard');
        });

        it('clears sap effects (disadvantage_next_attack) when attacking', async () => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') {
                    return [
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
            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectCalls.length).toBeGreaterThan(0);
            const clearedEffects = targetEffectCalls[0][2];
            expect(clearedEffects).toHaveLength(1);
            expect(clearedEffects[0].effect).toBe('other_effect');
        });

        it('does not clear target effects when rollType is not attack', async () => {
            getRuntimeValue.mockImplementation((name, prop, _campaign) => {
                if (name === 'test-campaign' && prop === 'targetEffects') {
                    return [
                        { effect: 'next_attack_advantage', target: 'TestWizard', vexTarget: 'Goblin' },
                    ];
                }
                return null;
            });
            const fn = createFn();
            await fn('Athletics', 5, 'check', {});
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

    describe('empowered evocation with potent cantrip', () => {
        it('adds Empowered Evocation modifier to formula when getEmpoweredEvocationFeatures and isEvocation', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(2);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageSchool: 'Evocation',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            // The formula should include the Empowered Evocation modifier
            const saveDamagePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'save-damage'
            );
            expect(saveDamagePopups.length).toBeGreaterThan(0);
            expect(saveDamagePopups[0][0].formula).toContain('Empowered Evocation');
        });

        it('does not add Empowered Evocation when spell school is not evocation', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(2);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
            const fn = createFn();
            await fn('Chill Touch', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d8',
                autoDamageSchool: 'Necromancy',
                damageType: 'cold',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const saveDamagePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'save-damage'
            );
            expect(saveDamagePopups.length).toBeGreaterThan(0);
            expect(saveDamagePopups[0][0].formula).not.toContain('Empowered Evocation');
        });

        it('does not add Empowered Evocation when hasEmpoweredEvocation is false', async () => {
            hasPotentCantrip.mockReturnValue(true);
        getEmpoweredEvocationFeatures.mockReturnValue([]);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageSchool: 'Evocation',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const saveDamagePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'save-damage'
            );
            expect(saveDamagePopups.length).toBeGreaterThan(0);
            expect(saveDamagePopups[0][0].formula).not.toContain('Empowered Evocation');
        });

        it('does not add Empowered Evocation when int modifier is 0', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(0);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10',
                autoDamageSchool: 'Evocation',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            const saveDamagePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'save-damage'
            );
            expect(saveDamagePopups.length).toBeGreaterThan(0);
            expect(saveDamagePopups[0][0].formula).not.toContain('Empowered Evocation');
        });

        it('applies half damage with Empowered Evocation modifier included', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(3);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            // Total is 15, with +3 = 18, half = 9
            rollExpression.mockReturnValue({ total: 15, rolls: [7, 8], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 9, newHp: 6, damageReduced: 0 });
            const fn = createFn();
            await fn('Fire Bolt', 3, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d10+5',
                autoDamageSchool: 'Evocation',
                damageType: 'fire',
                saveDc: 13,
                saveType: 'DEX',
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            // Verify damage was applied with the adjusted formula
            expect(applyDamageToTarget).toHaveBeenCalled();
            const saveDamagePopups = deps.setPopupHtml.mock.calls.filter(
                call => call[0].type === 'save-damage'
            );
            expect(saveDamagePopups.length).toBeGreaterThan(0);
            expect(saveDamagePopups[0][0].dcSuccess).toBe('half');
        });
    });
});
