// @maintained-by-ai: 2026-10-14
// MA-2045: Typhon legendary_actions[3] "Earthquake (Costs 2 Actions)" — DC 25 Dexterity,
// 6d8 Bludgeoning, "Failure: ... knocked Prone. Success: half damage and not Prone."
// The row authored save_dc/save_type/damage_dice_primary + hit_conditions:["prone"] BAIT
// (buildHitConditionClause is attack-lane only, §153/§567) but NO save_effect: the save
// lane word-scans save_effect ONLY (extractConditionsFromSaveEffect, Helpers:383 →
// Modal handleSaveRoll) → [] → zero prone grant on a failed save = FAIL(a).
// Costs-2 economy rides the NAME parse (MA-1883); delegates_to master hijack was already
// denied by own numeric fields (legendaryRowHasNumericMechanic, MonsterCardModal.jsx:895)
// and its vestigial key was dropped with the fix (MA-2022 precedent).
// DATA fix (MA-2021 Wing Clap byte-shape): one field save_effect:"The target has the
// Prone condition." — dc_success stays ABSENT (half-default pays half on success,
// matching RAW "Success: half damage"); save_effect grants fire on failure only.
// hit_conditions bait left UNTOUCHED (ticket).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { rechargeUsageOf, monsterRechargeGate, rechargeActionKey } from '../../services/encounters/monsterRecharge.js';
import { legendaryDelegateAction, legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TYPHON = monsters.find((m) => m.index === 'typhon');
const EARTHQUAKE = TYPHON.legendary_actions.find((a) => a.name === 'Earthquake (Costs 2 Actions)');
const BREACH = TYPHON.actions.find((a) => a.name === 'Storm Breach (Recharge 5-6)');

describe('MA-2045 disk fingerprint: Typhon Earthquake save_effect authored, core bytes intact', () => {
  it('live-verified exact: DC 25 Dex 6d8 Bludgeoning + canonical Prone word; costs-2 parse; half-default and bait untouched', () => {
    expect(TYPHON.name).toBe('Typhon');
    expect(EARTHQUAKE.save_dc).toBe(25);
    expect(EARTHQUAKE.save_type).toBe('Dexterity');
    expect(EARTHQUAKE.damage_dice_primary).toBe('6d8');
    expect(EARTHQUAKE.damage_type_primary).toBe('Bludgeoning');
    expect(EARTHQUAKE.description).toContain('Failure: 27 (6d8) Bludgeoning damage and the target is knocked Prone. Success: half damage and not Prone.');
    // The one-field DATA fix (MA-2021 byte-minimal sibling shape):
    expect(EARTHQUAKE.save_effect).toBe('The target has the Prone condition.');
    expect(EARTHQUAKE.dc_success).toBeUndefined(); // half-default = RAW "Success: half damage and not Prone" — pin its ABSENCE
    // Unique save-lane contract: the extractor grants prone (was save_effect-less inert → []):
    expect(extractConditionsFromSaveEffect(EARTHQUAKE.save_effect)).toEqual(['prone']);
    // MA-1883: costs-2 rides the NAME parse — press spends exactly 2 of 3 LA.
    expect(legendaryActionCost(EARTHQUAKE)).toBe(2);
    // hit_conditions bait left UNTOUCHED per ticket — attack-lane-only (§153/§567), never read on the save lane:
    expect(EARTHQUAKE.hit_conditions).toEqual(['prone']); // honest RAW mirror of "knocked Prone"
  });

  it('delegates_to GONE — delegate lane unreachable (vestigial drift dropped, MA-2022 precedent)', () => {
    expect(EARTHQUAKE.delegates_to).toBeUndefined();
    // The :895 delegate leg gate is `!legendaryRowHasNumericMechanic(action) && action.delegates_to` —
    // an absent delegates_to makes it dead for any press; own save_dc > 0 also self-resolves the row.
    expect(legendaryDelegateAction(TYPHON, EARTHQUAKE)).toBeNull();
    expect(Number(EARTHQUAKE.save_dc)).toBeGreaterThan(0);
  });

  it('recharge decoupling: Earthquake authors no recharge — gate null even with master Storm Breach SPENT; master stays byte-untouched (MA-2041 twin)', () => {
    expect(EARTHQUAKE.recharge).toBeUndefined();
    expect(rechargeUsageOf(EARTHQUAKE)).toBeNull();
    expect(monsterRechargeGate(EARTHQUAKE, { 'Storm Breach': { recharged: false, threshold: 5 } })).toBeNull(); // press never consults/refuses/consumes the master key
    expect(BREACH.save_dc).toBe(27);
    expect(BREACH.save_type).toBe('Strength');
    expect(BREACH.damage_dice_primary).toBe('26d6');
    expect(BREACH.damage_type_primary).toBe('Bludgeoning');
    expect(BREACH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREACH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREACH)).toBe('Storm Breach');
  });
});

