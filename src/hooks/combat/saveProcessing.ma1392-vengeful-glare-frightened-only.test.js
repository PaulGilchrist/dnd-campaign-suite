// MA-1392: Revenant Vengeful Glare — conditional Paralyzed (+ Cursed) rider
// over-granted on EVERY failed save. The prose tail ("If the Frightened target
// is cursed by the revenant (see Vow of Revenge), the target also has the
// Paralyzed condition for the duration.") is a gated conditional, but
// extractConditionsFromSaveEffect word-scans the WHOLE save_effect string, so
// the untruncated row sprayed ['cursed','frightened','paralyzed'] on any fail.
// Fix = MA-1351 band-truncation twin, DATA-only: save_effect truncated to the
// shallow Frightened band; description keeps the full RAW prose (§52: consumers
// feed save_effect only — MonsterCardModal.jsx:581/:1024/:2231,
// MonsterAction.jsx:122). The cursed-precondition→Paralyzed rider + the
// revenant Vow-of-Revenge cursed producer are parked to a separate mechanism
// ticket (§70-class; no consumer exists). Fail leg on an UNCURED victim:
// Frightened ONLY. Success: zero grants. Pure save row: zero damage both legs.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const runtimeStore = {};
const conditionLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 5, rolls: [2, 3], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Revenant 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Revenant 1';
const TARGET = 'Bandit 1';

const glareRow = () => monstersData.find(m => m.name === 'Revenant').actions[2];

// Fixed disk-row save context (§581 inline save lane shape: zero damage,
// saveConditions re-extracted from the TRUNCATED save_effect).
const glareContext = (total) => ({
    saveDc: 15,
    saveType: 'WIS',
    attackerName: ATTACKER,
    actionName: 'Vengeful Glare',
    dcSuccess: 'none',
    autoDamageFormula: null,
    saveConditions: extractConditionsFromSaveEffect(glareRow().save_effect),
    effectiveD20: total,
    effectiveBonus: 0,
});

async function resolveNpcSave(total) {
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: glareContext(total),
        bonus: 0,
        r1: total,
        r2: null,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
}

const appliedLogs = () => conditionLogs.filter(e => e.type === 'condition' && e.action === 'applied');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

describe('MA-1392 Revenant Vengeful Glare — truncated save_effect, Frightened-only fail grant', () => {
    it('DATA lock: save_effect truncated at the conditional tail; description keeps full RAW prose', () => {
        const row = glareRow();
        expect(row.name).toBe('Vengeful Glare');
        expect(row.save_dc).toBe(15);
        expect(row.save_type).toBe('Wisdom');
        expect(row.save_effect).toBe('The target has the Frightened condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.');
        expect(row.save_effect).not.toMatch(/cursed|paralyzed/i);
        expect(row.description).toContain('If the Frightened target is cursed by the revenant (see Vow of Revenge), the target also has the <strong>Paralyzed</strong> condition for the duration.');
    });

    it('extraction pin: word-scan of the fixed save_effect yields Frightened ONLY', () => {
        expect(extractConditionsFromSaveEffect(glareRow().save_effect)).toEqual(['frightened']);
    });

    it('pre-fix fingerprint gone: whole-string scan of the old prose sprayed three conditions', () => {
        const oldProse = glareRow().description.replace(/^.*Failure: /, '');
        expect(extractConditionsFromSaveEffect(oldProse)).toEqual(['cursed', 'frightened', 'paralyzed']);
    });

    it('fail leg (total 3 vs DC 15) on uncursed victim: Frightened ONLY — zero cursed/paralyzed grants', async () => {
        await resolveNpcSave(3);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['frightened']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Frightened']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].frightened).toMatchObject({ source: ATTACKER });
        expect(runtimeStore[`${TARGET}.activeConditions`]).not.toContain('cursed');
        expect(runtimeStore[`${TARGET}.activeConditions`]).not.toContain('paralyzed');
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
    });

    it('success leg (nat 1 + 19 vs DC 15): zero grants, zero damage, zero clock', async () => {
        await resolveNpcSave(20);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(appliedLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
