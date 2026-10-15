// @maintained-by-ai: 2026-10-14
// Owner lane: the log-writing contract for handlePlayerSaveDamage (per AGENTS.md,
// every automation must log with event details). Asserts the EXACT log rows this
// handler emits: the save-prompt row and the two forced-success save-damage rows.
// Popup payloads live in the main/.pending-data lanes, adv/dis in advantage-disadvantage,
// reroll kill-switches in .indomitable, invisibility in .endInvisibility, early
// bails in .early-paths.

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

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { getAllyList } from '../../useAllySelection.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';

const BASE_CONTEXT = {
    saveDc: 15,
    saveType: 'CON',
    dcSuccess: 'half',
    damageType: 'Poison',
    targetName: 'TestWizard',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

// The two auto-success routes converge on applyForcedSuccessSave, which logs a
// full save-damage row (auto-success, roll 20) before applying damage.
const AUTO_SUCCESS_ROUTES = [
    {
        label: 'careful spell',
        context: { ...BASE_CONTEXT, metamagicCareful: true },
        note: 'careful_spell_damage_roll_before_apply',
    },
    {
        label: 'contact patron',
        spellName: 'Contact Other Plane',
        context: {
            ...BASE_CONTEXT,
            playerStats: {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'contact_patron_auto_save' }],
                },
            },
        },
        note: 'contact_patron_damage_roll_before_apply',
    },
];

function makeDeps(overrides = {}) {
    return {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestWizard' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
        ...overrides,
    };
}

function invokeHandler(handler, context = BASE_CONTEXT, name = 'Acid Arrow') {
    return handler({
        name,
        formula: '4d4',
        total: 10,
        rolls: [3, 4, 2, 1],
        modifier: 5,
        context,
        adjustedTotal: 10,
        combatSummary: BASE_COMBAT_SUMMARY,
        displayRolls: [3, 4, 2, 1],
    });
}

describe('handlePlayerSaveDamage - log-entry contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        getAllyList.mockReturnValue(['TestWizard']);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    it('writes exactly one save-prompt roll row with the full event details', async () => {
        const deps = makeDeps();
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        // Exact match: adding or dropping a field is a contract change.
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
        expect(deps.logEntry).toHaveBeenCalledWith({
            type: 'roll',
            characterName: 'TestWizard',
            rollType: 'save-prompt',
            name: 'Acid Arrow',
            formula: '4d4',
            rolls: [3, 4, 2, 1],
            total: 10,
            modifier: 5,
            bonus: 5,
            damageType: 'Poison',
            targetName: 'TestWizard',
            saveType: 'CON',
            saveDc: 15,
            dcSuccess: 'half',
            forcedMode: 'normal',
            gwfApplied: false,
            gwfOriginalRolls: null,
        });
    });

    it('escalates forcedMode to disadvantage when metamagicHeighten is set', async () => {
        const deps = makeDeps();
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, { ...BASE_CONTEXT, metamagicHeighten: true });

        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({ rollType: 'save-prompt', forcedMode: 'disadvantage' })
        );
    });

    describe.each(AUTO_SUCCESS_ROUTES)('$label auto-success row', (route) => {
        it('logs one complete save-damage row (roll 20 success) before applying damage', async () => {
            const deps = makeDeps();
            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler, route.context, route.spellName || 'Acid Arrow');

            expect(deps.logEntry).toHaveBeenCalledTimes(1);
            expect(deps.logEntry).toHaveBeenCalledWith({
                type: 'roll',
                characterName: 'TestWizard',
                rollType: 'save-damage',
                name: route.spellName || 'Acid Arrow',
                formula: '4d4',
                rolls: [3, 4, 2, 1],
                total: 10,
                modifier: 5,
                damageType: 'Poison',
                targetName: 'TestWizard',
                saveType: 'CON',
                saveDc: 15,
                saveResult: 'success',
                saveRoll: 20,
                saveBonus: 0,
                finalDamage: null,
                note: route.note,
                gwfApplied: false,
                gwfOriginalRolls: null,
            });
        });
    });
});
