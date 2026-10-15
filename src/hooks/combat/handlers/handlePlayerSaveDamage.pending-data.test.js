// @maintained-by-ai: 2026-10-14
// Owns the pendingSave data-shape contract: the record written into
// pendingSaves[promptId] (and handed to pendingSaveRegistry) BEFORE the
// player's save prompt resolves. Sibling lanes: adv/dis resolution →
// .advantage-disadvantage, crit/trap arms → .ma0298-crit-trap, popup/log
// payloads → base + .logging, spell-origin prompt marker → .integration.
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
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { registerPendingSavePrompt } from '../../../services/combat/auras/pendingSaveRegistry.js';

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

// Golden keyset of the pending record (buildPendingData in handlePlayerSaveDamage.js).
// Downstream save-resolution consumers (savePrompt reply handlers) read these keys —
// renaming or dropping one without updating consumers breaks the prompt flow.
const GOLDEN_PENDING_KEYS = [
    'attackerName', 'autoDamageSecondaryDamageType', 'autoDamageSecondaryFormula',
    'autoDamageSecondaryName', 'campaignName', 'dcSuccess', 'damageType', 'formula',
    'infernalWound', 'isAutoCrit', 'isCantrip', 'isSpellDamage', 'metamagicHeighten',
    'modifier', 'name', 'overchannelActive', 'overchannelSpellLevel',
    'overchannelUseCount', 'playerStats', 'rawDamage', 'repeatSave', 'rolls',
    'saveAdvantage', 'saveConditions', 'saveDc', 'saveType', 'setPopupHtml',
    'soulTomeTrap', 'statusEffects', 'targetName', 'viciousMockeryMapName',
    'viciousMockerySpell',
].sort();

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

function invokeHandler(handler, context = BASE_CONTEXT) {
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
    });
}

describe('handlePlayerSaveDamage - pending save data shape', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        getRuntimeValue.mockReturnValue(null);
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

    it('writes the exact golden keyset with inert defaults for a plain save spell', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toBeDefined();
        expect(Object.keys(pending).sort()).toEqual(GOLDEN_PENDING_KEYS);
        expect(pending).toMatchObject({
            targetName: 'TestWizard',
            rawDamage: 5,
            saveDc: 13,
            saveType: 'DEX',
            dcSuccess: 'half',
            damageType: 'Fire',
            attackerName: 'TestWizard',
            name: 'Fire Bolt',
            formula: '1d10',
            modifier: 0,
            rolls: [6],
            campaignName: 'test-campaign',
            metamagicHeighten: false,
            saveAdvantage: false,
            isCantrip: false,
            overchannelActive: false,
            overchannelUseCount: 0,
            overchannelSpellLevel: 1,
            statusEffects: [],
            viciousMockerySpell: null,
            viciousMockeryMapName: null,
            autoDamageSecondaryFormula: null,
            autoDamageSecondaryName: null,
            autoDamageSecondaryDamageType: null,
            isAutoCrit: false,
            saveConditions: null,
            soulTomeTrap: null,
            repeatSave: null,
            infernalWound: null,
            isSpellDamage: true,
        });
        expect(pending.setPopupHtml).toBe(deps.setPopupHtml);
        // The registry must hand back the very same record the seam wrote.
        expect(registerPendingSavePrompt).toHaveBeenCalledWith('test-guid-1234', pending);
    });

    it('captures unresolved prompt state — raw damage untouched, no save outcome applied yet', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        await invokeHandler(handler);

        const pending = deps.pendingSaves['test-guid-1234'];
        // dcSuccess='half' is stored as the resolution policy, not pre-applied.
        expect(pending.rawDamage).toBe(5);
        expect(pending).not.toHaveProperty('saveResult');
        expect(pending).not.toHaveProperty('finalDamage');
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        // The prompt is outstanding — waiting for the player's answer.
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ promptId: 'test-guid-1234' }));
    });

    it('rides rider context fields through to pending, preserving object references', async () => {
        const handler = createPlayerSaveDamageHandler(deps);
        const statusEffects = ['exhaustion', 'poisoned'];
        const playerStats = { level: 10, class: { name: 'Wizard' } };
        const context = {
            ...BASE_CONTEXT,
            isCantrip: true,
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryName: 'Radiant',
            autoDamageSecondaryDamageType: 'Radiant',
            viciousMockerySpell: 'Vicious Mockery',
            viciousMockeryMapName: 'map-1',
            statusEffects,
            playerStats,
        };

        await invokeHandler(handler, context);

        const pending = deps.pendingSaves['test-guid-1234'];
        expect(pending).toMatchObject({
            isCantrip: true,
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryName: 'Radiant',
            autoDamageSecondaryDamageType: 'Radiant',
            viciousMockerySpell: 'Vicious Mockery',
            viciousMockeryMapName: 'map-1',
        });
        // CLA-377: the resolved save outcome gates the VM leg downstream —
        // the arrays/stats ride through by reference, untouched.
        expect(pending.statusEffects).toBe(statusEffects);
        expect(pending.playerStats).toBe(playerStats);
    });
});
