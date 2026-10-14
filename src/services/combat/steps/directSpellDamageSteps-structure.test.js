import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = rolls.reduce((s, r) => s + r, 0) + modStr;
      return { total, rolls, modifier: modStr };
    }
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = (rolls.reduce((s, r) => s + r, 0) * 2) + modStr;
      const doubledRolls = rolls.concat(rolls);
      return { total, rolls, doubledRolls, modifier: modStr };
    }
    return { total: 12, rolls: [6], modifier: 0 };
  }),
  rollExpressionMaximized: vi.fn((formula) => {
    if (!formula) return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      return { total: count * sides + modStr, rolls: Array(count).fill(sides), modifier: modStr, maximized: true };
    }
    return { total: 12, rolls: [6], modifier: 0 };
  }),
}));

vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

const _featureModulesRef = { value: [] };
vi.mock('./features/index.js', () => ({
  get featureModules() { return _featureModulesRef.value; },
}));

const { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } = await import('../../rules/spells/postCastRiderService.js');

describe('buildDirectSpellDamageSteps', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  describe('structure', () => {
    it('returns an array of 6 steps', () => {
      expect(Array.isArray(steps)).toBe(true);
      expect(steps).toHaveLength(6);
    });

    it('has steps with correct names in order', () => {
      const names = steps.map((s) => s.name);
      expect(names).toEqual([
        'spellHousekeeping',
        'spellContext',
        'spellRollDamage',
        'spellFeatureRiders',
        'spellOverchannel',
        'spellProceedToDamage',
      ]);
    });

    it('has correct subscribe/emit chain', () => {
      expect(steps[0].subscribe).toBe('spell:do');
      expect(steps[0].emit).toBe('spell:context');
      expect(steps[1].subscribe).toBe('spell:context');
      expect(steps[1].emit).toBe('spell:formulas');
      expect(steps[2].subscribe).toBe('spell:formulas');
      expect(steps[2].emit).toBe('spell:rolled');
      expect(steps[3].subscribe).toBe('spell:rolled');
      expect(steps[3].emit).toBe('spell:riders:applied');
      expect(steps[4].subscribe).toBe('spell:riders:applied');
      expect(steps[4].emit).toBe('spell:ready');
      expect(steps[5].subscribe).toBe('spell:ready');
      expect(steps[5].emit).toBe('spell:applied');
    });
  });

  describe('spellHousekeeping step', () => {
    it('always returns true for condition', () => {
      expect(steps[0].condition({})).toBe(true);
      expect(steps[0].condition({ attack: null })).toBe(true);
      expect(steps[0].condition({ playerStats: {} })).toBe(true);
    });

    it('returns { data: {} } from handler', async () => {
      const result = await steps[0].handler({});
      expect(result).toEqual({ data: {} });
    });
  });
});
