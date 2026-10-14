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
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Orc' }] }),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ creatures: [{ name: 'Orc' }], lastAttack: {} })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  playerIsImmuneToCondition: vi.fn(() => false),
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

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { collectWeaponMastery } = await import('../../combat/automation/automationService.js');
const { createSaveListener } = await import('../../automation/common/savePrompt.js');

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

describe('buildAttackRollDamageSteps - toppleMastery, masteryDone', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
      if (propertyName === 'lastAttack') return { hit: true };
      return null;
    });
    steps = buildAttackRollDamageSteps();
  });

  // ──────────────────────────────────────────────────────────────
  // toppleMastery
  // ──────────────────────────────────────────────────────────────

  describe('toppleMastery step', () => {
    let toppleIdx;

    beforeEach(() => {
      const names = steps.map((s) => s.name);
      toppleIdx = names.indexOf('toppleMastery');
    });

    describe('condition', () => {
      it('returns truthy when attack.name and playerStats exist', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        expect(steps[toppleIdx].condition(ctx)).toBeTruthy();
      });

      it('returns falsy when attack.name is missing', () => {
        const ctx = makeCtx({
          attack: {},
          playerStats: { name: 'TestChar' },
        });
        expect(steps[toppleIdx].condition(ctx)).toBeFalsy();
      });

      it('returns falsy when playerStats is missing', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: null,
        });
        expect(steps[toppleIdx].condition(ctx)).toBeFalsy();
      });
    });

    describe('handler', () => {
      it('returns early when lastAttack did not hit', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: false };
          return null;
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when collectWeaponMastery returns null', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true };
          return null;
        });
        collectWeaponMastery.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when Topple mastery not present', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when no target name', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('creates a CON save prompt', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          targetName: 'Orc',
          saveType: 'CON',
          saveDc: 14, // 8 + 3 (STR) + 3 (prof)
        }));
      });

      it('logs a save_result entry', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_result',
            targetName: 'Orc',
            saveType: 'CON',
            saveDc: 14,
          }),
        );
      });

      it('applies prone condition on failed save', async () => {
        vi.mocked(loadCombatSummary).mockResolvedValue({ creatures: [{ name: 'Orc' }] });
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Orc',
          'activeConditions',
          expect.arrayContaining(['prone']),
          'test-campaign',
        );
      });

      it('does not apply prone if already prone', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          if (propertyName === 'activeConditions') return ['prone'];
          return null;
        });
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        // Should not add another prone
        const calls = setRuntimeValue.mock.calls.filter(
          (c) => c[1] === 'activeConditions' && c[0] === 'Orc',
        );
        expect(calls.length).toBe(0);
      });

      it('logs save_result and ability_use entries on failed save', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_result',
            targetName: 'Orc',
            saveType: 'CON',
            success: false,
          }),
        );
        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Topple',
          }),
        );
      });

      it('does nothing on successful save', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: true }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'Orc',
          'activeConditions',
          expect.arrayContaining(['prone']),
          'test-campaign',
        );
      });

      it('uses weapon abilityName for save DC calculation', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Longbow' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Longbow' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Dexterity', bonus: 4 }],
            proficiency: 3,
            attacks: [{ name: 'Longbow', abilityName: 'Dexterity' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          saveDc: 15, // 8 + 4 (DEX) + 3 (prof)
        }));
      });

      it('defaults to Strength when weapon attack has no abilityName', async () => {
        getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
          if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
          return null;
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          saveDc: 14, // 8 + 3 (STR default) + 3 (prof)
        }));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // masteryDone
  // ──────────────────────────────────────────────────────────────

  describe('masteryDone step', () => {
    let masteryDoneIdx;

    beforeEach(() => {
      const names = steps.map((s) => s.name);
      masteryDoneIdx = names.indexOf('masteryDone');
    });

    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[masteryDoneIdx].condition({})).toBe(true);
        expect(steps[masteryDoneIdx].condition({ attack: null })).toBe(true);
      });
    });

    describe('handler', () => {
      it('returns data with _pipelineComplete: true', async () => {
        const result = await steps[masteryDoneIdx].handler({});

        expect(result.data._pipelineComplete).toBe(true);
      });

      it('does not depend on any context values', async () => {
        const result = await steps[masteryDoneIdx].handler({ attack: null, playerStats: null });

        expect(result.data._pipelineComplete).toBe(true);
      });
    });
  });
});
