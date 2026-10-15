// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, _rolls, isCrit) => (isCrit ? `${formula}*2` : formula)),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(() => 0),
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
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? Math.floor(total / 2) : total)),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
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

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../services/ui/logService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

// Seam only: effect matching, prompt payload, saveDc fallback, the
// pendingSavePrompts lifecycle and save_result log content are owned by
// handlers/handleSanctuarySave.test.js. This file guards the
// useLoggedDiceRollDamage wiring — the WIS gate runs before any damage
// dispatch, and a blocked gate shows the Sanctuary popup and aborts the
// spell entirely (no combat-summary load, no damage apply, no log entry).

const PROMPT_ID = 'test-guid-1234';

const deps = {
    characterName: 'Wizard1',
    campaignName: 'test-campaign',
    characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

// Save-based spell (Fireball per rules data: 8d6 fire, DEX half) cast by
// Wizard1 at the warded Goblin.
const fireball = {
    name: 'Fireball',
    formula: '8d6',
    total: 20,
    rolls: [3, 4, 5, 2, 3, 3],
    modifier: 0,
    context: { targetName: 'Goblin', damageType: 'fire', saveDc: 15, saveType: 'DEX', dcSuccess: 'half' },
};

const sanctuaryOnGoblin = (overrides = {}) => ({
    effect: 'sanctuary',
    target: 'Goblin',
    source: 'Cleric1',
    saveDc: 13,
    ...overrides,
});

const mockTargetEffects = (effects) =>
    getRuntimeValue.mockImplementation((key, prop) =>
        key === 'campaign' && prop === 'targetEffects' ? effects : null);

// The gate registers its save-result listener synchronously before awaiting,
// so dispatching in the same tick resolves it.
const dispatchSaveResult = (success) =>
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: PROMPT_ID, success } }));

describe('useLoggedDiceRollDamage sanctuary gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        rollSaveForCreature.mockReturnValue({ success: true, roll: 15, total: 18, bonus: 3 });
    });

    it('dispatches save damage normally when nothing is warded', async () => {
        mockTargetEffects([]);

        await createLogDamageAndShow(deps)(fireball);

        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Sanctuary' })
        );
        expect(addEntry).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ type: 'save_result' })
        );
        expect(applyDamageToTarget).toHaveBeenCalled();
    });

    it('prompts the attacker, blocks damage and loses the spell on a failed WIS save', async () => {
        mockTargetEffects([sanctuaryOnGoblin()]);

        const invoke = createLogDamageAndShow(deps)(fireball);
        dispatchSaveResult(false);
        await invoke;

        // Save-prompt route: the WIS save is the ATTACKER's, against the caster's DC.
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            promptId: PROMPT_ID,
            targetName: 'Wizard1',
            attackerName: 'Cleric1',
            saveType: 'WIS',
            saveDc: 13,
            condition: 'sanctuary',
        }));

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation_info',
            name: 'Sanctuary',
            description: expect.stringContaining('Wizard1 failed WIS save against Sanctuary on Goblin'),
        }));
        expect(deps.setPopupHtml.mock.calls[0][0].description).toContain('spell is lost');

        // The spell aborts before any damage dispatch.
        expect(loadCombatSummary).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    });

    it('proceeds to save damage on a successful WIS save', async () => {
        mockTargetEffects([sanctuaryOnGoblin()]);

        const invoke = createLogDamageAndShow(deps)(fireball);
        dispatchSaveResult(true);
        await invoke;

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'save_result',
            success: true,
            saveType: 'WIS',
        }));
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Sanctuary' })
        );
        // Spell continues through the normal NPC save-damage lane.
        expect(applyDamageToTarget).toHaveBeenCalled();
    });
});
