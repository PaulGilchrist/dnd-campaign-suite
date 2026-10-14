// @maintained-by-ai: 2026-10-14
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
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
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
    rollSaveForCreature: vi.fn(() => ({ roll: 4, total: 4, bonus: 0, success: false, rawRolls: [4] })),
    applyDamageToTarget: vi.fn((cs, name, dmg) => Promise.resolve({ finalDamage: dmg, newHp: 32 - dmg })),
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { triggerViciousMockeryForGeneric } from '../../../services/rules/features/viciousMockeryService.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage — Vicious Mockery save gate (CLA-377)', () => {
    // Matches public/data/spells.json: level 0, WIS save, dc_success none, Psychic.
    const vmSpell = { name: 'Vicious Mockery', level: 0, baseLevel: 0, dc: { dc_type: 'WIS', dc_success: 'none' } };

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
        attackerName: 'TestBard',
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
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Thug 1' && prop === 'activeConditions') return [];
            return null;
        });
    });

    function call(contextOverride = {}) {
        const fn = createNpcSaveDamageHandler(deps);
        return fn({
            name: 'Vicious Mockery',
            formula: '1d4',
            total: 4,
            rolls: [4],
            modifier: 0,
            context: { ...vmContext, ...contextOverride },
            adjustedTotal: 4,
            combatSummary,
        });
    }

    const saveDamageLog = () => deps.logEntry.mock.calls.map(c => c[0]).find(e => e.rollType === 'save-damage');

    it('triggers Vicious Mockery on a FAILED save with spell, target, caster and logs the failure', async () => {
        await call();

        expect(saveDamageLog().saveResult).toBe('failure');
        expect(triggerViciousMockeryForGeneric).toHaveBeenCalledTimes(1);
        expect(triggerViciousMockeryForGeneric).toHaveBeenCalledWith(
            vmSpell,
            { spellSaveDc: 19, targetName: 'Thug 1' },
            { name: 'TestBard' },
            'test-campaign',
            'test-map',
        );
    });

    it('does NOT trigger Vicious Mockery on a successful save and logs zero damage', async () => {
        rollSaveForCreature.mockReturnValueOnce({ roll: 19, total: 19, bonus: 0, success: true, rawRolls: [19] });

        await call();

        expect(triggerViciousMockeryForGeneric).not.toHaveBeenCalled();
        const log = saveDamageLog();
        expect(log.saveResult).toBe('success');
        expect(log.finalDamage).toBe(0);
    });

    it('does not trigger for non-Vicious-Mockery save spells', async () => {
        await call({ viciousMockerySpell: undefined, viciousMockeryMapName: undefined });

        expect(triggerViciousMockeryForGeneric).not.toHaveBeenCalled();
    });

    it('keeps rolling, logging and showing the popup when the trigger service rejects', async () => {
        triggerViciousMockeryForGeneric.mockRejectedValueOnce(new Error('Handler failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await call();

        expect(consoleSpy).toHaveBeenCalledWith(
            '[handleNpcSaveDamage] Vicious Mockery trigger failed:',
            expect.any(Error),
        );
        expect(saveDamageLog().saveResult).toBe('failure');
        expect(deps.setPopupHtml).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
