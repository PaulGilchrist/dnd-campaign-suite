// @maintained-by-ai: 2026-10-14
// CLA-364 BUG-C lane: handlePlayerSaveDamage hardcoded isTranceOfOrderActive:false,
// so a Trance of Order holder's save-prompt rolls never got the d20-floor-10 leg.
// Pins the seam (getRuntimeValue(target, 'tranceOfOrderActive', campaign) === true →
// computeConditionEffects option) and the real consumer: the trance modifiers emitted
// by automationModifiers.js trance_of_order (validated against public/data/2024/
// classes.json Enchantment L14) are gated by the 'trance_of_order_active' pre-target
// check in conditionEffectsInternal.js → d20Floor10/noAdvantageAgainst
// (→ applyD20Floor in d20RollComputation.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => 'test-guid-1'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    evaluateAutoExpression: vi.fn(() => 0),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    hasBuffEffect: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(async () => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(() => []),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('./damageHandlerUtils.js', () => ({
    findTargetByContext: vi.fn(() => ({ name: targetName, type: 'player' })),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    abilitySaveDisadvantageActive: vi.fn(() => false),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? 0 : total)),
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../useAllySelection.js', () => ({
    getAllyList: vi.fn(() => []),
}));

// Real computeConditionEffects, spied so the flag threading is observable.
vi.mock('../../../services/combat/conditions/conditionEffects.js', async () => {
    const actual = await vi.importActual('../../../services/combat/conditions/conditionEffects.js');
    return { ...actual, computeConditionEffects: vi.fn(actual.computeConditionEffects) };
});

import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';

const campaignName = 'test-campaign';
const targetName = 'ClockworkSorcerer';

// automationModifiers.js trance_of_order entry — the collected modifiers that
// reach the save context as computedStats.saveModifiers.
const tranceModifiers = [
    { source: 'Trance of Order', target: 'attack_roll', condition: 'trance_of_order_active', effect: 'no_advantage_against' },
    { source: 'Trance of Order', target: 'd20', condition: 'trance_of_order_active', effect: 'd20_floor_10' },
];

function runHandler(activeFlag) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === targetName && prop === 'tranceOfOrderActive') return activeFlag;
        return null;
    });
    const charactersRef = {
        current: [{ name: targetName, computedStats: { level: 20, saveModifiers: tranceModifiers } }],
    };
    return createPlayerSaveDamageHandler({
        characterName: targetName,
        campaignName,
        characters: charactersRef.current,
        charactersRef,
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    })({
        name: 'Fireball',
        formula: '8d6',
        total: 28,
        adjustedTotal: 28,
        rolls: [5],
        modifier: 0,
        context: { saveDc: 15, saveType: 'DEX', dcSuccess: 'half', damageType: 'fire' },
        combatSummary: { creatures: [{ name: targetName, type: 'player' }] },
        displayRolls: [5],
        gwfBaseRolls: [5],
        gwfDisplayRolls: [5],
    });
}

describe('CLA-364 BUG-C: player save context carries the real tranceOfOrderActive flag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads the runtime flag and threads it ===true into computeConditionEffects', async () => {
        await runHandler(true);
        expect(getRuntimeValue).toHaveBeenCalledWith(targetName, 'tranceOfOrderActive', campaignName);
        expect(computeConditionEffects).toHaveBeenCalledWith(
            expect.objectContaining({ isTranceOfOrderActive: true }),
        );

        // Strict === true gate (mirrors tranceOfOrderHandler.isActive /
        // CharSheet.conditionEffects.js) — non-boolean truthy stays false.
        await runHandler(null);
        expect(computeConditionEffects).toHaveBeenLastCalledWith(
            expect.objectContaining({ isTranceOfOrderActive: false }),
        );

        await runHandler('yes');
        expect(computeConditionEffects).toHaveBeenLastCalledWith(
            expect.objectContaining({ isTranceOfOrderActive: false }),
        );
    });

    it('consumer: trance modifiers gated on the flag — active sets d20Floor10 + noAdvantageAgainst, inactive neither', () => {
        const active = computeConditionEffects({ saveModifiers: tranceModifiers, isTranceOfOrderActive: true });
        expect(active.d20Floor10).toBe(true);
        expect(active.noAdvantageAgainst).toBe(true);

        const inactive = computeConditionEffects({ saveModifiers: tranceModifiers, isTranceOfOrderActive: false });
        expect(inactive.d20Floor10).toBe(false);
        expect(inactive.noAdvantageAgainst).toBe(false);
    });
});
