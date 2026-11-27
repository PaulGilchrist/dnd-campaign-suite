// @maintained-by-ai 2026-11-26
// MA-1000: Homunculus Bite fail-margin bands — the rider-only composite save
// chip (MA-0560 fork, MA-1000 guard fix) rides applyDamagelessSaveConditions
// with saveConditions ['poisoned'] (shallow-band-only save_effect, MA-0639
// twin layout) + structured context.saveMargin {failsBy:5, also:'unconscious'}
// derived LIVE from the monsters.json Homunculus row through the real
// processSaveRoll seam. This file owns ONLY the live-row band adjudication
// (per the cite-skip in MonsterCardModal.ma1000-homunculus-bite-save-rider):
// shallow fail → POISONED only (the §214 no-over-grant holds end-to-end);
// deep fail at the boundary → Poisoned + Unconscious on ONE merged clock at
// the AUTHORED duration ("1 minute" → rounds:10, owner ruling 2026-11-10
// minutes×10), zero save-leg damage (§410: autoDamageFormula null);
// success → zero grants, zero clock.
// Delegated elsewhere, not re-anchored here:
// - disk-row byte lock + save transport (DC/CON/save_margin/saveConditions):
//   MonsterCardModal.ma1000-homunculus-bite-save-rider.test.js
// - parseSaveMarginClause unit contract: MonsterCardHelpers.save-margin.test.js
// - generic rider mechanics (boundary ≥ gate, margin-10 beyond-band prose +
//   merged clock, clauseless byte-inert, immunity, no-double-grant):
//   saveProcessing.save-margin-rider.test.js
// - damage-bearing save leg contrast: saveProcessing.ma1351-pseudodragon-sting-margin.test.js
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
import { parseSaveMarginClause } from '../../components/encounter/MonsterCardHelpers.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Homunculus 1';
const TARGET = 'Bandit 1';

// Live monsters.json row — the disk row buildAbilitySaveRollContext arms into
// the rider-only save-chip context (saveDamageFormula null: rider-only fork).
// Byte-lock of this row lives in the modal test; here it is the integration
// subject. The deep-band anchor below fails loudly if the row ever drifts.
const biteRow = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
    .find(m => m.name === 'Homunculus').actions.find(a => a.name === 'Bite');
const SAVE_DC = biteRow.save_dc;
const SAVE_TYPE = biteRow.save_type.slice(0, 3).toUpperCase();
// Real parser (live-lane parity): { failsBy, also, duration }.
const MARGIN = parseSaveMarginClause(biteRow) ?? {};

const biteContext = (total) => ({
    saveDc: SAVE_DC,
    saveType: SAVE_TYPE,
    attackerName: ATTACKER,
    actionName: biteRow.name,
    dcSuccess: null,
    autoDamageFormula: null,
    saveConditions: ['poisoned'],
    saveMargin: MARGIN.failsBy ? MARGIN : null,
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

describe('MA-1000 Homunculus Bite margin bands (live row through the real save seam)', () => {
    it(`shallow fail by 3 (total ${SAVE_DC - 3}): POISONED only — no Unconscious over-grant, no clock, no damage`, async () => {
        await resolveNpcSave(SAVE_DC - 3);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
        expect(addExpiration).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('deep fail at the boundary, margin exactly 5: row anchor + Poisoned + Unconscious, ONE merged rounds:10 clock (authored 1 minute ×10) — NO damage (§410)', async () => {
        // MA-1000 disk anchor: the bands below only mean what they say if the
        // structured margin is armed as authored (full byte-lock: modal test).
        expect(MARGIN).toEqual({ failsBy: 5, also: 'unconscious', duration: '1 minute' });

        await resolveNpcSave(SAVE_DC - MARGIN.failsBy);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].unconscious).toMatchObject({ source: ATTACKER });
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.sourceName).toBe(ATTACKER);
        expect(uncons.sourceAbility).toBe('Bite');
        expect(uncons.description).toMatch(/failed the save by 5/);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: ATTACKER,
            targetName: TARGET,
            campaignName,
            rounds: 10,
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
