// MA-0102: Weakening Breath damage-subtract consumer — while the afflicted
// PC carries the weakening_breath te, its plain damage rolls subtract a
// rolled 1d6 (te.damageSubtractDie), the log carries weakeningBreathReduction
// / weakeningBreathRoll fields, and the popup shows the -1d6 notice. Without
// the te the flow is byte-identical (zero reduction).
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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('MA-0102 Weakening Breath damage-subtract consumer', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestFighter', computedStats: { armorClass: 16, characterAdvancement: [] } },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    it('subtracts rolled 1d6 from the afflicted attacker damage roll + logs it', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return [
                { target: 'TestFighter', effect: 'weakening_breath', source: 'Adult Gold Dragon 1', damageSubtractDie: '1d6' },
            ];
            return null;
        });
        rollExpression.mockImplementation((f) => (f === '1d6'
            ? { total: 3, rolls: [3], modifier: 0 }
            : { total: 8, rolls: [5, 3], modifier: 3 }));

        const fn = createFn();
        await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: { targetName: 'Goblin', damageType: 'slashing' } });

        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 5, ['slashing'], expect.any(Object));
        const logCall = deps.logEntry.mock.calls[0][0];
        expect(logCall.weakeningBreathReduction).toBe(3);
        expect(logCall.weakeningBreathRoll).toBe(3);
        expect(logCall.rayOfEnfeebleReduction).toBe(0);
    });

    it('popup carries weakeningBreathReduction for the -1d6 notice', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return [
                { target: 'TestFighter', effect: 'weakening_breath', source: 'Adult Gold Dragon 1', damageSubtractDie: '1d6' },
            ];
            return null;
        });
        rollExpression.mockImplementation((f) => (f === '1d6'
            ? { total: 3, rolls: [3], modifier: 0 }
            : { total: 8, rolls: [5, 3], modifier: 3 }));

        const fn = createFn();
        await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: { targetName: 'Goblin', damageType: 'slashing' } });

        const popupCall = deps.setPopupHtml.mock.calls.find(
            (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
        );
        expect(popupCall[0].weakeningBreathReduction).toBe(3);
        expect(popupCall[0].weakeningBreathRoll).toBe(3);
    });

    it('no te → zero reduction, byte-identical flow', async () => {
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 3 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

        const fn = createFn();
        await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: { targetName: 'Goblin', damageType: 'slashing' } });

        expect(rollExpression).not.toHaveBeenCalledWith('1d6');
        const logCall = deps.logEntry.mock.calls[0][0];
        expect(logCall.weakeningBreathReduction).toBe(0);
        expect(logCall.weakeningBreathRoll).toBeNull();
    });
});
