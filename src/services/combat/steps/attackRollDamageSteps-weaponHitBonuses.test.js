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
    const numMatch = baseFormula.match(/^(\d+)$/);
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      return { total: val, rolls: [val], modifier: 0 };
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
  evaluateAutoExpression: vi.fn((expr, playerStats) => {
    if (expr === 'proficiency_bonus') return playerStats?.proficiency || 0;
    return null;
  }),
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

describe('buildAttackRollDamageSteps - weaponHitBonuses', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
  });

  // ──────────────────────────────────────────────────────────────
  // weaponHitBonuses (index 11)
  // ──────────────────────────────────────────────────────────────

  describe('weaponHitBonuses step', () => {
    describe('condition', () => {
      it('returns true when automation.actions exists', () => {
        const ctx = makeCtx({ playerStats: { automation: { actions: [] } } });
        expect(steps[12].condition(ctx)).toBe(true);
      });

      it('returns false when automation.actions is missing', () => {
        const ctx = makeCtx({ playerStats: { automation: {} } });
        expect(steps[12].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('returns data when no matching bonuses', async () => {
        const ctx = makeCtx({
          playerStats: { automation: { actions: [] } },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
      });

      it('applies weapon_attack_hit damage_bonus', async () => {
        const ctx = makeCtx({
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Divine Strike',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [radiant]');
      });

      it('applies weapon_or_beast_form_attack_hit damage_bonus', async () => {
        const ctx = makeCtx({
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Eldritch Smite',
                  type: 'damage_bonus',
                  trigger: 'weapon_or_beast_form_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'poison',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [poison]');
      });

      it('skips upgraded bonuses', async () => {
        const ctx = makeCtx({
          playerStats: {
            automation: {
              actions: [
                { name: 'Divine Strike', type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d6', damageType: 'radiant', upgrades: 'Divine Strike' },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).not.toContain('+ 1d6');
      });

      it('skips once-per-turn when already used this round', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Divine_Strike_usedRound') return 1;
          return null;
        });

        const ctx = makeCtx({
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                {
                  name: 'Divine Strike',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  oncePerTurn: true,
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).not.toContain('+ 1d6');
      });

      it('skips when uses_expression and current uses <= 0', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Divine_Strike_uses') return 0;
          return null;
        });

        const ctx = makeCtx({
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                {
                  name: 'Divine Strike',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  uses_expression: '3',
                  recharge: true,
                  usesMax: 3,
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).not.toContain('+ 1d6');
      });

      it('prompts for damage type choice when type has "or"', async () => {
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                {
                  name: 'Eldritch Smite',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'force or necrotic',
                  oncePerTurn: true,
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.modal).toEqual({
          type: 'damageTypeChoice',
          props: expect.objectContaining({
            title: 'Eldritch Smite — Damage Type',
          }),
        });
        expect(result.data._weaponHitPending).toBe(true);
      });

      it('marks once-per-turn after applying', async () => {
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                {
                  name: 'Divine Strike',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  oncePerTurn: true,
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        await steps[12].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_Divine_Strike_usedRound',
          1,
          'test-campaign',
        );
      });

      it('decrements uses when uses_expression and recharge are set', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Divine_Strike_uses') return 2;
          return null;
        });

        const ctx = makeCtx({
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                {
                  name: 'Divine Strike',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  uses_expression: '3',
                  recharge: true,
                  usesMax: 3,
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        await steps[12].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_Divine_Strike_uses',
          1,
          'test-campaign',
        );
      });

      it('skips bonuses with options when no option selected (no "strike" in chosen)', async () => {
        getRuntimeValue.mockReturnValue('');

        const ctx = makeCtx({
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Feature',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  options: ['Option A', 'Option B'],
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).not.toContain('+ 1d6');
      });

      it('applies bonuses with options when option contains "strike"', async () => {
        getRuntimeValue.mockReturnValue('Strike Option');

        const ctx = makeCtx({
          playerStats: {
            automation: {
              actions: [
                {
                  name: 'Feature',
                  type: 'damage_bonus',
                  trigger: 'weapon_attack_hit',
                  damageExpression: '1d6',
                  damageType: 'radiant',
                  options: ['Strike Option', 'Other Option'],
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[12].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6');
      });
    });
  });
});
