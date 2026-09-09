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
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { isMagicMissileImmune, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Magic Missile shield immunity', () => {
    const deps = {
        characterName: 'Wizard1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const npcCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
    };

    beforeEach(() => {
        getRuntimeValue.mockReturnValue(null);
        isMagicMissileImmune.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockClear().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue(npcCombatSummary);
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('when target has shield buff and spell is Magic Missile', () => {
        it('logs damage entry with zero damage and immunity note', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '3d4+2', 8, [2, 3, 3], 2, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(deps.logEntry).toHaveBeenCalledTimes(1);
            const logArgs = deps.logEntry.mock.calls[0][0];
            expect(logArgs.type).toBe('roll');
            expect(logArgs.rollType).toBe('damage');
            expect(logArgs.name).toBe('Magic Missile');
            expect(logArgs.formula).toBe('3d4+2');
            expect(logArgs.rolls).toEqual([2, 3, 3]);
            expect(logArgs.total).toBe(8);
            expect(logArgs.modifier).toBe(2);
            expect(logArgs.damageType).toBe('force');
            expect(logArgs.targetName).toBe('Goblin');
            expect(logArgs.finalDamage).toBe(0);
            expect(logArgs.note).toBe('Shield: Immune to Magic Missile');
            expect(logArgs.isCrit).toBe(false);
        });

        it('shows damage popup with zero finalDamage and damageReduced flag', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '3d4+2', 8, [2, 3, 3], 2, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.type).toBe('damage');
            expect(popup.name).toBe('Magic Missile');
            expect(popup.formula).toBe('3d4+2');
            expect(popup.rolls).toEqual([2, 3, 3]);
            expect(popup.bonus).toBe(0);
            expect(popup.modifier).toBe(2);
            expect(popup.damageType).toBe('force');
            expect(popup.targetName).toBe('Goblin');
            expect(popup.total).toBe(8);
            expect(popup.adjustedTotal).toBe(0);
            expect(popup.targetCurrentHp).toBe(13);
            expect(popup.targetMaxHp).toBe(13);
            expect(popup.damageApplied).toBe(true);
            expect(popup.finalDamage).toBe(0);
            expect(popup.damageReduced).toBe(true);
            expect(popup.note).toBe('Shield: Immune to Magic Missile');
        });

        it('does not call applyDamageToTarget', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '3d4+2', 8, [2, 3, 3], 2, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('uses original formula (not doubled) for non-crit log entry', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '3d4+2', 8, [2, 3, 3], 2, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            const logArgs = deps.logEntry.mock.calls[0][0];
            expect(logArgs.formula).toBe('3d4+2');
            expect(logArgs.isCrit).toBe(false);
        });

        it('calls loadCombatSummary to resolve target HP', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '3d4+2', 8, [2, 3, 3], 2, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign');
        });

        it('passes through original rolls and total to both log and popup', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '4d4+1', 11, [3, 2, 4, 2], 1, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            const logArgs = deps.logEntry.mock.calls[0][0];
            expect(logArgs.rolls).toEqual([3, 2, 4, 2]);
            expect(logArgs.total).toBe(11);
            expect(logArgs.modifier).toBe(1);

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.rolls).toEqual([3, 2, 4, 2]);
            expect(popup.total).toBe(11);
            expect(popup.modifier).toBe(1);
        });
    });

    describe('when target has shield buff but spell is NOT Magic Missile', () => {
        it('does not apply immunity and proceeds with normal damage flow', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 5, [5], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(deps.logEntry).not.toHaveBeenCalledWith(
                expect.objectContaining({ note: 'Shield: Immune to Magic Missile' })
            );
        });

        it('applies immunity for lowercase spell name since source uses toLowerCase comparison', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('magic missile', '1d4+1', 3, [2, 1], 1, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ finalDamage: 0, note: 'Shield: Immune to Magic Missile' })
            );
        });
    });

    describe('edge cases', () => {
        it('handles missing target in combat summary gracefully', async () => {
            isMagicMissileImmune.mockReturnValue(true);
            loadCombatSummary.mockResolvedValue({ creatures: [] });

            const fn = createFn();
            await fn('Magic Missile', '1d4+1', 3, [2, 1], 1, {
                targetName: 'NonExistent',
                damageType: 'force',
            });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'damage',
                    finalDamage: 0,
                    targetName: 'NonExistent',
                })
            );
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('does not apply immunity for similarly named spells', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile Burst', '2d4+1', 5, [3, 2], 1, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(applyDamageToTarget).toHaveBeenCalled();
        });
    });
});
