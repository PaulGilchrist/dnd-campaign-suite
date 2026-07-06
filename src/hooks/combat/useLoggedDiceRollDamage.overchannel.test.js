// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Overchannel self-damage', () => {
    const deps = {
        characterName: 'Warlock1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        rollExpression.mockReturnValue({ total: 24, rolls: [12, 12], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 24, newHp: -11, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('logs necrotic self-damage when overchannelActive is true and useCount > 1', async () => {
        const fn = createFn();
        await fn('Eldritch Blast', '2d10+4', 14, [5, 9], 4, {
            targetName: 'Goblin',
            damageType: 'force',
            overchannelActive: true,
            overchannelUseCount: 3,
            overchannelSpellLevel: 2,
        });
        // dicePerLevel = 2 + (3-1) = 4, totalDice = 4 * 2 = 8
        expect(rollExpression).toHaveBeenCalledWith('8d12');
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'overchannel-damage',
            name: 'Overchannel',
            formula: '8d12',
            damageType: 'Necrotic',
            targetName: 'Warlock1',
            note: 'Overchannel self-damage (ignores resistance/immunity)',
        }));
    });

    it('calculates dice count based on different useCount and spellLevel combinations', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
        });
        // dicePerLevel = 2 + (2-1) = 3, totalDice = 3 * 3 = 9
        expect(rollExpression).toHaveBeenCalledWith('9d12');
    });

    it('does not trigger self-damage when overchannel is inactive, useCount is 1, or context is missing', async () => {
        const fn = createFn();
        const testCases = [
            { name: 'overchannelActive false', context: { targetName: 'Goblin', damageType: 'fire', overchannelActive: false, overchannelUseCount: 3, overchannelSpellLevel: 2 } },
            { name: 'overchannelUseCount is 1', context: { targetName: 'Goblin', damageType: 'fire', overchannelActive: true, overchannelUseCount: 1, overchannelSpellLevel: 3 } },
            { name: 'overchannelActive undefined', context: { targetName: 'Goblin', damageType: 'fire' } },
        ];

        for (const { context } of testCases) {
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, context);
            const d12Calls = deps.logEntry.mock.calls.filter(c => c[0].formula && c[0].formula.includes('d12'));
            expect(d12Calls).toHaveLength(0);
        }
    });
});
