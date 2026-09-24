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
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary, getCurrentCombatRound } = await import('../../encounters/combatData.js');
const { featureModules } = await import('./features/index.js');
const { getActiveBuffs } = await import('../../automation/common/buffToggle.js');

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

describe('buildAttackRollDamageSteps - natural20Bonuses, celestialRevelation', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
    featureModules.length = 0;
  });

  // ──────────────────────────────────────────────────────────────
  // natural20Bonuses (index 12)
  // ──────────────────────────────────────────────────────────────

  describe('natural20Bonuses step', () => {
    describe('condition', () => {
      it('returns true when ctx.isNatural20 and automation.actions exists', () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[13].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.isNatural20 is false', () => {
        const ctx = makeCtx({
          isNatural20: false,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[13].condition(ctx)).toBe(false);
      });

      it('returns false when automation.actions is missing', () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: { automation: {} },
        });
        expect(steps[13].condition(ctx)).toBe(false);
      });

      it('returns true when ctx.d20Roll is 20 (matches test threshold)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: 20,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[13].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.d20Roll is 19 (below test threshold)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: 19,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[13].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.d20Roll is 9 (below test threshold)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: 9,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[13].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.d20Roll is undefined (auto-damage path without d20)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: undefined,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[13].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('returns data when no matching actions', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: { automation: { actions: [] } },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
      });

      it('applies natural_20_attack_roll damage_bonus', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: '1d6',
                  extraDamageType: 'force',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [Overwhelming Strike]');
      });

      it('handles increased_ability_score expression', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: {
            abilities: [{ name: 'Strength', bonus: 5 }],
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: 'increased_ability_score',
                  abilityIncreased: 'Strength',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toContain('+ 5 [Overwhelming Strike]');
      });

      it('handles increased_ability_score when ability not found', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: {
            abilities: [{ name: 'Dexterity', bonus: 5 }],
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: 'increased_ability_score',
                  abilityIncreased: 'Strength',
                },
              ],
            },
          },
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toContain('+ 0 [Overwhelming Strike]');
      });

      it('defaults to attack damageType when extraDamageType is same_as_attack', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: '1d6',
                  extraDamageType: 'same_as_attack',
                },
              ],
            },
          },
          attack: { damageType: 'slashing' },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [Overwhelming Strike]');
      });

      it('uses extraDamageType when not same_as_attack', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: '1d6',
                  extraDamageType: 'force',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [Overwhelming Strike]');
      });

      it('handles missing extraDamageType by using same_as_attack fallback', async () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Overwhelming Strike',
                  type: 'damage_bonus',
                  trigger: 'natural_20_attack_roll',
                  extraDamageExpression: '1d6',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [Overwhelming Strike]');
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // celestialRevelation (index 13)
  // ──────────────────────────────────────────────────────────────

  describe('celestialRevelation step', () => {
    describe('condition', () => {
      it('returns true when automation.passives exists', () => {
        const ctx = makeCtx({ playerStats: { automation: { passives: [] } } });
        expect(steps[14].condition(ctx)).toBe(true);
      });

      it('returns false when automation.passives is missing', () => {
        const ctx = makeCtx({ playerStats: { automation: {} } });
        expect(steps[14].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('returns early when no attack_rider passives with damageExpression', async () => {
        const ctx = makeCtx({
          playerStats: {
            automation: {
              passives: [
                { type: 'passive_rule', effect: 'some-effect' },
              ],
            },
          },
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when no active celestial buff', async () => {
        getActiveBuffs.mockReturnValue([]);
        const ctx = makeCtx({
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                },
              ],
            },
          },
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when buff name does not match any rider', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Some Other Buff' }]);
        const ctx = makeCtx({
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                },
              ],
            },
          },
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when already used this round', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Heavenly_Wings_usedRound') return 2;
          return null;
        });

        const ctx = makeCtx({
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                  oncePerTurn: true,
                },
              ],
            },
          },
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('adds damage when active buff matches rider', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

        const ctx = makeCtx({
          targetName: 'Goblin',
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 1d8 [radiant]');
        expect(result.data.total).toBeGreaterThan(11);
      });

      it('marks used for current round after applying', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockImplementation((formula) => {
          if (formula === '1d8') return { total: 5, rolls: [5], modifier: 0 };
          return null;
        });

        const ctx = makeCtx({
          targetName: 'Goblin',
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                  oncePerTurn: true,
                },
              ],
            },
          },
        });
        await steps[14].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_Heavenly_Wings_usedRound',
          3,
          'test-campaign',
        );
        rollExpression.mockReset();
      });

      it('handles Inner Radiance buff', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Inner Radiance' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

        const ctx = makeCtx({
          targetName: 'Goblin',
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  name: 'Inner Radiance',
                },
              ],
            },
          },
          formula: '1d8',
          total: 5,
          rolls: [5],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data.formula).toBe('1d8 + 1d6 [radiant]');
      });

      it('handles Necrotic Shroud buff', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Necrotic Shroud' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

        const ctx = makeCtx({
          targetName: 'Goblin',
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d4',
                  damageType: 'necrotic',
                  name: 'Necrotic Shroud',
                },
              ],
            },
          },
          formula: '1d6',
          total: 4,
          rolls: [4],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data.formula).toBe('1d6 + 1d4 [necrotic]');
      });

      it('returns early when rollExpression returns null', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue(null);

        const ctx = makeCtx({
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when ctx.targetName is not set (no target on creature card)', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({});
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('applies damage when ctx.targetName is set on creature card', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

        const ctx = makeCtx({
          targetName: 'Goblin',
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d8',
                  damageType: 'radiant',
                  name: 'Heavenly Wings',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 1d8 [radiant]');
        expect(result.data.total).toBeGreaterThan(11);
        expect(rollExpression).toHaveBeenCalledWith('1d8');
      });

      it('applies Necrotic Shroud damage when target is set', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Necrotic Shroud' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

        const ctx = makeCtx({
          targetName: 'Orc',
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d4',
                  damageType: 'necrotic',
                  name: 'Necrotic Shroud',
                },
              ],
            },
          },
          formula: '1d6+2',
          total: 8,
          rolls: [6, 2],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data.formula).toBe('1d6+2 + 1d4 [necrotic]');
        expect(result.data.total).toBeGreaterThan(8);
      });

      it('applies Inner Radiance damage when target is set', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Inner Radiance' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

        const ctx = makeCtx({
          targetName: 'Skeleton',
          playerStats: {
            automation: {
              passives: [
                {
                  type: 'attack_rider',
                  trigger: 'hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  name: 'Inner Radiance',
                },
              ],
            },
          },
          formula: '1d8',
          total: 5,
          rolls: [5],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data.formula).toBe('1d8 + 1d6 [radiant]');
        expect(result.data.total).toBeGreaterThan(5);
      });
    });
  });
});
