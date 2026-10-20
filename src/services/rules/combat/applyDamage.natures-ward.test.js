// @maintained-by-ai
// CLA-237 regression at the applyDamage choke point: Nature's Ward (2024
// Circle of the Land lv10) — when the PC save-damage lane forwards FULL-STAT
// characters (the modal fix), the CLA-336 land_resistance fold in
// resolveCreatureDefenses must read the LIVE `_circleOfTheLandType` runtime key
// and halve the mapped type: floor(raw/2) + resisted breakdown + the
// "Damage Resistance" passive-resistance log + HP actually landing.
// cs player stubs stay resistances:[] — the fold comes from automation, not
// the stub lists (the CLA-119 stub bug fed exactly these stubs and folded nil).
// Lane ownership: automationPassives.landResistance.test.js:86-95 owns the
// predicate's full landMappings census — this seam pins live-byte behavior
// with two legs (mapped byte folds its type; same byte FULL when unchosen or
// land unset) and stays silent when the guard should not fire (#1187).
// Generic halving arithmetic is owned by applyDamage.helpers.test.js:53-86.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));
vi.mock('../core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}));
vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(() => 0),
}));
vi.mock('../core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

const DRUID = 'Wild_Sage_Druid';
const START_HP = 143;

// Byte-exact Nature's Ward automation envelope from public/data/2024/classes.json.
const LAND_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
  casting_time: 'passive',
};

function makeCombatSummary() {
  return {
    round: 1,
    creatures: [{
      name: DRUID,
      type: 'player',
      maxHp: START_HP,
      currentHp: START_HP,
      resistances: [],
      immunities: [],
      conditions: [],
      concentration: null,
      saveBonuses: {},
    }],
  };
}

function makeFullStatDruid() {
  return {
    name: DRUID,
    campaignName: 'test-campaign',
    computedStats: {
      resistances: [],
      immunities: [],
      automation: { passives: [LAND_PASSIVE] },
    },
  };
}

// Keyed `${name}.${key}` store (#1057/#1186): only exact routings answer;
// every other lookup is undefined. Land bytes are modal-capital — the exact
// bytes CircleOfTheLandSpellsModal writes to the runtime store.
function applyDamage(landByte, damageTypes, rawDamage) {
  const store = new Map([
    [`${DRUID}._circleOfTheLandType`, landByte],
    ['campaign.lastAttack', null],
    [`${DRUID}.activeBuffs`, []],
    [`${DRUID}.activeConditions`, []],
    [`${DRUID}.currentHitPoints`, START_HP],
    [`${DRUID}.tempHp`, 0],
    [`${DRUID}.polymorphTempHp`, 0],
  ]);
  getRuntimeValue.mockImplementation((name, key) => store.get(`${name}.${key}`));
  return applyDamageToTarget(makeCombatSummary(), DRUID, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [makeFullStatDruid()],
    ignoreResistance: false,
    attackerName: DRUID,
  });
}

function damageResistanceLogs() {
  return addEntry.mock.calls.filter(
    ([, entry]) => entry.type === 'automation' && entry.name === 'Damage Resistance'
  );
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-237 Nature\'s Ward land_resistance fold (save-damage seam)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The live land byte, not a hardcoded type, drives the fold: same raw 25
  // halves under its own mapped land and lands as real HP (143 → 131).
  it.each([
    ['Temperate', 'Lightning'],
    ['Arid', 'Fire'],
  ])('live land byte %s folds %s: floor(25/2)=12 + breakdown + golden log bytes', async (landByte, type) => {
    const result = await applyDamage(landByte, [type], 25);

    expect(result.finalDamage).toBe(12);
    expect(result.newHp).toBe(131);
    expect(result.resistanceDetails).toEqual([{ damageType: type, status: 'resistant' }]);

    const logs = damageResistanceLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0][1].creatureName).toBe(DRUID);
    expect(logs[0][1].description).toBe(
      `${DRUID} has resistance to ${type} damage — 25 damage halved to 12.`
    );
  });

  // Guard falsifier (#1187): the fold fires ONLY for the chosen land's mapped
  // type against a live byte — another land's mapped type, unmapped type, and
  // an unset land byte all stay FULL with zero "Damage Resistance" logs.
  it.each([
    ['Temperate', 'Fire', 21],
    ['Temperate', 'Slashing', 16],
    [null, 'Lightning', 25],
  ])('stays FULL and silent: land %s vs %s damage', async (landByte, type, raw) => {
    const result = await applyDamage(landByte, [type], raw);

    expect(result.finalDamage).toBe(raw);
    expect(result.newHp).toBe(START_HP - raw);
    expect(result.resistanceDetails).toEqual([]);
    expect(damageResistanceLogs()).toHaveLength(0);
  });
});
