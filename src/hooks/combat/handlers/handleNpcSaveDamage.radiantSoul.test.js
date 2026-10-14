// @maintained-by-ai: 2026-10-14
// CLA-279: single-target save spells consume the Radiant Soul once-per-turn flag
// at save-damage application time when the formula carries the execution-owned adder.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
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
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
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
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess) => (dcSuccess === 'half' && success ? Math.floor(total / 2) : total)),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage — CLA-279 Radiant Soul consumption', () => {
    const combatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', currentHp: 13, maxHp: 13 }],
    };

    const makeDeps = (characterName = 'HexWarlock') => ({
        characterName,
        campaignName: 'test-campaign',
        characters: [
            { name: characterName },
            { name: 'Goblin', computedStats: { saveBonuses: { dex: -1 }, evasionEffects: [] } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    });

    const saveEvent = (formula, context = {}) => ({
        name: 'Hellish Rebuke',
        formula,
        total: 13,
        rolls: [6, 4, 3],
        modifier: 3,
        context: { targetName: 'Goblin', saveDc: 16, saveType: 'DEX', dcSuccess: 'half', damageType: 'Fire', attackerName: 'HexWarlock', ...context },
        adjustedTotal: 13,
        combatSummary,
    });

    // Radiant Soul flag writes only (lastAttack / targetEffects stamps excluded).
    const radiantWrites = () => setRuntimeValue.mock.calls.filter(([, key]) => String(key).startsWith('_radiantSoul_'));

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 13, rolls: [6, 4, 3], modifier: 3 });
        getRuntimeValue.mockReturnValue(null);
        rollSaveForCreature.mockReturnValue({ roll: 3, total: 2, bonus: -1, success: false, rawRolls: [3] });
        applyDamageToTarget.mockResolvedValue({ finalDamage: 13, newHp: 0, damageReduced: false });
    });

    it('writes the once-per-turn flag when the save-damage formula carries [Radiant Soul]', async () => {
        await createNpcSaveDamageHandler(makeDeps())(saveEvent('2d6 + 3 [Radiant Soul]'));

        expect(radiantWrites()).toEqual([['HexWarlock', '_radiantSoul_HexWarlock_oncePerTurn', true, 'test-campaign']]);
    });

    it('sanitizes spaces in the character name when building the flag key', async () => {
        await createNpcSaveDamageHandler(makeDeps('Hex Warlock'))(saveEvent('2d6 + 3 [Radiant Soul]', { attackerName: 'Hex Warlock' }));

        expect(radiantWrites()).toEqual([['Hex Warlock', '_radiantSoul_Hex_Warlock_oncePerTurn', true, 'test-campaign']]);
    });

    it('does NOT write the flag when formula has no [Radiant Soul] marker', async () => {
        await createNpcSaveDamageHandler(makeDeps())(saveEvent('2d6'));

        expect(radiantWrites()).toEqual([]);
    });

    it('does NOT consume when no damage is applied', async () => {
        applyDamageToTarget.mockResolvedValue({ finalDamage: 0, newHp: 13, damageReduced: false });
        await createNpcSaveDamageHandler(makeDeps())(saveEvent('2d6 + 3 [Radiant Soul]', { dcSuccess: 'none' }));

        expect(radiantWrites()).toEqual([]);
    });
});
