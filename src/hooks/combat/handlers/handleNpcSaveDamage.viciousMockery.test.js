import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../../services/combat/automation/automationService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { triggerViciousMockeryForGeneric } from '../../../services/rules/features/viciousMockeryService.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage — Vicious Mockery save gate (CLA-377)', () => {
    const vmSpell = { name: 'Vicious Mockery', level: 0, baseLevel: 0, dc: { dc_type: 'wis' } };

    const deps = {
        characterName: 'TestBard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestBard' },
            { name: 'Thug 1', computedStats: { saveBonuses: { wis: 0 } } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const combatSummary = {
        creatures: [{ name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32 }],
    };

    const vmContext = {
        targetName: 'Thug 1',
        saveDc: 19,
        saveType: 'wis',
        dcSuccess: 'none',
        damageType: 'Psychic',
        isCantrip: true,
        playerStats: { name: 'TestBard' },
        viciousMockerySpell: vmSpell,
        viciousMockeryMapName: 'test-map',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 13, rolls: [3, 3, 1, 6], modifier: 0 });
        getRuntimeValue.mockReset().mockImplementation((key, prop) => {
            if (key === 'Thug 1' && prop === 'activeConditions') return [];
            return null;
        });
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue({ roll: 4, total: 4, bonus: 0, success: false, rawRolls: [4] });
        applyDamageToTarget.mockImplementation((cs, name, dmg) => Promise.resolve({ finalDamage: dmg, newHp: 32 - dmg }));
    });

    function call(contextOverride = {}) {
        const fn = createNpcSaveDamageHandler(deps);
        return fn({ name: 'Vicious Mockery', formula: '4d6', total: 13, rolls: [3, 3, 1, 6], modifier: 0, context: { ...vmContext, ...contextOverride }, adjustedTotal: 13, combatSummary: combatSummary });
    }

    it('triggers Vicious Mockery on a FAILED save with spell, target and caster', async () => {
        await call();

        expect(triggerViciousMockeryForGeneric).toHaveBeenCalledTimes(1);
        expect(triggerViciousMockeryForGeneric).toHaveBeenCalledWith(
            vmSpell,
            { spellSaveDc: 19, targetName: 'Thug 1' },
            { name: 'TestBard' },
            'test-campaign',
            'test-map',
        );
    });

    it('does NOT trigger Vicious Mockery on a SUCCESSFUL save', async () => {
        rollSaveForCreature.mockReturnValue({ roll: 19, total: 19, bonus: 0, success: true, rawRolls: [19] });

        await call();

        expect(triggerViciousMockeryForGeneric).not.toHaveBeenCalled();
    });

    it('logs zero-damage save success without any condition application', async () => {
        rollSaveForCreature.mockReturnValue({ roll: 19, total: 19, bonus: 0, success: true, rawRolls: [19] });

        await call();

        const damageLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.rollType === 'save-damage');
        expect(damageLog).toBeDefined();
        expect(damageLog.saveResult).toBe('success');
        expect(damageLog.finalDamage).toBe(0);
        const conditionLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition');
        expect(conditionLogs).toHaveLength(0);
    });

    it('logs the failed save and still triggers the disadvantage effect', async () => {
        await call();

        const damageLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.rollType === 'save-damage');
        expect(damageLog).toBeDefined();
        expect(damageLog.saveResult).toBe('failure');
        expect(triggerViciousMockeryForGeneric).toHaveBeenCalledTimes(1);
    });

    it('does not trigger for non-Vicious-Mockery save spells', async () => {
        await call({ viciousMockerySpell: undefined, viciousMockeryMapName: undefined });

        expect(triggerViciousMockeryForGeneric).not.toHaveBeenCalled();
    });

    it('keeps rolling and logging damage when trigger service rejects', async () => {
        triggerViciousMockeryForGeneric.mockRejectedValueOnce(new Error('Handler failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await call();

        expect(consoleSpy).toHaveBeenCalledWith(
            '[handleNpcSaveDamage] Vicious Mockery trigger failed:',
            expect.any(Error),
        );
        expect(deps.setPopupHtml).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
