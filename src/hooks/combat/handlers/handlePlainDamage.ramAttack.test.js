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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage ram attack / prone condition', () => {
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
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function baseContext(extra = {}) {
        return {
            targetName: 'Goblin',
            damageType: 'slashing',
            ramActive: true,
            isMelee: true,
            ...extra,
        };
    }

    describe('ram prone application', () => {
        it('applies prone when ramActive and isMelee with NPC target', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'condition',
                condition: 'Prone',
                reason: 'Power of the Wilds (Ram)',
            }));
        });

        it('applies prone when ramActive and isMelee with player target', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return [];
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'player', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when ramActive is false', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', ramActive: false, isMelee: true, });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when isMelee is false', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'fire', ramActive: true, isMelee: false, });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when target is already prone', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return ['Prone'];
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when target is Huge', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13, size: 'Huge' }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when target is Large', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13, size: 'Large' }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when applyResult is null', async () => {
            applyDamageToTarget.mockReturnValue(null);

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });

        it('does not apply prone when target is not in combat summary', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 }],
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', ramActive: true, isMelee: true, });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.anything(),
                'test-campaign'
            );
        });

        it('preserves existing non-prone conditions when adding prone', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return ['Ensnaring Strike'];
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Ensnaring Strike', 'Prone']),
                'test-campaign'
            );
        });

        it('does not add prone if target has prone with different casing', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'activeConditions') return ['prone'];
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, baseContext());

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['Prone']),
                'test-campaign'
            );
        });
    });
});
