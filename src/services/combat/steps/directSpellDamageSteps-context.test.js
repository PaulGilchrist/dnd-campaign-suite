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

describe('buildDirectSpellDamageSteps - spellContext', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEmpoweredEvocationFeatures).mockReturnValue([]);
    vi.mocked(getEmpoweredEvocationIntModifier).mockReturnValue(0);
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

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
