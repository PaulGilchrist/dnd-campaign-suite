// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
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

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Plain damage edge cases', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestFighter',
                computedStats: {
                    armorClass: 16,
                    characterAdvancement: [{ name: 'Sentinel' }],
                },
            },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        rollExpression.mockClear().mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('sentinel reaction', () => {
        it('applies sentinel halt effect on opportunity attack when attacker has sentinel', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'test-campaign') return [];
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
                lastAttack: { hit: true, attackerName: 'TestFighter' },
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isOpportunityAttack: true,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.any(Array),
                'test-campaign'
            );
        });
    });

    describe('ray of enfeeble debuff', () => {
        it('reduces damage when ray of enfeeble debuff is active from the attacker', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'test-campaign') return [
                    { effect: 'ray_of_enfeeble_debuff', source: 'TestFighter' },
                ];
                return null;
            });
            rollExpression.mockReturnValueOnce({ total: 3, rolls: [3], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                attackerName: 'TestFighter',
            });

            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                finalDamage: 5,
            }));
        });
    });

    describe('multiattack defense', () => {
        it('applies multiattack defense effect when defensiveChoice is set on a player target', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'test-campaign') return [];
                if (key === 'Ally1') return 'Multiattack Defense';
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Ally1',
                damageType: 'slashing',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.any(Array),
                'test-campaign'
            );
        });
    });

    describe('plain damage with secondary', () => {
        it('applies secondary damage with multi-attack sequence', async () => {
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 0, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast (Agonizing)', '2d10+4', 14, [5, 9], 4, {
                targetName: 'Goblin',
                damageType: 'force',
                autoDamageSecondaryFormula: '1d10',
                autoDamageSecondaryName: 'Eldritch Blast',
                autoDamageSecondaryDamageType: 'force',
            });

            expect(applyDamageToTarget.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        it('applies secondary damage with auto crit (doubled)', async () => {
            rollExpressionDoubled.mockReturnValue({ total: 20, rolls: [6, 6, 4, 4], modifier: 0 });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 20, newHp: -7, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: -11, damageReduced: false });

            const fn = createFn();
            await fn('Eldritch Blast', '2d10', 10, [6, 4], 0, {
                targetName: 'Goblin',
                damageType: 'force',
                autoDamageSecondaryFormula: '2d10',
                isAutoCrit: true,
            });

            expect(rollExpressionDoubled).toHaveBeenCalledWith('2d10');
        });
    });

    describe('twin target plain damage', () => {
        it('applies damage to twin target in plain damage', async () => {
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 8, newHp: 7, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                ],
            });

            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, {
                targetName: 'Goblin',
                damageType: 'force',
                metamagicTwinTarget: 'Orc',
            });

            expect(applyDamageToTarget.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(deps.setPopupHtml.mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('damage popup data', () => {
        it('includes elementalAdeptBonus when adjustedTotal > total', async () => {
            applyMinDamageAdjustment.mockReturnValue(12);
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fireball', '8d6', 8, [1, 1, 3, 3, 3, 3, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                playerStats: { automation: { passives: [] } },
            });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                elementalAdeptBonus: 4,
                adjustedTotal: 12,
            }));
        });

        it('sets damageReduced flag from applyResult', async () => {
            applyDamageToTarget.mockReturnValue({ finalDamage: 4, newHp: 9, damageReduced: true });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                damageReduced: true,
            }));
        });
    });
});
