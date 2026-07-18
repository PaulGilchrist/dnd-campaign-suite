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

// Use a mutable array so tests can replace featureModules without vi.resetModules
const _featureModulesRef = { value: [] };
vi.mock('./features/index.js', () => ({
  get featureModules() { return _featureModulesRef.value; },
}));

const { rollExpression, rollExpressionDoubled, rollExpressionMaximized } = await import('../../dice/diceRoller.js');
const { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } = await import('../../rules/spells/postCastRiderService.js');
const { addEntry } = await import('../../ui/logService.js');
const { getChosenRuntimeValue } = await import('../../../services/automation/common/choiceStorage.js');

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

  describe('spellContext step', () => {
    describe('condition', () => {
      it('returns true when ctx has playerStats', () => {
        const ctx = makeCtx({ playerStats: { name: 'Test' } });
        expect(steps[1].condition(ctx)).toBe(true);
      });

      it('returns false when ctx has no playerStats', () => {
        const ctx = makeCtx({ playerStats: null });
        expect(steps[1].condition(ctx)).toBe(false);
      });

      it('returns false when ctx has no playerStats at all', () => {
        const ctx = makeCtx();
        delete ctx.playerStats;
        expect(steps[1].condition(ctx)).toBe(false);
      });
    });

    describe('handler - basic formula', () => {
      it('uses attack.damage as the formula', async () => {
        const ctx = makeCtx({ attack: { damage: '8d6' } });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });

      it('uses autoFormulaOverride when no attack.damage', async () => {
        const ctx = makeCtx({ autoFormulaOverride: '4d10' });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('4d10');
      });

      it('prefers attack.damage over autoFormulaOverride', async () => {
        const ctx = makeCtx({
          attack: { damage: '8d6' },
          autoFormulaOverride: '4d10',
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });
    });

    describe('handler - empowered evocation', () => {
      it('appends Int mod when empowered evocation applies', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(['Empowered Evocation']);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(3);

        const ctx = makeCtx({
          attack: { damage: '8d6' },
          autoDamageSchool: 'Evocation',
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6 + 3 [Empowered Evocation]');
      });

      it('appends Int mod with lowercase school name', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(['Empowered Evocation']);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(2);

        const ctx = makeCtx({
          attack: { damage: '8d6' },
          autoDamageSchool: 'evocation',
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6 + 2 [Empowered Evocation]');
      });

      it('does not apply empowered evocation for non-evocation school', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(['Empowered Evocation']);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(3);

        const ctx = makeCtx({
          attack: { damage: '8d6' },
          autoDamageSchool: 'Necromancy',
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });

      it('does not apply empowered evocation when Int mod is 0', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(['Empowered Evocation']);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);

        const ctx = makeCtx({
          attack: { damage: '8d6' },
          autoDamageSchool: 'Evocation',
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });

      it('does not apply empowered evocation when player has no feature', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(3);

        const ctx = makeCtx({
          attack: { damage: '8d6' },
          autoDamageSchool: 'Evocation',
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });
    });

    describe('handler - blessed strikes / potent spellcasting', () => {
      it('appends spellcasting mod for cantrips with potent feature', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: 4 }],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                  abilityName: 'Wisdom',
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10 + 4 [Blessed Strikes]');
      });

      it('appends blessed strikes with default Wisdom ability', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: 3 }],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10 + 3 [Blessed Strikes]');
      });

      it('does not append blessed strikes when ability mod is 0', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: 0 }],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                  abilityName: 'Wisdom',
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10');
      });

      it('does not append blessed strikes for non-cantrips', async () => {
        const ctx = makeCtx({
          isCantrip: false,
          attack: { damage: '3d6' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: 4 }],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                  abilityName: 'Wisdom',
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('3d6');
      });

      it('does not append blessed strikes when no potent feature exists', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: 4 }],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10');
      });

      it('does not append blessed strikes when automation.actions is null', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: 4 }],
            automation: { actions: null },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10');
      });

      it('applies both empowered evocation and blessed strikes', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(['Empowered Evocation']);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(2);

        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          autoDamageSchool: 'Evocation',
          playerStats: {
            name: 'TestWizard',
            abilities: [
              { name: 'Intelligence', bonus: 2 },
              { name: 'Wisdom', bonus: 3 },
            ],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                  abilityName: 'Wisdom',
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10 + 2 [Empowered Evocation] + 3 [Blessed Strikes]');
      });

      it('does not add blessed strikes when ability not found', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Intelligence', bonus: 5 }],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                  abilityName: 'Charisma',
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10');
      });

      it('uses Math.max(0, bonus) for spellcasting mod so negative mods are skipped', async () => {
        const ctx = makeCtx({
          isCantrip: true,
          attack: { damage: '1d10' },
          playerStats: {
            name: 'TestWizard',
            abilities: [{ name: 'Wisdom', bonus: -2 }],
            automation: {
              actions: [
                {
                  type: 'damage_bonus',
                  options: ['Potent Spellcasting (Spellcasting Ability)'],
                  abilityName: 'Wisdom',
                },
              ],
            },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10');
      });
    });

    describe('handler - elemental affinity', () => {
      it('appends CHA mod when spell damage type matches chosen type', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Fire');

        const ctx = makeCtx({
          attack: { damage: '8d6', damageType: 'Fire' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: 3 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6 + 3 [Elemental Affinity]');
      });

      it('appends CHA mod with lowercase damage type matching', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Fire');

        const ctx = makeCtx({
          attack: { damage: '4d6', damageType: 'fire' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: 2 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('4d6 + 2 [Elemental Affinity]');
      });

      it('does not apply when spell damage type does not match chosen type', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Fire');

        const ctx = makeCtx({
          attack: { damage: '8d6', damageType: 'Cold' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: 3 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });

      it('does not apply when no chosen type', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue(undefined);

        const ctx = makeCtx({
          attack: { damage: '8d6', damageType: 'Fire' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: 3 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });

      it('does not apply when CHA mod is 0', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Lightning');

        const ctx = makeCtx({
          attack: { damage: '6d6', damageType: 'Lightning' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: 0 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('6d6');
      });

      it('does not apply when CHA mod is negative', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Acid');

        const ctx = makeCtx({
          attack: { damage: '4d6', damageType: 'Acid' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: -2 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('4d6');
      });

      it('does not apply when no Charisma ability found', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Poison');

        const ctx = makeCtx({
          attack: { damage: '3d6', damageType: 'Poison' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Intelligence', bonus: 3 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('3d6');
      });

      it('does not apply when attack has no damageType', async () => {
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Fire');

        const ctx = makeCtx({
          attack: { damage: '8d6' },
          playerStats: {
            name: 'TestSorcerer',
            abilities: [
              { name: 'Charisma', bonus: 3 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('8d6');
      });

      it('applies both empowered evocation and elemental affinity', async () => {
        vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue(['Empowered Evocation']);
        vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(2);
        vi.mocked(getChosenRuntimeValue).mockReturnValue('Fire');

        const ctx = makeCtx({
          attack: { damage: '1d10', damageType: 'Fire' },
          autoDamageSchool: 'Evocation',
          playerStats: {
            name: 'TestWizard',
            abilities: [
              { name: 'Intelligence', bonus: 2 },
              { name: 'Charisma', bonus: 3 },
            ],
            automation: { actions: [] },
          },
        });
        const result = await steps[1].handler(ctx);
        expect(result.data.formula).toBe('1d10 + 2 [Empowered Evocation] + 3 [Elemental Affinity]');
      });
    });
  });

  describe('spellRollDamage step', () => {
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

  describe('spellFeatureRiders step', () => {
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

  describe('spellOverchannel step', () => {
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

  describe('spellProceedToDamage step', () => {
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
        expect(ctx.proceedWithDamage).toHaveBeenCalledWith(
          { name: 'Fireball' },
          '8d6',
          28,
          [6, 5, 4, 3, 6, 2, 1, 1],
          0,
        );
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
});
