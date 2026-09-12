// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

const { rollExpression } = await import('../../dice/diceRoller.js');
const { addEntry } = await import('../../ui/logService.js');
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

describe('buildDirectSpellDamageSteps - spellOverchannel', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  describe('condition', () => {
    it('returns true when overchannelActive true and useCount > 1', () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
      });
      expect(steps[4].condition(ctx)).toBe(true);
    });

    it('returns true when overchannelActive true and useCount > 1 with higher count', () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 3,
      });
      expect(steps[4].condition(ctx)).toBe(true);
    });

    it('returns false when overchannelActive is false', () => {
      const ctx = makeCtx({
        overchannelActive: false,
        overchannelUseCount: 2,
      });
      expect(steps[4].condition(ctx)).toBe(false);
    });

    it('returns false when overchannelUseCount is 1', () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 1,
      });
      expect(steps[4].condition(ctx)).toBe(false);
    });

    it('returns false when overchannelUseCount is 0', () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 0,
      });
      expect(steps[4].condition(ctx)).toBe(false);
    });

    it('returns false when overchannelUseCount is undefined', () => {
      const ctx = makeCtx({
        overchannelActive: true,
      });
      expect(steps[4].condition(ctx)).toBe(false);
    });
  });

  describe('handler', () => {
    it('rolls 3d12 for level 1 spell with useCount 2', async () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 1,
        playerStats: { name: 'TestWizard' },
        campaignName: 'test-campaign',
      });
      const result = await steps[4].handler(ctx);
      expect(rollExpression).toHaveBeenCalledWith('3d12');
      expect(result.data).toEqual({});
    });

    it('rolls 6d12 for level 2 spell with useCount 2', async () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 2,
        playerStats: { name: 'TestWizard' },
        campaignName: 'test-campaign',
      });
      const result = await steps[4].handler(ctx);
      expect(rollExpression).toHaveBeenCalledWith('6d12');
      expect(result.data).toEqual({});
    });

    it('rolls 6d12 for level 3 spell with useCount 3', async () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 3,
        overchannelSpellLevel: 3,
        playerStats: { name: 'TestWizard' },
        campaignName: 'test-campaign',
      });
      const result = await steps[4].handler(ctx);
      // dicePerLevel = 2 + (3 - 1) = 4, totalDice = 4 * 3 = 12
      expect(rollExpression).toHaveBeenCalledWith('12d12');
      expect(result.data).toEqual({});
    });

    it('logs the damage entry with correct data', async () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 1,
        playerStats: { name: 'TestWizard' },
        campaignName: 'test-campaign',
      });
      await steps[4].handler(ctx);
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'roll',
        characterName: 'TestWizard',
        rollType: 'overchannel-damage',
        name: 'Overchannel',
        formula: '3d12',
        rolls: expect.any(Array),
        total: expect.any(Number),
        modifier: expect.any(Number),
        damageType: 'Necrotic',
        targetName: 'TestWizard',
        finalDamage: expect.any(Number),
        note: 'Overchannel self-damage (ignores resistance/immunity)',
      }));
    });

    it('uses playerStats.name for characterName and targetName', async () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 1,
        playerStats: { name: 'Elminster' },
        campaignName: 'test-campaign',
      });
      await steps[4].handler(ctx);
      const callArg = addEntry.mock.calls[0][1];
      expect(callArg.characterName).toBe('Elminster');
      expect(callArg.targetName).toBe('Elminster');
    });

    it('uses "unknown" for characterName when playerStats is missing', async () => {
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 1,
        playerStats: null,
        campaignName: 'test-campaign',
      });
      await steps[4].handler(ctx);
      const callArg = addEntry.mock.calls[0][1];
      expect(callArg.characterName).toBe('unknown');
      expect(callArg.targetName).toBe(undefined);
    });

    it('handles addEntry error gracefully via .catch', async () => {
      addEntry.mockRejectedValueOnce(new Error('Network error'));
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 1,
        playerStats: { name: 'TestWizard' },
        campaignName: 'test-campaign',
      });
      await expect(steps[4].handler(ctx)).resolves.toEqual({ data: {} });
    });

    it('does not call addEntry when rollExpression returns null', async () => {
      rollExpression.mockReturnValueOnce(null);
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: 2,
        overchannelSpellLevel: 1,
        playerStats: { name: 'TestWizard' },
        campaignName: 'test-campaign',
      });
      await steps[4].handler(ctx);
      expect(addEntry).not.toHaveBeenCalled();
    });
  });
});

describe('buildDirectSpellDamageSteps - spellProceedToDamage', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  describe('condition', () => {
    it('returns true when ctx.formula is a string', () => {
      const ctx = makeCtx({ formula: '1d6' });
      expect(steps[5].condition(ctx)).toBe(true);
    });

    it('returns true when ctx.formula is 0', () => {
      const ctx = makeCtx({ formula: 0 });
      expect(steps[5].condition(ctx)).toBe(true);
    });

    it('returns true when ctx.formula is a number', () => {
      const ctx = makeCtx({ formula: 10 });
      expect(steps[5].condition(ctx)).toBe(true);
    });

    it('returns false when ctx.formula is undefined', () => {
      const ctx = makeCtx();
      delete ctx.formula;
      expect(steps[5].condition(ctx)).toBe(false);
    });

    it('returns false when ctx.formula is null', () => {
      const ctx = makeCtx({ formula: null });
      expect(steps[5].condition(ctx)).toBe(false);
    });
  });

  describe('handler', () => {
    it('calls proceedWithDamage with attack, formula, total, rolls, and modifier', async () => {
      const ctx = makeCtx({
        attack: { name: 'Fireball' },
        formula: '8d6',
        total: 28,
        rolls: [6, 5, 4, 3, 6, 2, 1, 1],
        modifier: 0,
      });
      const result = await steps[5].handler(ctx);
      expect(ctx.proceedWithDamage).toHaveBeenCalledWith({
        attack: { name: 'Fireball' },
        formula: '8d6',
        total: 28,
        rolls: [6, 5, 4, 3, 6, 2, 1, 1],
        modifier: 0,
      });
      expect(result).toEqual({ data: { _done: true } });
    });

    it('returns _done: true in result', async () => {
      const ctx = makeCtx({
        attack: {},
        formula: '1d4',
        total: 4,
        rolls: [4],
        modifier: 0,
      });
      const result = await steps[5].handler(ctx);
      expect(result.data._done).toBe(true);
    });
  });
});
