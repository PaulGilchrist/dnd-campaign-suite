// @maintained-by-ai: 2026-10-14
// MA-1000: Homunculus Bite fail-margin bands — the rider-only composite save
// chip (MA-0560 fork, MA-1000 guard fix) rides applyDamagelessSaveConditions
// with saveConditions ['poisoned'] (shallow-band-only save_effect, MA-0639
// twin layout) + structured context.saveMargin {failsBy:5, also:'unconscious'}
// derived live from the monsters.json Homunculus row.
// Shallow fail (margin < 5): POISONED ONLY — the extracted word list carries
// no unconscious, so the shallow over-grant is suppressed at the source (§214).
// Deep fail (margin >= 5): applySaveMarginRider adds UNCONSCIOUS with ONE
// merged rounds:600 clock (§37/§170). Success: zero grants, zero clock.
// The save leg pays NO damage (§410/§416): autoDamageFormula null, so no
// applyDamageToTarget call and no save-damage log on any band.
// Generic rider mechanics + byte-inert fork: saveProcessing.save-margin-rider.test.js;
// damage-bearing save leg: saveProcessing.ma1351-pseudodragon-sting-margin.test.js.
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

const rollExpression = vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Homunculus 1' }),
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

import { readFileSync } from 'node:fs';
import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Homunculus 1';
const TARGET = 'Bandit 1';

// Live monsters.json row — the disk row buildAbilitySaveRollContext arms into
// the rider-only save-chip context (saveDamageFormula null: rider-only fork).
const biteRow = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
    .find(m => m.name === 'Homunculus').actions.find(a => a.name === 'Bite');
const SAVE_DC = biteRow.save_dc;
const SAVE_TYPE = biteRow.save_type.slice(0, 3).toUpperCase();
const MARGIN = { failsBy: biteRow.save_margin.fails_by, also: biteRow.save_margin.also };

const biteContext = (total) => ({
    saveDc: SAVE_DC,
    saveType: SAVE_TYPE,
    attackerName: ATTACKER,
    actionName: biteRow.name,
    dcSuccess: null,
    autoDamageFormula: null,
    saveConditions: ['poisoned'],
    saveMargin: MARGIN,
    effectiveD20: total,
    effectiveBonus: 0,
});

async function resolveNpcSave(total) {
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: biteContext(total),
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

describe('MA-1000 Homunculus Bite margin bands', () => {
    it('monsters.json data lock: rider-only row arms DC/CON margin context', () => {
        expect(SAVE_DC).toBe(12);
        expect(SAVE_TYPE).toBe('CON');
        expect(MARGIN).toEqual({ failsBy: 5, also: 'unconscious' });
        expect(biteRow.save_effect).toMatch(/Poisoned/);
        expect(biteRow).not.toHaveProperty('save_damage_formula');
    });

    it(`shallow fail by 3 (total ${SAVE_DC - 3}): POISONED only — no Unconscious over-grant, no clock`, async () => {
        await resolveNpcSave(SAVE_DC - 3);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it(`deep fail at the boundary, margin exactly ${MARGIN.failsBy}: Poisoned + Unconscious, meta + log`, async () => {
        await resolveNpcSave(SAVE_DC - MARGIN.failsBy);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.sourceName).toBe(ATTACKER);
        expect(uncons.sourceAbility).toBe('Bite');
        expect(uncons.description).toMatch(new RegExp(`failed the save by ${MARGIN.failsBy}`));
    });

    it(`deep fail beyond the band, margin ${SAVE_DC - 2}: ONE merged rounds:600 clock, both legs — NO damage (§37/§170/§410)`, async () => {
        await resolveNpcSave(2);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: ATTACKER,
            targetName: TARGET,
            campaignName,
            rounds: 600,
            effects: [
                { type: 'condition', condition: 'poisoned' },
                { type: 'condition', condition: MARGIN.also },
            ],
        }));
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(conditionLogs.filter(e => e.type === 'roll' && e.rollType === 'save-damage')).toHaveLength(0);
    });

    it(`success (total ${SAVE_DC}): zero grants, zero clock, zero damage`, async () => {
        await resolveNpcSave(SAVE_DC);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(appliedLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