// ── Live-lane unit: processSaveRoll NPC inline branch driven from the disk row's OWN
// bytes (MA-2021 harness mirror, MA-1997 lineage) — the exact seam the fixed
// DC 25 chip press adjudicates on (shapeless "within 60 ft" prose = inline auto-roll,
// never picker, §211/MA-2041 pin). Fail pays FULL Σ6d8 AND grants Prone (was zero);
// dc_success unset → half-default success pays floor(Σ/2) with zero prone.
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
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'AasimarTest' }),
  getCurrentCombatRound: () => 6,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
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
const TYPHON_NAME = 'Typhon 1';

// Deterministic 6d8 pool — the live pre-fix repro pool (Σ=21; fail face proven exact there).
const MOCK_DAMAGE = { total: 21, rolls: [3, 6, 2, 1, 7, 2], modifier: 0 };

function saveContextFromRow({ targetName, effectiveD20 }) {
  return {
    attackerName: TYPHON_NAME,
    targetName,
    actionName: EARTHQUAKE.name,
    saveDc: EARTHQUAKE.save_dc,
    saveType: EARTHQUAKE.save_type,
    dcSuccess: 'half', // untouched default transport (row authors no dc_success)
    autoDamageFormula: EARTHQUAKE.damage_dice_primary,
    autoDamageDamageType: EARTHQUAKE.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(EARTHQUAKE.save_effect),
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

describe('MA-2045 live-lane unit: Prone lands on the failed save alongside full damage (was FAIL(a) zero-grant)', () => {
  it('failed save (raw +0, nat 8 < DC 25, live repro fail face): rolls 6d8 (never 26d6) pays FULL pool AND prone applied + grant log + meta stamp', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 1', effectiveD20: 8, bonus: 0 });
    expect(saveSuccess).toBe(false);

    const formulas = rollExpression.mock.calls.map(c => c[0]);
    expect(formulas).toContain('6d8');
    expect(formulas).not.toContain('26d6'); // master Storm Breach pool never reachable

    // Full damage face (computeDamageAfterEvasion: fail → total, no halve)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(21);

    // Prone grant (was zero pre-fix: save_effect absent → [] → zero grants)
    expect(runtimeStore['Bandit 1.activeConditions']).toEqual(['prone']);
    expect(runtimeStore['Bandit 1.activeConditionMeta'].prone).toEqual(
      expect.objectContaining({ source: TYPHON_NAME }));
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Prone' && e.sourceName === TYPHON_NAME)).toBe(true);
  });

  it('successful save (+21 rig, deterministic face): half damage floor(21/2)=10 AND zero prone grant (RAW "not Prone")', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 19, bonus: 21 });
    expect(saveSuccess).toBe(true);

    // Half-on-success default transport (dc_success absent on disk)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(10);

    // Fail-only condition lane: success face never grants prone
    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
  });
});
