// MA-0348: Bandit Deceiver Hold Person save leg downstream — the routed save
// context (saveDc 14 authored on the row, saveType WIS from spells.json,
// saveConditions ['paralyzed'] parsed off the spell text, honest concentration
// durationNote) resolves in saveProcessing: FAILED save → paralyzed + meta +
// condition log + save_result failure at DC 14, zero damage rolled; SUCCESS →
// nothing lands. Mirrors the MA-0017/MA-0020 failed-save-conditions harness.
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

const rollExpression = vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Bandit Deceiver 1' }),
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 24 }));
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

const campaignName = 'test-campaign';
const holdPersonContext = {
    saveDc: 14,
    saveType: 'WIS',
    attackerName: 'Bandit Deceiver 1',
    actionName: 'Hold Person',
    spellName: 'Hold Person',
    dcSuccess: 'none',
    autoDamageFormula: null,
    saveConditions: ['paralyzed'],
    isSpellDamage: true,
    conditionDurationNote: "for the spell's duration — Concentration, Up to 1 minute (GM-enforced)",
};

const gmLog = [];
const logEntry = (e) => gmLog.push(e);

function resolveSave(success) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'AberrantSorcerer', type: 'player' },
        characterName: 'AberrantSorcerer',
        campaignName,
        context: { ...holdPersonContext },
        logEntry,
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve(success
        ? { success: true, roll: 15, total: 15, saveBonus: 0, rawRolls: [], mode: 'normal' }
        : { success: false, roll: 3, total: 3, saveBonus: 0, rawRolls: [], mode: 'normal' });
    return promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
    gmLog.length = 0;
});

describe('MA-0348 Hold Person damageless save leg', () => {
    it('failed save: paralyzed lands with source meta + condition log, DC 14 enforced, zero damage', async () => {
        await resolveSave(false);

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['paralyzed']);
        expect(runtimeStore['AberrantSorcerer.activeConditionMeta'].paralyzed).toMatchObject({
            source: 'Bandit Deceiver 1',
            durationNote: "for the spell's duration — Concentration, Up to 1 minute (GM-enforced)",
        });
        const conditionLog = conditionLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(conditionLog).toMatchObject({ characterName: 'AberrantSorcerer', condition: 'Paralyzed', sourceName: 'Bandit Deceiver 1', sourceAbility: 'Hold Person' });
        const saveLog = gmLog.find(e => e.rollType === 'save');
        expect(saveLog).toMatchObject({ saveResult: 'failure', saveType: 'WIS', saveDc: 14 });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.some(e => e.rollType === 'save-damage')).toBe(false);
    });

    it('successful save: nothing lands, DC 14 success logged', async () => {
        await resolveSave(true);

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toBeUndefined();
        expect(conditionLogs.filter(e => e.type === 'condition')).toHaveLength(0);
        const saveLog = gmLog.find(e => e.rollType === 'save');
        expect(saveLog).toMatchObject({ saveResult: 'success', saveType: 'WIS', saveDc: 14 });
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('campaign lastAttack stamp carries the spell-attributed paralyzed saveConditions + CLA-324 spell origin', async () => {
        await resolveSave(false);

        const stamped = runtimeStore['campaign.lastAttack'];
        expect(stamped).toBeTruthy();
        expect(stamped.saveConditions).toEqual(['paralyzed']);
        expect(stamped.isSpellDamage).toBe(true);
        expect(stamped.saveDc).toBe(14);
        expect(stamped.saveResult).toBe('failure');
    });
});
