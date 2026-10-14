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

const { rollExpression, rollExpressionDoubled, rollExpressionMaximized } = await import('../../dice/diceRoller.js');
const { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } = await import('../../rules/spells/postCastRiderService.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestWizard',
      abilities: [
        { name: 'Intelligence', bonus: 3 },
        { name: 'Wisdom', bonus: 2 },
      ],
      automation: { actions: [] },
    },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

describe('buildDirectSpellDamageSteps - spellRollDamage', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  describe('condition', () => {
    it('returns true when ctx.attack has damage', () => {
      const ctx = makeCtx({ attack: { damage: '1d6' } });
      expect(steps[2].condition(ctx)).toBe(true);
    });

    it('returns true when ctx has autoFormulaOverride', () => {
      const ctx = makeCtx({ autoFormulaOverride: '2d4' });
      expect(steps[2].condition(ctx)).toBe(true);
    });

    it('returns false when neither attack.damage nor autoFormulaOverride exists', () => {
      const ctx = makeCtx({ attack: {} });
      expect(steps[2].condition(ctx)).toBe(false);
    });
  });

  describe('handler - normal roll', () => {
    it('calls rollExpression for non-crit, non-overchannel', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
      });
      const result = await steps[2].handler(ctx);
      expect(rollExpression).toHaveBeenCalledWith('8d6');
      expect(rollExpressionDoubled).not.toHaveBeenCalled();
      expect(rollExpressionMaximized).not.toHaveBeenCalled();
      expect(result.data).toHaveProperty('total');
      expect(result.data).toHaveProperty('rolls');
      expect(result.data).toHaveProperty('modifier');
      expect(result.data).toHaveProperty('formula');
    });

    it('returns data with formula, total, rolls, and modifier', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
      });
      const result = await steps[2].handler(ctx);
      expect(result.data).toEqual(
        expect.objectContaining({
          formula: '8d6',
          total: expect.any(Number),
          rolls: expect.any(Array),
          modifier: expect.any(Number),
        }),
      );
    });
  });

  describe('handler - critical hit', () => {
    it('calls rollExpressionDoubled when isCrit is true', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        isCrit: true,
      });
      const result = await steps[2].handler(ctx);
      expect(rollExpressionDoubled).toHaveBeenCalledWith('8d6');
      expect(result).not.toBeNull();
    });
  });

  describe('handler - overchannel', () => {
    it('calls rollExpressionMaximized when overchannelActive is true', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        overchannelActive: true,
      });
      const result = await steps[2].handler(ctx);
      expect(rollExpressionMaximized).toHaveBeenCalledWith('8d6');
      expect(result).not.toBeNull();
    });

    it('prefers overchannel over crit when both are set', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        isCrit: true,
        overchannelActive: true,
      });
      await steps[2].handler(ctx);
      expect(rollExpressionMaximized).toHaveBeenCalledWith('8d6');
      expect(rollExpressionDoubled).not.toHaveBeenCalled();
    });
  });

  describe('handler - null result', () => {
    it('returns null when rollExpression returns null', async () => {
      const ctx = makeCtx({
        attack: { damage: '0' },
        formula: '0',
      });
      const result = await steps[2].handler(ctx);
      expect(result).toBeNull();
    });
  });
});
