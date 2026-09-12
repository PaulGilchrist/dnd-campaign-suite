// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
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

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage multi/twin target', () => {
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
        getRuntimeValue.mockReset().mockReturnValue(null);
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('multi target plain damage', () => {
        it('applies damage to both primary and multi targets with correct arguments', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
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
            await fn('Words of Creation', '2d6', 7, [3, 4], 0, { targetName: 'Goblin', damageType: 'force', multiTarget: 'Orc', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);

            // First call: primary target (Goblin) with adjusted total
            expect(applyDamageToTarget).toHaveBeenNthCalledWith(1, expect.any(Object), 'Goblin', 7, ['force'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestFighter', suppressHpLog: true });

            // Second call: multi target (Orc) with adjusted total
            expect(applyDamageToTarget).toHaveBeenNthCalledWith(2, expect.any(Object), 'Orc', 7, ['force'], 'test-campaign', null, { ignoreResistance: false, attackerName: 'TestFighter' });
        });

        it('logs damage entries for both primary and multi targets', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
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
            await fn('Words of Creation', '2d6', 7, [3, 4], 0, { targetName: 'Goblin', damageType: 'force', multiTarget: 'Orc', });

            const logCalls = deps.logEntry.mock.calls.map((call) => call[0]);
            expect(logCalls).toHaveLength(2);
            expect(logCalls[0].targetName).toBe('Goblin');
            expect(logCalls[1].targetName).toBe('Orc');
            expect(logCalls[1].note).toBe('multi_damage_roll_before_apply');
        });

        it('includes multi target info in popup data', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 6, newHp: 9, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                ],
            });

            const fn = createFn();
            await fn('Words of Creation', '2d6', 7, [3, 4], 0, { targetName: 'Goblin', damageType: 'force', multiTarget: 'Orc', });

            // setPopupHtml is called multiple times: first with popup object, then with updater function for multi-target
            const popupCalls = deps.setPopupHtml.mock.calls;
            // Find the call that contains multi-target info (the updater function)
            const lastCallArgs = popupCalls[popupCalls.length - 1][0];
            // The last call is an updater function; verify it was called with multi-target data
            expect(lastCallArgs).toBeTypeOf('function');
            // Simulate the updater to verify the multi-target fields
            const basePopup = popupCalls[popupCalls.length - 2][0];
            const result = lastCallArgs(basePopup);
            expect(result.twinTargetName).toBe('Orc');
            expect(result.twinFinalDamage).toBe(6);
        });
    });

    describe('twin target with same name', () => {
        it('applies damage only once when twin target equals primary target', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, { targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'Goblin', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenNthCalledWith(1, expect.any(Object), 'Goblin', 10, ['force'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestFighter', suppressHpLog: true });
        });
    });

    describe('multi target with same name', () => {
        it('applies damage only once when multi target equals primary target', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Words of Creation', '2d6', 7, [3, 4], 0, { targetName: 'Goblin', damageType: 'force', multiTarget: 'Goblin', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        });
    });

    describe('multi target not found in combat summary', () => {
        it('applies damage only to primary when multi target is missing', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Words of Creation', '2d6', 7, [3, 4], 0, { targetName: 'Goblin', damageType: 'force', multiTarget: 'NonExistent', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(deps.logEntry).toHaveBeenCalledTimes(1);
        });
    });

    describe('twin target not found in combat summary', () => {
        it('applies damage only to primary when twin target is missing', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, { targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'NonExistent', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(deps.logEntry).toHaveBeenCalledTimes(1);
        });
    });

    describe('both twin and multi targets', () => {
        it('applies damage to primary, twin, and multi targets independently', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 10, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 6, newHp: 8, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                    { name: 'Skeleton', type: 'npc', ac: 13, currentHp: 12, maxHp: 12 },
                ],
            });

            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, { targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'Orc', multiTarget: 'Skeleton', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(3);

            const logCalls = deps.logEntry.mock.calls.map((call) => call[0]);
            expect(logCalls).toHaveLength(3);
            expect(logCalls[0].targetName).toBe('Goblin');
            expect(logCalls[1].targetName).toBe('Orc');
            expect(logCalls[1].note).toBe('twin_damage_roll_before_apply');
            expect(logCalls[2].targetName).toBe('Skeleton');
            expect(logCalls[2].note).toBe('multi_damage_roll_before_apply');
        });

        it('applies only twin damage when multi target equals primary', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 5, newHp: 10, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                ],
            });

            const fn = createFn();
            await fn('Magic Missile', '4d4+2', 10, [3, 2, 3, 2], 2, { targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'Orc', multiTarget: 'Goblin', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        });

        it('applies only multi damage when twin target equals primary', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget
                .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
                .mockReturnValueOnce({ finalDamage: 6, newHp: 8, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                    { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
                ],
            });

            const fn = createFn();
            await fn('Words of Creation', '2d6', 7, [3, 4], 0, { targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'Goblin', multiTarget: 'Orc', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        });
    });
});
