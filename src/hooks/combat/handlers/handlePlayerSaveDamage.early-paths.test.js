// @maintained-by-ai: 2026-10-14
// Guard/early-return coverage for handlePlayerSaveDamage at the DIRECT handler
// seam: target resolution, non-player target, and the careful-spell not-in-ally-list
// bail-out (the seam where the handler must touch nothing — via the
// useLoggedDiceRollDamage wrapper these fall through to plain damage and cannot be
// observed as "no side effects"). Positive careful/contact-patron application,
// invisibility seams, pending-save payloads, advantage/disadvantage and logging
// legs live in the sibling handlePlayerSaveDamage.*.test.js files and
// ../useLoggedDiceRollDamage.{careful-spell,auto-save}.test.js.

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    // Real buffToggle/deathWardHandler modules import setRuntimeValue from here.
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

// Consumers: handlePlayerSaveDamage + damageHandlerUtils — keep every named export.
vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    evaluateAutoExpression: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

// Consumer: damageHandlerUtils (applyMinDamageAdjustment only).
vi.mock('../../loggedDiceRollUtils.js', () => ({
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

// Consumer: real deathWardHandler module.
vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? 0 : total)),
    applyDamageToTarget: vi.fn(),
}));

// Must return an object — resolveTargetSaveContext reads its fields before the guards.
vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: null,
    })),
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
    getAllyList: vi.fn(() => []),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { getAllyList } from '../../useAllySelection.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';

describe('handlePlayerSaveDamage - early returns', () => {
    const makeDeps = () => ({
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestWizard' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    });

    const invoke = (handler, context, combatSummary) => handler({
        name: 'Fire Bolt', formula: '1d10', total: 5, rolls: [6], modifier: 0,
        context, adjustedTotal: 5, combatSummary, displayRolls: [6],
    });

    const expectUntouched = (deps) => {
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(computeDamageAfterSave).not.toHaveBeenCalled();
        expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('returns undefined when the target cannot be resolved from the combat summary', async () => {
        const deps = makeDeps();
        const handler = createPlayerSaveDamageHandler(deps);
        const context = { saveDc: 11, saveType: 'DEX', dcSuccess: 'half', damageType: 'Fire', targetName: 'TestWizard' };

        // Missing combat summary, missing creatures list, and a name that matches
        // no creature all resolve via findTargetByContext to no target.
        for (const combatSummary of [undefined, {}, { creatures: [{ name: 'SomeoneElse', type: 'player' }] }]) {
            expect(await invoke(handler, context, combatSummary)).toBeUndefined();
        }
        expectUntouched(deps);
    });

    it('returns undefined when the resolved target is not a player', async () => {
        const deps = makeDeps();
        const handler = createPlayerSaveDamageHandler(deps);
        const context = { saveDc: 11, saveType: 'DEX', dcSuccess: 'half', damageType: 'Fire', targetName: 'Goblin' };

        const result = await invoke(handler, context, { creatures: [{ name: 'Goblin', type: 'npc' }] });

        expect(result).toBeUndefined();
        expectUntouched(deps);
    });

    it('returns undefined for a careful spell on an ally outside the ally list, without applying damage', async () => {
        getAllyList.mockReturnValue(['OtherAlly']);
        const deps = makeDeps();
        const handler = createPlayerSaveDamageHandler(deps);
        const context = { saveDc: 11, saveType: 'DEX', dcSuccess: 'half', damageType: 'Fire', targetName: 'Ally1', metamagicCareful: true };

        const result = await invoke(handler, context, { creatures: [{ name: 'Ally1', type: 'player' }] });

        expect(result).toBeUndefined();
        expect(getAllyList).toHaveBeenCalledWith('TestWizard');
        expectUntouched(deps);
    });
});
