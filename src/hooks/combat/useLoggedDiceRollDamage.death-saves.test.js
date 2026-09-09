// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
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
    setRuntimeValue: vi.fn(() => Promise.resolve()),
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
    evaluateAutoExpression: vi.fn((expr) => {
        const match = expr.match(/^(\d+)d(\d+)\+(\d+)/);
        if (match) return parseInt(match[1]) + parseInt(match[3]);
        return 0;
    }),
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
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

describe('Player death saves on unconscious', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Ally1', computedStats: { armorClass: 14 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 0, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
        });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('death saves initialization', () => {
        it('sets deathSaves and deathFailures arrays when player drops to 0 HP', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Ally1' && prop === 'hitPoints') return 20;
                return null;
            });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Ally1',
                damageType: 'fire',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'deathSaves',
                [false, false, false],
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'deathFailures',
                [false, false, false],
                'test-campaign'
            );
        });

        it('sets death saves when player drops below 0 HP', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Ally1' && prop === 'hitPoints') return 10;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: -10, damageReduced: false });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Ally1',
                damageType: 'fire',
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'deathSaves',
                [false, false, false],
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'deathFailures',
                [false, false, false],
                'test-campaign'
            );
        });

        it('does not set death saves when player survives with positive HP', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Ally1' && prop === 'hitPoints') return 20;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 10, damageReduced: false });

            const fn = createFn();
            await fn('Fireball', '8d6', 10, [3, 4, 5, 2], 0, {
                targetName: 'Ally1',
                damageType: 'fire',
            });

            const deathSaveCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'deathSaves' || call[1] === 'deathFailures'
            );
            expect(deathSaveCalls).toHaveLength(0);
        });

        it('does not reset death saves when player was already unconscious before damage', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Ally1' && prop === 'hitPoints') return 0;
                if (key === 'Ally1' && prop === 'currentHitPoints') return -5;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: -5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 5, [5], 0, {
                targetName: 'Ally1',
                damageType: 'fire',
            });

            const deathSaveCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'deathSaves' || call[1] === 'deathFailures'
            );
            expect(deathSaveCalls).toHaveLength(0);
        });

        it('does not set death saves for NPC targets', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'Goblin' && prop === 'hitPoints') return 10;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 0, damageReduced: false });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 10, maxHp: 10 }],
            });

            const fn = createFn();
            await fn('Claw', '1d4+2', 5, [3], 2, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            const deathSaveCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'deathSaves' || call[1] === 'deathFailures'
            );
            expect(deathSaveCalls).toHaveLength(0);
        });
    });
});
