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
const { collectWeaponMastery } = await import('../../combat/automation/automationService.js');
const { applyMasteryEffect } = await import('../../automation/handlers/combat/weaponMasteryHandler.js');

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

describe('buildAttackRollDamageSteps - tacticalMaster', () => {
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

  describe('condition', () => {
    it('returns truthy when attack.name and playerStats.automation exist', () => {
      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      expect(steps[tacticalIdx].condition(ctx)).toBeTruthy();
    });

    it('returns falsy when attack.name is missing', () => {
      const ctx = makeCtx({
        attack: {},
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      expect(steps[tacticalIdx].condition(ctx)).toBeFalsy();
    });

    it('returns falsy when playerStats.automation is missing', () => {
      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: {},
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      expect(steps[tacticalIdx].condition(ctx)).toBeFalsy();
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
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      const result = await steps[tacticalIdx].handler(ctx);

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
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      const result = await steps[tacticalIdx].handler(ctx);

      expect(result.data).toEqual({});
    });

    it('auto-applies mastery effects when no replace options', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
        return null;
      });
      collectWeaponMastery.mockReturnValue({
        baseMastery: 'Push',
        extraMasteries: ['Sap'],
        replaceMasteryOptions: [],
      });

      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      const result = await steps[tacticalIdx].handler(ctx);

      expect(applyMasteryEffect).toHaveBeenCalledWith('Push', expect.anything(), 'test-campaign', 'Orc');
      expect(applyMasteryEffect).toHaveBeenCalledWith('Sap', expect.anything(), 'test-campaign', 'Orc');
      expect(result.data).toEqual({});
    });

    it('skips Graze, Topple, Nick in auto-apply', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
        return null;
      });
      collectWeaponMastery.mockReturnValue({
        baseMastery: 'Graze',
        extraMasteries: ['Topple', 'Nick'],
        replaceMasteryOptions: [],
      });

      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      await steps[tacticalIdx].handler(ctx);

      expect(applyMasteryEffect).not.toHaveBeenCalled();
    });

    it('skips mastery when already applied to target', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
        if (propertyName === '_Push_appliedTarget') return 'Orc';
        return null;
      });
      collectWeaponMastery.mockReturnValue({
        baseMastery: 'Push',
        extraMasteries: [],
        replaceMasteryOptions: [],
      });

      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      await steps[tacticalIdx].handler(ctx);

      expect(applyMasteryEffect).not.toHaveBeenCalled();
    });

    it('does not set _Slow_appliedTarget for Slow mastery', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
        return null;
      });
      collectWeaponMastery.mockReturnValue({
        baseMastery: 'Slow',
        extraMasteries: [],
        replaceMasteryOptions: [],
      });

      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      await steps[tacticalIdx].handler(ctx);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'test-campaign',
        '_Slow_appliedTarget',
        'Orc',
        'test-campaign',
      );
    });

    it('prompts for tactical master replacement when options exist', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe' };
        return null;
      });
      collectWeaponMastery.mockReturnValue({
        baseMastery: 'Push',
        replaceMasteryOptions: ['Sap', 'Vex'],
      });

      const setModalState = vi.fn();
      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
        setModalState: setModalState,
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      const result = await steps[tacticalIdx].handler(ctx);

      expect(setModalState).toHaveBeenCalled();
      expect(result.modal).toEqual({
        type: 'tacticalMaster',
        props: expect.objectContaining({
          attackName: 'Greataxe',
          baseMastery: 'Push',
          replaceOptions: ['Sap', 'Vex'],
          targetName: 'Orc',
        }),
      });
      expect(result.data._tacticalMasterPending).toBe(true);
    });

    it('threads the granting featureName through choice-mode modal props (Battering Roots)', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Goblin', attackName: 'Longsword' };
        return null;
      });
      collectWeaponMastery.mockReturnValue({
        baseMastery: 'Sap',
        replaceMasteryOptions: ['Push', 'Topple'],
        choiceMasteries: ['Push', 'Topple'],
        featureName: 'Battering Roots',
      });

      const setModalState = vi.fn();
      const ctx = makeCtx({
        attack: { name: 'Longsword' },
        playerStats: { automation: { actions: [] } },
        setModalState: setModalState,
      });
      const tacticalIdx = steps.map((s) => s.name).indexOf('tacticalMaster');
      const result = await steps[tacticalIdx].handler(ctx);

      expect(result.modal.props.featureName).toBe('Battering Roots');
      expect(result.modal.props.isChoiceMode).toBe(true);
      expect(setModalState).toHaveBeenCalledWith(expect.objectContaining({
        tacticalMasterPending: expect.objectContaining({ featureName: 'Battering Roots' }),
      }));
    });
  });
});
