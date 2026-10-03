// @improved-by-ai
// FT-009 regression: Boon Of Energy Resistance (2024 Epic Boon).
// The Energy Resistances chooser stamps the runtime key
// `_Energy_Resistances_chosenTypes` (producer = boonOfEnergyResistanceHandler,
// via choiceStorage name "Energy Resistances"). The damage pipeline must read
// that SAME producer key LIVE at hit-resolution (CLA-336 Stormborn twin) so a
// mid-session re-pick halves damage WITHOUT a computedStats recompute.
// Locks: chosen Fire halves Fire, chosen Cold halves Cold, unchosen Lightning
// lands full, halving is logged, and an absent key stays byte-inert.
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

// choiceStorage is NOT mocked — getChosenRuntimeValue runs LIVE, delegating to
// the mocked getRuntimeValue, so the producer key lookup is exercised for real.
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

const PLAYER = 'Disciplined_Monk';

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createPlayerCreature(name) {
  return {
    name,
    type: 'player',
    maxHp: 143,
    currentHp: 143,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
  };
}

// Stale computedStats: the chooser stamped runtime keys AFTER this was computed,
// so computedStats.resistances is empty even though chosenTypes is live.
function createMonkCharacter(name, computedResistances = []) {
  return {
    name,
    campaignName: 'test-campaign',
    computedStats: {
      resistances: computedResistances,
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
    },
  };
}

function stubRuntime(chosenTypes) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return 143;
    if (key === 'hitPoints') return 143;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    if (key === '_Energy_Resistances_chosenTypes') return chosenTypes;
    return undefined;
  });
}

function apply(damageTypes, rawDamage) {
  const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
  return applyDamageToTarget(cs, PLAYER, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [createMonkCharacter(PLAYER)],
    ignoreResistance: false,
    attackerName: 'Fire Giant 1',
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — FT-009 Energy Resistances live chooser resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halves Fire while Fire+Cold are chosen (resisted:true)', async () => {
    stubRuntime(['Fire', 'Cold']);
    const result = await apply(['Fire'], 13);
    expect(result.finalDamage).toBe(6);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Fire', status: 'resistant' }]);
  });

  it('halves Cold while Fire+Cold are chosen (resisted:true)', async () => {
    stubRuntime(['Fire', 'Cold']);
    const result = await apply(['Cold'], 11);
    expect(result.finalDamage).toBe(5);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });

  it('does NOT halve Lightning (unchosen) — full damage, resisted:false', async () => {
    stubRuntime(['Fire', 'Cold']);
    const result = await apply(['Lightning'], 15);
    expect(result.finalDamage).toBe(15);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('halves the Fire leg of a mixed Slashing+Fire attack via the breakdown', async () => {
    stubRuntime(['Fire', 'Cold']);
    // Fire Giant Flame Sword primary: Slashing (full) — proves only the chosen leg halves
    const slashResult = await apply(['Slashing'], 16);
    expect(slashResult.finalDamage).toBe(16);
    expect(slashResult.resistanceDetails).toEqual([]);
    // Fire leg of the same attack halves
    const fireResult = await apply(['Fire'], 13);
    expect(fireResult.finalDamage).toBe(6);
  });

  it('logs the halving via the passive-resistance log channel', async () => {
    stubRuntime(['Fire', 'Cold']);
    addEntry.mockClear();
    await apply(['Fire'], 13);
    const resistLog = addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain(PLAYER);
    expect(resistLog[1].description).toContain('Fire');
    expect(resistLog[1].description).toContain('13');
    expect(resistLog[1].description).toContain('6');
  });

  it('is byte-inert when no chosen types are set (unknown key → full damage)', async () => {
    stubRuntime(null);
    for (const [type, dmg] of [['Fire', 13], ['Cold', 11], ['Lightning', 15]]) {
      const result = await apply([type], dmg);
      expect(result.finalDamage).toBe(dmg);
      expect(result.resistanceDetails).toEqual([]);
    }
  });

  it('is byte-inert when the chosen array is empty', async () => {
    stubRuntime([]);
    const result = await apply(['Fire'], 13);
    expect(result.finalDamage).toBe(13);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('reads the live producer key, not the parent feat name (key mismatch guard)', async () => {
    // Provide ONLY the correct producer key; a feat-name key consumer would read nothing.
    getRuntimeValue.mockImplementation((_charName, key) => {
      if (key === '_Boon_Of_Energy_Resistance_chosenTypes') return undefined; // the OLD broken key
      if (key === '_Energy_Resistances_chosenTypes') return ['Cold']; // the live producer key
      if (key === 'activeBuffs') return [];
      if (key === 'currentHitPoints') return 143;
      return undefined;
    });
    const cs = makeCombatSummary([createPlayerCreature(PLAYER)]);
    const result = await applyDamageToTarget(cs, PLAYER, 11, ['Cold'], {
      campaignName: 'test-campaign',
      characters: [createMonkCharacter(PLAYER)],
      attackerName: 'Abominable Yeti 1',
    });
    expect(result.finalDamage).toBe(5);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Cold', status: 'resistant' }]);
  });
});
