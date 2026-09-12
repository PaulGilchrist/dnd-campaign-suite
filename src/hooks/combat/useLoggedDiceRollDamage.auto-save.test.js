// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
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
    evaluateAutoExpression: vi.fn((expr) => {
        const match = expr.match(/^(\d+)d(\d+)\+(\d+)/);
        if (match) return parseInt(match[1]) + parseInt(match[3]);
        return 0;
    }),
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
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
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
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterSave, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';

describe('Contact Other Plane auto-save', () => {
    const deps = {
        characterName: 'Warlock1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Warlock1', computedStats: { armorClass: 14 } }],
        charactersRef: { current: [{ name: 'Warlock1', computedStats: { armorClass: 14 } }] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const playerStats = {
        automation: {
            passives: [
                { type: 'passive_rule', effect: 'contact_patron_auto_save' },
            ],
        },
    };

    const autoSaveContext = {
        targetName: 'Warlock1',
        damageType: 'psychic',
        saveDc: 15,
        saveType: 'WIS',
        dcSuccess: 'half',
        playerStats,
    };

    const nonAutoSaveContext = {
        targetName: 'Warlock1',
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'half',
        playerStats,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        computeDamageAfterSave.mockImplementation((total, success) =>
            success ? Math.floor(total / 2) : total
        );
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 10, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Warlock1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
        });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('applies auto-save for Contact Other Plane when caster is the target', async () => {
        const fn = createFn();
        await fn('Contact Other Plane', '4d6', 14, [3, 4, 5, 2], 0, autoSaveContext);

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                name: 'Contact Other Plane',
                saveResult: 'success',
                note: 'contact_patron_damage_roll_before_apply',
                targetName: 'Warlock1',
                damageType: 'psychic',
                formula: '4d6',
                total: 14,
            })
        );

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Warlock1', 7, ['psychic'], 'test-campaign', null, { ignoreResistance: false, attackerName: 'Warlock1', suppressHpLog: false, ...{ isSpellDamage: true } });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'save-damage',
                name: 'Contact Other Plane',
                contactPatron: true,
                finalDamage: 7,
                total: 7,
                damageApplied: true,
                damageReduced: false,
            })
        );

        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(
            'Warlock1',
            'test-campaign'
        );

        expect(sendSavePrompt).not.toHaveBeenCalled();
    });

    it('does not auto-save for other spells and falls through to save prompt', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, nonAutoSaveContext);

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ contactPatron: true })
        );

        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        const savePromptCall = sendSavePrompt.mock.calls[0][1];
        expect(savePromptCall).toEqual(
            expect.objectContaining({
                promptId: 'test-guid-1234',
                targetName: 'Warlock1',
                saveType: 'DEX',
                saveDc: 15,
                dcSuccess: 'half',
                damageType: 'fire',
            })
        );

        expect(deps.pendingSaves).toHaveProperty('test-guid-1234');
    });

    it('does not auto-save when target is not the caster', async () => {
        const allyContext = {
            ...autoSaveContext,
            targetName: 'Ally1',
        };

        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player', ac: 16, currentHp: 30, maxHp: 30 }],
        });

        const fn = createFn();
        await fn('Contact Other Plane', '4d6', 14, [3, 4, 5, 2], 0, allyContext);

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ contactPatron: true })
        );

        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(deps.pendingSaves).toHaveProperty('test-guid-1234');
    });

    it('does not auto-save when character has no contact_patron_auto_save passive', async () => {
        const noPassiveStats = {
            automation: {
                passives: [],
            },
        };

        const context = {
            ...autoSaveContext,
            playerStats: noPassiveStats,
        };

        const fn = createFn();
        await fn('Contact Other Plane', '4d6', 14, [3, 4, 5, 2], 0, context);

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(deps.pendingSaves).toHaveProperty('test-guid-1234');
    });
});
