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

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

describe('Resistance damage reduction', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function getFirstPopupCall() {
        expect(deps.setPopupHtml).toHaveBeenCalled();
        return deps.setPopupHtml.mock.calls[0][0];
    }

    describe('resistance applied', () => {
        function setupResistance(damageType, resRollTotal) {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: damageType,
                        },
                    ];
                }
                if (key === 'Goblin' && _subKey === 'resistanceUsedThisTurn') return false;
                return null;
            });
            rollExpression.mockReturnValueOnce({ total: resRollTotal, rolls: [resRollTotal], modifier: 0 });
        }

        it('rolls 1d4 and subtracts from damage when effect exists and damage type matches', async () => {
            setupResistance('fire', 3);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'resistanceUsedThisTurn',
                true,
                'test-campaign',
            );
        });

        it('passes the reduced total to applyDamageToTarget', async () => {
            setupResistance('fire', 3);
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: true });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                5, // 8 adjusted - 3 resistance
                ['fire'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard',
                true,
            );
        });

        it('includes resistanceReduction and resistanceRoll in the popup', async () => {
            setupResistance('fire', 3);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(3);
            expect(popup.resistanceRoll).toBe(3);
        });

        it('includes resistanceReduction and resistanceRoll in the log entry', async () => {
            setupResistance('fire', 3);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(deps.logEntry).toHaveBeenCalled();
            const logData = deps.logEntry.mock.calls[0][0];
            expect(logData.resistanceReduction).toBe(3);
            expect(logData.resistanceRoll).toBe(3);
        });

        it('logs an ability_use entry for the Resistance feature', async () => {
            setupResistance('fire', 3);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            const abilityCalls = addEntry.mock.calls.filter(
                (call) => call[1]?.type === 'ability_use',
            );
            expect(abilityCalls.length).toBeGreaterThan(0);
            expect(abilityCalls[0][1]).toMatchObject({
                abilityName: 'Resistance',
                characterName: 'Goblin',
            });
        });

        it('uses the resistance roll value (not zero) for reduction', async () => {
            setupResistance('fire', 1);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                7, // 8 - 1
                ['fire'],
                expect.any(String),
                expect.any(Array),
                false,
                'TestWizard',
                true,
            );
        });
    });

    describe('resistance NOT applied', () => {
        function setupNoResistance() {
            getRuntimeValue.mockImplementation((_key, _subKey) => null);
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        }

        it('does not apply resistance when damage type does not match', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'cold',
                        },
                    ];
                }
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).not.toHaveBeenCalledWith('1d4');
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'resistanceUsedThisTurn',
                true,
                expect.any(String),
            );
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(0);
            expect(popup.resistanceRoll).toBeNull();
        });

        it('does not apply resistance when the effect target does not match', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Ogre',
                            chosenType: 'fire',
                        },
                    ];
                }
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).not.toHaveBeenCalledWith('1d4');
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(0);
        });

        it('does not apply resistance when already used this turn', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'fire',
                        },
                    ];
                }
                if (key === 'Goblin' && _subKey === 'resistanceUsedThisTurn') return true;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).not.toHaveBeenCalledWith('1d4');
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'resistanceUsedThisTurn',
                true,
                expect.any(String),
            );
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(0);
        });

        it('does not apply resistance when no resistance effect exists', async () => {
            setupNoResistance();

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).not.toHaveBeenCalledWith('1d4');
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(0);
            expect(popup.resistanceRoll).toBeNull();
        });
    });

    describe('case-insensitive damage type matching', () => {
        it('applies resistance when damage type casing differs from effect type', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'Fire',
                        },
                    ];
                }
                if (key === 'Goblin' && _subKey === 'resistanceUsedThisTurn') return false;
                return null;
            });
            rollExpression.mockReturnValueOnce({ total: 2, rolls: [2], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 7, damageReduced: true });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).toHaveBeenCalledWith('1d4');
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(2);
        });

        it('applies resistance with uppercase damage type in context', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'fire',
                        },
                    ];
                }
                if (key === 'Goblin' && _subKey === 'resistanceUsedThisTurn') return false;
                return null;
            });
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [4], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 9, damageReduced: true });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'FIRE',
            });

            expect(rollExpression).toHaveBeenCalledWith('1d4');
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(4);
        });
    });

    describe('resistance clamped to zero minimum', () => {
        it('does not reduce total below zero when resistance exceeds damage', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'fire',
                        },
                    ];
                }
                if (key === 'Goblin' && _subKey === 'resistanceUsedThisTurn') return false;
                return null;
            });
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [4], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 13, damageReduced: true });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 2, [2], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                0, // max(0, 2 - 4) = 0
                ['fire'],
                expect.any(String),
                expect.any(Array),
                false,
                'TestWizard',
                true,
            );
        });
    });

    describe('resistance with multiple effects on campaign', () => {
        it('finds the resistance effect among other effects', async () => {
            getRuntimeValue.mockImplementation((key, _subKey) => {
                if (key === 'campaign') {
                    return [
                        { effect: 'some_other_effect', target: 'Goblin' },
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'fire',
                        },
                        { effect: 'another_effect', target: 'Ogre' },
                    ];
                }
                if (key === 'Goblin' && _subKey === 'resistanceUsedThisTurn') return false;
                return null;
            });
            rollExpression.mockReturnValueOnce({ total: 2, rolls: [2], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 7, damageReduced: true });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(rollExpression).toHaveBeenCalledWith('1d4');
            const popup = getFirstPopupCall();
            expect(popup.resistanceReduction).toBe(2);
        });
    });

    describe('resistance does not set flag when type mismatch', () => {
        it('does not mark resistanceUsedThisTurn when types do not match', async () => {
            getRuntimeValue.mockImplementation((_key, _subKey) => {
                if (_key === 'campaign') {
                    return [
                        {
                            effect: 'resistance_damage_reduction',
                            target: 'Goblin',
                            chosenType: 'cold',
                        },
                    ];
                }
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'resistanceUsedThisTurn',
                true,
                expect.any(String),
            );
        });
    });
});
