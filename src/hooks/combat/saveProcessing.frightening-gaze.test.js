// @maintained-by-ai: 2026-10-14
// MA-1089 frightening-gaze-specific seam ONLY: the Lich "Frightening Gaze"
// disk row (monsters.json, DC 20 WIS, dc_success none, fear dc_success "none")
// byte-builds the save context through extractConditionsFromSaveEffect +
// extractConditionDurationNote and the FAILED-save player prompt lane grants
// Frightened carrying the honest Concentration until-clause note on
// activeConditionMeta + the condition_clauses_advisory log, zero damage.
// Generic legs are owned elsewhere: fail/success condition grants and the
// npc lane — saveProcessing.failed-save-conditions.test.js; saveConditions
// threading upstream of context-building — saveProcessing.cla034-save-conditions-thread.test.js;
// extractor semantics — services/encounters/monsterAbilityUses.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const conditionLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 17, rolls: [5, 6, 6], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Lich 1' }),
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 391 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

import { processSaveRoll } from './saveProcessing.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const GAZE_ROW = monstersData.find(m => m.index === 'lich').legendary_actions.find(a => a.name === 'Frightening Gaze');

// Context byte-built from the DATA row itself — the modal forwards exactly
// these fields (resolveLegendaryRowMechanic → handleSaveRoll →
// buildAbilitySaveRollContext), so the kept test locks row → grant end to end.
const gazeContext = () => ({
    saveDc: GAZE_ROW.save_dc,
    saveType: 'WIS',
    attackerName: 'Lich 1',
    actionName: 'Frightening Gaze',
    dcSuccess: GAZE_ROW.dc_success,
    autoDamageFormula: null,
    saveConditions: extractConditionsFromSaveEffect(GAZE_ROW.save_effect),
    conditionDurationNote: extractConditionDurationNote(GAZE_ROW.save_effect),
});

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

describe('MA-1089 Frightening Gaze adjudication', () => {
    it('failed save vs disk-row context (DC 20 WIS, frightened fail-only): grants Frightened with source meta + honest Concentration until-note, zero damage', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context: gazeContext(),
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        // Row → context extraction lock (DC 20, fail-only fear, honest note).
        expect(gazeContext()).toMatchObject({
            saveDc: 20,
            dcSuccess: 'none',
            saveConditions: ['frightened'],
            conditionDurationNote: 'until the spell ends, Concentration up to 1 minute (GM-enforced)',
        });
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['frightened']);
        expect(runtimeStore['AberrantSorcerer.activeConditionMeta'].frightened).toMatchObject({
            source: 'Lich 1',
            durationNote: 'until the spell ends, Concentration up to 1 minute (GM-enforced)',
        });
        const applied = conditionLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(applied).toMatchObject({ characterName: 'AberrantSorcerer', condition: 'Frightened', sourceName: 'Lich 1' });
        const advisory = conditionLogs.find(e => e.automationType === 'condition_clauses_advisory');
        expect(advisory.description).toMatch(/until the spell ends, Concentration up to 1 minute/);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
