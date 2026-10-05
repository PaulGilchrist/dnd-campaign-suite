// CLA-120: spellContext must fold INT exactly once — a pre-baked attack.damage
// carrying [Empowered Evocation] (from execution/index.js computeEmpoweredEvocation
// via noSavePath autoDamageFormula) must not receive a second appended term.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').replace(/\s+/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)((?:[+-]\d+)+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modifier = match[3] ? match[3].match(/[+-]\d+/g).reduce((s, m) => s + parseInt(m, 10), 0) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = rolls.reduce((s, r) => s + r, 0) + modifier;
      return { total, rolls, modifier };
    }
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn((_formula) => ({ total: 12, rolls: [6], modifier: 0 })),
  rollExpressionMaximized: vi.fn((_formula) => ({ total: 12, rolls: [6], modifier: 0, maximized: true })),
}));

vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

const _featureModulesRef = { value: [] };
vi.mock('./features/index.js', () => ({
  get featureModules() { return _featureModulesRef.value; },
}));

const { buildDirectSpellDamageSteps } = await import('./directSpellDamageSteps.js');
const { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } = await import('../../rules/spells/postCastRiderService.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'DivinationWizard',
      abilities: [{ name: 'Intelligence', bonus: 5 }],
      automation: { passives: [{ type: 'empowered_evocation' }], actions: [] },
    },
    campaignName: 'test-campaign',
    isCantrip: true,
    autoDamageSchool: 'Evocation',
    ...overrides,
  };
}

describe('spellContext — CLA-120 Empowered Evocation folds INT exactly once', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([{ type: 'empowered_evocation', name: 'Empowered Evocation' }]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(5);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  it('does NOT append a second term to a pre-baked formula (execution-owned)', async () => {
    const ctx = makeCtx({ attack: { damage: '4d10 + 5 [Empowered Evocation]' } });
    const result = await steps[1].handler(ctx);
    expect(result.data.formula).toBe('4d10 + 5 [Empowered Evocation]');
    expect(result.data.formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('folds the INT term exactly once onto an unmarked formula (PASS control)', async () => {
    const ctx = makeCtx({ attack: { damage: '8d6' } });
    const result = await steps[1].handler(ctx);
    expect(result.data.formula).toBe('8d6 + 5 [Empowered Evocation]');
    expect(result.data.formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('non-evocation school gate stays zero (Poison Spray necromancy control)', async () => {
    const ctx = makeCtx({ attack: { damage: '4d12' }, autoDamageSchool: 'Necromancy' });
    const result = await steps[1].handler(ctx);
    expect(result.data.formula).toBe('4d12');
    expect(result.data.formula).not.toContain('[Empowered Evocation]');
  });
});
