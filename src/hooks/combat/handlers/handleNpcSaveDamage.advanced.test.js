// @maintained-by-ai: 2026-10-14
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { playerIsImmuneToCondition } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
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

    const failedSave = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const successSave = { roll: 18, total: 20, bonus: 2, success: true, rawRolls: [18] };
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
        getRuntimeValue.mockReset().mockReturnValue(null);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(failedSave);
        applyDamageToTarget.mockResolvedValue(defaultApplyResult);
    });

    function setupActiveConditions(conditions) {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeConditions') return conditions;
            return null;
        });
    }

    function createFn(characters) {
        return createNpcSaveDamageHandler(characters ? { ...deps, characters } : deps);
    }

    function callHandler(fn, contextOverride = {}, combatSummaryOverride = null) {
        return fn({ name: 'Fire Bolt', formula: '1d10', total: 10, rolls: [6, 4], modifier: 0, context: { ...defaultContext, ...contextOverride }, adjustedTotal: 10, combatSummary: combatSummaryOverride || defaultCombatSummary });
    }

    function goblinWith(saveModifiers) {
        return [
            { name: 'TestWizard' },
            {
                name: 'Goblin',
                computedStats: { saveBonuses: { con: 2 }, evasionEffects: [] },
                saveModifiers,
            },
        ];
    }

    const againstSpellAdvantage = [{ target: 'saving_throw', effect: 'advantage', condition: 'against_spell' }];

    describe('popup data', () => {
        it('carries save result, target HP, and damage-reduced details on a failed save', async () => {
            setupActiveConditions([]);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 5, newHp: 8, damageReduced: true });

            await callHandler(createFn());

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fire Bolt',
                formula: '1d10',
                targetName: 'Goblin',
                saveDc: 12,
                saveType: 'dex',
                saveResult: expect.objectContaining(failedSave),
                finalDamage: 5,
                damageReduced: true,
                targetCurrentHp: 8,
                targetMaxHp: 13,
                forcedMode: 'normal',
            }));
        });

        // CLA-063: the corona util is async — the lane must AWAIT it. A Promise is
        // truthy but carries no .disadvantage, so this pins the await fix.
        it('CLA-063: awaited corona payload forces disadvantage mode', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'War_Cleric' });

            await callHandler(createFn());

            expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Goblin',
                damageType: 'fire',
                skipRangeCheck: true,
            }));
            expect(deps.setPopupHtml.mock.calls[0][0].forcedMode).toBe('disadvantage');
            expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'dex', 12, true, false);
        });

        it('sets forcedMode to advantage when saveModifiers grant advantage', async () => {
            setupActiveConditions([]);

            await callHandler(createFn(goblinWith(againstSpellAdvantage)));

            expect(deps.setPopupHtml.mock.calls[0][0].forcedMode).toBe('advantage');
            expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'dex', 12, false, true);
        });

        it('prioritizes disadvantage over advantage in forcedMode', async () => {
            setupActiveConditions([]);
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

            await callHandler(createFn(goblinWith(againstSpellAdvantage)));

            expect(deps.setPopupHtml.mock.calls[0][0].forcedMode).toBe('disadvantage');
        });

        it('marks isCrit in popup when isAutoCrit is true', async () => {
            setupActiveConditions([]);

            await callHandler(createFn(), { isAutoCrit: true });

            expect(deps.setPopupHtml.mock.calls[0][0].isCrit).toBe(true);
        });
    });

    describe('log entry', () => {
        it('marks isCrit in log when isAutoCrit is true', async () => {
            setupActiveConditions([]);

            await callHandler(createFn(), { isAutoCrit: true });

            expect(deps.logEntry.mock.calls[0][0].isCrit).toBe(true);
        });
    });

    describe('threshold tracking', () => {
        it('tracks bloodied threshold when crossing halfway point', async () => {
            setupActiveConditions([]);
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
            setupActiveConditions([]);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 13, newHp: 0, damageReduced: false });

            await callHandler(createFn());

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: -13,
                currentHp: 0,
                isUnconscious: true,
            }));
        });

        it('does not track threshold when already bloodied and still bloodied', async () => {
            setupActiveConditions([]);
            // Start at 6 HP (already bloodied out of 13), take 2 damage → 4 HP
            const combatSummary = {
                creatures: [{ name: 'Goblin', type: 'npc', currentHp: 6, maxHp: 13 }],
            };
            applyDamageToTarget.mockResolvedValue({ finalDamage: 2, newHp: 4, damageReduced: false });

            await callHandler(createFn(), {}, combatSummary);

            expect(addEntry.mock.calls[0][1].threshold).toBeUndefined();
        });
    });

    describe('status effects on failed save', () => {
        it('applies status effects when save fails and target is not immune', async () => {
            setupActiveConditions([]);
            playerIsImmuneToCondition.mockReturnValue(false);

            await callHandler(createFn(), { statusEffects: ['poisoned'] });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });

        it('applies multiple status effects via separate writes on failed save', async () => {
            setupActiveConditions([]);
            playerIsImmuneToCondition.mockReturnValue(false);

            await callHandler(createFn(), { statusEffects: ['poisoned', 'benumbed'] });

            // Each status effect is applied via a separate setRuntimeValue call
            const conditionCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'activeConditions'
            );
            expect(conditionCalls.map(c => c[2][c[2].length - 1])).toEqual(['poisoned', 'benumbed']);
        });

        it('skips status effect when target is immune', async () => {
            setupActiveConditions([]);
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
            setupActiveConditions([]);
            rollSaveForCreature.mockReturnValue(successSave);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn(), { statusEffects: ['poisoned'], dcSuccess: 'half' });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['poisoned']),
                'test-campaign'
            );
        });
    });

    describe('lastAttack data', () => {
        it('stamps campaign lastAttack with attacker info and save-roll details', async () => {
            setupActiveConditions([]);

            await callHandler(createFn(), { attackerName: 'TestWizard' });

            const lastAttack = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'lastAttack'
            )[2];
            expect(lastAttack).toEqual(expect.objectContaining({
                attackerName: 'TestWizard',
                targetName: 'Goblin',
                rollType: 'attack',
                saveType: 'dex',
                saveDc: 12,
                saveResult: 'failure',
                actualDamage: 10,
                d20: 12,
                d20Rolls: [12],
                bonus: 2,
                total: 14,
            }));
        });

        it('stamps attackerName as null when context omits it', async () => {
            setupActiveConditions([]);

            await callHandler(createFn(), {});

            const lastAttack = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'lastAttack'
            )[2];
            expect(lastAttack.attackerName).toBeNull();
        });
    });

    describe('endInvisibilityOnHostileAction', () => {
        it('calls endInvisibilityOnHostileAction when damage is applied', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        });

        it('does not call endInvisibilityOnHostileAction when no damage applied', async () => {
            setupActiveConditions([]);
            rollSaveForCreature.mockReturnValue(successSave);
            applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });

            await callHandler(createFn());

            expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });
    });

    describe('handleOverchannelSelfDamage', () => {
        it('calls handleOverchannelSelfDamage at end of handler', async () => {
            setupActiveConditions([]);

            await callHandler(createFn());

            expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
                'TestWizard',
                'test-campaign',
                expect.objectContaining(defaultContext),
                expect.any(Function),
                expect.any(Array)
            );
        });
    });
});
