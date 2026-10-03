// @generated-by:ai
// CLA-048: Celestial Revelation extra-damage rider was INERT —
// rollExpression('proficiency_bonus') is null (diceRoller NdM/constants only),
// so the step silently returned {} on every hit. Locks the resolve-first fix:
// 'proficiency_bonus' → resolveDiceExpression → '6' (PB+6) → flat +6 term.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../brutalStrikeSelection.js', () => ({
  selectBrutalStrikeRiders: vi.fn(() => []),
}));

vi.mock('../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

import { buildCelestialRevelationStep } from './attackRollBonuses.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';

const step = buildCelestialRevelationStep();

function rider(overrides = {}) {
  return {
    type: 'attack_rider',
    name: 'Heavenly Wings',
    damageExpression: 'proficiency_bonus',
    damageType: 'Radiant',
    trigger: 'hit',
    oncePerTurn: true,
    ...overrides,
  };
}

function makeCtx(overrides = {}) {
  return {
    playerStats: {
      name: 'AasimarTest',
      level: 20,
      proficiency: 6,
      abilities: [],
      automation: { actions: [], passives: [rider()] },
    },
    targetName: 'Bandit 1',
    campaignName: 'test-campaign',
    formula: '1d6+2',
    total: 8,
    rolls: [6],
    ...overrides,
  };
}

describe('CLA-048 buildCelestialRevelationStep — proficiency_bonus resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCurrentCombatRound.mockReturnValue(1);
    getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
  });

  it('appends + 6 [radiant] flat term for PB+6 with proficiency_bonus token', async () => {
    const ctx = makeCtx();
    const result = await step.handler(ctx);

    expect(result.data.formula).toBe('1d6+2 + 6 [radiant]');
    expect(result.data.total).toBe(14);
    expect(result.data.rolls).toEqual([6]);
  });

  it('stamps the once-per-turn latch when the rider lands', async () => {
    getCurrentCombatRound.mockReturnValue(4);
    await step.handler(makeCtx());

    expect(setRuntimeValue).toHaveBeenCalledWith('AasimarTest', '_Heavenly_Wings_usedRound', 4, 'test-campaign');
  });

  it('is inert when the latch already matches the current round', async () => {
    getCurrentCombatRound.mockReturnValue(3);
    getRuntimeValue.mockImplementation((_k, prop) => (prop === '_Heavenly_Wings_usedRound' ? 3 : null));

    const result = await step.handler(makeCtx());

    expect(result.data).toEqual({});
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('resolves Necrotic Shroud proficiency_bonus to + 6 [necrotic]', async () => {
    getActiveBuffs.mockReturnValue([{ name: 'Necrotic Shroud' }]);
    const ctx = makeCtx({
      playerStats: {
        name: 'AasimarTest',
        level: 20,
        proficiency: 6,
        abilities: [],
        automation: { actions: [], passives: [rider({ name: 'Necrotic Shroud', damageType: 'Necrotic' })] },
      },
    });
    const result = await step.handler(ctx);

    expect(result.data.formula).toBe('1d6+2 + 6 [necrotic]');
    expect(result.data.total).toBe(14);
  });

  it('still rolls dice riders unchanged', async () => {
    getActiveBuffs.mockReturnValue([{ name: 'Inner Radiance' }]);
    const ctx = makeCtx({
      playerStats: {
        name: 'AasimarTest',
        level: 20,
        proficiency: 6,
        abilities: [],
        automation: { actions: [], passives: [rider({ name: 'Inner Radiance', damageExpression: '2d6' })] },
      },
    });
    const result = await step.handler(ctx);

    expect(result.data.formula).toBe('1d6+2 + 2d6 [radiant]');
    expect(result.data.total).toBeGreaterThanOrEqual(10);
    expect(result.data.rolls.length).toBe(3);
  });

  it('is null-safe when no rider passive exists', async () => {
    const ctx = makeCtx({
      playerStats: { name: 'AasimarTest', level: 20, proficiency: 6, abilities: [], automation: { actions: [], passives: [] } },
    });
    await expect(step.handler(ctx)).resolves.toEqual({ data: {} });
  });

  it('is null-safe when the celestial buff is not active', async () => {
    getActiveBuffs.mockReturnValue([]);
    const result = await step.handler(makeCtx());

    expect(result.data).toEqual({});
  });

  it('is null-safe with no targetName', async () => {
    const result = await step.handler(makeCtx({ targetName: null }));

    expect(result.data).toEqual({});
  });
});

describe('CLA-048 races.json data lock', () => {
  const data = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/data/2024/races.json'), 'utf8'));

  function findAasimar(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = findAasimar(item);
        if (hit) return hit;
      }
      return null;
    }
    if (node && typeof node === 'object') {
      if (node.name === 'Aasimar' && Array.isArray(node.traits)) return node;
      for (const value of Object.values(node)) {
        const hit = findAasimar(value);
        if (hit) return hit;
      }
    }
    return null;
  }

  const aasimar = findAasimar(data);
  const byName = (n) => aasimar.traits.find((t) => t.name === n);
  const riderOf = (name) => (Array.isArray(byName(name).automation) ? byName(name).automation : [byName(name).automation]).find((a) => a.type === 'attack_rider');

  it('Inner Radiance carries an attack_rider Radiant proficiency_bonus block', () => {
    expect(riderOf('Inner Radiance')).toMatchObject({
      type: 'attack_rider',
      damageExpression: 'proficiency_bonus',
      damageType: 'Radiant',
      trigger: 'hit',
      oncePerTurn: true,
    });
    expect(byName('Inner Radiance').automation.some((a) => a.type === 'damage_aura')).toBe(true);
  });

  it('all three options carry rider blocks with identical shape', () => {
    const wings = riderOf('Heavenly Wings');
    const radiance = riderOf('Inner Radiance');
    const shroud = riderOf('Necrotic Shroud');

    expect(radiance.oncePerTurn).toBe(wings.oncePerTurn);
    expect(radiance.trigger).toBe(wings.trigger);
    expect(radiance.damageExpression).toBe(shroud.damageExpression);
    expect(shroud.damageType).toBe('Necrotic');
  });
});
