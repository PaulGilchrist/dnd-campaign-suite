// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

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

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: {} })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({
  sendBardicInspirationOffensePrompt: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));

vi.mock('../../automation/common/resourceCheck.js', () => ({
  spendResource: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

vi.mock('../../automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 3),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { rollExpression } = await import('../../dice/diceRoller.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { featureModules } = await import('./features/index.js');
const { applyDamageToTarget } = await import('../../rules/combat/applyDamage.js');

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Strength', bonus: 3 }],
      automation: { actions: [], passives: [] },
      level: 5,
      proficiency: 3,
    },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('buildAttackRollDamageSteps - overchannel, proceedToDamage', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
    featureModules.length = 0;
  });

  // ──────────────────────────────────────────────────────────────
  // overchannel (index 16)
  // ──────────────────────────────────────────────────────────────

  describe('overchannel step', () => {
    describe('condition', () => {
      it('returns true when overchannelActive and useCount > 1', () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 2,
        });
        expect(steps[16].condition(ctx)).toBe(true);
      });

      it('returns false when overchannelActive is false', () => {
        const ctx = makeCtx({
          overchannelActive: false,
          overchannelUseCount: 2,
        });
        expect(steps[16].condition(ctx)).toBe(false);
      });

      it('returns false when overchannelUseCount is 1', () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 1,
        });
        expect(steps[16].condition(ctx)).toBe(false);
      });

      it('returns false when overchannelUseCount is 0', () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 0,
        });
        expect(steps[16].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('rolls correct dice for level 1 spell with useCount 2', async () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 2,
          overchannelSpellLevel: 1,
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[16].handler(ctx);

        expect(rollExpression).toHaveBeenCalledWith('3d12');
        expect(result.data).toEqual({});
      });

      it('rolls correct dice for level 2 spell with useCount 2', async () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 2,
          overchannelSpellLevel: 2,
          playerStats: { name: 'TestChar' },
        });
        await steps[16].handler(ctx);

        expect(rollExpression).toHaveBeenCalledWith('6d12');
      });

      it('rolls correct dice for level 3 spell with useCount 3', async () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 3,
          overchannelSpellLevel: 3,
          playerStats: { name: 'TestChar' },
        });
        await steps[16].handler(ctx);

        // dicePerLevel = 2 + (3-1) = 4, totalDice = 4 * 3 = 12
        expect(rollExpression).toHaveBeenCalledWith('12d12');
      });

      it('logs a damage entry', async () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 2,
          overchannelSpellLevel: 1,
          playerStats: { name: 'TestChar' },
        });
        await steps[16].handler(ctx);

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'roll',
          rollType: 'overchannel-damage',
          name: 'Overchannel',
          damageType: 'Necrotic',
          targetName: 'TestChar',
          note: 'Overchannel self-damage (ignores resistance/immunity)',
        }));
      });

      it('calls applyDamageToTarget', async () => {
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 2,
          overchannelSpellLevel: 1,
          playerStats: { name: 'TestChar' },
        });
        await steps[16].handler(ctx);

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'TestChar', expect.any(Number), ['Necrotic'], 'test-campaign', null, { ignoreResistance: true, attackerName: 'TestChar' },);
      });

      it('handles null rollExpression gracefully', async () => {
        rollExpression.mockImplementation(() => null);
        const ctx = makeCtx({
          overchannelActive: true,
          overchannelUseCount: 2,
          overchannelSpellLevel: 1,
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[16].handler(ctx);

        expect(result.data).toEqual({});
        rollExpression.mockReset();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // proceedToDamage (index 17)
  // ──────────────────────────────────────────────────────────────

  describe('proceedToDamage step', () => {
    describe('condition', () => {
      it('returns true when ctx.formula is a string', () => {
        const ctx = makeCtx({ formula: '1d6' });
        expect(steps[17].condition(ctx)).toBe(true);
      });

      it('returns true when ctx.formula is 0', () => {
        const ctx = makeCtx({ formula: 0 });
        expect(steps[17].condition(ctx)).toBe(true);
      });

      it('returns true when ctx.formula is a number', () => {
        const ctx = makeCtx({ formula: 10 });
        expect(steps[17].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.formula is undefined', () => {
        const ctx = makeCtx();
        delete ctx.formula;
        expect(steps[17].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.formula is null', () => {
        const ctx = makeCtx({ formula: null });
        expect(steps[17].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('calls proceedWithDamage with correct arguments', async () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe', damage: '1d12' },
          formula: '1d12+4',
          total: 16,
          rolls: [12, 4],
          modifier: 4,
        });
        const result = await steps[17].handler(ctx);

        expect(ctx.proceedWithDamage).toHaveBeenCalledWith(
          { name: 'Greataxe', damage: '1d12' },
          '1d12+4',
          16,
          [12, 4],
          4,
          undefined,
          ctx,
        );
        expect(result.data._done).toBe(true);
      });

      it('returns _done: true in result', async () => {
        const ctx = makeCtx({
          formula: '1d4',
          total: 4,
          rolls: [4],
          modifier: 0,
        });
        const result = await steps[17].handler(ctx);

        expect(result.data._done).toBe(true);
      });
    });
  });
});
