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
const { rollExpression } = await import('../../dice/diceRoller.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');

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

describe('buildDamageSteps - twoWeaponFighting, targetEffects, superiorityDieBonuses, automationBonuses, weaponHitBonuses', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildDamageSteps();
  });

  // ──────────────────────────────────────────────────────────────
  // twoWeaponFighting (index 7)
  // ──────────────────────────────────────────────────────────────

  describe('twoWeaponFighting step', () => {
    describe('condition', () => {
      it('returns true when ctx.isBonusActionAttack is true and playerStats exists', () => {
        const ctx = makeCtx({ isBonusActionAttack: true });
        expect(steps[7].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.isBonusActionAttack is false', () => {
        const ctx = makeCtx({ isBonusActionAttack: false });
        expect(steps[7].condition(ctx)).toBe(false);
      });

      it('returns falsy when ctx.isBonusActionAttack is undefined but playerStats exists', () => {
        const ctx = makeCtx();
        expect(steps[7].condition(ctx)).toBeFalsy();
      });

      it('returns false when playerStats is missing', () => {
        const ctx = makeCtx({ isBonusActionAttack: true, playerStats: null });
        expect(steps[7].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('returns early when player has no two weapon fighting', async () => {
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Light'], abilityName: 'Dexterity' },
        });
        const result = await steps[7].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when attack property is not Light', async () => {
        vi.mocked(await import('../../combat/automation/automationService.js')).hasTwoWeaponFighting.mockReturnValue(true);
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Finesse'], abilityName: 'Dexterity' },
        });
        const result = await steps[7].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when attack has no abilityName', async () => {
        vi.mocked(await import('../../combat/automation/automationService.js')).hasTwoWeaponFighting.mockReturnValue(true);
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Light'] },
        });
        const result = await steps[7].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when ability mod is 0', async () => {
        vi.mocked(await import('../../combat/automation/automationService.js')).hasTwoWeaponFighting.mockReturnValue(true);
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Light'], abilityName: 'Dexterity' },
          playerStats: {
            abilities: [{ name: 'Dexterity', bonus: 0 }],
          },
        });
        const result = await steps[7].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when mod already in formula', async () => {
        vi.mocked(await import('../../combat/automation/automationService.js')).hasTwoWeaponFighting.mockReturnValue(true);
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Light'], abilityName: 'Dexterity' },
          playerStats: {
            abilities: [{ name: 'Dexterity', bonus: 3 }],
          },
          formula: '1d8+3[Dexterity]',
          total: 11,
          rolls: [8],
        });
        const result = await steps[7].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('adds ability modifier to damage when conditions are met', async () => {
        vi.mocked(await import('../../combat/automation/automationService.js')).hasTwoWeaponFighting.mockReturnValue(true);
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Light'], abilityName: 'Dexterity' },
          playerStats: {
            abilities: [{ name: 'Dexterity', bonus: 3 }],
          },
          formula: '1d6',
          total: 4,
          rolls: [1],
        });
        const result = await steps[7].handler(ctx);

        expect(result.data.formula).toBe('1d6 + 3 [Dexterity]');
        expect(result.data.total).toBe(7);
        expect(result.data.rolls).toEqual([1, 3]);
      });

      it('handles negative ability modifier by skipping (mod <= 0 check)', async () => {
        vi.mocked(await import('../../combat/automation/automationService.js')).hasTwoWeaponFighting.mockReturnValue(true);
        const ctx = makeCtx({
          isBonusActionAttack: true,
          attack: { properties: ['Light'], abilityName: 'Dexterity' },
          playerStats: {
            abilities: [{ name: 'Dexterity', bonus: -2 }],
          },
          formula: '1d6',
          total: 4,
          rolls: [3],
        });
        const result = await steps[7].handler(ctx);

        expect(result.data).toEqual({});
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // targetEffects (index 8)
  // ──────────────────────────────────────────────────────────────

  describe('targetEffects step', () => {
    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[8].condition({})).toBe(true);
        expect(steps[8].condition({ attack: null })).toBe(true);
      });
    });

    describe('handler', () => {
      it('returns early when no targetEffects stored', async () => {
        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[8].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when no damage_bonus targetEffects', async () => {
        setRuntimeValue.mockImplementation(() => {});
        getRuntimeValue.mockReturnValue([{ effect: 'push', value: 5 }]);

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[8].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('adds damage from damage_bonus targetEffects', async () => {
        getRuntimeValue.mockReturnValue([{ effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' }]);

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[8].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 1d4 [force]');
        expect(result.data.total).toBeGreaterThan(11);
      });

      it('uses attack damageType when targetEffect has no damageType', async () => {
        getRuntimeValue.mockReturnValue([{ effect: 'damage_bonus', damageExpression: '1d4' }]);

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { damageType: 'slashing' },
        });
        const result = await steps[8].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 1d4 [slashing]');
      });

      it('handles multiple damage_bonus targetEffects', async () => {
        getRuntimeValue.mockReturnValue([
          { effect: 'damage_bonus', damageExpression: '1d4', damageType: 'force' },
          { effect: 'damage_bonus', damageExpression: '1d6', damageType: 'cold' },
        ]);

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[8].handler(ctx);

        expect(result.data.formula).toContain('+ 1d4 [force]');
        expect(result.data.formula).toContain('+ 1d6 [cold]');
      });

      it('skips targetEffect when rollExpression returns null', async () => {
        rollExpression.mockReturnValue(null);
        getRuntimeValue.mockReturnValue([{ effect: 'damage_bonus', damageExpression: '1d4' }]);

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[8].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
        expect(result.data.total).toBe(11);
      });

      it('handles non-array targetEffects gracefully', async () => {
        getRuntimeValue.mockReturnValue('not-an-array');

        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[8].handler(ctx);

        expect(result.data).toEqual({});
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // superiorityDieBonuses (index 9)
  // ──────────────────────────────────────────────────────────────

  describe('superiorityDieBonuses step', () => {
    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[9].condition({})).toBe(true);
      });
    });

    describe('handler', () => {
      it('returns early when no superiority values are set', async () => {
        getRuntimeValue.mockReturnValue(null);
        const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
        expect(result.data.total).toBe(11);
      });

      it('consumes feintingAttackDieValue', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'feintingAttackDieValue') return 4;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { damageType: 'slashing' },
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 4 [slashing]');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'feintingAttackDieValue',
          null,
          'test-campaign',
        );
      });

      it('consumes bardicInspirationOffenseValue', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'bardicInspirationOffenseValue') return 5;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 5 [Bardic Inspiration]');
      });

      it('consumes pendingRiposteDieValue', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'pendingRiposteDieValue') return 3;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { damageType: 'piercing' },
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 3 [piercing]');
      });

      it('consumes lungingAttackDieValue for melee attacks', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'lungingAttackDieValue') return 2;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { weaponType: 'melee', damageType: 'melee' },
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 2 [melee]');
        expect(result.data.isMeleeOrUnarmed).toBe(true);
      });

      it('consumes lungingAttackDieValue for unarmed attacks', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'lungingAttackDieValue') return 2;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 2 [bludgeoning]');
      });

      it('does not consume lungingAttackDieValue for ranged attacks', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'lungingAttackDieValue') return 2;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { weaponType: 'ranged' },
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
        expect(result.data.isMeleeOrUnarmed).toBe(false);
      });

      it('consumes commanderStrikeBonus', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'commanderStrikeBonus') return 6;
          return null;
        });

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3 + 6 [same_as_weapon]');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'commanderStrikeBonus',
          null,
          'test-campaign',
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'commanderStrikeActive',
          null,
          'test-campaign',
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'commanderStrikeSource',
          null,
          'test-campaign',
        );
      });

      it('does not consume values that are 0 or null', async () => {
        getRuntimeValue.mockReturnValue(0);

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
        expect(result.data.total).toBe(11);
      });

      it('returns isMeleeOrUnarmed flag', async () => {
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
          attack: { weaponType: 'melee' },
        });
        const result = await steps[9].handler(ctx);

        expect(result.data.isMeleeOrUnarmed).toBe(true);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // automationBonuses (index 10)
  // ──────────────────────────────────────────────────────────────

  describe('automationBonuses step', () => {
    describe('condition', () => {
      it('returns true when ctx.isMeleeOrUnarmed is true and automation.actions exists', () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[10].condition(ctx)).toBe(true);
      });

      it('returns true when isMeleeOrUnarmed is false but automation exists', () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: false,
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[10].condition(ctx)).toBe(true);
      });

      it('returns false when automation.actions is missing', () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { automation: {} },
        });
        expect(steps[10].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('returns data when no matching actions', async () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: { automation: { actions: [] } },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
      });

      it('applies melee_weapon_hit damage_bonus actions', async () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d6', damageType: 'fire' },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [fire]');
      });

      it('applies monk_weapon_or_unarmed_hit with elemental attunement', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Elemental_Attunement_option') return 'fire';
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [fire]');
      });

      it('applies monk_weapon_or_unarmed_hit with default fire when no elemental attunement', async () => {
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [fire]');
      });

      it('applies monk_weapon_or_unarmed_hit with lowercase option', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_Elemental_Attunement_option') return 'Lightning';
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: '' },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [lightning]');
      });

      it('applies melee_heavy_weapon_hit when weapon is heavy', async () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6', damageType: 'slashing' },
              ],
            },
          },
          attack: { properties: ['Heavy'] },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [slashing]');
      });

      it('does not apply melee_heavy_weapon_hit when weapon is not heavy', async () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6', damageType: 'slashing' },
              ],
            },
          },
          attack: { properties: ['Finesse'] },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 1d6');
      });

      it('defaults to Slashing for melee_heavy_weapon_hit when no damageType', async () => {
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d6' },
              ],
            },
          },
          attack: { properties: ['Heavy'] },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [Slashing]');
      });

      it('applies frenzy when reckless + raging + strength', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_frenzyUsedRound') return null;
          if (prop === 'activeBuffs') return [
            { effect: 'advantage_attacks_advantage_against' },
            { damageBonusExpression: '1d6' },
          ];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: 'rage_damage', damageType: '' },
              ],
            },
            class: { class_levels: [{ rage_damage: 2 }] },
            level: 5,
          },
          attack: { abilityName: 'Strength' },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 2');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_frenzyUsedRound',
          1,
          'test-campaign',
        );
      });

      it('does not apply frenzy when not reckless', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_frenzyUsedRound') return null;
          if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d6' }];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: '2', damageType: '' },
              ],
            },
            level: 5,
          },
          attack: { abilityName: 'Strength' },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
      });

      it('does not apply frenzy when not raging', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_frenzyUsedRound') return null;
          if (prop === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: '2', damageType: '' },
              ],
            },
            level: 5,
          },
          attack: { abilityName: 'Strength' },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
      });

      it('does not apply frenzy when not strength', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_frenzyUsedRound') return null;
          if (prop === 'activeBuffs') return [
            { effect: 'advantage_attacks_advantage_against' },
            { damageBonusExpression: '1d6' },
          ];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: '2', damageType: '' },
              ],
            },
            level: 5,
          },
          attack: { abilityName: 'Dexterity' },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
      });

      it('does not apply frenzy when already used this round', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_frenzyUsedRound') return 1;
          if (prop === 'activeBuffs') return [
            { effect: 'advantage_attacks_advantage_against' },
            { damageBonusExpression: '1d6' },
          ];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            name: 'TestChar',
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: '2', damageType: '' },
              ],
            },
            level: 5,
          },
          attack: { abilityName: 'Strength' },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
      });

      it('applies divine fury while raging', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_divineFuryUsedRound') return null;
          if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d6' }];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: 'barbarian_level / 2', damageType: 'radiant' },
              ],
            },
            level: 5,
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 2 [radiant]');
      });

      it('does not apply divine fury when already used this round', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_divineFuryUsedRound') return 1;
          if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d6' }];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant' },
              ],
            },
            level: 5,
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
      });

      it('does not apply divine fury when not raging', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_divineFuryUsedRound') return null;
          if (prop === 'activeBuffs') return [];
          return null;
        });

        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant' },
              ],
            },
            level: 5,
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).not.toContain('+ 2');
      });

      it('prompts for divine fury damage type choice when type has "or"', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_divineFuryUsedRound') return null;
          if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d6' }];
          return null;
        });

        const setDivineFuryChoice = vi.fn();
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: '2', damageType: 'radiant or necrotic' },
              ],
            },
            level: 5,
          },
          setDivineFuryChoice,
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.modal).toEqual({
          type: 'divineFury',
          props: { damageType: 'radiant or necrotic' },
        });
        expect(result.data._divineFuryPending).toBe(true);
        expect(setDivineFuryChoice).toHaveBeenCalledWith('radiant or necrotic');
      });

      it('applies attack_rider strength attacks after reckless', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_brutalStrikeActive') return true;
          return null;
        });
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                {
                  type: 'attack_rider',
                  trigger: 'strength_attack_hit_after_reckless',
                  damageExpression: '1d6',
                  damageType: 'slashing',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [slashing]');
      });

      it('skips attack_rider when _brutalStrikeActive is not set', async () => {
        getRuntimeValue.mockReturnValue(null);
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          playerStats: {
            automation: {
              actions: [
                {
                  type: 'attack_rider',
                  trigger: 'strength_attack_hit_after_reckless',
                  damageExpression: '1d6',
                  damageType: 'slashing',
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toBe('1d8+3');
        expect(result.data.formula).not.toContain('+ 1d6 [slashing]');
      });

      it('stores Staggering Blow targetEffects and logs to campaign log', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_brutalStrikeActive') return true;
          if (prop === '_brutalStrikeEffects') return ['Staggering Blow'];
          if (prop === 'targetEffects') return [];
          return null;
        });
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          targetName: 'Goblin',
          playerStats: {
            automation: {
              actions: [
                {
                  type: 'attack_rider',
                  trigger: 'strength_attack_hit_after_reckless',
                  effect: 'attack_rider',
                  damageExpression: '1d6',
                  damageType: 'slashing',
                  name: "Brutal Strike (Level 13)",
                  options: [
                    {
                      name: 'Staggering Blow',
                      effect: 'disadvantage_on_next_save',
                      value: '1 round',
                      noOpportunityAttacks: true,
                    },
                  ],
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [slashing]');
        expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          abilityName: "Brutal Strike (Level 13)",
        }));
      });

      it('stores Sundering Blow targetEffects and applies bonus to formula', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === '_brutalStrikeActive') return true;
          if (prop === '_brutalStrikeEffects') return ['Sundering Blow'];
          if (prop === 'targetEffects') return [];
          return null;
        });
        const ctx = makeCtx({
          isMeleeOrUnarmed: true,
          targetName: 'Orc',
          playerStats: {
            automation: {
              actions: [
                {
                  type: 'attack_rider',
                  trigger: 'strength_attack_hit_after_reckless',
                  effect: 'attack_rider',
                  damageExpression: '1d6',
                  damageType: 'slashing',
                  name: "Brutal Strike (Level 17)",
                  options: [
                    {
                      name: 'Sundering Blow',
                      effect: 'next_attack_bonus',
                      value: 5,
                    },
                  ],
                },
              ],
            },
          },
          formula: '1d8+3',
          total: 11,
          rolls: [8, 3],
        });
        const result = await steps[10].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6 [slashing]');
        expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          abilityName: "Brutal Strike (Level 17)",
        }));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // weaponHitBonuses (index 11)
  // ──────────────────────────────────────────────────────────────

  describe('weaponHitBonuses step', () => {
    describe('condition', () => {
      it('returns true when automation.actions exists', () => {
        const ctx = makeCtx({ playerStats: { automation: { actions: [] } } });
        expect(steps[11].condition(ctx)).toBe(true);
      });

      it('returns false when automation.actions is missing', () => {
        const ctx = makeCtx({ playerStats: { automation: {} } });
        expect(steps[11].condition(ctx)).toBe(false);
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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        await steps[11].handler(ctx);

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
        await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

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
        const result = await steps[11].handler(ctx);

        expect(result.data.formula).toContain('+ 1d6');
      });
    });
  });
});
