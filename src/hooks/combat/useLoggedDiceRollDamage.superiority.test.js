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

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Superiority die damage bonuses', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockImplementation((_charName, _key) => null);
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

    describe('feinting attack bonus', () => {
        it('adds feinting attack die value to damage', async () => {
            getRuntimeValue.mockImplementation((charName, key) => {
                if (charName === 'TestFighter' && key === 'feintingAttackDieValue') return 4;
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'feintingAttackDieValue',
                null,
                'test-campaign'
            );
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.total).toBe(12);
        });
    });

    describe("commander's strike bonus", () => {
        it("adds commander's strike bonus to damage", async () => {
            getRuntimeValue.mockImplementation((charName, key) => {
                if (charName === 'TestFighter' && key === 'commanderStrikeBonus') return 5;
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'commanderStrikeBonus',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'commanderStrikeActive',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'commanderStrikeSource',
                null,
                'test-campaign'
            );
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.total).toBe(13);
        });
    });

    describe('lunging attack bonus', () => {
        it('adds lunging attack die value to damage', async () => {
            getRuntimeValue.mockImplementation((charName, key) => {
                if (charName === 'TestFighter' && key === 'lungingAttackDieValue') return 3;
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'lungingAttackDieValue',
                null,
                'test-campaign'
            );
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.total).toBe(11);
        });
    });

    describe('multiple superiority bonuses', () => {
        it('applies all three superiority bonuses in order', async () => {
            getRuntimeValue.mockImplementation((charName, key) => {
                if (charName === 'TestFighter' && key === 'feintingAttackDieValue') return 4;
                if (charName === 'TestFighter' && key === 'commanderStrikeBonus') return 5;
                if (charName === 'TestFighter' && key === 'lungingAttackDieValue') return 3;
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.total).toBe(20);
        });
    });
});
