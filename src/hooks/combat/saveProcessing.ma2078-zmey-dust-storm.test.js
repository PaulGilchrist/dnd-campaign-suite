// MA-2078: Zmey Gorynych "Dust Storm" legendary save — DC 23 Strength, 2d6
// Bludgeoning, "Failure: Blinded until the end of its next turn". The row
// authored conditions:["blinded"] BAIT (buildHitConditionClause is attack-lane
// only, §153/§567) but NO save_effect: the save lane word-scans save_effect
// ONLY (extractConditionsFromSaveEffect, Helpers:383) → [] → zero Blinded grant
// on a failed save = FAIL(a) (MA-1997/2013/2045/2021 family).
// DATA fix (MA-2059 Glacier Wave byte-twin — the phrasing that produced the
// until-clause meta; MA-2021's "The target has the Prone condition." carries
// NO duration clause): one field
// save_effect:"The target has the Blinded condition until the end of its next turn."
// (canonical Blinded word §346 + honest RAW duration → durationNote via
// extractConditionDurationNote monsterAbilityUses.js:74, /\b(until\b[^.;]+)/i
// → "until the end of its next turn (GM-enforced)"). dc_success stays UNSET —
// half-default pays half on success, matching the RAW half implicit in the
// damage-bearing save row. conditions:["blinded"] bait KEPT per ticket
// (MA-2021 precedent kept hit_conditions). Shapeless "within 40 ft." carries
// no Cone/Line/Sphere noun → picker-inert inline lane (§211/MA-2041 pin).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import { legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ZMEY = monsters.find((m) => m.index === 'zmey-gorynych');
const HEADER = ZMEY.legendary_actions[0];
const DUST = ZMEY.legendary_actions.find((a) => a.name === 'Dust Storm');
const WING = ZMEY.legendary_actions.find((a) => a.name === 'Wing Buffet (Costs 2 Actions)');
const DUST_DESC = 'Strength Saving Throw: DC 23, each creature within 40 ft. Failure: Blinded until the end of its next turn; takes 7 (2d6) Bludgeoning damage.';

describe('MA-2078 disk fingerprint: Zmey Dust Storm save_effect authored, MA-2059 byte-shape', () => {
  it('row identity + save core byte-unchanged (live-verified RAW): DC 23 STR, 2d6 Bludgeoning', () => {
    expect(ZMEY.name).toBe('Zmey Gorynych');
    expect(DUST.name).toBe('Dust Storm');
    expect(DUST.save_dc).toBe(23);
    expect(DUST.save_type).toBe('Strength');
    expect(DUST.damage_dice_primary).toBe('2d6');
    expect(DUST.damage_type_primary).toBe('Bludgeoning');
    expect(DUST.description).toBe(DUST_DESC);
  });

  it('save_effect authored: canonical Blinded word + honest RAW until-clause (MA-2059 Glacier Wave phrasing twin)', () => {
    expect(DUST.save_effect).toBe('The target has the Blinded condition until the end of its next turn.');
    expect(DUST.dc_success).toBeUndefined(); // half-default = RAW half on success
  });

  it('conditions:["blinded"] bait left UNTOUCHED per ticket (attack-lane-only, §153/§567 pin — MA-2021 kept hit_conditions)', () => {
    expect(DUST.conditions).toEqual(['blinded']); // never read on the save lane — harmless bait
  });

  it('NO range field — shapeless "within 40 ft." carries no Cone/Line/Sphere noun (picker-inert inline lane, §211/MA-2041 pin)', () => {
    expect(DUST.range).toBeUndefined();
    expect(DUST.attack_bonus).toBeUndefined();
    expect(DUST.automation).toBeUndefined();
    expect(DUST.delegates_to).toBeUndefined();
  });

  it('extractor grants blinded (was save_effect-less inert → [] → zero grant)', () => {
    expect(extractConditionsFromSaveEffect(DUST.save_effect)).toEqual(['blinded']);
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]); // pre-fix input: zero save-lane producers
  });

  it('until-clause durationNote lands (MA-2059 phrasing chose over MA-2021 clause-less shape)', () => {
    expect(extractConditionDurationNote(DUST.save_effect)).toBe('until the end of its next turn (GM-enforced)');
    expect(extractConditionDurationNote('The target has the Prone condition.')).toBeNull(); // MA-2021 shape: no until-note
  });

  it('legendary cost honest: name carries no "Costs N" → cost 1 (LA spends exactly 1, live-proven "2 of 3 left")', () => {
    expect(legendaryActionCost(DUST)).toBe(1);
    expect(legendaryActionCost(HEADER)).toBe(1);
  });

  it('MA-2079 sibling Wing Buffet self-resolving save row (§384 inversion of stale delegate pin)', () => {
    expect(WING.name).toBe('Wing Buffet (Costs 2 Actions)');
    expect(WING.delegates_to).toBeUndefined(); // delegate-hijack dropped (MA-2022 pattern)
    expect(WING.save_dc).toBe(23);
    expect(WING.save_type).toBe('Dexterity');
    expect(WING.damage_dice_primary).toBe('2d8');
    expect(WING.damage_type_primary).toBe('Fire');
    expect(WING.dc_success).toBeUndefined(); // half-default — RAW "Success: Half"
    expect(WING.save_effect).toBeUndefined();
    expect(legendaryActionCost(WING)).toBe(2);
  });
});

