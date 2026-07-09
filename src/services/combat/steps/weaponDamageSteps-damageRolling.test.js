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

const { buildDamageSteps } = await import('./weaponDamageSteps.js');
const { rollExpression, rollExpressionDoubled, rollExpressionMaximized } = await import('../../dice/diceRoller.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');

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

describe('buildDamageSteps - rollBaseDamage, buildContext, sneakAttack', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildDamageSteps();
  });

  // ──────────────────────────────────────────────────────────────
  // rollBaseDamage (index 4)
  // ──────────────────────────────────────────────────────────────

  describe('rollBaseDamage step', () => {
    describe('condition', () => {
      it('returns true when ctx.attack has damage', () => {
        const ctx = makeCtx({ attack: { damage: '1d8+3' } });
        expect(steps[4].condition(ctx)).toBe(true);
      });

      it('returns true when ctx has autoFormulaOverride', () => {
        const ctx = makeCtx({ autoFormulaOverride: '2d6' });
        expect(steps[4].condition(ctx)).toBe(true);
      });

      it('returns false when neither attack.damage nor autoFormulaOverride exists', () => {
        const ctx = makeCtx({ attack: {} });
        expect(steps[4].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('clears popupHtml on crit', async () => {
        const setPopupHtml = vi.fn();
        const ctx = makeCtx({
          attack: { damage: '1d8+3' },
          isCrit: true,
          setPopupHtml,
        });

        await steps[4].handler(ctx);

        expect(setPopupHtml).toHaveBeenCalledWith(null);
      });

      it('does not clear popupHtml on non-crit', async () => {
        const setPopupHtml = vi.fn();
        const ctx = makeCtx({
          attack: { damage: '1d8+3' },
          isCrit: false,
          setPopupHtml,
        });

        await steps[4].handler(ctx);

        expect(setPopupHtml).not.toHaveBeenCalled();
      });

      it('uses autoFormulaOverride when no attack.damage', async () => {
        const ctx = makeCtx({ autoFormulaOverride: '3d6+2' });
        const result = await steps[4].handler(ctx);

        expect(rollExpression).toHaveBeenCalledWith('3d6+2');
        expect(result.data.formula).toBe('3d6+2');
      });

      it('prefers autoFormulaOverride over attack.damage', async () => {
        const ctx = makeCtx({
          attack: { damage: '2d8+4' },
          autoFormulaOverride: '3d6',
        });
        const result = await steps[4].handler(ctx);

        expect(rollExpression).toHaveBeenCalledWith('3d6');
        expect(result.data.formula).toBe('3d6');
      });

      it('appends empowered evocation modifier to formula', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          empoweredEvocationModifier: 3,
        });
        const result = await steps[4].handler(ctx);

        expect(result.data.formula).toBe('8d6 + 3 [Empowered Evocation]');
      });

      it('does not append empowered evocation when modifier is 0', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          empoweredEvocationModifier: 0,
        });
        const result = await steps[4].handler(ctx);

        expect(result.data.formula).toBe('8d6');
      });

      it('does not append empowered evocation when modifier is negative', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          empoweredEvocationModifier: -1,
        });
        const result = await steps[4].handler(ctx);

        expect(result.data.formula).toBe('8d6');
      });

      it('uses rollExpressionDoubled on crit', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          isCrit: true,
        });
        await steps[4].handler(ctx);

        expect(rollExpressionDoubled).toHaveBeenCalledWith('8d6');
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('uses rollExpressionMaximized when overchannelActive', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          overchannelActive: true,
        });
        await steps[4].handler(ctx);

        expect(rollExpressionMaximized).toHaveBeenCalledWith('8d6');
        expect(rollExpressionDoubled).not.toHaveBeenCalled();
      });

      it('prefers overchannel over crit when both are set', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          isCrit: true,
          overchannelActive: true,
        });
        await steps[4].handler(ctx);

        expect(rollExpressionMaximized).toHaveBeenCalledWith('8d6');
        expect(rollExpressionDoubled).not.toHaveBeenCalled();
      });

      it('returns null when rollExpression returns null', async () => {
        const ctx = makeCtx({ attack: { damage: '0' } });
        const result = await steps[4].handler(ctx);

        expect(result).toBeNull();
      });

      it('returns data with formula, total, rolls, and modifier', async () => {
        const ctx = makeCtx({ attack: { damage: '1d8+3' } });
        const result = await steps[4].handler(ctx);

        expect(result.data).toEqual(
          expect.objectContaining({
            formula: '1d8+3',
            total: expect.any(Number),
            rolls: expect.any(Array),
            modifier: expect.any(Number),
          }),
        );
      });

      it('combines autoFormulaOverride with empowered evocation', async () => {
        const ctx = makeCtx({
          autoFormulaOverride: '8d6',
          empoweredEvocationModifier: 2,
        });
        const result = await steps[4].handler(ctx);

        expect(result.data.formula).toBe('8d6 + 2 [Empowered Evocation]');
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // buildContext (index 5)
  // ──────────────────────────────────────────────────────────────

  describe('buildContext step', () => {
    describe('condition', () => {
      it('returns true when no buildCtxResult and no autoDamageSource', () => {
        const ctx = makeCtx();
        expect(steps[5].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.buildCtxResult exists', () => {
        const ctx = makeCtx({ buildCtxResult: { sneakAttackDice: 2 } });
        expect(steps[5].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.autoDamageSource exists', () => {
        const ctx = makeCtx({ autoDamageSource: 'some-source' });
        expect(steps[5].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('calls buildCtxSync when available (default path)', async () => {
        const buildCtxSyncMock = vi.fn(async () => ({ sneakAttackDice: 2, targetName: 'Orc' }));
        const ctx = makeCtx({ buildCtxSync: buildCtxSyncMock });
        const result = await steps[5].handler(ctx);

        expect(buildCtxSyncMock).toHaveBeenCalledWith({});
        expect(result.data.buildCtxResult).toEqual({ sneakAttackDice: 2, targetName: 'Orc' });
        expect(result.data.sneakDice).toBe(2);
      });

      it('calls buildCtx when mapName is present', async () => {
        const buildCtxMock = vi.fn(async () => ({ sneakAttackDice: 3 }));
        const ctx = makeCtx({
          mapName: 'test-map',
          buildCtx: buildCtxMock,
        });
        const result = await steps[5].handler(ctx);

        expect(buildCtxMock).toHaveBeenCalled();
        expect(result.data.sneakDice).toBe(3);
      });

      it('returns empty data when no build function available', async () => {
        const ctx = makeCtx();
        const result = await steps[5].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('sets targetName from buildResult when ctx.targetName is missing', async () => {
        const buildCtxSyncMock = vi.fn(async () => ({ sneakAttackDice: 1, targetName: 'Goblin' }));
        const ctx = makeCtx({ buildCtxSync: buildCtxSyncMock });
        const result = await steps[5].handler(ctx);

        expect(result.data.targetName).toBe('Goblin');
      });

      it('does not override targetName when ctx.targetName exists', async () => {
        const buildCtxSyncMock = vi.fn(async () => ({ sneakAttackDice: 1, targetName: 'Goblin' }));
        const ctx = makeCtx({
          buildCtxSync: buildCtxSyncMock,
          targetName: 'Orc',
        });
        const result = await steps[5].handler(ctx);

        expect(result.data.targetName).toBeUndefined();
      });

      it('handles buildCtxResult with no sneakAttackDice', async () => {
        const buildCtxSyncMock = vi.fn(async () => ({}));
        const ctx = makeCtx({ buildCtxSync: buildCtxSyncMock });
        const result = await steps[5].handler(ctx);

        expect(result.data.sneakDice).toBe(0);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // sneakAttack (index 6)
  // ──────────────────────────────────────────────────────────────

  describe('sneakAttack step', () => {
    describe('condition', () => {
      it('returns true when ctx.sneakDice > 0', () => {
        const ctx = makeCtx({ sneakDice: 2 });
        expect(steps[6].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.sneakDice is 0', () => {
        const ctx = makeCtx({ sneakDice: 0 });
        expect(steps[6].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.sneakDice is undefined', () => {
        const ctx = makeCtx();
        expect(steps[6].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.sneakDice is negative', () => {
        const ctx = makeCtx({ sneakDice: -1 });
        expect(steps[6].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('adds sneak dice to formula and total', async () => {
        getRuntimeValue.mockReturnValue(0);
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[6].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 2d6 [Sneak Attack]');
        expect(result.data.effectiveSneakDice).toBe(2);
        expect(result.data.rolls).toContainEqual(expect.any(Number));
      });

      it('doubles sneak dice on crit', async () => {
        getRuntimeValue.mockReturnValue(0);
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          isCrit: true,
        });
        await steps[6].handler(ctx);

        expect(rollExpressionDoubled).toHaveBeenCalledWith('2d6');
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('does not double sneak dice on non-crit', async () => {
        getRuntimeValue.mockReturnValue(0);
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          isCrit: false,
        });
        await steps[6].handler(ctx);

        expect(rollExpression).toHaveBeenCalledWith('2d6');
        expect(rollExpressionDoubled).not.toHaveBeenCalled();
      });

      it('reduces sneak dice by cunning strike cost', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_cunningStrikeCostUsed') return 1;
          return null;
        });
        const ctx = makeCtx({
          sneakDice: 3,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[6].handler(ctx);

        expect(result.data.effectiveSneakDice).toBe(2);
        expect(result.data.formula).toBe('1d8+3 + 2d6 [Sneak Attack]');
      });

      it('clamps effective sneak dice to 0 minimum', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_cunningStrikeCostUsed') return 5;
          return null;
        });
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[6].handler(ctx);

        expect(result.data.effectiveSneakDice).toBe(0);
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('resets cunning strike cost to 0 when cost > 0', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_cunningStrikeCostUsed') return 1;
          return null;
        });
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        await steps[6].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_cunningStrikeCostUsed',
          0,
          'test-campaign',
        );
      });

      it('does not reset cunning strike cost when cost is 0', async () => {
        getRuntimeValue.mockReturnValue(0);
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        await steps[6].handler(ctx);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'TestChar',
          '_cunningStrikeCostUsed',
          0,
          'test-campaign',
        );
      });

      it('marks sneak attack as used this round', async () => {
        getRuntimeValue.mockReturnValue(0);
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        await steps[6].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_SneakAttack_usedRound',
          1,
          'test-campaign',
        );
      });

      it('returns data without sneak dice when rollExpression returns null', async () => {
        getRuntimeValue.mockReturnValue(0);
        rollExpression.mockReturnValue(null);
        const ctx = makeCtx({
          sneakDice: 1,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[6].handler(ctx);

        expect(result.data.effectiveSneakDice).toBe(1);
        expect(result.data.formula).toBe('1d8+3');
        expect(result.data.total).toBe(11);
      });

      it('preserves existing rolls and adds sneak rolls', async () => {
        getRuntimeValue.mockReturnValue(0);
        rollExpression.mockReturnValue({ total: 7, rolls: [4, 3], modifier: 0 });
        const ctx = makeCtx({
          sneakDice: 2,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[6].handler(ctx);

        expect(result.data.rolls).toEqual([8, 3, 4, 3]);
      });

      it('uses existing rolls when rolls array is missing', async () => {
        getRuntimeValue.mockReturnValue(0);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        const ctx = makeCtx({
          sneakDice: 1,
          formula: '1d8+3',
          total: 11,
          rolls: undefined,
        });
        const result = await steps[6].handler(ctx);

        expect(result.data.rolls).toEqual([5]);
      });
    });
  });
});
