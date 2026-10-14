// @maintained-by-ai: 2026-10-14
// CLA-394: Zealous Presence (2024 Barbarian, buffExpression advantage_attacks_and_saves
// stored on the target's activeBuffs by buffToggle.toggleBuff) must grant advantage on
// the NPC auto-save path: handleNpcSaveDamage resolveSaveAdvantage → rollSaveForCreature.
// buffToggle.js stays unmocked so the seam exercised is the real hasBuffEffect lookup.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(),
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
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    evaluateAutoExpression: vi.fn(),
}));
vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));
vi.mock('../loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    clearSoulstitchStamp: vi.fn(),
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
vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));
vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? 0 : total)),
    computeDamageAfterEvasion: vi.fn((total, success) => (success ? 0 : total)),
    rollSaveForCreature: vi.fn(() => ({ roll: 5, total: 7, bonus: 2, success: false, rawRolls: [5] })),
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 5, newHp: 8, damageReduced: false })),
    normalizeSaveType: vi.fn((t) => t),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage — CLA-394 Zealous Presence save advantage', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestWizard' },
            { name: 'Goblin', computedStats: { saveBonuses: { dex: 2 }, evasionEffects: [] }, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const context = {
        attackerName: 'TestWizard',
        targetName: 'Goblin',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'half',
        damageType: 'cold',
    };
    const combatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // mockReset (not clear) — per-test activeBuffs impls must not leak between tests.
        getRuntimeValue.mockReset().mockReturnValue(null);
    });

    function targetBuffs(buffs) {
        getRuntimeValue.mockImplementation((name, key) => (name === 'Goblin' && key === 'activeBuffs' ? buffs : null));
    }

    async function callHandler() {
        await createNpcSaveDamageHandler(deps)({
            name: 'Fire Bolt', formula: '1d10', total: 10, rolls: [6, 4], modifier: 0,
            context, adjustedTotal: 10, combatSummary,
        });
    }

    function expectSaveRollAdvantage(advantage) {
        expect(rollSaveForCreature).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Goblin' }),
            'dex',
            12,
            false,
            advantage
        );
        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ forcedMode: advantage ? 'advantage' : 'normal' })
        );
    }

    it('rolls with advantage=true when the target carries the Zealous Presence buff', async () => {
        targetBuffs([{ name: 'Zealous Presence', effect: 'advantage_attacks_and_saves', duration: 'until_start_of_next_turn' }]);
        await callHandler();
        expectSaveRollAdvantage(true);
    });

    it('control: rolls with advantage=false when the buff is absent', async () => {
        await callHandler();
        expectSaveRollAdvantage(false);
    });

    it('matches on buff effect, not buff name — a same-named buff without the effect grants no advantage', async () => {
        targetBuffs([{ name: 'Zealous Presence', duration: 'until_start_of_next_turn' }]);
        await callHandler();
        expectSaveRollAdvantage(false);
    });
});
