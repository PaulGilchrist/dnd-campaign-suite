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
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../rules/combat/damageUtils.js');
const { featureModules } = await import('./features/index.js');

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

describe('buildAttackRollDamageSteps - featureRiders, damageTypeModifiers', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
    featureModules.length = 0;
  });

  // ──────────────────────────────────────────────────────────────
  // featureRiders (index 14)
  // ──────────────────────────────────────────────────────────────

  describe('featureRiders step', () => {
    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[15].condition({})).toBe(true);
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
        const result = await steps[15].handler(ctx);

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
        await steps[15].handler(ctx);

        expect(handlerMock).not.toHaveBeenCalled();
      });

      it('calls feature handler when condition returns true', async () => {
        const handlerMock = vi.fn(async () => null);
        featureModules.push({
          condition: () => true,
          handler: handlerMock,
        });

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        await steps[15].handler(ctx);

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
        const result = await steps[15].handler(ctx);

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
        const result = await steps[15].handler(ctx);

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
        await steps[15].handler(ctx);

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
        const result = await steps[15].handler(ctx);

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
        await steps[15].handler(ctx);

        expect(handler2).not.toHaveBeenCalled();
        featureModules.length = 0;
      });

      it('handles missing rolls gracefully', async () => {
        featureModules.length = 0;
        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: undefined });
        const result = await steps[15].handler(ctx);

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
        expect(steps[16].condition(ctx)).toBe(true);
      });

      it('returns false when weaponType is not unarmed', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'melee' },
          playerStats: { automation: { passives: [] } },
        });
        expect(steps[16].condition(ctx)).toBe(false);
      });

      it('returns false when passives are missing', () => {
        const ctx = makeCtx({
          attack: { weaponType: 'unarmed' },
          playerStats: { automation: {} },
        });
        expect(steps[16].condition(ctx)).toBe(false);
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
        const result = await steps[16].handler(ctx);

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
        await steps[16].handler(ctx);

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
        const result = await steps[16].handler(ctx);

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
        const result = await steps[16].handler(ctx);

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

      it('returns damageTypeChoice modal when target has no relevant resistances', async () => {
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
        const result = await steps[16].handler(ctx);

        expect(result.modal).toEqual({
          type: 'damageTypeChoice',
          props: { title: 'Empowered Strikes — Damage Type', types: ['Force', 'Bludgeoning'] },
        });
        expect(result.data._damageTypeModifier).toEqual(expect.objectContaining({ name: 'Empowered Strikes' }));
      });

      it('returns damageTypeChoice modal when target not found', async () => {
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
        const result = await steps[16].handler(ctx);

        expect(result.modal).toEqual({
          type: 'damageTypeChoice',
          props: { title: 'Empowered Strikes — Damage Type', types: ['Force', 'Bludgeoning'] },
        });
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
        const result = await steps[16].handler(ctx);

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
        const result = await steps[16].handler(ctx);

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
        const result = await steps[16].handler(ctx);

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
});
