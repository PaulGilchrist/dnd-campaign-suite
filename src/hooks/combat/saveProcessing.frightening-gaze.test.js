// MA-1089 adjudication seam: Lich "Frightening Gaze" post-data-fix save
// context (DC 20 WIS, dc_success none, saveConditions ['frightened'],
// concentration until-clause note) resolved through the inline single-target
// save lane — FAIL grants Frightened with source meta + durationNote +
// `condition applied`, SUCCESS grants NOTHING, both legs zero damage
// (fear dc_success "none" on disk; MA-0017/MA-0020 harness twin of
// saveProcessing.failed-save-conditions.test.js).
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
// buildAbilitySaveRollContext), so this locks row → grant end to end.
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
    it('context derives from the disk row: DC 20, frightened fail-only, honest until-note', () => {
        const context = gazeContext();
        expect(context.saveDc).toBe(20);
        expect(context.dcSuccess).toBe('none');
        expect(context.saveConditions).toEqual(['frightened']);
        expect(context.conditionDurationNote).toBe('until the spell ends, Concentration up to 1 minute (GM-enforced)');
    });

    it('player path: failed save grants Frightened with source meta + durationNote, zero damage', async () => {
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

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['frightened']);
        expect(runtimeStore['AberrantSorcerer.activeConditionMeta'].frightened).toMatchObject({
            source: 'Lich 1',
            durationNote: 'until the spell ends, Concentration up to 1 minute (GM-enforced)',
        });
        const applied = conditionLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(applied).toBeTruthy();
        expect(applied).toMatchObject({ characterName: 'AberrantSorcerer', condition: 'Frightened', sourceName: 'Lich 1' });
        const advisory = conditionLogs.find(e => e.automationType === 'condition_clauses_advisory');
        expect(advisory.description).toMatch(/until the spell ends, Concentration up to 1 minute/);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('player path: successful save grants NOTHING (dc_success none, unaffected)', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context: gazeContext(),
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: true, roll: 18, total: 18, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toBeUndefined();
        expect(runtimeStore['AberrantSorcerer.activeConditionMeta']).toBeUndefined();
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('npc path: failed save grants Frightened + condition-applied log, zero damage', async () => {
        await processSaveRoll({
            rollType: 'save',
            target: { name: 'Bandit 1', type: 'npc' },
            characterName: 'Bandit 1',
            campaignName,
            context: { ...gazeContext(), effectiveD20: 4, effectiveBonus: 0 },
            bonus: 0,
            r1: 4,
            r2: null,
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore['Bandit 1.activeConditions']).toEqual(['frightened']);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Frightened' && e.sourceName === 'Lich 1')).toBe(true);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
