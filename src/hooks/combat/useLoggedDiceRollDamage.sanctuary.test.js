// @maintained-by-ai 2026-11-26
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
    deleteRuntimeKey: vi.fn(),
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

import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../services/ui/logService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

// Seam only: this file guards the useLoggedDiceRollDamage wiring — the WIS
// gate runs BEFORE any damage dispatch, a blocked gate shows the Sanctuary
// popup and aborts the spell entirely (no combat-summary load, no damage
// apply, no UI log entry), and a resolved gate leaves the pending-prompt
// bucket drained. Effect matching, saveDc fallback and full save_result log
// wording are authority in handlers/handleSanctuarySave.test.js; the
// sanctuary-block "no lastAttack stamp" pin is owned by
// useLoggedDiceRollDamage.last-attack.test.js. Sanctuary ≥1 minute is
// combat-scoped (no-timers canon): this lane never writes targetEffects or a
// rounds countdown, so no duration byte is pinned here.

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

    it('runs the whole save-damage lane untouched when nothing is warded', async () => {
        mockTargetEffects([]);

        await createLogDamageAndShow(deps)(fireball);

        // Gate silent: no prompt sent, no pending-prompt registration, no popup.
        // (lastAttack stamping on this path is owned by the last-attack lane.)
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'pendingSavePrompts', expect.anything(), expect.any(String));
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Sanctuary' })
        );
        // The lane completes exactly once: damage applied, one hp_change log,
        // one UI log entry, one damage popup — and no sanctuary save_result.
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'hp_change' }));
        expect(addEntry).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ type: 'save_result' })
        );
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
    });

    it('registers the WIS prompt, blocks damage and loses the spell on a failed save', async () => {
        mockTargetEffects([sanctuaryOnGoblin()]);

        const invoke = createLogDamageAndShow(deps)(fireball);
        dispatchSaveResult(false);
        await invoke;

        // Full-shape registration write: the ward's own DC (13), not the
        // spell's (15), and the ATTACKER (Wizard1) must save — wiring the
        // wrapper's characterName through to the store row.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingSavePrompts', {
            [PROMPT_ID]: {
                promptId: PROMPT_ID,
                campaignName: 'test-campaign',
                targetName: 'Wizard1',
                attackerName: 'Cleric1',
                saveType: 'WIS',
                saveDc: 13,
                dcSuccess: 'none',
                disadvantage: false,
                advantage: false,
                condition: 'sanctuary',
                sourceName: 'Cleric1',
            },
        }, 'test-campaign');
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            promptId: PROMPT_ID,
            targetName: 'Wizard1',
            saveType: 'WIS',
            saveDc: 13,
            condition: 'sanctuary',
        }));

        // Resolution drains the last row via deleteRuntimeKey (drain-to-evict).
        expect(deleteRuntimeKey).toHaveBeenCalledTimes(1);
        expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', 'pendingSavePrompts', 'test-campaign');

        // Exactly one log line — the failed save_result — and no damage log.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'save_result',
            success: false,
            saveType: 'WIS',
        }));

        // The block popup is the only UI feedback; the spell aborts before
        // any damage dispatch.
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation_info',
            name: 'Sanctuary',
            description: expect.stringContaining('Wizard1 failed WIS save against Sanctuary on Goblin'),
        }));
        expect(deps.setPopupHtml.mock.calls[0][0].description).toContain('spell is lost');
        expect(loadCombatSummary).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    });

    it('continues the save-damage lane exactly once on a successful save', async () => {
        mockTargetEffects([sanctuaryOnGoblin()]);

        const invoke = createLogDamageAndShow(deps)(fireball);
        dispatchSaveResult(true);
        await invoke;

        // Gate logs the pass, then the spell flows through the normal NPC
        // save-damage lane once: ordered census save_result → hp_change,
        // one damage popup (no Sanctuary popup), one UI log, one apply.
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls.map(c => c[1].type)).toEqual(['save_result', 'hp_change']);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'save_result',
            success: true,
            saveType: 'WIS',
        }));
        expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', 'pendingSavePrompts', 'test-campaign');
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Sanctuary' })
        );
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(deps.logEntry).toHaveBeenCalledTimes(1);
    });
});
