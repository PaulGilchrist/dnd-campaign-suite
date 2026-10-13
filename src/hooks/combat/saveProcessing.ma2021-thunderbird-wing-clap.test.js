// MA-2021: Thunderbird "Wing Clap" legendary save — DC 23 Strength, 2d6 Thunder,
// "Failure: pushed 20 ft. and knocked Prone". The row authored save_dc/save_type/
// damage_dice_primary + hit_conditions:["prone"] BAIT (buildHitConditionClause is
// attack-lane only, §153/§567) but NO save_effect: the save lane word-scans
// save_effect ONLY (extractConditionsFromSaveEffect, Helpers:383) → [] → zero
// prone grant on a failed save = FAIL(a). Push 20 ft / multi-target shapeless
// clause stay §398/§211 advisory-by-design.
// DATA fix: one field save_effect:"The target has the Prone condition." (canonical
// word §346, byte-mirror of the centaur Trampling Charge / damage+condition save
// siblings). dc_success stays ABSENT — half-default pays half on success, matching
// RAW "Success: Half damage". Prone has no duration clause in RAW (ends by moving
// an action), so no durationNote wording is authored.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const THUNDERBIRD = monsters.find((m) => m.index === 'thunderbird');
const WING_CLAP = THUNDERBIRD.legendary_actions.find((a) => a.name === 'Wing Clap');
const STORM_CALL = THUNDERBIRD.legendary_actions[3];

describe('MA-2021 disk fingerprint: Thunderbird Wing Clap save_effect authored, core bytes intact', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 23 STR, 2d6 Thunder', () => {
    expect(THUNDERBIRD.name).toBe('Thunderbird');
    expect(WING_CLAP.save_dc).toBe(23);
    expect(WING_CLAP.save_type).toBe('Strength');
    expect(WING_CLAP.damage_dice_primary).toBe('2d6');
    expect(WING_CLAP.damage_type_primary).toBe('Thunder');
    expect(WING_CLAP.description).toContain('Failure: pushed 20 ft. and knocked Prone; takes 7 (2d6) Thunder damage.');
  });

  it('save_effect authored with the canonical Prone word (byte-minimal, sibling shape)', () => {
    expect(WING_CLAP.save_effect).toBe('The target has the Prone condition.');
    expect(WING_CLAP.dc_success).toBeUndefined(); // half-default = RAW "Success: Half damage"
  });

  it('hit_conditions bait left UNTOUCHED per ticket (attack-lane-only, §153/§567 pin)', () => {
    expect(WING_CLAP.hit_conditions).toEqual(['prone']); // never read on the save lane — honest RAW mirror of "knocked Prone"
  });

  it('extractor grants prone (was save_effect-less inert → [] → zero grant)', () => {
    expect(extractConditionsFromSaveEffect(WING_CLAP.save_effect)).toEqual(['prone']);
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]); // pre-fix input: zero save-lane producers
  });

  it('Storm Call sibling byte-guarded (same board, untouched by this fix)', () => {
    expect(STORM_CALL.name).toBe('Storm Call (Costs 2 Actions)');
    expect(STORM_CALL.delegates_to).toBe('Thunderstrike (Recharge 5-6)');
    expect(STORM_CALL.save_effect).toBeUndefined();
  });
});

// ── Live-lane grant path: processSaveRoll NPC inline branch (useNpcPath =
// !targetIsPlayer) driven from the disk row's own bytes — the exact seam the
// fixed DC 23 chip press adjudicates on. Harness mirrors MA-1997
// saveProcessing.frightful-presence.test.js, adapted to the DAMAGE-bearing
// save lane (applySaveDamage, MA-1351 shape — not applyDamagelessSaveConditions).
const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Thunderbird 1' }),
  getCurrentCombatRound: () => 6,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 880 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  normalizeSaveType: (t) => String(t || '').toUpperCase(),
  computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
  computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
    (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
      : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
  applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
  isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: () => false,
  playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { processSaveRoll } from './saveProcessing.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

const campaignName = 'test-campaign';
const TB_NAME = 'Thunderbird 1';
const TARGET = 'Bandit 1';

// Deterministic 2d6 pool (live repro rolled 2,1 = 3; fail face proven exact there).
const MOCK_DAMAGE = { total: 9, rolls: [4, 5], modifier: 0 };

function saveContextFromRow({ targetName, effectiveD20 }) {
  return {
    attackerName: TB_NAME,
    targetName,
    actionName: WING_CLAP.name,
    saveDc: WING_CLAP.save_dc,
    saveType: WING_CLAP.save_type,
    dcSuccess: 'half', // untouched default transport (row authors no dc_success)
    autoDamageFormula: WING_CLAP.damage_dice_primary,
    autoDamageDamageType: WING_CLAP.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(WING_CLAP.save_effect),
    effectiveD20,
    effectiveBonus: 0,
  };
}

async function rollNpcInline({ targetName, effectiveD20, bonus }) {
  return processSaveRoll({
    rollType: 'save',
    target: { name: targetName, type: 'npc' }, // EB-joined NPC → processNpcSave inline lane
    characterName: targetName,
    campaignName,
    context: saveContextFromRow({ targetName, effectiveD20 }),
    bonus,
    r1: effectiveD20,
    r2: effectiveD20,
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  addEntryLogs.length = 0;
  rollExpression.mockReturnValue(MOCK_DAMAGE);
});

describe('MA-2021 live-lane: Prone now lands on the failed save alongside full damage (was FAIL(a) zero-grant)', () => {
  it('failed save (raw +0, nat 3 < DC 23, structural fail): full 2d6 Thunder AND prone applied + grant log + meta stamp', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: TARGET, effectiveD20: 3, bonus: 0 });
    expect(saveSuccess).toBe(false);

    // Full damage face (computeDamageAfterEvasion: fail → total, no halve)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(9);

    // Prone grant (was zero pre-fix)
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['prone']);
    expect(runtimeStore[`${TARGET}.activeConditionMeta`].prone).toEqual(
      expect.objectContaining({ source: TB_NAME }));
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Prone' && e.sourceName === TB_NAME)).toBe(true);
  });

  it('successful save (+21 rig, deterministic face): half damage floor(9/2)=4 AND zero prone grant', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 19, bonus: 21 });
    expect(saveSuccess).toBe(true);

    // Half-on-success default transport (dc_success absent on disk)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(4);

    // Fail-only condition lane: success face never grants prone
    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
  });
});
