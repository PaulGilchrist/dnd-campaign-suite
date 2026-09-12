// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
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

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { rollExpression, rollExpressionDoubled } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget, clearReTriggeredSequence } from '../../../services/rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage secondary damage', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestFighter',
                computedStats: {
                    armorClass: 16,
                    characterAdvancement: [{ name: 'Sentinel' }],
                },
            },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        rollExpression.mockClear().mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        rollExpressionDoubled.mockClear().mockReturnValue({ total: 16, rolls: [5, 3, 7, 1], modifier: 0 });
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        clearReTriggeredSequence.mockClear();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function setupSecondaryFormulaContext() {
        getRuntimeValue.mockImplementation((key) => {
            if (key === 'campaign') return [];
            return null;
        });
    }

    describe('secondary damage execution', () => {
        it('rolls secondary formula and applies it before primary damage', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Eldritch Blast', autoDamageSecondaryDamageType: 'force', });

            // Secondary is applied first (index 0), primary second (index 1)
            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            const secondaryCall = applyDamageToTarget.mock.calls[0];
            const primaryCall = applyDamageToTarget.mock.calls[1];
            expect(secondaryCall[1]).toBe('Goblin');
            expect(primaryCall[1]).toBe('Goblin');
        });

        it('calls clearReTriggeredSequence after secondary damage is applied', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Eldritch Blast', autoDamageSecondaryDamageType: 'force', });

            expect(clearReTriggeredSequence).toHaveBeenCalled();
        });

        it('does not apply secondary damage when formula is absent', async () => {
            setupSecondaryFormulaContext();
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        });
    });

    describe('log entry with secondary damage', () => {
        it('includes all secondary damage fields in the log entry', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Eldritch Blast', autoDamageSecondaryDamageType: 'force', });

            expect(deps.logEntry).toHaveBeenCalled();
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.secondaryName).toBe('Eldritch Blast');
            expect(logCall.secondaryFormula).toBe('1d10');
            expect(logCall.secondaryDamageType).toBe('force');
            expect(logCall.secondaryTotal).toBe(10);
            expect(logCall.secondaryRolls).toEqual([6, 4]);
            expect(logCall.secondaryFinalDamage).toBe(8);
        });

        it('omits secondary fields from log when no secondary formula', async () => {
            setupSecondaryFormulaContext();
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.secondaryName).toBeUndefined();
            expect(logCall.secondaryFormula).toBeUndefined();
            expect(logCall.secondaryDamageType).toBeUndefined();
        });
    });

    describe('popup data with secondary damage', () => {
        it('includes secondary damage fields in popup data', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Eldritch Blast', autoDamageSecondaryDamageType: 'force', });

            const popupCall = deps.setPopupHtml.mock.calls[0][0];
            expect(popupCall.secondaryName).toBe('Eldritch Blast');
            expect(popupCall.secondaryFormula).toBe('1d10');
            expect(popupCall.secondaryDamageType).toBe('force');
            expect(popupCall.secondaryTotal).toBe(10);
            expect(popupCall.secondaryRolls).toEqual([6, 4]);
            expect(popupCall.secondaryFinalDamage).toBe(8);
        });

        it('omits secondary fields from popup when no secondary formula', async () => {
            setupSecondaryFormulaContext();
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const popupCall = deps.setPopupHtml.mock.calls[0][0];
            expect(popupCall.secondaryName).toBeUndefined();
            expect(popupCall.secondaryFormula).toBeUndefined();
        });
    });

    describe('crit handling for secondary damage', () => {
        it('uses rollExpressionDoubled for secondary on critical hits', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 16, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, { targetName: 'Goblin', damageType: 'force', isAutoCrit: true, autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Eldritch Blast', autoDamageSecondaryDamageType: 'force', });

            expect(rollExpressionDoubled).toHaveBeenCalledWith('1d10');
            expect(rollExpression).not.toHaveBeenCalledWith('1d10');
        });

        it('uses rollExpression (not doubled) for secondary on non-crit', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 7, rolls: [7], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 7, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Eldritch Blast', autoDamageSecondaryDamageType: 'force', });

            expect(rollExpression).toHaveBeenCalledWith('1d10');
            expect(rollExpressionDoubled).not.toHaveBeenCalled();
        });
    });

    describe('secondary damage with different damage types', () => {
        it('passes the correct secondary damage type to applyDamageToTarget', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 5, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', autoDamageSecondaryFormula: '1d6', autoDamageSecondaryName: 'Searing Smite', autoDamageSecondaryDamageType: 'fire', });

            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[3]).toEqual(['fire']);
        });

        it('passes the correct secondary damage type when different from primary', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 4, rolls: [4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 4, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', autoDamageSecondaryFormula: '1d6', autoDamageSecondaryName: 'Searing Smite', autoDamageSecondaryDamageType: 'fire', });

            const secondaryCall = applyDamageToTarget.mock.calls[0];
            expect(secondaryCall[3]).toEqual(['fire']);
            const primaryCall = applyDamageToTarget.mock.calls[1];
            expect(primaryCall[3]).toEqual(['slashing']);
        });
    });

    describe('secondary name fallback', () => {
        it('uses autoDamageSecondaryName when provided', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 5, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast', '2d10', 10, [5, 5], 0, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Agonizing Blast', autoDamageSecondaryDamageType: 'force', });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.secondaryName).toBe('Agonizing Blast');
        });

        it('falls back to attack name when autoDamageSecondaryName is absent', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 5, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast', '2d10', 10, [5, 5], 0, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryDamageType: 'force', });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.secondaryName).toBe('Eldritch Blast');
        });
    });

    describe('endInvisibilityOnHostileAction with secondary', () => {
        it('calls endInvisibilityOnHostileAction when secondary deals damage', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 5, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast', '2d10', 10, [5, 5], 0, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Agonizing Blast', autoDamageSecondaryDamageType: 'force', });

            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        });
    });

    describe('concentration tracking with secondary', () => {
        it('passes concentrationTotalDamage combining primary and secondary to applyDamageToTarget', async () => {
            setupSecondaryFormulaContext();
            rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 5, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast', '2d10', 10, [5, 5], 0, { targetName: 'Goblin', damageType: 'force', autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Agonizing Blast', autoDamageSecondaryDamageType: 'force', });

            // Second call is the primary damage; check the options object (last arg, index 6)
            const primaryCall = applyDamageToTarget.mock.calls[1];
            const options = primaryCall[6];
            expect(options.concentrationTotalDamage).toBe(15);
        });
    });
});
