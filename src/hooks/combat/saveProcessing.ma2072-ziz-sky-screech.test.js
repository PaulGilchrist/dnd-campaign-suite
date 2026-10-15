// @maintained-by-ai: 2026-10-14
// MA-2072: Ziz "Sky Screech (Costs 2 Actions)" legendary save child — formerly
// a prose-only row (name + delegates_to:null + description only) that spent 2
// legendary uses via the MA-1883 costs-2 NAME-parse and dead-ended at the
// console.error in MonsterCardModal.resolveLegendaryRowMechanic with ZERO
// save/damage/Prone (exact MA-2063 Ymir Frost Geyser / MA-1990 Simurgh
// silent-burn twins; MA-1974 active-trap fingerprint).
// DATA fix (MA-2063 byte-shape): author save_dc:23 / save_type:"Wisdom" /
// damage_dice_primary:"2d6" / damage_type_primary:"Thunder" /
// save_effect:"The target has the Prone condition." with delegates_to:null
// KEPT (numeric child self-resolves — the save_dc>0 leg routes before the
// delegate leg) and dc_success UNSET (RAW states no Success face explicitly:
// engine half-damage default applies to damage; Prone stays fail-only via the
// save_effect word lane). NO range field — "Enemies within 60 ft." carries no
// Cone/Line/Sphere/Radius shape noun, so the prose picker stays inert
// (MA-2041 pin) and the row rides the inline save lane (MA-2041/MA-2021).
// Costs-2 enforcement rides the name-parse (legendaryActionCost — generic
// parse pinned in monsterLegendaryUses.ma1883; the Blinding Ascent self-buff
// sibling is pinned in monsterSelfBuff.ma2071 — deduped here).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ZIZ = monsters.find((m) => m.index === 'ziz');
const SCREECH = ZIZ.legendary_actions[3];
const SCREECH_DESC = 'Enemies within 60 ft. must succeed on a DC 23 Wisdom saving throw or take 7 (2d6) Thunder damage and be knocked Prone.';

describe('MA-2072 disk fingerprint: Ziz Sky Screech structured save fields authored, MA-2063 byte-shape', () => {
  it('live-verified exact: DC 23 Wisdom 2d6 Thunder + canonical Prone word; half-default honest; key order mirrors Ymir twin (range slot skipped — no shape noun)', () => {
    expect(ZIZ.name).toBe('Ziz');
    expect(SCREECH.name).toBe('Sky Screech (Costs 2 Actions)');
    expect(SCREECH.save_dc).toBe(23);
    expect(SCREECH.save_type).toBe('Wisdom');
    expect(SCREECH.damage_dice_primary).toBe('2d6');
    expect(SCREECH.damage_type_primary).toBe('Thunder');
    expect(SCREECH.save_effect).toBe('The target has the Prone condition.');
    expect(SCREECH.dc_success).toBeUndefined(); // half-damage default honest; Prone fail-only word lane
    expect(SCREECH.description).toBe(SCREECH_DESC);
    expect(Object.keys(SCREECH)).toEqual([
      'name', 'delegates_to', 'save_dc', 'save_type', 'damage_dice_primary', 'damage_type_primary', 'save_effect', 'description',
    ]);
    // delegates_to:null KEPT — the pre-fix burn marker, pinned; numeric child self-resolves.
    expect(SCREECH.delegates_to).toBeNull();
    // Shapeless inline lane pins (MA-2041): "within 60 ft." carries no shape noun.
    expect(SCREECH.range).toBeUndefined();
    expect(SCREECH.attack_bonus).toBeUndefined();
    expect(SCREECH.automation).toBeUndefined();
    expect(SCREECH.advisory).toBeUndefined();
    // Unique save-lane contract: the extractor grants prone (was save_effect-less inert → [] → zero grant).
    expect(extractConditionsFromSaveEffect(SCREECH.save_effect)).toEqual(['prone']);
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]); // pre-fix input: zero save-lane producers
  });

  it('costs-2 NAME-parse honest: legendaryActionCost === 2 (spends exactly 2, never 1)', () => {
    expect(legendaryActionCost(SCREECH)).toBe(2);
  });
});

// ── Live-lane grant path: processSaveRoll NPC inline branch (useNpcPath =
// !targetIsPlayer) driven from the disk row's own bytes — the exact seam the
// fixed DC 23 Wisdom chip press adjudicates on at a legal post-turn boundary.
// Harness mirrors MA-2021 saveProcessing.thunderbird-wing-clap.test.js.
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
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Bandit 1' }),
  getCurrentCombatRound: () => 6,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 806 }));
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
const ZIZ_NAME = 'Ziz 1';

// Deterministic 2d6 pool (fail-face live repro will record exact rolls).
const MOCK_DAMAGE = { total: 9, rolls: [4, 5], modifier: 0 };

function saveContextFromRow({ targetName, effectiveD20 }) {
  return {
    attackerName: ZIZ_NAME,
    targetName,
    actionName: SCREECH.name,
    saveDc: SCREECH.save_dc,
    saveType: SCREECH.save_type,
    dcSuccess: 'half', // untouched default transport (row authors no dc_success)
    autoDamageFormula: SCREECH.damage_dice_primary,
    autoDamageDamageType: SCREECH.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(SCREECH.save_effect),
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

describe('MA-2072 live-lane: DC 23 Wisdom save now resolves inline — fail grants 2d6 Thunder + Prone (was console.error dead-end)', () => {
  it('failed save (Bandit raw WIS +0, nat cap 20 < DC 23 structural fail): full 2d6 Thunder AND prone applied + grant log + meta stamp', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 1', effectiveD20: 20, bonus: 0 });
    expect(saveSuccess).toBe(false); // raw +0: even nat 20 cannot beat DC 23 — structural fail

    // Full damage face (computeDamageAfterEvasion: fail → total, no halve)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(9);

    // Prone grant (was zero pre-fix — prose never reached the word lane)
    expect(runtimeStore['Bandit 1.activeConditions']).toEqual(['prone']);
    expect(runtimeStore['Bandit 1.activeConditionMeta'].prone).toEqual(
      expect.objectContaining({ source: ZIZ_NAME }));
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Prone' && e.sourceName === ZIZ_NAME)).toBe(true);
  });

  it('successful save (+8 rig, deterministic face): half damage floor(9/2)=4 AND zero prone grant (fail-only word lane, dc_success UNSET half-default)', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 20, bonus: 8 });
    expect(saveSuccess).toBe(true); // 28 ≥ DC 23

    // Half-on-success default transport (dc_success absent on disk)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(4);

    // Fail-only condition lane: success face never grants prone
    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
  });
});
