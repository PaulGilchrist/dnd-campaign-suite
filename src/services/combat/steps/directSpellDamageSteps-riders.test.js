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

describe('buildDirectSpellDamageSteps - spellFeatureRiders', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  describe('handler with empty featureModules', () => {
    it('returns data with formula, total, and copied rolls', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6, 5, 4, 3, 2, 4],
      });
      const result = await steps[3].handler(ctx);
      expect(result.data).toEqual(
        expect.objectContaining({
          formula: '8d6',
          total: 24,
          rolls: [6, 5, 4, 3, 2, 4],
        }),
      );
    });

    it('handles missing rolls gracefully', async () => {
      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
      });
      const result = await steps[3].handler(ctx);
      expect(result.data.rolls).toEqual([]);
    });
  });

  describe('handler with feature modules', () => {
    it('skips features whose condition returns false', async () => {
      const mockFeature = {
        condition: vi.fn(() => false),
        handler: vi.fn(),
      };
      _featureModulesRef.value = [mockFeature];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      await steps[3].handler(ctx);
      expect(mockFeature.handler).not.toHaveBeenCalled();
    });

    it('calls feature handler when condition returns true', async () => {
      const mockFeature = {
        condition: vi.fn(() => true),
        handler: vi.fn(async () => null),
      };
      _featureModulesRef.value = [mockFeature];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      await steps[3].handler(ctx);
      expect(mockFeature.handler).toHaveBeenCalledWith(ctx, expect.any(Object));
    });

    it('passes prevData to feature handler with formula, total, and rolls', async () => {
      const mockFeature = {
        condition: vi.fn(() => true),
        handler: vi.fn(async () => null),
      };
      _featureModulesRef.value = [mockFeature];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6, 5],
      });
      await steps[3].handler(ctx);
      const passedData = mockFeature.handler.mock.calls[0][1];
      expect(passedData).toEqual({
        formula: '8d6',
        total: 24,
        rolls: [6, 5],
      });
    });

    it('returns modal result when feature returns modal', async () => {
      const mockFeature = {
        condition: vi.fn(() => true),
        handler: vi.fn(async () => ({
          modal: { type: 'test', props: {} },
        })),
      };
      _featureModulesRef.value = [mockFeature];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      const result = await steps[3].handler(ctx);
      expect(result).toEqual({ modal: { type: 'test', props: {} } });
    });

    it('updates data when feature returns data', async () => {
      const mockFeature = {
        condition: vi.fn(() => true),
        handler: vi.fn(async () => ({
          data: { total: 30, formula: '8d6 + 6 [Feature]' },
        })),
      };
      _featureModulesRef.value = [mockFeature];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      const result = await steps[3].handler(ctx);
      expect(result.data).toEqual({
        formula: '8d6 + 6 [Feature]',
        total: 30,
      });
    });

    it('calls sideEffects when feature returns them', async () => {
      const sideEffectsMock = vi.fn();
      const mockFeature = {
        condition: vi.fn(() => true),
        handler: vi.fn(async () => ({
          data: { total: 30 },
          sideEffects: sideEffectsMock,
        })),
      };
      _featureModulesRef.value = [mockFeature];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      await steps[3].handler(ctx);
      expect(sideEffectsMock).toHaveBeenCalled();
    });

    it('processes multiple features in sequence', async () => {
      const feature1Handler = vi.fn(async () => ({
        data: { total: 28 },
      }));
      const feature2Handler = vi.fn(async () => ({
        data: { total: 32 },
      }));
      _featureModulesRef.value = [
        { condition: () => true, handler: feature1Handler },
        { condition: () => true, handler: feature2Handler },
      ];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      await steps[3].handler(ctx);
      expect(feature1Handler).toHaveBeenCalledTimes(1);
      expect(feature2Handler).toHaveBeenCalledTimes(1);
    });

    it('stops processing when a feature returns modal', async () => {
      const feature1Handler = vi.fn(async () => ({
        data: { total: 28 },
      }));
      const feature2Handler = vi.fn(async () => ({
        modal: { type: 'modal' },
      }));
      _featureModulesRef.value = [
        { condition: () => true, handler: feature1Handler },
        { condition: () => true, handler: feature2Handler },
      ];

      const ctx = makeCtx({
        attack: { damage: '8d6' },
        formula: '8d6',
        total: 24,
        rolls: [6],
      });
      const _result = await steps[3].handler(ctx);
      expect(feature1Handler).toHaveBeenCalledTimes(1);
      expect(feature2Handler).toHaveBeenCalledTimes(1);
      expect(_result).toEqual({ modal: { type: 'modal' } });
    });
  });
});
