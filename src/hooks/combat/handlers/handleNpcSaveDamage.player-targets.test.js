// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

import { rollExpression, rollExpressionDoubled } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance, evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - player targets', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestWizard' },
            { name: 'PlayerTarget', computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const defaultSaveResult = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const defaultContext = {
        targetName: 'PlayerTarget',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'none',
        damageType: 'fire',
    };
    const defaultCombatSummary = {
        creatures: [{ name: 'PlayerTarget', type: 'player', currentHp: 10, maxHp: 10 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 20, rolls: [6, 4, 6, 4], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        evaluateAutoExpression.mockReturnValue(0);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        endInvisibilityOnHostileAction.mockClear();
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createNpcSaveDamageHandler(deps);
    }

    function callHandler(fn, contextOverride = {}, combatSummaryOverride = null) {
        return fn({ name: 'Fire Bolt', formula: '1d10', total: 10, rolls: [6, 4], modifier: 0, context: { ...defaultContext, ...contextOverride }, adjustedTotal: 10, combatSummary: combatSummaryOverride || defaultCombatSummary });
    }

    function setupPlayerActiveConditions(conditions) {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'PlayerTarget' && prop === 'activeConditions') return conditions;
            return null;
        });
    }

    function setupPlayerHp(hp) {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'PlayerTarget' && prop === 'hitPoints') return hp;
            if (key === 'PlayerTarget' && prop === 'activeConditions') return [];
            return null;
        });
    }

    function getSetRuntimeValueCalls(prop) {
        return setRuntimeValue.mock.calls.filter((call) => call[1] === prop);
    }

    describe('death saves on dropping to 0 HP', () => {
        it('initializes death saves and death failures when player drops to 0 HP', async () => {
            setupPlayerHp(10);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 0, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            const deathSaveCalls = getSetRuntimeValueCalls('deathSaves');
            expect(deathSaveCalls.length).toBe(1);
            expect(deathSaveCalls[0]).toEqual([
                'PlayerTarget', 'deathSaves', [false, false, false], 'test-campaign',
            ]);

            const deathFailureCalls = getSetRuntimeValueCalls('deathFailures');
            expect(deathFailureCalls.length).toBe(1);
            expect(deathFailureCalls[0]).toEqual([
                'PlayerTarget', 'deathFailures', [false, false, false], 'test-campaign',
            ]);
        });

        it('does not set death saves when player takes damage but survives', async () => {
            setupPlayerHp(10);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 5, newHp: 5, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(getSetRuntimeValueCalls('deathSaves')).toHaveLength(0);
            expect(getSetRuntimeValueCalls('deathFailures')).toHaveLength(0);
        });

        it('does not set death saves for non-player targets', async () => {
            setupPlayerHp(10);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 0, damageReduced: false });

            const combatSummary = {
                creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }],
            };
            const fn = createFn();
            await fn({ name: 'Fire Bolt', formula: '1d10', total: 10, rolls: [6, 4], modifier: 0, context: { ...defaultContext, targetName: 'Goblin', }, adjustedTotal: 10, combatSummary: combatSummary });

            expect(getSetRuntimeValueCalls('deathSaves')).toHaveLength(0);
            expect(getSetRuntimeValueCalls('deathFailures')).toHaveLength(0);
        });

        it('does not set death saves when save succeeds and deals zero damage', async () => {
            setupPlayerHp(10);
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 10, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(getSetRuntimeValueCalls('deathSaves')).toHaveLength(0);
        });
    });

    describe('currentHitPoints updates', () => {
        it('updates player currentHitPoints to the value returned by applyDamageToTarget', async () => {
            setupPlayerHp(10);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 7, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PlayerTarget', 'currentHitPoints', 3, 'test-campaign'
            );
        });

        it('updates currentHitPoints even when no damage is dealt', async () => {
            setupPlayerHp(10);
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 10, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'PlayerTarget', 'currentHitPoints', 10, 'test-campaign'
            );
        });
    });

    describe('ignoreResistance with secondary damage', () => {
        it('passes ignoreResistance=true to secondary damage when player has the feat', async () => {
            setupPlayerActiveConditions([]);
            hasIgnoreResistance.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 4, newHp: 9, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
                playerStats: { name: 'TestWizard' },
            });

            // First call is secondary damage — options should carry ignoreResistance=true
            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[6].ignoreResistance).toBe(true);
        });

        it('passes ignoreResistance=false to secondary damage when player lacks the feat', async () => {
            setupPlayerActiveConditions([]);
            hasIgnoreResistance.mockReturnValue(false);
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 4, newHp: 9, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
                playerStats: { name: 'TestWizard' },
            });

            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[6].ignoreResistance).toBe(false);
        });
    });

    describe('potent cantrip', () => {
        it('halves secondary damage on save success when potent cantrip is active', async () => {
            setupPlayerActiveConditions([]);
            hasPotentCantrip.mockReturnValue(true);
            const primarySave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
            const secondarySave = { roll: 15, total: 17, bonus: 2, success: true, rawRolls: [15] };
            rollSaveForCreature.mockReturnValueOnce(primarySave).mockReturnValueOnce(secondarySave);
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 4, newHp: 9, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });

            // Secondary damage should be halved: floor(8/2) = 4
            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[2]).toBe(4);
            // Secondary should skip concentration tracking
            expect(secondaryCall[6]).toEqual(expect.objectContaining({ skipConcentration: true }));
        });

        it('does not halve secondary damage on save failure when potent cantrip is active', async () => {
            setupPlayerActiveConditions([]);
            hasPotentCantrip.mockReturnValue(true);
            const primarySave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
            const secondarySave = { roll: 10, total: 12, bonus: 2, success: false, rawRolls: [10] };
            rollSaveForCreature.mockReturnValueOnce(primarySave).mockReturnValueOnce(secondarySave);
            rollExpression.mockReturnValueOnce({ total: 8, rolls: [5, 3], modifier: 0 });
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 8, newHp: 9, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });

            // Secondary damage should NOT be halved on failed save
            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[2]).toBe(8);
        });
    });

    describe('ignoreResistance on primary damage', () => {
        it('passes ignoreResistance=true to primary damage when player has the feat', async () => {
            setupPlayerActiveConditions([]);
            hasIgnoreResistance.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { playerStats: { name: 'TestWizard' } });

            const primaryCall = applyDamageToTarget.mock.calls[0];
            expect(primaryCall[6].ignoreResistance).toBe(true);
        });

        it('passes ignoreResistance=false to primary damage when player lacks the feat', async () => {
            setupPlayerActiveConditions([]);
            hasIgnoreResistance.mockReturnValue(false);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { playerStats: { name: 'TestWizard' } });

            const primaryCall = applyDamageToTarget.mock.calls[0];
            expect(primaryCall[6].ignoreResistance).toBe(false);
        });
    });

    describe('concentrationTotalDamage with secondary', () => {
        it('passes combined total damage to primary apply when secondary damage exists', async () => {
            setupPlayerActiveConditions([]);
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 })
                .mockReturnValueOnce({ total: 5, rolls: [3, 2], modifier: 0 });
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false })
                .mockResolvedValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, {
                autoDamageSecondaryFormula: '1d6',
                autoDamageSecondaryDamageType: 'fire',
            });

            // Second call is primary damage — should include concentrationTotalDamage
            const primaryCall = applyDamageToTarget.mock.calls[1];
            expect(primaryCall[6]).toEqual(expect.objectContaining({ concentrationTotalDamage: 15 }));
        });

        it('does not pass concentrationTotalDamage when there is no secondary damage', async () => {
            setupPlayerActiveConditions([]);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            const fn = createFn();
            await callHandler(fn);

            const primaryCall = applyDamageToTarget.mock.calls[0];
            expect(primaryCall[6].concentrationTotalDamage).toBeUndefined();
        });
    });

    describe('dcSuccess=half with player targets', () => {
        it('applies full damage on failed save when dcSuccess is half without evasion', async () => {
            setupPlayerHp(10);
            rollSaveForCreature.mockReturnValue({ roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 0, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { dcSuccess: 'half' });

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'PlayerTarget', 10, expect.any(Array), 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestWizard', suppressHpLog: true });
        });

        it('applies zero damage on successful save when dcSuccess is half', async () => {
            setupPlayerHp(10);
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 10, damageReduced: false });

            const fn = createFn();
            await callHandler(fn, { dcSuccess: 'half' });

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'PlayerTarget', 0, expect.any(Array), 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestWizard', suppressHpLog: true });
        });
    });
});
