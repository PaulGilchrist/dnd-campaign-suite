// @improved-by-ai
// CLA-237 regression at the applyDamage choke point: Nature's Ward (2024
// Circle of the Land lv10) — when the PC save-damage lane forwards FULL-STAT
// characters (the modal fix), the CLA-336 land_resistance fold in
// resolveCreatureDefenses must read the LIVE `_circleOfTheLandType` runtime key
// and halve the mapped type: floor(raw/2) + resisted breakdown + the
// "Damage Resistance" passive-resistance log. Unmapped types stay FULL.
// cs player stubs stay resistances:[] — the fold comes from automation, not
// the stub lists (the CLA-119 stub bug fed exactly these stubs and folded nil).
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

const LAND_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
};

function makeCombatSummary() {
  return {
    round: 1,
    creatures: [{
      name: DRUID,
      type: 'player',
      maxHp: 143,
      currentHp: 143,
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

function apply(landType, damageTypes, rawDamage) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === '_circleOfTheLandType') return landType;
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    if (key === 'currentHitPoints') return 143;
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    return undefined;
  });
  return applyDamageToTarget(makeCombatSummary(), DRUID, rawDamage, damageTypes, {
    campaignName: 'test-campaign',
    characters: [makeFullStatDruid()],
    ignoreResistance: false,
    attackerName: DRUID,
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-237 Nature\'s Ward land_resistance fold (save-damage lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Temperate halves Lightning: floor(raw/2) + resisted breakdown', async () => {
    const result = await apply('Temperate', ['Lightning'], 25);
    expect(result.finalDamage).toBe(12);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Lightning', status: 'resistant' }]);
  });

  it('logs the halving via the Damage Resistance automation channel', async () => {
    await apply('Temperate', ['Lightning'], 25);
    const resistLog = addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain(DRUID);
    expect(resistLog[1].description).toContain('Lightning');
    expect(resistLog[1].description).toContain('25');
    expect(resistLog[1].description).toContain('12');
  });

  it('control: unmapped types land FULL while Temperate is chosen', async () => {
    const slash = await apply('Temperate', ['Slashing'], 16);
    expect(slash.finalDamage).toBe(16);
    expect(slash.resistanceDetails).toEqual([]);
    const fire = await apply('Temperate', ['Fire'], 21);
    expect(fire.finalDamage).toBe(21);
  });

  it('all four land mappings fold their type live', async () => {
    const cases = [['arid', 'Fire'], ['polar', 'Cold'], ['temperate', 'Lightning'], ['tropical', 'Poison']];
    for (const [land, type] of cases) {
      const result = await apply(land, [type], 21);
      expect(result.finalDamage).toBe(10);
      expect(result.resistanceDetails).toEqual([{ damageType: type, status: 'resistant' }]);
    }
  });

  it('no land chosen (runtime key unset, no class fallback) → Lightning stays FULL', async () => {
    const result = await apply(null, ['Lightning'], 25);
    expect(result.finalDamage).toBe(25);
    expect(result.resistanceDetails).toEqual([]);
  });
});