// ── Live-lane grant path: processSaveRoll NPC inline branch (useNpcPath =
// !targetIsPlayer) driven from the disk row's own bytes — the exact seam the
// fixed DC 23 Strength chip press adjudicates on at a legal post-Zmey
// boundary. Harness mirrors MA-2072/MA-2021 saveProcessing twins.
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

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 4 }));
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
const ZMEY_NAME = 'Zmey Gorynych 1';
const TARGET = 'Bandit 1';

// Deterministic 2d6 pool (live repro rolled 6,1 = 7 — fail face proven exact there).
const MOCK_DAMAGE = { total: 7, rolls: [6, 1], modifier: 0 };

function saveContextFromRow({ targetName, effectiveD20 }) {
  return {
    attackerName: ZMEY_NAME,
    targetName,
    actionName: DUST.name,
    saveDc: DUST.save_dc,
    saveType: DUST.save_type,
    dcSuccess: 'half', // untouched default transport (row authors no dc_success)
    autoDamageFormula: DUST.damage_dice_primary,
    autoDamageDamageType: DUST.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(DUST.save_effect),
    // Modal:418 blockSaveConditionDurationNote — the row's own until-clause.
    conditionDurationNote: extractConditionDurationNote(DUST.save_effect),
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

describe('MA-2078 live-lane: Blinded now lands on the failed save alongside full damage (was FAIL(a) zero-grant)', () => {
  it('failed save (Bandit raw STR +0, even nat 20 < DC 23 — structural fail): full 2d6 Bludgeoning AND blinded applied + grant log + until-clause meta', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: TARGET, effectiveD20: 12, bonus: 0 });
    expect(saveSuccess).toBe(false); // 12+0 < 23 (live repro byte); raw +0 caps at 20 anyway

    // Full damage face (computeDamageAfterEvasion: fail → total, no halve)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);

    // Blinded grant (was zero pre-fix — prose never reached the word lane)
    expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['blinded']);
    expect(runtimeStore[`${TARGET}.activeConditionMeta`].blinded).toEqual(
      expect.objectContaining({ source: ZMEY_NAME }));
    expect(runtimeStore[`${TARGET}.activeConditionMeta`].blinded.durationNote).toBe('until the end of its next turn (GM-enforced)');
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Blinded' && e.sourceName === ZMEY_NAME)).toBe(true);
    // until-clause advisory log carries the honest duration (§346 durationNote family)
    expect(addEntryLogs.some(e => e.automationType === 'condition_clauses_advisory' && e.characterName === TARGET && e.description.includes('until the end of its next turn (GM-enforced)'))).toBe(true);
  });

  it('successful save (+8 rig, deterministic face): half damage floor(7/2)=3 AND zero blinded grant (fail-only word lane, dc_success UNSET half-default)', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 20, bonus: 8 });
    expect(saveSuccess).toBe(true); // 28 ≥ DC 23

    // Half-on-success default transport (dc_success absent on disk)
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(3);

    // Fail-only condition lane: success face never grants blinded
    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
    expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
  });
});
