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
const { addEntry } = await import('../../ui/logService.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../rules/combat/damageUtils.js');
const { featureModules } = await import('./features/index.js');
const { applyDamageToTarget } = await import('../../rules/combat/applyDamage.js');
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

describe('buildAttackRollDamageSteps - natural20Bonuses, celestialRevelation, featureRiders, damageTypeModifiers, overchannel, proceedToDamage', () => {
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
        expect(steps[12].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.isNatural20 is false', () => {
        const ctx = makeCtx({
          isNatural20: false,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[12].condition(ctx)).toBe(false);
      });

      it('returns false when automation.actions is missing', () => {
        const ctx = makeCtx({
          isNatural20: true,
          playerStats: { automation: {} },
        });
        expect(steps[12].condition(ctx)).toBe(false);
      });

      it('returns true when ctx.d20Roll is 20 (matches test threshold)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: 20,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[12].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.d20Roll is 19 (below test threshold)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: 19,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[12].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.d20Roll is 9 (below test threshold)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: 9,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[12].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.d20Roll is undefined (auto-damage path without d20)', () => {
        const ctx = makeCtx({
          isNatural20: false,
          d20Roll: undefined,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[12].condition(ctx)).toBe(false);
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
        const result = await steps[12].handler(ctx);

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
        const result = await steps[12].handler(ctx);

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
        const result = await steps[12].handler(ctx);

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
        const result = await steps[12].handler(ctx);

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
        const result = await steps[12].handler(ctx);

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
        const result = await steps[12].handler(ctx);

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
        const result = await steps[12].handler(ctx);

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
        expect(steps[13].condition(ctx)).toBe(true);
      });

      it('returns false when automation.passives is missing', () => {
        const ctx = makeCtx({ playerStats: { automation: {} } });
        expect(steps[13].condition(ctx)).toBe(false);
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
        const result = await steps[13].handler(ctx);

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
        const result = await steps[13].handler(ctx);

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
        const result = await steps[13].handler(ctx);

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
        const result = await steps[13].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('adds damage when active buff matches rider', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

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
        const result = await steps[13].handler(ctx);

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
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        await steps[13].handler(ctx);

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
        const result = await steps[13].handler(ctx);

        expect(result.data.formula).toBe('1d8 + 1d6 [radiant]');
      });

      it('handles Necrotic Shroud buff', async () => {
        getActiveBuffs.mockReturnValue([{ name: 'Necrotic Shroud' }]);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

        const ctx = makeCtx({
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
        const result = await steps[13].handler(ctx);

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
        const result = await steps[13].handler(ctx);

        expect(result.data).toEqual({});
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // featureRiders (index 14)
  // ──────────────────────────────────────────────────────────────

  describe('featureRiders step', () => {
    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[14].condition({})).toBe(true);
      });
    });

    describe('handler', () => {
      beforeEach(() => {
        featureModules.length = 0;
      });

      it('returns data when no feature modules', async () => {
        featureModules.length = 0;
        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[14].handler(ctx);

        expect(result.data).toEqual({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
      });

      it('skips features whose condition returns false', async () => {
        const handlerMock = vi.fn();
        featureModules.push({
          condition: () => false,
          handler: handlerMock,
        });

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        await steps[14].handler(ctx);

        expect(handlerMock).not.toHaveBeenCalled();
      });

      it('calls feature handler when condition returns true', async () => {
        const handlerMock = vi.fn(async () => null);
        featureModules.push({
          condition: () => true,
          handler: handlerMock,
        });

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        await steps[14].handler(ctx);

        expect(handlerMock).toHaveBeenCalledWith(ctx, expect.objectContaining({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        }));
      });

      it('updates data when feature returns data', async () => {
        featureModules.push({
          condition: () => true,
          handler: async () => ({
            data: { total: 20, formula: '1d8+3 + 6 [Feature]' },
          }),
        });

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[14].handler(ctx);

        expect(result.data.total).toBe(20);
        expect(result.data.formula).toBe('1d8+3 + 6 [Feature]');
      });

      it('returns modal when feature returns modal', async () => {
        featureModules.push({
          condition: () => true,
          handler: async () => ({
            modal: { type: 'test-modal', props: {} },
          }),
        });

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[14].handler(ctx);

        expect(result).toEqual({ modal: { type: 'test-modal', props: {} } });
      });

      it('calls sideEffects when feature returns them', async () => {
        const sideEffectsMock = vi.fn();
        featureModules.push({
          condition: () => true,
          handler: async () => ({
            data: { total: 20 },
            sideEffects: sideEffectsMock,
          }),
        });

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        await steps[14].handler(ctx);

        expect(sideEffectsMock).toHaveBeenCalled();
        featureModules.length = 0;
      });

      it('processes multiple features in sequence', async () => {
        featureModules.push(
          {
            condition: () => true,
            handler: async () => ({ data: { total: 15 } }),
          },
          {
            condition: () => true,
            handler: async () => ({ data: { total: 20 } }),
          },
        );

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[14].handler(ctx);

        expect(result.data.total).toBe(20);
        featureModules.length = 0;
      });

      it('stops processing when a feature returns modal', async () => {
        const handler2 = vi.fn(async () => ({ data: { total: 20 } }));
        featureModules.push(
          {
            condition: () => true,
            handler: async () => ({ data: { total: 15 } }),
          },
          {
            condition: () => true,
            handler: async () => ({ modal: { type: 'stop' } }),
          },
          {
            condition: () => true,
            handler: handler2,
          },
        );

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        await steps[14].handler(ctx);

        expect(handler2).not.toHaveBeenCalled();
        featureModules.length = 0;
      });

      it('handles missing rolls gracefully', async () => {
        featureModules.length = 0;
        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: undefined });
        const result = await steps[14].handler(ctx);

        expect(result.data.rolls).toEqual([]);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // damageTypeModifiers (index 15)
  // ──────────────────────────────────────────────────────────────

  describe('damageTypeModifiers step', () => {
    describe('condition', () => {
      it('returns true when weaponType is unarmed and passives exist', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: { automation: { passives: [] } },
        });
        expect(steps[15].condition(ctx)).toBe(true);
      });

      it('returns false when weaponType is not unarmed', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: { automation: { passives: [] } },
        });
        expect(steps[15].condition(ctx)).toBe(false);
      });

      it('returns false when passives are missing', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: { automation: {} },
        });
        expect(steps[15].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('returns early when no damage_type_modifier passives', async () => {
        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: {
            automation: {
              passives: [
                { type: 'attack_rider', trigger: 'hit' },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(result.data.formula).toBe('1d4');
      });

      it('uses stored empoweredStrikesDamageType', async () => {
        getRuntimeValue.mockReturnValue('psychic');

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Empowered Strikes',
                  type: 'damage_type_modifier',
                  trigger: 'unarmed_strike_hit',
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        await steps[15].handler(ctx);

        expect(ctx.attack.damageType).toBe('psychic');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'empoweredStrikesDamageType',
          null,
          'test-campaign',
        );
      });

      it('auto-selects Force when target resists Bludgeoning', async () => {
        getRuntimeValue.mockReturnValue(null);
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue({ resistances: ['Bludgeoning'], immunities: [] });

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Empowered Strikes',
                  type: 'damage_type_modifier',
                  trigger: 'unarmed_strike_hit',
                  options: [
                    { name: 'Force', damageType: 'Force' },
                    { name: 'Bludgeoning', damageType: 'Bludgeoning' },
                  ],
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(ctx.attack.damageType).toBe('Force');
        expect(result.popup).toContain('resists Bludgeoning');
        expect(result.popup).toContain('using <b>Force</b>');
        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Empowered Strikes',
            description: expect.stringContaining('auto-selected Force'),
            targetName: undefined,
          }),
        );
      });

      it('auto-selects Force when target is immune to Bludgeoning', async () => {
        getRuntimeValue.mockReturnValue(null);
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue({ resistances: [], immunities: ['Bludgeoning'] });

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Empowered Strikes',
                  type: 'damage_type_modifier',
                  trigger: 'unarmed_strike_hit',
                  options: [
                    { name: 'Force', damageType: 'Force' },
                    { name: 'Bludgeoning', damageType: 'Bludgeoning' },
                  ],
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(ctx.attack.damageType).toBe('Force');
        expect(result.popup).toContain('immune to Bludgeoning');
        expect(result.popup).toContain('using <b>Force</b>');
        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Empowered Strikes',
            description: expect.stringMatching(/auto-selected Force.*immune to Bludgeoning/),
            targetName: undefined,
          }),
        );
      });

      it('auto-selects normal type when target has no relevant resistances', async () => {
        getRuntimeValue.mockReturnValue(null);
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue({ resistances: ['Piercing'], immunities: [] });

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Empowered Strikes',
                  type: 'damage_type_modifier',
                  trigger: 'unarmed_strike_hit',
                  options: [
                    { name: 'Force', damageType: 'Force' },
                    { name: 'Bludgeoning', damageType: 'Bludgeoning' },
                  ],
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(ctx.attack.damageType).toBe('Bludgeoning');
        expect(result).not.toHaveProperty('popup');
        expect(addEntry).not.toHaveBeenCalled();
      });

      it('falls back to normal type when target not found', async () => {
        getRuntimeValue.mockReturnValue(null);
        getTargetFromAttacker.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Empowered Strikes',
                  type: 'damage_type_modifier',
                  trigger: 'unarmed_strike_hit',
                  options: [
                    { name: 'Force', damageType: 'Force' },
                    { name: 'Bludgeoning', damageType: 'Bludgeoning' },
                  ],
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(ctx.attack.damageType).toBe('Bludgeoning');
        expect(result).not.toHaveProperty('popup');
      });

      it('uses case-insensitive comparison for resistances', async () => {
        getRuntimeValue.mockReturnValue(null);
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue({ resistances: ['BLUDGEONING'], immunities: [] });

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Empowered Strikes',
                  type: 'damage_type_modifier',
                  trigger: 'unarmed_strike_hit',
                  options: [
                    { name: 'Force', damageType: 'Force' },
                    { name: 'Bludgeoning', damageType: 'Bludgeoning' },
                  ],
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(ctx.attack.damageType).toBe('Force');
        expect(result).toHaveProperty('popup');
      });

      it('prompts for chosen option when stored and effect is damage_bonus', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Chosen_Rider_selectedOption') return 'Option A';
          return null;
        });

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Chosen Rider',
                  type: 'attack_rider',
                  trigger: 'unarmed_strike_hit',
                  chooseOne: true,
                  options: [
                    { name: 'Option A', effect: 'damage_bonus', damageExpression: '1d6', damageType: 'force' },
                    { name: 'Option B', effect: 'other' },
                  ],
                },
              ],
            },
          },
          formula: '1d4',
          total: 4,
          rolls: [4],
        });
        const result = await steps[15].handler(ctx);

        expect(result.data.formula).toBe('1d4 + 1d6 [force]');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_Chosen_Rider_selectedOption',
          null,
          'test-campaign',
        );
      });

      it('prompts for rider option selection when no stored value', async () => {
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: {
            name: 'TestChar',
            automation: {
              passives: [
                {
                  name: 'Chosen Rider',
                  type: 'attack_rider',
                  trigger: 'unarmed_strike_hit',
                  chooseOne: true,
                  options: [
                    { name: 'Option A' },
                    { name: 'Option B' },
                  ],
                },
              ],
            },
          },
        });
        const result = await steps[15].handler(ctx);

        expect(result.modal).toEqual({
          type: 'damageTypeChoice',
          props: {
            title: expect.stringContaining('Enhanced Unarmed Strike'),
            types: ['Option A', 'Option B'],
          },
        });
      });
    });
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

        expect(applyDamageToTarget).toHaveBeenCalledWith(
          expect.anything(),
          'TestChar',
          expect.any(Number),
          ['Necrotic'],
          'test-campaign',
          null,
          true,
          'TestChar',
        );
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
