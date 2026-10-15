// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Byte-mirror of the real applyDamage.js save/evasion arithmetic (MA-0367
// 'full' + MA-0218 'none' zero-on-success semantics included) so the seam
// below validates against live rules, not a half-halving shortcut.
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => {
        if (!success) return raw;
        if (dcSuccess === 'half') return Math.floor(raw / 2);
        if (dcSuccess === 'full') return raw;
        return 0;
    }),
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
        if (evasionActive && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
        if (!success) return raw;
        if (dcSuccess === 'half') return Math.floor(raw / 2);
        if (dcSuccess === 'full') return raw;
        return 0;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { hasSoulstitchProtection, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterEvasion, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';

// This lane covers ONLY the createLogDamageAndShow wrapper's own-evasion seam:
// an NPC target whose computedStats.evasionEffects arm evasion through the
// wrapper's deps threading. Everything else in this lane is owned elsewhere —
// save-disadvantage auras (useLoggedDiceRollDamage.save-disadvantage), routing
// / popup schema (useLoggedDiceRollDamage.popup-data), Circle of Power evasion
// (useLoggedDiceRollDamage.circle-of-power), handler-level evasion incl.
// incapacitation denial and ledger naming (handlers/handleNpcSaveDamage),
// player-prompt evasion (useLoggedDiceRollSaves.evasion, evasionUtils).
describe('createLogDamageAndShow - NPC save-damage evasion seam', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'Goblin',
                computedStats: {
                    saveBonuses: { DEX: 3 },
                    armorClass: 12,
                    evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }],
                },
                saveModifiers: [],
            },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        isCircleOfPowerActive.mockReturnValue(false);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        applyDamageToTarget.mockImplementation((summary, name, damage) =>
            Promise.resolve({ finalDamage: damage, newHp: 13 - damage, damageReduced: false })
        );
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    function castFireball(contextOverride = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Fireball',
            formula: '8d6',
            total: 20,
            rolls: [3, 4, 5, 2, 3, 3],
            modifier: 0,
            context: {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                attackerName: 'TestWizard',
                ...contextOverride,
            },
        });
    }

    function logsOf(rollType) {
        return deps.logEntry.mock.calls.filter((call) => call[0].rollType === rollType);
    }

    it('arms evasion from the target evasionEffects: successful save takes zero damage and logs the Evasion entry first', async () => {
        rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });

        await castFireball();

        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', true);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 0, ['fire'], {
            campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false,
            attackerName: 'TestWizard', suppressHpLog: true,
        });

        const evasionLogs = logsOf('evasion');
        expect(evasionLogs).toHaveLength(1);
        expect(evasionLogs[0][0]).toEqual(expect.objectContaining({
            rollType: 'evasion',
            name: 'Evasion',
            targetName: 'Goblin',
            saveResult: 'success',
        }));
        // Evasion ledger entry is written before the combined save-damage entry.
        const evasionIdx = deps.logEntry.mock.calls.findIndex((call) => call[0].rollType === 'evasion');
        const saveDamageIdx = deps.logEntry.mock.calls.findIndex((call) => call[0].rollType === 'save-damage');
        expect(saveDamageIdx).toBeGreaterThan(evasionIdx);
    });

    it('failed save with evasion armed still pays half damage', async () => {
        rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });

        await castFireball();

        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', true);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);
        expect(logsOf('evasion')[0][0].saveResult).toBe('failure');
    });

    it('does not arm evasion when dcSuccess is not half', async () => {
        rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });

        await castFireball({ dcSuccess: 'none' });

        expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'none', false);
        // dcSuccess 'none' failures pay full damage (MA-0218 semantics), evasion untouched.
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(20);
        expect(logsOf('evasion')).toHaveLength(0);
    });
});
