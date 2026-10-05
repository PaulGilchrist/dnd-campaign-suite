// @improved-by-ai
// CLA-113 regression: Elemental Epitome (2024 Warrior of the Elements lv17).
// elementalEpitomeHandler.applyResistanceChoice stamps activeBuffs with
// {name:'Elemental Epitome', effect:'epitome_resistance', damageType:<type>} and
// REPLACES that entry in place on every per-turn re-pick. applyDamage's
// addBuffResistances reads resistanceTypes arrays only, so the chosen type was
// never consumed — Fire Bolt landed FULL (render-only resistance, CLA-110 family).
// The fix folds the buff's damageType LIVE at hit-resolution (MA-0681
// effect-scoped byte shape; CLA-110/FT-009 double-fold twin: resistances halve
// the hit, passiveResistances logs the halving). Locks: chosen Fire halves Fire
// (floor(raw/2), resisted), unchosen Cold lands full, in-place re-pick
// Fire→Cold switches live, non-epitome buffs stay inert.
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
  parseMagicWordName: vi.fn(),
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

const PLAYER = 'Disciplined_Monk';

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name) {
  return {
    name,
    type: 'player',
    maxHp: 183,
    currentHp: 183,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

function createMonkCharacter(name) {
  return {
    name,
    campaignName: 'test-campaign',
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

function epitomeBuff(type) {
  return { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: type };
}

function stubRuntime(activeBuffs) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return 183;
    if (key === 'hitPoints') return 183;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    return undefined;
  });
}

function apply(damageTypes, rawDamage) {
  const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
  return applyDamageToTarget(cs, PLAYER, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [createMonkCharacter(PLAYER)],
    ignoreResistance: false,
    attackerName: 'DivinationWizard',
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-113 Elemental Epitome chosen-type live resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halves Fire while epitome Fire is armed (resisted)', async () => {
    stubRuntime([epitomeBuff('Fire')]);
    const result = await apply(['Fire'], 29);
    expect(result.finalDamage).toBe(14);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);
  });

  it('halves lowercase fire (normalization mirrors the CLA-110 sibling)', async () => {
    stubRuntime([epitomeBuff('Fire')]);
    const result = await apply(['fire'], 25);
    expect(result.finalDamage).toBe(12);
    expect(result.resistanceDetails).toEqual([{ damageType: 'fire', status: 'resistant' }]);
  });

  it('does NOT halve Cold while Fire is chosen — full damage', async () => {
    stubRuntime([epitomeBuff('Fire')]);
    const result = await apply(['Cold'], 21);
    expect(result.finalDamage).toBe(21);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('per-turn re-pick Fire→Cold switches LIVE (producer replaces the entry in place)', async () => {
    stubRuntime([epitomeBuff('Fire')]);
    const first = await apply(['Fire'], 29);
    expect(first.finalDamage).toBe(14);

    // Start of next turn: handler re-picks Cold by REPLACING the same entry.
    stubRuntime([epitomeBuff('Cold')]);
    const fireAfter = await apply(['Fire'], 29);
    expect(fireAfter.finalDamage).toBe(29);
    expect(fireAfter.resistanceDetails).toEqual([]);
    const coldAfter = await apply(['Cold'], 13);
    expect(coldAfter.finalDamage).toBe(6);
    expect(coldAfter.resistanceDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });

  it('logs the halving via the passive-resistance log channel', async () => {
    stubRuntime([epitomeBuff('Fire')]);
    addEntry.mockClear();
    await apply(['Fire'], 29);
    const resistLog = addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain(PLAYER);
    expect(resistLog[1].description).toContain('29');
    expect(resistLog[1].description).toContain('14');
  });

  it('is byte-inert without the epitome effect — other buffs keep their own lane', async () => {
    // Generic buff carrying a stray damageType must NOT grant resistance
    // (effect-scoped filter, MA-0681 shape).
    stubRuntime([{ name: 'Something Else', effect: 'other', damageType: 'Fire' }]);
    const fire = await apply(['Fire'], 29);
    expect(fire.finalDamage).toBe(29);
    expect(fire.resistanceDetails).toEqual([]);
  });

  it('is byte-inert with no activeBuffs (epitome never activated)', async () => {
    stubRuntime([]);
    for (const [type, dmg] of [['Fire', 29], ['Cold', 13], ['Lightning', 15]]) {
      const result = await apply([type], dmg);
      expect(result.finalDamage).toBe(dmg);
      expect(result.resistanceDetails).toEqual([]);
    }
  });

  it('resistanceTypes buffs (existing lane) still fold unchanged next to the epitome entry', async () => {
    stubRuntime([
      epitomeBuff('Fire'),
      { name: 'Protection', effect: 'protection', resistanceTypes: ['Cold'] },
    ]);
    const fire = await apply(['Fire'], 29);
    expect(fire.finalDamage).toBe(14);
    const cold = await apply(['Cold'], 21);
    expect(cold.finalDamage).toBe(10);
  });
});
