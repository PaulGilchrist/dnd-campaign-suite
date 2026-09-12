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

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
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

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';

const DEFAULT_CONTEXT = {
    saveDc: 13,
    saveType: 'DEX',
    dcSuccess: 'half',
    damageType: 'Fire',
    targetName: 'TestWizard',
};

const DEFAULT_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

function invokeHandler(handler, context = DEFAULT_CONTEXT, combatSummary = DEFAULT_COMBAT_SUMMARY) {
    return handler({ name: 'Fire Bolt', formula: '1d10', total: 5, rolls: [6], modifier: 0, context: context, adjustedTotal: 5, combatSummary: combatSummary, displayRolls: [6] });
}

function makeDefaultDeps(level = 17) {
    return {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestWizard',
                computedStats: { level, saveModifiers: [] },
            },
        ],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };
}

describe('handlePlayerSaveDamage - indomitable and fanatical focus', () => {
    let deps;

    beforeEach(() => {
        deps = makeDefaultDeps();
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: true,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    function setupRuntimeValues(overrides) {
        getRuntimeValue.mockImplementation((key, subKey) => {
            if (overrides[key]?.[subKey] !== undefined) return overrides[key][subKey];
            if (key === 'campaign' && subKey === 'targetEffects') return [];
            return null;
        });
    }

    describe('fanaticalFocusUsed', () => {
        it('disables autoRerollForSaves when fanaticalFocusUsed is true', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { fanaticalFocusUsed: true },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });

        it('does not disable autoRerollForSaves when fanaticalFocusUsed is false', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { fanaticalFocusUsed: false },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });
    });

    describe('indomitable uses tracking', () => {
        it('disables autoRerollForSaves when indomitableUses equals indomitableMax at level 17', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            // Level 17 -> indomitableMax = 3
            setupRuntimeValues({
                TestWizard: { indomitableUses: '3' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });

        it('disables autoRerollForSaves when indomitableUses exceeds indomitableMax', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            // Level 17 -> indomitableMax = 3, uses = 5 > 3
            setupRuntimeValues({
                TestWizard: { indomitableUses: '5' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });

        it('enables autoRerollForSaves when indomitableUses is below indomitableMax', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            // Level 17 -> indomitableMax = 3, uses = 2 < 3
            setupRuntimeValues({
                TestWizard: { indomitableUses: '2' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('enables autoRerollForSaves when indomitableUses is zero', async () => {
            setupRuntimeValues({
                TestWizard: { indomitableUses: '0' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('treats undefined indomitableUses as zero and enables autoRerollForSaves', async () => {
            // indomitableUses not set -> Number(undefined ?? 0) = 0
            setupRuntimeValues({});

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('treats NaN indomitableUses (non-numeric string) as below max and enables autoRerollForSaves', async () => {
            // Number('abc') = NaN, NaN >= 3 = false, so autoReroll stays true
            setupRuntimeValues({
                TestWizard: { indomitableUses: 'abc' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });
    });

    describe('indomitableMax calculation based on level', () => {
        it('sets indomitableMax to 3 for level 17+', async () => {
            deps.characters[0].computedStats.level = 17;
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { indomitableUses: '0' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('sets indomitableMax to 2 for level 13-16', async () => {
            deps.characters[0].computedStats.level = 13;
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 13, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { indomitableUses: '0' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('sets indomitableMax to 1 for level below 13', async () => {
            deps.characters[0].computedStats.level = 10;
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 10, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { indomitableUses: '0' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('sets indomitableMax to 1 for level 0 (edge case)', async () => {
            deps.characters[0].computedStats.level = 0;
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 0, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { indomitableUses: '0' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: true })
            );
        });

        it('disables autoRerollForSaves when uses equals max at level 13', async () => {
            // Level 13 -> indomitableMax = 2, uses = 2
            deps.characters[0].computedStats.level = 13;
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 13, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { indomitableUses: '2' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });

        it('disables autoRerollForSaves when uses equals max at level 10', async () => {
            // Level 10 -> indomitableMax = 1, uses = 1
            deps.characters[0].computedStats.level = 10;
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 10, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { indomitableUses: '1' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });
    });

    describe('fanaticalFocus + indomitable interaction', () => {
        it('disables autoRerollForSaves when both fanaticalFocusUsed and indomitable are exhausted', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { fanaticalFocusUsed: true, indomitableUses: '3' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });

        it('disables autoRerollForSaves when fanaticalFocusUsed is true but indomitable still available', async () => {
            deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level: 17, saveModifiers: [] } }];
            setupRuntimeValues({
                TestWizard: { fanaticalFocusUsed: true, indomitableUses: '0' },
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ autoReroll: false })
            );
        });
    });
});

describe('handlePlayerSaveDamage - autoRerollBonus evaluation', () => {
    let deps;

    beforeEach(() => {
        deps = makeDefaultDeps(10);
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        evaluateAutoExpression.mockReturnValue(5);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: true,
            autoRerollBonus: '1d4 + 2',
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    it('evaluates autoRerollBonus when present and targetChar has computedStats', async () => {
        deps.charactersRef.current = [
            { name: 'TestWizard', computedStats: { level: 10, saveModifiers: [] } },
        ];

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(evaluateAutoExpression).toHaveBeenCalledWith(
            '1d4 + 2',
            deps.characters[0].computedStats
        );
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ autoRerollBonus: 5 })
        );
    });

    it('does not evaluate autoRerollBonus when targetChar has no computedStats', async () => {
        deps.charactersRef.current = [
            { name: 'TestWizard', computedStats: undefined },
        ];
        deps.characters[0].computedStats = undefined;

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(evaluateAutoExpression).not.toHaveBeenCalled();
    });

    it('does not evaluate autoRerollBonus when targetChar is not in charactersRef', async () => {
        deps.charactersRef.current = [];

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(evaluateAutoExpression).not.toHaveBeenCalled();
    });

    it('passes null autoRerollBonus when no expression is defined', async () => {
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: true,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        deps.charactersRef.current = [
            { name: 'TestWizard', computedStats: { level: 10, saveModifiers: [] } },
        ];

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(evaluateAutoExpression).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ autoRerollBonus: null })
        );
    });

    it('passes zero autoRerollBonus when expression evaluates to 0', async () => {
        evaluateAutoExpression.mockReturnValue(0);
        deps.charactersRef.current = [
            { name: 'TestWizard', computedStats: { level: 10, saveModifiers: [] } },
        ];

        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(evaluateAutoExpression).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ autoRerollBonus: 0 })
        );
    });
});
