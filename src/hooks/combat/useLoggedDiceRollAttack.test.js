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
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
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
    hasEmpoweredEvocation: vi.fn(),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
}));

vi.mock('./useLoggedDiceRollUtils.js', () => ({
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    dispatchUnbreakableMajestySave,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './useLoggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

describe('createLogAndShow (useLoggedDiceRollAttack)', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe('basic attack roll', () => {
        it('rolls two d20s and logs the result', async () => {
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(rollD20).toHaveBeenCalledTimes(2);
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                rollType: 'attack',
                name: 'Longsword',
                characterName: 'TestFighter',
            }));
        });

        it('sets popupHtml with d20 type', async () => {
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'd20',
                rollType: 'attack',
                name: 'Longsword',
            }));
        });

        it('determines hit when effectiveD20 + bonus >= effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 17 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
            }));
        });

        it('determines miss when effectiveD20 + bonus < effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 22 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
            }));
        });

        it('handles no target (undefined hit)', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {});
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: undefined,
            }));
        });
    });

    describe('d20Floor10', () => {
        it('floors r1 to 10 when context.d20Floor10 and r1 <= 9', async () => {
            rollD20.mockReturnValueOnce(5);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', d20Floor10: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                rolls: [5, 15],
            }));
        });
    });

    describe('coverAcBonus', () => {
        it('adds coverAcBonus to effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', coverAcBonus: 2 });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                coverAcBonus: 2,
            }));
        });
    });

    describe('auto miss', () => {
        it('marks hit as false when isAutoMiss is true', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoMiss: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                isAutoMiss: true,
            }));
        });
    });

    describe('auto crit', () => {
        it('marks isCrit when context.isAutoCrit and hit', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoCrit: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: true,
                isAutoCrit: true,
            }));
        });
    });

    describe('natural 20', () => {
        it('sets isNatural20 when r1 === 20', async () => {
            rollD20.mockReturnValueOnce(20);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isNatural20: true,
            }));
        });
    });

    describe('critical range', () => {
        it('marks isCrit when effectiveD20 falls in criticalRange', async () => {
            rollD20.mockReturnValueOnce(19);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: true,
            }));
        });

        it('does not mark isCrit when effectiveD20 is outside criticalRange', async () => {
            rollD20.mockReturnValueOnce(18);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', criticalRange: '19-20' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: false,
            }));
        });
    });

    describe('target resolution', () => {
        it('resolves player target AC from characters array', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
            const chars = [{ name: 'Ally', computedStats: { armorClass: 16 } }];
            const fn = createLogAndShow({ ...deps, characters: chars });
            await fn('Longsword', 5, 'attack', { targetName: 'Ally' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetAc: 16,
            }));
        });

        it('throws when player target has no armorClass', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Ally', type: 'player' });
            const chars = [{ name: 'Ally' }];
            const fn = createLogAndShow({ ...deps, characters: chars });
            await expect(fn('Longsword', 5, 'attack', { targetName: 'Ally' })).rejects.toThrow('has no AC defined');
        });

        it('uses target.ac for non-player targets', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetAc: 12,
            }));
        });
    });

    describe('glorious defense and defensive duelist bonuses', () => {
        it('adds gloriousDefenseBonus to effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', gloriousDefenseBonus: 2 });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                gloriousDefenseBonus: 2,
            }));
        });

        it('adds defensiveDuelistBonus to effectiveAc', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', defensiveDuelistBonus: 3 });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                defensiveDuelistBonus: 3,
            }));
        });
    });

    describe('shield and shield of faith AC bonuses', () => {
        it('adds shield AC bonus when active', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            getShieldAcBonus.mockReturnValue(5);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(getShieldAcBonus).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        });

        it('adds shield of faith AC bonus when active', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            getShieldOfFaithAcBonus.mockReturnValue(2);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            expect(getShieldOfFaithAcBonus).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        });
    });

    describe('auto damage context', () => {
        it('includes autoDamage in popupHtml when autoDamageFormula is provided', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Fireball', 0, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '8d6',
                autoDamageName: 'Fireball',
                damageType: 'fire',
            });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                autoDamage: expect.objectContaining({
                    formula: '8d6',
                    damageType: 'fire',
                }),
            }));
        });
    });

    describe('initiative roll type', () => {
        it('logs and displays initiative roll', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'initiative',
                name: 'Initiative',
            }));
        });

        it('sets tandemFootworkBonus to 0 if > 0', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(null).mockReturnValueOnce(5);
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'tandemFootworkBonus', 0, 'test-campaign');
        });
    });

    describe('save roll type', () => {
        it('logs save result when saveDc is provided', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Constitution', 3, 'save', { saveType: 'CON', saveDc: 15 });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'save',
                saveType: 'CON',
                saveDc: 15,
            }));
        });
    });

    describe('attack hit path with unbreakable majesty', () => {
        it('checks majesty when hit and target has majesty active', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Mage', ac: 10 });
            isUnbreakableMajestyActive.mockReturnValue(true);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getUnbreakableMajestySaveDc.mockReturnValue(15);
            // Mock setTimeout to avoid the 30s timeout in the promise
            const origSetTimeout = globalThis.setTimeout;
            globalThis.setTimeout = (cb) => { cb(); return 0; };
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mage' });
            globalThis.setTimeout = origSetTimeout;
            expect(isUnbreakableMajestyActive).toHaveBeenCalledWith('Mage', 'test-campaign');
            expect(markAttackerTriggeredMajesty).toHaveBeenCalledWith('Mage', 'TestFighter', 'test-campaign');
            expect(dispatchUnbreakableMajestySave).toHaveBeenCalled();
        });
    });

    describe('veteran initiative handling', () => {
        it('clears expiration effects on initiative roll', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const { clearAllExpirationEffects } = await import('../../services/rules/effects/expirations.js');
            clearAllExpirationEffects.mockReturnValue(undefined);
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            expect(clearAllExpirationEffects).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        });
    });
});
