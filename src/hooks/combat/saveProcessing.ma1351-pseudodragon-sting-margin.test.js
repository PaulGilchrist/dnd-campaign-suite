// @maintained-by-ai 2026-11-26
// MA-1351: Pseudodragon Sting fail-margin bands on the DAMAGE-BEARING save
// leg — unlike the MA-0639/MA-1000 rider-only composites (save chip pays no
// damage), Sting's save adjudicates its own 2d4 Poison pool, so the DC chip
// routes applySaveOutcome → applySaveDamage and the structured context.saveMargin
// rider must fire there too, gated on the base condition actually landing
// ("unconscious WHILE poisoned"). Context is derived through the SAME live
// transport the modal arms (parseSaveMarginClause +
// extractConditionsFromSaveEffect over the monsters.json Sting row). The
// merged clock follows the owner ruling 2026-11-10: the base clause authors
// "for 1 hour" → hours×600 → rounds:600 (pinned as the source encodes today).
// Lane fingerprints (pre-fix guards):
// - shallow fail (margin < failsBy): POISONED only + FULL pool, no clock —
//   no ungated unconscious over-grant;
// - deep fail at the boundary: rider fires THROUGH the damage leg — both
//   conditions on ONE merged rounds:600 clock AND the full 2d4 still pays
//   (inert rider = deep-band lost when the :1705 wiring regresses to the
//   rider-only fork);
// - success: dc_success "none" (fix#172 family, Failure:-only prose) pays
//   ZERO, not half (the MA-0030 placement byte this row's only fingerprint
//   lives here — dc-success-half-leak-family cite-skips MA-1351);
// - byte-inert: no structured key → legacy poisoned + full damage, no clock.
// Delegated elsewhere, not re-anchored here:
// - generic rider mechanics (≥-gate, beyond-band prose, merged clock,
//   byte-inert, immunity, no-double-grant, duration→rounds encoding):
//   saveProcessing.save-margin-rider.test.js
// - rider-only twin: saveProcessing.ma1000-homunculus-margin-band.test.js
// - parseSaveMarginClause unit contract: MonsterCardHelpers.save-margin.test.js
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
// pays ZERO via the mocked half/none branch below.
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
import { parseSaveMarginClause, extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const campaignName = 'test-campaign';
const ATTACKER = 'Pseudodragon 1';
const TARGET = 'Bandit 1';

// Live monsters.json row — the disk row the modal's save-chip transport arms
// into the damage-bearing context (autoDamageFormula '2d4' rides
// applySaveOutcome → applySaveDamage). Margin and conditions come through the
// REAL parsers (live-lane parity), not hand-built constants.
const stingRow = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
    .find(m => m.name === 'Pseudodragon').actions.find(a => a.name === 'Sting');
const SAVE_DC = stingRow.save_dc;
const SAVE_TYPE = stingRow.save_type.slice(0, 3).toUpperCase();
const MARGIN = parseSaveMarginClause(stingRow) ?? {};
const SAVE_CONDITIONS = extractConditionsFromSaveEffect(stingRow.save_effect);

const stingContext = (total, saveMargin = MARGIN) => ({
    saveDc: SAVE_DC,
    saveType: SAVE_TYPE,
    attackerName: ATTACKER,
    actionName: stingRow.name,
    dcSuccess: stingRow.dc_success,
    autoDamageFormula: stingRow.damage_dice_primary,
    autoDamageDamageType: stingRow.damage_type_primary,
    saveConditions: SAVE_CONDITIONS,
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
    it('monsters.json data lock: damage-bearing row arms the live margin/zero-success context', () => {
        expect(SAVE_DC).toBe(12);
        expect(SAVE_TYPE).toBe('CON');
        expect(SAVE_CONDITIONS).toEqual(['poisoned']);
        // Real-parser anchor: shallow band ends at Poisoned ("for 1 hour" —
        // the authored duration feeding the merged clock's hours×600);
        // deep-band rider is the structured save_margin key.
        expect(MARGIN).toEqual({ failsBy: 5, also: 'unconscious', duration: '1 hour' });
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

    it(`deep fail at the boundary, margin exactly ${MARGIN.failsBy} (total ${SAVE_DC - MARGIN.failsBy}): both legs grant AND the full pool still pays, ONE merged rounds:600 clock`, async () => {
        await resolveNpcSave(SAVE_DC - MARGIN.failsBy);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].poisoned).toMatchObject({ source: ATTACKER });
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].unconscious).toMatchObject({ source: ATTACKER });
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned', 'Unconscious']);
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.sourceName).toBe(ATTACKER);
        expect(uncons.sourceAbility).toBe(stingRow.name);
        expect(uncons.description).toMatch(new RegExp(`failed the save by ${MARGIN.failsBy}`));
        // Rider fires THROUGH the damage leg: a single merged clock carries
        // both condition legs at the authored "1 hour" → 600 rounds...
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
        // ...and the deep fail never forfeits the save-leg 2d4 pool.
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(5);
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
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(5);
    });
});
