// @maintained-by-ai: 2026-10-14
// Owns the statusEffects seam through the createLogDamageAndShow wrapper: the
// context threading into the NPC failed-save activeConditions write (including
// lowercase normalization + dedupe, which has no other owner) and into the
// player pending-save prompt. Immunity skip, save-success gating, and per-effect
// write semantics are owned by handleNpcSaveDamage.advanced.test.js; the pending
// record shape (incl. the statusEffects: [] default) by
// handlePlayerSaveDamage.pending-data.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
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

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
    isMagicMissileImmune: vi.fn(),
    readAoeContext: vi.fn(),
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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
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

vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('statusEffects through the logDamageAndShow wrapper', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: {}, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const failedSave = { roll: 5, total: 8, bonus: 3, success: false, rawRolls: [5] };
    const defaultCombatSummary = {
        creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        playerIsImmuneToCondition.mockReturnValue(false);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        rollSaveForCreature.mockReturnValue(failedSave);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
        deps.pendingSaves = {};
    });

    function callHandler(contextOverride = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0,
            context: {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                attackerName: 'TestWizard',
                ...contextOverride,
            },
        });
    }

    function conditionWrites() {
        return setRuntimeValue.mock.calls.filter((call) => call[1] === 'activeConditions');
    }

    it('threads statusEffects into activeConditions on an NPC failed save', async () => {
        await callHandler({ statusEffects: ['poisoned', 'frightened'] });

        // Each effect is written via its own activeConditions update (handleNpcSaveDamage).
        const writes = conditionWrites();
        expect(writes.map((call) => call[2][call[2].length - 1])).toEqual(['poisoned', 'frightened']);
        for (const call of writes) {
            expect(call[0]).toBe('Goblin');
            expect(call[3]).toBe('test-campaign');
        }
    });

    it('normalizes incoming keys to lowercase and dedupes existing conditions', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Goblin' && prop === 'activeConditions') return ['Poisoned'];
            return null;
        });

        await callHandler({ statusEffects: ['POISONED'] });

        const writes = conditionWrites();
        expect(writes).toHaveLength(1);
        expect(writes[0][2]).toEqual(['poisoned']);
    });

    it('threads statusEffects into the pending save prompt for player targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Ally', type: 'player', ac: 15, currentHp: 20, maxHp: 20 }],
        });
        deps.charactersRef = { current: [{ name: 'Ally', computedStats: {}, saveModifiers: [] }] };

        await callHandler({ targetName: 'Ally', statusEffects: ['poisoned', 'frightened'] });

        expect(sendSavePrompt).toHaveBeenCalled();
        expect(deps.pendingSaves['test-guid-1234'].statusEffects).toEqual(['poisoned', 'frightened']);
    });

    it('writes no activeConditions when the context carries no statusEffects', async () => {
        await callHandler({});

        expect(conditionWrites()).toHaveLength(0);
    });
});
