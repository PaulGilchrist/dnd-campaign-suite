// @improved-by-ai
// CLA-336 Stormborn (Circle of the Sea lv10) regression tests.
// Locks down: while wrathOfTheSeaActive is TRUE the damage pipeline halves
// Cold/Lightning/Thunder LIVE (via live getDamageResistances); Bludgeoning is
// NOT halved; while the Wrath badge is removed (key false) full damage returns.
import { describe, it, expect, vi } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

// automationPassives is NOT mocked — getDamageResistances runs LIVE here.
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

const STORMBORN_PASSIVE = {
  type: 'resistance',
  name: 'Stormborn',
  damageTypes: ['Cold', 'Lightning', 'Thunder'],
  casting_time: 'passive',
};

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

function createDruidCharacter(name) {
  // Stale computedStats: rulesFactory folded nothing in (wrath toggles never recompute).
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [STORMBORN_PASSIVE] },
    },
  };
}

function stubRuntime(wrathActive) {
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'lastAttack') return null;
    if (key === 'activeBuffs') return [];
    if (key === 'wrathOfTheSeaActive') return wrathActive;
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'currentHitPoints') return 143;
    if (key === 'hitPoints') return 143;
    if (key === 'activeConditions') return [];
    if (key === 'tempHp') return 0;
    if (key === 'polymorphTempHp') return 0;
    return undefined;
  });
}

function apply(cs, damageTypes, rawDamage) {
  return applyDamageToTarget(cs, 'Wild_Sage_Druid', rawDamage, damageTypes, 'test-campaign', [ createDruidCharacter('Wild_Sage_Druid'), ], { ignoreResistance: false, attackerName: 'Air Elemental 1' });
}

// ── Integration ─────────────────────────────────────────────────

describe('applyDamageToTarget — CLA-336 Stormborn wrath-gated resistance', () => {
  it('halves Lightning while Wrath of the Sea is active and logs', async () => {
    stubRuntime(true);
    const logModule = await import('../../ui/logService.js');
    logModule.addEntry.mockClear();

    const player = createPlayerCreature('Wild_Sage_Druid');
    const cs = makeCombatSummary([player]);

    const result = await apply(cs, ['Lightning'], 15);

    expect(result.finalDamage).toBe(7);
    expect(result.damageReduced).toBe(true);
    expect(result.resistanceDetails).toEqual([{ damageType: 'Lightning', status: 'resistant' }]);

    const resistLog = logModule.addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Damage Resistance'
    );
    expect(resistLog).toBeDefined();
    expect(resistLog[1].description).toContain('Wild_Sage_Druid');
    expect(resistLog[1].description).toContain('15');
    expect(resistLog[1].description).toContain('7');
  });

  it('halves Thunder while Wrath of the Sea is active', async () => {
    stubRuntime(true);
    const player = createPlayerCreature('Wild_Sage_Druid');
    const cs = makeCombatSummary([player]);

    const result = await apply(cs, ['Thunder'], 12);

    expect(result.finalDamage).toBe(6);
  });

  it('halves Cold while Wrath of the Sea is active', async () => {
    stubRuntime(true);
    const player = createPlayerCreature('Wild_Sage_Druid');
    const cs = makeCombatSummary([player]);

    const result = await apply(cs, ['Cold'], 16);

    expect(result.finalDamage).toBe(8);
  });

  it('does NOT halve Bludgeoning while Wrath of the Sea is active', async () => {
    stubRuntime(true);
    const player = createPlayerCreature('Wild_Sage_Druid');
    const cs = makeCombatSummary([player]);

    const result = await apply(cs, ['Bludgeoning'], 8);

    expect(result.finalDamage).toBe(8);
    expect(result.resistanceDetails).toEqual([]);
  });

  it('does NOT halve Cold/Lightning/Thunder after the Wrath badge is removed', async () => {
    stubRuntime(false);
    for (const [type, dmg] of [['Cold', 16], ['Lightning', 15], ['Thunder', 12]]) {
      const player = createPlayerCreature('Wild_Sage_Druid');
      const cs = makeCombatSummary([player]);
      const result = await apply(cs, [type], dmg);
      expect(result.finalDamage).toBe(dmg);
      expect(result.resistanceDetails).toEqual([]);
    }
  });
});
