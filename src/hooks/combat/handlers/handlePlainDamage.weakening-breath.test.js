// @maintained-by-ai: 2026-10-14
// MA-0102: Weakening Breath damage-subtract consumer (handlePlainDamage lane).
// While the afflicted attacker carries the weakening_breath te, each plain
// damage roll rolls the te's damageSubtractDie once (monsters.json Adult Gold
// Dragon: "subtracts 3 (1d6) from its damage rolls"; the die is consumed from
// the te, never hardcoded) and subtracts it from the applied damage, clamped
// at 0; the log row and the damage popup carry weakeningBreathReduction /
// weakeningBreathRoll for the DiceRollResult -1d6 notice, and the ray channel
// stays independent (0). Without the te there is no phantom 1d6 roll and the
// popup defaults to 0/null (the zero-log-row baseline lives in the base
// handlePlainDamage.test.js lane). Te grant/repeat-save lives in
// weakeningBreathService; STR-test disadvantage in d20RollComputation.
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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
        characters: [{ name: 'TestFighter' }, { name: 'Goblin' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    // Plain longsword hit (8 total); te on the attacker arms the subtract lane.
    function attack() {
        return createLogDamageAndShow(deps)({
            name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3,
            context: { targetName: 'Goblin', damageType: 'slashing' },
        });
    }

    function weakenTe(die) {
        return [{ target: 'TestFighter', effect: 'weakening_breath', source: 'Adult Gold Dragon 1', damageSubtractDie: die }];
    }

    function mockTe(weakeningRoll, die = '1d6') {
        getRuntimeValue.mockImplementation((name, key) => (name === 'campaign' && key === 'targetEffects' ? weakenTe(die) : null));
        rollExpression.mockImplementation((f) => (f === die
            ? { total: weakeningRoll, rolls: [weakeningRoll], modifier: 0 }
            : { total: 8, rolls: [5, 3], modifier: 3 }));
    }

    const damagePopup = () => deps.setPopupHtml.mock.calls.find(
        (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
    )[0];

    // Adult Gold standard 1d6; the ancient-family te proves the die is read
    // from the te (1d10, weakeningBreathService twin); reducedTotal clamps at 0.
    it.each([
        ['1d6', 3, 5],
        ['1d10', 7, 1],
        ['1d10', 12, 0],
    ])('subtracting te %s roll %i applies %i, logged and surfaced on the popup', async (die, weakeningRoll, expectedApplied) => {
        mockTe(weakeningRoll, die);
        await attack();

        expect(rollExpression).toHaveBeenCalledWith(die);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', expectedApplied, ['slashing'], expect.any(Object));

        const logRow = deps.logEntry.mock.calls[0][0];
        expect(logRow).toMatchObject({
            weakeningBreathReduction: weakeningRoll,
            weakeningBreathRoll: weakeningRoll,
            rayOfEnfeebleReduction: 0,
        });

        const popup = damagePopup();
        expect(popup.weakeningBreathReduction).toBe(weakeningRoll);
        expect(popup.weakeningBreathRoll).toBe(weakeningRoll);
    });

    it('no te → no phantom subtract roll, popup defaults 0/null', async () => {
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 3 });

        await attack();

        expect(rollExpression).not.toHaveBeenCalledWith('1d6');
        expect(rollExpression).not.toHaveBeenCalledWith('1d10');
        expect(damagePopup()).toMatchObject({ weakeningBreathReduction: 0, weakeningBreathRoll: null });
    });
});
