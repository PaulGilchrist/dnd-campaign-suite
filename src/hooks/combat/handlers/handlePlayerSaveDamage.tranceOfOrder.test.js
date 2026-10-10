// @improved-by-ai
// CLA-364 BUG-C: handlePlayerSaveDamage hardcoded isTranceOfOrderActive:false,
// so a Trance of Order holder's save-prompt rolls never got the d20-floor-10
// leg. These tests pin the seam to the real runtime flag and to the real
// computeConditionEffects consumer (d20Floor10 → applyD20Floor in
// d20RollComputation.js:189, automationModifiers.js trance_of_order entry).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => 10),
    rollExpressionDoubled: vi.fn(() => 20),
    formatDamageFormula: vi.fn((f) => f),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
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
    findTargetByContext: vi.fn(() => ({ name: 'ClockworkSorcerer', type: 'player' })),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    abilitySaveDisadvantageActive: vi.fn(() => false),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? 0 : total)),
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../../useAllySelection.js', () => ({
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

function makeCharsRef() {
    return {
        current: [{
            name: targetName,
            computedStats: { level: 20, saveModifiers: tranceModifiers },
        }],
    };
}

function runHandler(activeFlag) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key !== targetName) return null;
        if (prop === 'tranceOfOrderActive') return activeFlag;
        return null;
    });
    const pendingSaves = {};
    const deps = {
        characterName: targetName,
        campaignName,
        characters: makeCharsRef().current,
        charactersRef: makeCharsRef(),
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves,
    };
    return createPlayerSaveDamageHandler(deps)({
        name: 'Fireball',
        formula: '8d6',
        total: 28,
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

    it('passes isTranceOfOrderActive:true and sets d20Floor10 when the trance is active', async () => {
        await runHandler(true);

        expect(computeConditionEffects).toHaveBeenCalledWith(
            expect.objectContaining({ isTranceOfOrderActive: true }),
        );
    });

    it('passes isTranceOfOrderActive:false and leaves d20Floor10 false when not active', async () => {
        await runHandler(null);

        expect(computeConditionEffects).toHaveBeenCalledWith(
            expect.objectContaining({ isTranceOfOrderActive: false }),
        );
    });

    it('consumer: active flag + trance modifiers yields d20Floor10; inactive stays false', () => {
        const active = computeConditionEffects({ saveModifiers: tranceModifiers, isTranceOfOrderActive: true });
        expect(active.d20Floor10).toBe(true);
        const inactive = computeConditionEffects({ saveModifiers: tranceModifiers, isTranceOfOrderActive: false });
        expect(inactive.d20Floor10).toBe(false);
    });
});
