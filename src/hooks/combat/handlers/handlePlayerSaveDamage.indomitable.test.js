// @maintained-by-ai: 2026-10-14
// Seam: resolveAutoRerolls in handlePlayerSaveDamage.js — how the once-per-rest
// kill-switches (fanaticalFocusUsed, indomitableUses >= indomitableMax) and the
// autoRerollBonus expression shape the waiting-save popup. Reroll *computation*
// lives in the d20RollComputation lanes; use-count enforcement lives in
// CharSheet.handlers (indomitable lane). Max ladder validated against
// public/data/2024/classes.json (Indomitable at Fighter 9/13/17).
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js' , () => ({
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

function makeDefaultDeps(level = 17) {
    return {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestWizard', computedStats: { level, saveModifiers: [] } },
        ],
        charactersRef: { current: [{ name: 'TestWizard', computedStats: { level, saveModifiers: [] } }] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };
}

// Baseline computeConditionEffects output with reroll arming left to the caller.
function conditionEffects(overrides = {}) {
    return {
        restoreBalance: false,
        autoRerollForSaves: true,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: null,
        ...overrides,
    };
}

function setupRuntimeValues(deps, overrides) {
    getRuntimeValue.mockImplementation((key, subKey) => {
        if (overrides[key]?.[subKey] !== undefined) return overrides[key][subKey];
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return null;
    });
}

// Run the handler through the save-prompt flow and return the waiting-save popup payload.
async function popupAfterSavePrompt(deps, context = DEFAULT_CONTEXT, combatSummary = DEFAULT_COMBAT_SUMMARY) {
    deps.setPopupHtml.mockClear();
    const handler = createPlayerSaveDamageHandler(deps);
    await handler({
        name: 'Fire Bolt',
        formula: '1d10',
        total: 5,
        rolls: [6],
        modifier: 0,
        context,
        adjustedTotal: 5,
        combatSummary,
        displayRolls: [6],
    });
    expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
    return deps.setPopupHtml.mock.calls[0][0];
}

describe('handlePlayerSaveDamage - autoReroll kill-switches (fanaticalFocusUsed, indomitableUses)', () => {
    let deps;

    beforeEach(() => {
        deps = makeDefaultDeps();
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        computeConditionEffects.mockReturnValue(conditionEffects());
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    // Max ladder mirrors computeIndomitableMax / 2024 classes.json:
    // Fighter 9-12 → 1 use, 13-16 → 2, 17+ → 3.
    const matrix = [
        { level: 17, uses: '0', focusUsed: undefined, expected: true, why: 'no uses spent' },
        { level: 17, uses: undefined, focusUsed: undefined, expected: true, why: 'missing uses read as zero' },
        { level: 17, uses: 'abc', focusUsed: undefined, expected: true, why: 'NaN never disables' },
        { level: 17, uses: '2', focusUsed: undefined, expected: true, why: 'below max (3)' },
        { level: 17, uses: '3', focusUsed: undefined, expected: false, why: 'uses equals max (3)' },
        { level: 17, uses: '5', focusUsed: undefined, expected: false, why: 'uses exceed max' },
        { level: 13, uses: '1', focusUsed: undefined, expected: true, why: 'max ladder at 13 allows 2' },
        { level: 13, uses: '2', focusUsed: undefined, expected: false, why: 'uses equals max at 13 (2)' },
        { level: 9, uses: '1', focusUsed: undefined, expected: false, why: 'uses equals max at feature grant (1)' },
        { level: 17, uses: '0', focusUsed: false, expected: true, why: 'focus not consumed' },
        { level: 17, uses: '0', focusUsed: true, expected: false, why: 'consumed focus disables even with indomitable available' },
    ];

    it.each(matrix)('autoReroll=$expected — lv $level, uses $uses, focusUsed $focusUsed ($why)', async ({ level, uses, focusUsed, expected }) => {
        deps.charactersRef.current = [{ name: 'TestWizard', computedStats: { level, saveModifiers: [] } }];
        setupRuntimeValues(deps, {
            TestWizard: { fanaticalFocusUsed: focusUsed, indomitableUses: uses },
        });

        const popup = await popupAfterSavePrompt(deps);

        expect(popup.autoReroll).toBe(expected);
    });

    it('never disables the halfling Lucky reroll (roll_equals_1) even when both kill-switches are tripped', async () => {
        computeConditionEffects.mockReturnValue(conditionEffects({ autoRerollCondition: 'roll_equals_1' }));
        setupRuntimeValues(deps, {
            TestWizard: { fanaticalFocusUsed: true, indomitableUses: '3' },
        });

        const popup = await popupAfterSavePrompt(deps);

        expect(popup.autoReroll).toBe(true);
        expect(popup.autoRerollCondition).toBe('roll_equals_1');
    });
});

describe('handlePlayerSaveDamage - autoRerollBonus evaluation', () => {
    let deps;

    beforeEach(() => {
        deps = makeDefaultDeps(10);
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        setupRuntimeValues(deps, {});
        evaluateAutoExpression.mockReturnValue(5);
        computeConditionEffects.mockReturnValue(conditionEffects({ autoRerollBonus: '1d4 + 2' }));
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    it('evaluates the bonus expression against the target computedStats and passes the number to the popup', async () => {
        const popup = await popupAfterSavePrompt(deps);

        const targetStats = deps.charactersRef.current[0].computedStats;
        expect(evaluateAutoExpression).toHaveBeenCalledWith('1d4 + 2', targetStats);
        expect(popup.autoRerollBonus).toBe(5);
    });

    it('passes a zero bonus through without discarding it', async () => {
        evaluateAutoExpression.mockReturnValue(0);

        const popup = await popupAfterSavePrompt(deps);

        expect(evaluateAutoExpression).toHaveBeenCalledTimes(1);
        expect(popup.autoRerollBonus).toBe(0);
    });

    it('skips evaluation when there is no expression, no computedStats, or no target in charactersRef', async () => {
        // No expression defined.
        computeConditionEffects.mockReturnValue(conditionEffects({ autoRerollBonus: null }));
        let popup = await popupAfterSavePrompt(deps);
        expect(evaluateAutoExpression).not.toHaveBeenCalled();
        expect(popup.autoRerollBonus).toBeNull();

        // Target present but without computedStats.
        computeConditionEffects.mockReturnValue(conditionEffects({ autoRerollBonus: '1d4 + 2' }));
        deps.charactersRef.current = [{ name: 'TestWizard', computedStats: undefined }];
        popup = await popupAfterSavePrompt(deps);
        expect(evaluateAutoExpression).not.toHaveBeenCalled();
        expect(popup.autoReroll).toBe(true);

        // Target not in charactersRef at all.
        deps.charactersRef.current = [];
        popup = await popupAfterSavePrompt(deps);
        expect(evaluateAutoExpression).not.toHaveBeenCalled();
        expect(popup.autoReroll).toBe(true);
    });
});
