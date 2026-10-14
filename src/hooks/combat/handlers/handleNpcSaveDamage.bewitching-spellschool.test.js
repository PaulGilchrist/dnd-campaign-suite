// @maintained-by-ai: 2026-10-14
// CLA-037: the NPC save-damage lane must stamp spellSchool into the campaign
// lastAttack (lowercased, or null when the cast context carries none) so the
// manual Bewitching Magic row gate can ever pass for spell casts.
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
        getRuntimeValue.mockReturnValue(null);
        rollSaveForCreature.mockReturnValue({ roll: 7, total: 7, bonus: 0, success: false, rawRolls: [7] });
    });

    function stampFor(context) {
        return createNpcSaveDamageHandler(deps)({
            name: 'Phantasmal Force',
            formula: '2d8',
            total: 11,
            rolls: [4, 3, 4],
            modifier: 0,
            adjustedTotal: 11,
            context,
            combatSummary,
        }).then(() => setRuntimeValue.mock.calls
            .find(c => c[0] === 'campaign' && c[1] === 'lastAttack')?.[2] ?? null);
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
        expect(entry).toMatchObject({
            spellSchool: 'illusion',
            attackerName: 'HexWarlock',
            targetName: 'Bandit',
            saveType: 'INT',
            saveDc: 16,
        });
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
        expect(entry).toMatchObject({ spellSchool: null, saveType: 'DEX' });
    });
});
