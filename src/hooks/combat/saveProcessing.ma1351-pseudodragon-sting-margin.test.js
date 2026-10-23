// @maintained-by-ai: 2026-10-14
// MA-1351: Pseudodragon Sting fail-margin bands on the DAMAGE-BEARING save
// leg — unlike the MA-0639/MA-1000 rider-only composites (save chip pays no
// damage), Sting's save adjudicates its own 2d4 Poison pool, so the DC chip
// routes applySaveOutcome → applySaveDamage and the structured context.saveMargin
// rider must fire there too (saveProcessing.js:1705, gated on the base
// condition landing). Context derived live from the monsters.json Sting row
// (dcSuccess authored 'none' on the disk row — fix#172 family; the modal
// default for unauthored rows was 'half', MonsterCardModal.jsx :1332).
// Shallow fail (margin < failsBy): POISONED only + FULL pool, no clock.
// Deep fail (margin >= failsBy): applySaveMarginRider adds UNCONSCIOUS with
// ONE merged rounds:600 clock (§37/§170). Success: half damage, zero conditions.
// Pre-fix fingerprints: ungated unconscious over-grant (deep band left in
// save_effect, no save_margin key) and deep-band inert if the damage-leg
// wiring regresses to the rider-only fork — byte-inert legacy test guards both.
// Generic rider mechanics: saveProcessing.save-margin-rider.test.js;
// rider-only twin: saveProcessing.ma1000-homunculus-margin-band.test.js.
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

// 2d4 face pinned to the row's average ("5 (2d4)"): fail pays 5; success
// pays ZERO — the mock mirrors the real computeDamageAfterEvasion branch and
// forwards dcSuccess (authored 'none' on the disk row, fix#172 family).
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Pseudodragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess) => (saveSuccess ? (dcSuccess === 'none' ? 0 : Math.floor(total / 2)) : total),
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
const ATTACKER = 'Pseudodragon 1';
const TARGET = 'Bandit 1';

// Live monsters.json row — the disk row buildAbilitySaveRollContext arms into
// the damage-bearing save-chip context (autoDamageFormula '2d4' rides
// applySaveOutcome → applySaveDamage; saveConditions ['poisoned'] from the
// truncated shallow-band save_effect).
const stingRow = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
    .find(m => m.name === 'Pseudodragon').actions.find(a => a.name === 'Sting');
const SAVE_DC = stingRow.save_dc;
const SAVE_TYPE = stingRow.save_type.slice(0, 3).toUpperCase();
const MARGIN = { failsBy: stingRow.save_margin.fails_by, also: stingRow.save_margin.also };

const stingContext = (total, saveMargin = MARGIN) => ({
    saveDc: SAVE_DC,
    saveType: SAVE_TYPE,
    attackerName: ATTACKER,
    actionName: stingRow.name,
    dcSuccess: stingRow.dc_success ?? 'half',
    autoDamageFormula: stingRow.damage_dice_primary,
    autoDamageDamageType: stingRow.damage_type_primary,
    saveConditions: ['poisoned'],
    saveMargin,
    effectiveD20: total,
    effectiveBonus: 0,
});

async function resolveNpcSave(total, saveMargin) {
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: stingContext(total, saveMargin),
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

describe('MA-1351 Pseudodragon Sting margin bands (damage-bearing save leg)', () => {
    it('monsters.json data lock: damage-bearing row arms DC/CON margin context', () => {
        expect(SAVE_DC).toBe(12);
        expect(SAVE_TYPE).toBe('CON');
        expect(MARGIN).toEqual({ failsBy: 5, also: 'unconscious' });
        expect(stingRow.save_effect).toMatch(/Poisoned/);
        // The damage-bearing fork vs the MA-1000 rider-only twin: this row
        // carries its own save-leg pool.
        expect(stingRow.damage_dice_primary).toBe('2d4');
        expect(stingRow.damage_type_primary).toBe('Poison');
        // fix#172 family: Failure:-only save damage ("Failure: 5 (2d4) Poison
        // damage") — RAW success pays NOTHING; dc_success:"none" authored
        // immediately after save_type (MA-0030 placement).
        expect(stingRow.dc_success).toBe('none');
        expect(Object.keys(stingRow).indexOf('dc_success')).toBe(Object.keys(stingRow).indexOf('save_type') + 1);
    });

    it(`shallow fail by 4 (total ${SAVE_DC - 4}): POISONED only + FULL pool — no Unconscious over-grant, no clock`, async () => {
        await resolveNpcSave(SAVE_DC - 4);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(5);
    });

    it(`deep fail at the boundary, margin exactly ${MARGIN.failsBy} (total ${SAVE_DC - MARGIN.failsBy}): Poisoned + Unconscious with source meta + log`, async () => {
        await resolveNpcSave(SAVE_DC - MARGIN.failsBy);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        const conds = appliedLogs().map(e => e.condition);
        expect(conds).toContain('Poisoned');
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.sourceName).toBe(ATTACKER);
        expect(uncons.sourceAbility).toBe(stingRow.name);
        expect(uncons.description).toMatch(new RegExp(`failed the save by ${MARGIN.failsBy}`));
    });

    it(`deep fail beyond the band (nat 2, margin ${SAVE_DC - 2}): ONE merged rounds:600 clock, both legs (§37/§170)`, async () => {
        await resolveNpcSave(2);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(appliedLogs().find(e => e.condition === 'Unconscious').description).toMatch(new RegExp(`failed the save by ${SAVE_DC - 2}`));
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
    });

    it(`success (total ${SAVE_DC}): ZERO damage (authored dc_success none, fix#172 family), zero conditions, zero clock`, async () => {
        await resolveNpcSave(SAVE_DC);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(appliedLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        // RAW success: nothing — the pre-fix half-default paid 2 (floor of the
        // rolled pool); dc_success:"none" collapses the zero leg (§335).
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
    });

    it('byte-inert without the structured key: poisoned + full damage, no clock (legacy row)', async () => {
        await resolveNpcSave(2, null);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    });
});
