// CLA-037: the NPC save-damage lane must stamp spellSchool into the campaign
// lastAttack so the manual Bewitching Magic row gate can ever pass for spell casts.
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
    computeDamageAfterSave: vi.fn((total, success) => (success ? 0 : total)),
    computeDamageAfterEvasion: vi.fn((total, success) => (success ? 0 : total)),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 11, newHp: 988 })),
    normalizeSaveType: vi.fn((t) => t),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage — CLA-037 spellSchool lastAttack stamp', () => {
    const deps = {
        characterName: 'HexWarlock',
        campaignName: 'test-campaign',
        characters: [{ name: 'HexWarlock' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const combatSummary = {
        creatures: [{ name: 'Bandit', type: 'npc', currentHp: 999, maxHp: 999 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 11, rolls: [4, 3, 4], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        rollSaveForCreature.mockReturnValue({ roll: 7, total: 7, bonus: 0, success: false, rawRolls: [7] });
    });

    function stampFor(context) {
        const handler = createNpcSaveDamageHandler(deps);
        return handler({
            name: 'Phantasmal Force',
            formula: '2d8',
            total: 11,
            rolls: [4, 3, 4],
            modifier: 0,
            adjustedTotal: 11,
            context,
            combatSummary,
        }).then(() => {
            const call = setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'lastAttack');
            return call ? call[2] : null;
        });
    }

    it('stamps lowercased spellSchool from the cast context into campaign lastAttack', async () => {
        const entry = await stampFor({
            targetName: 'Bandit',
            attackerName: 'HexWarlock',
            saveDc: 16,
            saveType: 'INT',
            dcSuccess: 'none',
            damageType: 'Psychic',
            spellSchool: 'Illusion',
        });
        expect(entry).not.toBeNull();
        expect(entry.spellSchool).toBe('illusion');
        expect(entry.attackerName).toBe('HexWarlock');
    });

    it('stamps null spellSchool when the context carries none (non-spell lanes byte-safe)', async () => {
        const entry = await stampFor({
            targetName: 'Bandit',
            attackerName: 'HexWarlock',
            saveDc: 12,
            saveType: 'DEX',
            dcSuccess: 'half',
            damageType: 'fire',
        });
        expect(entry.spellSchool).toBeNull();
    });
});
