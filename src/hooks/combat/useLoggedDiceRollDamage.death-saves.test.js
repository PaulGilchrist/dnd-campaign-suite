// @maintained-by-ai: 2026-10-14
// AUTHORITATIVE owner of death-save initialization (deathSaves/deathFailures
// writes) at the useLoggedDiceRollDamage seam — handlePlainDamage.hpEffects.test.js
// defers hp_change/currentHitPoints shape here for death saves.
// Guard under test (handlePlainDamage.writePlainHpResults): player only,
// and only on the alive→unconscious transition (oldHp > 0 && newHp <= 0).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
    parseConstant: vi.fn(),
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
    evaluateAutoExpression: vi.fn(),
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
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
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

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
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 0, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 }],
        });
    });

    const deathSaveWrites = () => setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'deathSaves' || call[1] === 'deathFailures'
    );

    function stubHitPoints(name, hp) {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === name && prop === 'hitPoints') return hp;
            return null;
        });
    }

    function attack(context, roll = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0,
            context: { damageType: 'fire', ...context },
            ...roll,
        });
    }

    it.each([
        ['to exactly 0 HP', 20, 0],
        ['below 0 HP', 10, -10],
    ])('initializes fresh deathSaves/deathFailures arrays when player drops %s', async (_label, hitPoints, newHp) => {
        stubHitPoints('Ally1', hitPoints);
        applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp, damageReduced: false });

        await attack({ targetName: 'Ally1' });

        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'deathSaves', [false, false, false], 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'deathFailures', [false, false, false], 'test-campaign');
    });

    it('does not set death saves when player survives with positive HP', async () => {
        stubHitPoints('Ally1', 20);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 10, damageReduced: false });

        await attack({ targetName: 'Ally1' }, { total: 10, rolls: [3, 4, 5, 2] });

        expect(deathSaveWrites()).toHaveLength(0);
    });

    it('does not reset death saves when player was already unconscious before damage', async () => {
        // oldHp resolves to newHp + finalDamage = 0 → not an alive→unconscious transition.
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Ally1' && prop === 'currentHitPoints') return -5;
            if (key === 'Ally1' && prop === 'hitPoints') return 0;
            return null;
        });
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: -5, damageReduced: false });

        await attack({ targetName: 'Ally1' }, { name: 'Fire Bolt', formula: '1d10', total: 5, rolls: [5] });

        expect(deathSaveWrites()).toHaveLength(0);
    });

    it('does not set death saves for NPC targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 10, maxHp: 10 }],
        });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 0, damageReduced: false });

        await attack({ targetName: 'Goblin' }, { name: 'Claw', formula: '1d4+2', total: 5, rolls: [3], modifier: 2 });

        expect(deathSaveWrites()).toHaveLength(0);
    });
});
