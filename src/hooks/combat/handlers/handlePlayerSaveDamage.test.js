// @maintained-by-ai: 2026-10-14
// BASE lane: the honest core prompt flow of createPlayerSaveDamageHandler —
// prompt sequence fires once with a shared promptId, the full sendSavePrompt
// payload, the waiting-popup essentials (attacker fallback + GWF tracking).
// Owned elsewhere: pendingSave golden shape + rider/statusEffects/playerStats
// propagation → .pending-data; save-prompt log row → .logging; adv/dis
// resolution → .advantage-disadvantage; registration order + spell-origin
// marker + custom-attacker prompt → .integration; early returns → .early-paths;
// autoReroll kill-switches/bonus → .indomitable; crit/trap arms →
// .ma0298-crit-trap; endInvisibility + forced-success halving/apply →
// .endInvisibility + .logging; targetEffects → .targetEffects.
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

// Inert for the base prompt path — the handler only prompts here; the
// compute*/apply* legs run on save resolution (see .endInvisibility lane).
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
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';
import { registerPendingPopupSetter } from '../../../services/combat/auras/pendingPopupRegistry.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';

const BASE_CONTEXT = {
    saveDc: 13,
    saveType: 'DEX',
    dcSuccess: 'half',
    damageType: 'Fire',
    targetName: 'TestWizard',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

const PROMPT_ID = 'test-guid-1234';

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

function invokeHandler(handler, context = BASE_CONTEXT, eventOverrides = {}) {
    return handler({
        name: 'Fire Bolt',
        formula: '1d10',
        total: 5,
        rolls: [6],
        modifier: 0,
        context,
        adjustedTotal: 5,
        combatSummary: BASE_COMBAT_SUMMARY,
        displayRolls: [6],
        ...eventOverrides,
    });
}

describe('handlePlayerSaveDamage - core save prompt flow', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        getRuntimeValue.mockReturnValue(null);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            autoRerollCondition: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
    });

    it('runs the full prompt sequence once with a shared promptId and returns true', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const result = await invokeHandler(handler);

        expect(result).toBe(true);
        // Every side effect is keyed by the same utils.guid promptId.
        expect(registerPendingSavePrompt).toHaveBeenCalledTimes(1);
        expect(registerPendingSavePrompt).toHaveBeenCalledWith(PROMPT_ID, expect.any(Object));
        expect(registerPendingPopupSetter).toHaveBeenCalledWith(PROMPT_ID, deps.setPopupHtml);
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ promptId: PROMPT_ID }));
        expect(deps.pendingSaves).toHaveProperty(PROMPT_ID);
        // The turn always logs and pops.
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
            'TestWizard',
            'test-campaign',
            BASE_CONTEXT,
            deps.logEntry,
            deps.characters
        );
    });

    it('sends the plain save prompt with the exact core payload', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        // Full payload contract of the sendSavePrompt call (adv/dis flags →
        // .advantage-disadvantage; the spell-origin marker → .integration).
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', {
            promptId: PROMPT_ID,
            targetName: 'TestWizard',
            saveType: 'DEX',
            saveDc: 13,
            dcSuccess: 'half',
            damageFormula: '1d10',
            damageType: 'Fire',
            sourceName: 'Fire Bolt',
            sourceAttackerName: 'TestWizard',
            rawDamage: 5,
            disadvantage: false,
            advantage: false,
            isSpellDamage: true,
        });
    });

    it('shows a waiting popup with the core roll/save fields, attacker fallback, and inert GWF/reroll flags', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        expect(deps.setPopupHtml).toHaveBeenCalledWith({
            type: 'save-damage',
            name: 'Fire Bolt',
            formula: '1d10',
            rolls: [6],
            total: 5,
            bonus: 0,
            modifier: 0,
            damageType: 'Fire',
            targetName: 'TestWizard',
            saveDc: 13,
            saveType: 'DEX',
            dcSuccess: 'half',
            waitingForPlayerSave: true,
            promptId: PROMPT_ID,
            rawDamage: 5,
            attackerName: 'TestWizard',
            gwfApplied: false,
            gwfOriginalRolls: null,
            autoReroll: false,
            autoRerollBonus: null,
            autoRerollCondition: null,
        });
    });

    it('surfaces a context attackerName in the waiting popup and prompt instead of the casting character', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, { ...BASE_CONTEXT, attackerName: 'EnemyMage' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ attackerName: 'EnemyMage' })
        );
        expect(sendSavePrompt).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ sourceAttackerName: 'EnemyMage' })
        );
    });

    it('tracks applied GWF rolls in the waiting popup and the log row', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler, BASE_CONTEXT, {
            gwfBaseRolls: [6, 6],
            gwfDisplayRolls: [3, 3],
        });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({
                gwfApplied: true,
                gwfOriginalRolls: [6, 6],
            })
        );
        expect(deps.logEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                rollType: 'save-prompt',
                gwfApplied: true,
                gwfOriginalRolls: [6, 6],
            })
        );
    });
});
