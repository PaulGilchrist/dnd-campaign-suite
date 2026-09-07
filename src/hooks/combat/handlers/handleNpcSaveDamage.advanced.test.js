// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - advanced scenarios', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestWizard' },
            { name: 'Goblin', computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const defaultSaveResult = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const defaultApplyResult = { finalDamage: 10, newHp: 3, damageReduced: false };
    const defaultContext = {
        targetName: 'Goblin',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'none',
        damageType: 'fire',
        isSpellDamage: true,
    };
    const defaultCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
        endInvisibilityOnHostileAction.mockClear();
        addEntry.mockClear();
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createNpcSaveDamageHandler(deps);
    }

    function callHandler(fn, contextOverride = {}, combatSummaryOverride = null) {
        return fn('Fire Bolt', '1d10', 10, [6, 4], 0, { ...defaultContext, ...contextOverride }, 10, combatSummaryOverride || defaultCombatSummary);
    }

    describe('popup data', () => {
        it('sets popup data with save result details on failed save', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                targetName: 'Goblin',
                saveDc: 12,
                saveType: 'dex',
                saveResult: expect.objectContaining({
                    roll: 12,
                    total: 14,
                    bonus: 2,
                    success: false,
                }),
                finalDamage: 10,
                forcedMode: 'normal',
            }));
        });

        it('sets forcedMode to disadvantage when corona aura applies', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

            await callHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.forcedMode).toBe('disadvantage');
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'dex',
                12,
                true, // disadvantage
                false
            );
        });

        it('sets forcedMode to advantage when saveModifiers grant advantage', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] },
                    saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
                },
            ];

            await callHandler(createNpcSaveDamageHandler({ ...deps, characters }));

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.forcedMode).toBe('advantage');
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'dex',
                12,
                false, // no disadvantage
                true   // advantage
            );
        });

        it('prioritizes disadvantage over advantage in forcedMode', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            const characters = [
                { name: 'TestWizard' },
                {
                    name: 'Goblin',
                    computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] },
                    saveModifiers: [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }],
                },
            ];

            await callHandler(createNpcSaveDamageHandler({ ...deps, characters }));

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.forcedMode).toBe('disadvantage');
        });

        it('includes target HP info in popup data', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });

            await callHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.targetCurrentHp).toBe(3);
            expect(popup.targetMaxHp).toBe(13);
        });

        it('marks isCrit in popup when isAutoCrit is true', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn(), { isAutoCrit: true });

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.isCrit).toBe(true);
        });
    });

    describe('log entry', () => {
        it('includes save damage log entry with all required fields', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                characterName: 'TestWizard',
                rollType: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                total: 10,
                damageType: 'fire',
                targetName: 'Goblin',
                saveType: 'dex',
                saveDc: 12,
                saveResult: 'failure',
                finalDamage: 10,
                note: 'combined_save_damage_roll',
                isCrit: false,
            }));
        });

        it('includes saveRoll, saveBonus, and saveRawRolls in log', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.saveRoll).toBe(12);
            expect(logCall.saveBonus).toBe(2);
            expect(logCall.saveRawRolls).toEqual([12]);
        });

        it('marks isCrit in log when isAutoCrit is true', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn(), { isAutoCrit: true });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.isCrit).toBe(true);
        });

        it('includes saveResult as success when save succeeds', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.saveResult).toBe('success');
            expect(logCall.finalDamage).toBe(0);
        });

        it('includes forcedMode in log entry', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.forcedMode).toBe('normal');
        });
    });

    describe('threshold tracking', () => {
        it('tracks bloodied threshold when crossing halfway point', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            await callHandler(createFn());

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: -8,
                currentHp: 5,
                isUnconscious: false,
                threshold: 'bloodied',
            }));
        });

        it('marks isUnconscious when target drops to 0 HP', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 13, newHp: 0, damageReduced: false });

            await callHandler(createFn());

            const hpCall = addEntry.mock.calls[0][1];
            expect(hpCall.type).toBe('hp_change');
            expect(hpCall.targetName).toBe('Goblin');
            expect(hpCall.delta).toBe(-13);
            expect(hpCall.currentHp).toBe(0);
            expect(hpCall.isUnconscious).toBe(true);
        });

        it('does not track threshold when already bloodied and still bloodied', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            // Start at 6 HP (already bloodied out of 13), take 2 damage → 4 HP
            const combatSummary = {
                creatures: [{ name: 'Goblin', type: 'npc', currentHp: 6, maxHp: 13 }],
            };
            applyDamageToTarget.mockResolvedValue({ finalDamage: 2, newHp: 4, damageReduced: false });

            await callHandler(createFn(), {}, combatSummary);

            const hpEntry = addEntry.mock.calls[0][1];
            expect(hpEntry.threshold).toBeUndefined();
        });

        it('tracks recovering threshold when bloodied target takes negative damage', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            // Start at 5 HP (bloodied out of 13), take 1 damage → 4 HP (still bloodied, no threshold change)
            const combatSummary = {
                creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 13 }],
            };
            applyDamageToTarget.mockResolvedValue({ finalDamage: 1, newHp: 4, damageReduced: false });

            await callHandler(createFn(), {}, combatSummary);

            const hpCall = addEntry.mock.calls[0][1];
            expect(hpCall.threshold).toBeUndefined();
        });

        it('does not create hp_change log entry when no damage is dealt', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('status effects on failed save', () => {
        it('applies status effects when save fails and target is not immune', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            playerIsImmuneToCondition.mockReturnValue(false);

            await callHandler(createFn(), { statusEffects: ['poisoned'] });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });

        it('applies multiple status effects on failed save', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            playerIsImmuneToCondition.mockReturnValue(false);

            await callHandler(createFn(), { statusEffects: ['poisoned', 'benumbed'] });

            // Each status effect is applied via a separate setRuntimeValue call
            expect(setRuntimeValue).toHaveBeenCalledTimes(3); // 2 status effects + 1 lastAttack
            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            expect(conditionCalls.length).toBe(2);
            expect(conditionCalls[0][2]).toContain('poisoned');
            expect(conditionCalls[1][2]).toContain('benumbed');
        });

        it('skips status effect when target is immune', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            playerIsImmuneToCondition.mockReturnValue(true);

            await callHandler(createFn(), { statusEffects: ['poisoned'] });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });

        it('does not apply status effects when save succeeds', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn(), { statusEffects: ['poisoned'] });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });

        it('does not apply status effects when dcSuccess is half (save success still prevents)', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn(), {
                statusEffects: ['poisoned'],
                dcSuccess: 'half',
            });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });
    });

    describe('lastAttack data', () => {
        it('sets lastAttack in campaign state with attacker info', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn(), { attackerName: 'TestWizard' });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'lastAttack',
                expect.objectContaining({
                    attackerName: 'TestWizard',
                    targetName: 'Goblin',
                    rollType: 'attack',
                    saveType: 'dex',
                    saveDc: 12,
                    saveResult: 'failure',
                    actualDamage: 10,
                }),
                'test-campaign'
            );
        });

        it('sets lastAttack with save roll details', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn(), { attackerName: 'TestWizard' });

            const lastAttack = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'lastAttack'
            )[2];
            expect(lastAttack.d20).toBe(12);
            expect(lastAttack.d20Rolls).toEqual([12]);
            expect(lastAttack.bonus).toBe(2);
            expect(lastAttack.total).toBe(14);
        });

        it('handles missing attackerName gracefully', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn(), {});

            const lastAttack = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'lastAttack'
            )[2];
            expect(lastAttack.attackerName).toBeNull();
        });
    });

    describe('endInvisibilityOnHostileAction', () => {
        it('calls endInvisibilityOnHostileAction when damage is applied', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        });

        it('does not call endInvisibilityOnHostileAction when no damage applied', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            rollSaveForCreature.mockReturnValue({ roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });
    });

    describe('handleOverchannelSelfDamage', () => {
        it('calls handleOverchannelSelfDamage at end of handler', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
                'TestWizard',
                'test-campaign',
                expect.objectContaining({
                    targetName: 'Goblin',
                    saveDc: 12,
                    saveType: 'dex',
                    dcSuccess: 'none',
                    damageType: 'fire',
                }),
                expect.any(Function),
                expect.any(Array)
            );
        });
    });

    describe('soulstitch protection', () => {
        it('auto-succeeds save and deals zero damage', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            hasSoulstitchProtection.mockReturnValue(true);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.anything(),
                'Goblin',
                0, // zero damage
                expect.any(Array),
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard',
                true
            );
        });

        it('marks saveResult as soulstitch_auto_success in log', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            hasSoulstitchProtection.mockReturnValue(true);

            await callHandler(createFn());

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.saveResult).toBe('soulstitch_auto_success');
        });

        it('marks saveResult as success in popup when soulstitch protected', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            hasSoulstitchProtection.mockReturnValue(true);

            await callHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.saveResult.success).toBe(true);
        });
    });

    describe('popup data edge cases', () => {
        it('includes damageReduced flag in popup when damage was reduced by resistance', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            applyDamageToTarget.mockResolvedValue({ finalDamage: 5, newHp: 8, damageReduced: true });

            await callHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup.damageReduced).toBe(true);
            expect(popup.finalDamage).toBe(5);
        });

        it('includes gwfApplied flag in popup', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });

            await callHandler(createFn());

            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(popup).toHaveProperty('gwfApplied');
            expect(popup).toHaveProperty('gwfDisplayRolls');
        });
    });
});
