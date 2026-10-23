// @maintained-by-ai: 2026-10-14
// MA-1997: Smaug the Golden "Frightful Presence" — FP save row authored ONLY
// conditions:["frightened"] + save_dc/save_type: the DC 22 Wisdom save adjudicated
// honestly on the live EB-NPC inline lane (chip armed, victim rolled, failure
// stamped on log/lastAttack) but extractConditionsFromSaveEffect (Helpers:383) is
// save_effect-scoped with ZERO description fallback and plain action.conditions is
// NOT a save-lane producer (MA-1927/§346) → applyDamagelessSaveConditions
// (saveProcessing.js) early-returned and Frightened NEVER landed = FAIL(a).
// DATA fix: save_effect:"…Frightened…" (canonical word §346) + the MA-1577
// adult-blue-dracolich FP service shape (OBJECT success_immunity + repeat_save
// between save_type and save_effect — booleans kill it, MA-0147). dc_success
// stays ABSENT — damageless row, half-default never computes damage (§63 moot,
// zero hp_change live-verified). Live post-fix: fail-face grants frightened +
// grant log + frightful_presence tracked te with merged 10-round clock; success
// face grants frightful_presence_immunity te (24h = 14400 rounds) and the
// MA-0030 refusal gate refuses re-fires (`frightful_presence_refused (immunity)`).
// Authority per saveProcessing.frightful-presence.test.js ownership map: this
// file + the MA-2026 Tiamat twin own the FP success face + refusal gate on
// disk rows. (MA-1996 Fire Breath sibling guard lives in its dedicated
// services/encounters/monsterRecharge.ma1996-smaug-fire-breath-recharge.test.js.)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect, gazeImmunityActive } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SMAUG = monsters.find((m) => m.index === 'smaug-the-golden');
const FP = SMAUG.actions.find((a) => a.name === 'Frightful Presence');

describe('MA-1997 disk fingerprint: Smaug Frightful Presence save_effect + FP service shape authored', () => {
  it('row bytes: DC 22 WIS control-only core + MA-1577 canonical FP clause + service shape (objects, not booleans, MA-0147)', () => {
    expect(SMAUG.name).toBe('Smaug the Golden');
    expect(FP.save_dc).toBe(22);
    expect(FP.save_type).toBe('Wisdom');
    expect(FP.conditions).toEqual(['frightened']); // pre-existing byte kept (inert on the save lane, MA-1927)
    expect(FP.description).toContain('or have the Frightened condition for 1 minute');

    expect(FP.save_effect).toBe('The target becomes Frightened. The effect lasts for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Successful creatures are immune to this effect for the next 24 hours. This effect deals no damage.');

    expect(FP.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
    expect(FP.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    const keys = Object.keys(FP);
    expect(keys.indexOf('success_immunity')).toBeGreaterThan(keys.indexOf('save_type'));
    expect(keys.indexOf('repeat_save')).toBeLessThan(keys.indexOf('save_effect'));
    expect(FP.dc_success).toBeUndefined(); // damageless row — half-default never pays damage (§63 moot)
  });

  it('extractor grants frightened (was save_effect-less inert → [] → applyDamagelessSaveConditions early-return)', () => {
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]); // pre-fix input: zero save-lane producers
  });

  it('gazeImmunityActive refuses FP re-fires once the success-immunity te stands (live refused press)', () => {
    const immunityTe = { target: 'Bandit 2', effect: 'frightful_presence_immunity', source: 'Smaug the Golden 1' };
    expect(gazeImmunityActive({ action: FP, target: { name: 'Bandit 2' }, monsterName: 'Smaug the Golden 1', targetEffects: [immunityTe] })).toEqual(
      expect.objectContaining({ effect: 'frightful_presence_immunity', durationMinutes: 1440 }));
    // absent-te (targetEffects:[])→null re-pin folded (pass #509 rec, fix#277
    // echo-class): hand-fed [] is pure parser-input echo of the owner empty-arm
    // truth-table MonsterCardHelpers.gaze-immunity.test.js:48 — same parse exit
    // (find over [] finds nothing regardless of row), zero Smaug-specific signal.
    // The armed leg above stays: distinct-cause consumer seam (this disk FP row's
    // success_immunity bytes + source-name match against the granted te, §MA-1997).
  });
});

// ── Live-lane grant path: processSaveRoll NPC inline branch (useNpcPath =
// !targetIsPlayer) driven from the disk row's own bytes — the exact seam the
// fixed DC 22 chip press adjudicates on. Harness mirrors MA-0048
// saveProcessing.frightful-presence.test.js.
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
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Smaug the Golden 1' }),
  getCurrentCombatRound: () => 3,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 }));
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

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const SMAUG_NAME = 'Smaug the Golden 1';

function saveContextFromRow({ targetName, effectiveD20 }) {
  return {
    attackerName: SMAUG_NAME,
    targetName,
    actionName: FP.name,
    saveDc: FP.save_dc,
    saveType: FP.save_type,
    dcSuccess: 'half', // untouched default transport (row authors no dc_success)
    autoDamageFormula: null, // damageless row — applyDamagelessSaveConditions lane
    saveConditions: extractConditionsFromSaveEffect(FP.save_effect),
    successImmunity: FP.success_immunity,
    repeatSave: FP.repeat_save,
    effectiveD20,
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
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  addEntryLogs.length = 0;
});

describe('MA-1997 live-lane: Frightened now lands on the failed save (was FAIL(a) zero-grant)', () => {
  it('failed save (raw +0, nat 6 < DC 22): frightened applied + grant log + FP tracked te + merged clock, zero damage', async () => {
    const TARGET = 'Bandit 1';
    const { saveSuccess } = await rollNpcInline({ targetName: TARGET, effectiveD20: 6, bonus: 0 });
    expect(saveSuccess).toBe(false);

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['frightened']);
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Frightened' && e.sourceName === SMAUG_NAME)).toBe(true);

    const tes = runtimeStore['campaign.targetEffects'] || [];
    expect(tes).toEqual([expect.objectContaining({
      target: TARGET, effect: 'frightful_presence', source: SMAUG_NAME, dc: 22, condition: 'frightened', rounds: 10,
    })]);
    expect(addExpiration).toHaveBeenCalledTimes(1);
    const clock = addExpiration.mock.calls[0][0];
    expect(clock.rounds).toBe(10);
    expect(clock.effects.map(e => e.type)).toEqual(expect.arrayContaining(['remove_target_effect', 'condition', 'frightful_presence_immunity_grant']));
    expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_tracked')).toBe(true);
    // success-immunity must NOT fire on the fail face
    expect(tes.some(te => te.effect === 'frightful_presence_immunity')).toBe(false);
    expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_immunity_granted')).toBe(false);
  });

  it('successful save (+21 rig, MA-211/§163 deterministic face): zero grant, frightful_presence_immunity te 24h=14400 rounds, no FP track', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 19, bonus: 21 });
    expect(saveSuccess).toBe(true);

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
    const tes = runtimeStore['campaign.targetEffects'] || [];
    expect(tes).toEqual([expect.objectContaining({
      target: 'Bandit 2', effect: 'frightful_presence_immunity', source: SMAUG_NAME, duration: '24_hours', rounds: 14400,
    })]);
    expect(addExpiration).toHaveBeenCalledTimes(1);
    expect(addExpiration.mock.calls[0][0].rounds).toBe(14400);
    expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_immunity_granted')).toBe(true);
    expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_tracked')).toBe(false);
  });
});
