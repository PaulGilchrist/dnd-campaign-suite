// @maintained-by-ai: 2026-10-14
// MA-0348: Bandit Deceiver Hold Person save leg downstream — the routed save
// context (saveDc 14 authored on the row, saveType WIS per spells.json
// hold-person, saveConditions ['paralyzed'], concentration durationNote)
// resolves in saveProcessing: FAILED save → paralyzed + source/durationNote
// meta + condition log + save_result failure at DC 14 + spell-origin
// lastAttack stamp, zero damage rolled; SUCCESS → nothing lands.
// MA-0560: Death Dog Bite rider-only composite — the DC chip (fork upstream
// in ActionSaveRoll) reaches this seam with autoDamageFormula NULL +
// saveConditions ['poisoned'] against an EB-NPC victim (processNpcSave inline
// branch): FAILED save → Poisoned + condition log, ZERO damage rolled (the
// fixed 1d4+2 primary is paid once, FULL, on the attack chip); SUCCESS →
// nothing lands. Generic condition/damageless mechanics are pinned in
// saveProcessing.failed-save-conditions.test.js — this file keeps only the
// Hold-Person spell-origin stamp and the MA-0560 poisoned rider attribution
// (sourceAbility 'Bite') plus the NPC success face.
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

// Mirrors the Bandit Deceiver Hold Person row: spells.json hold-person is a
// WIS save, dc_success 'none' (failure lands paralyzed, no half face),
// Concentration Up to 1 minute — GM-enforced, no auto-expiry subsystem.
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

// MA-0560 Death Dog Bite: rider-only composite, autoDamageFormula NULL —
// the save adjudicates the poisoned rider, never re-pays the attack chip.
const deathDogContext = {
    saveDc: 12,
    saveType: 'CON',
    attackerName: 'Death Dog 1',
    actionName: 'Bite',
    spellName: null,
    dcSuccess: 'half',
    autoDamageFormula: null,
    saveConditions: ['poisoned'],
    isSpellDamage: false,
    _characters: [],
};

const gmLog = [];
const logEntry = (e) => gmLog.push(e);

function resolvePlayerSave(success) {
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

function resolveNpcSave(success) {
    return processSaveRoll({
        rollType: 'save',
        target: { name: 'Bandit 1', type: 'npc' },
        characterName: 'Death Dog 1',
        campaignName,
        context: { ...deathDogContext, effectiveD20: success ? 15 : 5 },
        bonus: 0,
        r1: success ? 15 : 5,
        r2: success ? 15 : 5,
        logEntry,
        setPopupHtml: vi.fn(),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
    gmLog.length = 0;
});

describe('MA-0348 Hold Person damageless save leg (player prompt path)', () => {
    it('failed save: paralyzed lands with source + concentration meta, condition log, DC 14 enforced, spell-origin lastAttack stamp, zero damage', async () => {
        await resolvePlayerSave(false);

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['paralyzed']);
        expect(runtimeStore['AberrantSorcerer.activeConditionMeta'].paralyzed).toMatchObject({
            source: 'Bandit Deceiver 1',
            durationNote: "for the spell's duration — Concentration, Up to 1 minute (GM-enforced)",
        });
        const conditionLog = conditionLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(conditionLog).toMatchObject({ characterName: 'AberrantSorcerer', condition: 'Paralyzed', sourceName: 'Bandit Deceiver 1', sourceAbility: 'Hold Person' });
        const saveLog = gmLog.find(e => e.rollType === 'save');
        expect(saveLog).toMatchObject({ saveResult: 'failure', saveType: 'WIS', saveDc: 14 });
        // CLA-324 spell-origin stamp: the save descriptor replaces lastAttack
        // with the spell-attributed saveConditions.
        const stamped = runtimeStore['campaign.lastAttack'];
        expect(stamped).toMatchObject({ saveConditions: ['paralyzed'], isSpellDamage: true, saveDc: 14, saveResult: 'failure' });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.some(e => e.rollType === 'save-damage')).toBe(false);
    });

    it('successful save: nothing lands, DC 14 success logged', async () => {
        await resolvePlayerSave(true);

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toBeUndefined();
        expect(conditionLogs.filter(e => e.type === 'condition')).toHaveLength(0);
        const saveLog = gmLog.find(e => e.rollType === 'save');
        expect(saveLog).toMatchObject({ saveResult: 'success', saveType: 'WIS', saveDc: 14 });
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});

describe('MA-0560 Death Dog rider-only composite save (EB-NPC inline path)', () => {
    it('failed save: Poisoned lands with source meta + condition log, zero save damage', async () => {
        await resolveNpcSave(false);

        expect(runtimeStore['Bandit 1.activeConditions']).toEqual(['poisoned']);
        expect(runtimeStore['Bandit 1.activeConditionMeta'].poisoned).toMatchObject({ source: 'Death Dog 1' });
        const conditionLog = conditionLogs.find(e => e.type === 'condition' && e.action === 'applied');
        expect(conditionLog).toMatchObject({ characterName: 'Bandit 1', condition: 'Poisoned', sourceName: 'Death Dog 1', sourceAbility: 'Bite' });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.some(e => e.rollType === 'save-damage')).toBe(false);
    });

    it('successful save: nothing lands, zero damage (bite already paid FULL on attack chip)', async () => {
        await resolveNpcSave(true);

        expect(runtimeStore['Bandit 1.activeConditions']).toBeUndefined();
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
