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
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { collectWeaponMastery } = await import('../../combat/automation/automationService.js');
const { isWithinRange } = await import('../../rules/combat/rangeCheck.js');

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

describe('buildAttackRollDamageSteps - cleaveMastery', () => {
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
    it('returns truthy when setSecondaryTargetModal exists and attack and playerStats.automation exist', () => {
      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      expect(steps[cleaveIdx].condition(ctx)).toBeTruthy();
    });

    it('returns false when setSecondaryTargetModal is missing', () => {
      const ctx = makeCtx({
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      expect(steps[cleaveIdx].condition(ctx)).toBeFalsy();
    });

    it('returns false when attack.name is missing', () => {
      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: {},
        playerStats: { automation: { actions: [] } },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      expect(steps[cleaveIdx].condition(ctx)).toBeFalsy();
    });

    it('returns false when playerStats.automation is missing', () => {
      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: {},
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      expect(steps[cleaveIdx].condition(ctx)).toBeFalsy();
    });
  });

  describe('handler', () => {
    it('returns early when lastAttack did not hit', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: false };
        return null;
      });

      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      const result = await steps[cleaveIdx].handler(ctx);

      expect(result.data).toEqual({});
    });

    it('returns early when collectWeaponMastery returns null', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true };
        return null;
      });
      collectWeaponMastery.mockReturnValue(null);

      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      const result = await steps[cleaveIdx].handler(ctx);

      expect(result.data).toEqual({});
    });

    it('returns early when mastery is not Cleave', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true };
        return null;
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: [] });

      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] } },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      const result = await steps[cleaveIdx].handler(ctx);

      expect(result.data).toEqual({});
    });

    it('returns early when no second targets available', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [{ name: 'Orc' }],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: { automation: { actions: [] }, name: 'TestChar' },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      const result = await steps[cleaveIdx].handler(ctx);

      expect(result.data).toEqual({});
    });

    it('prompts for second target selection when targets available (no map)', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc', currentHp: 10, maxHp: 20 },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      const result = await steps[cleaveIdx].handler(ctx);

      expect(setSecondaryTargetModal).toHaveBeenCalled();
      expect(result.modal).toEqual({
        type: 'cleaveTargetSelection',
        props: expect.objectContaining({
          title: 'Cleave — Choose Second Target',
        }),
      });
      expect(result.data._cleavePending).toBe(true);
    });

    it('cleave damage formula strips numeric additions from original', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc', currentHp: 10, maxHp: 20 },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      expect(ctx._cleaveAttackInfo.damageFormula).toBe('1d12');
    });

    it('calculates second targets with map positions', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc' };
        if (propertyName === 'currentHitPoints') return 10;
        if (propertyName === 'hitPoints') return 20;
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'TestChar', position: { x: 0, y: 0 } },
          { name: 'Orc', position: { x: 0, y: 0 } },
          { name: 'Goblin', position: { x: 3, y: 0 } },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
          mapName: 'test-map',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      expect(isWithinRange).toHaveBeenCalled();
    });

    // WM-001 stale-pin inversion: player allies are no longer offered as
    // Cleave second targets (the feature attacks a second creature, not the
    // party). Players are excluded before HP resolution.
    it('excludes player allies from candidates', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc' };
        if (propertyName === 'currentHitPoints') return 15;
        if (propertyName === 'hitPoints') return 30;
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc', type: 'player' },
          { name: 'Ally', type: 'player' },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      const result = await steps[cleaveIdx].handler(ctx);

      expect(result.data).toEqual({});
      expect(setSecondaryTargetModal).not.toHaveBeenCalled();
    });

    it('resolves HP for enemy candidates', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc', currentHp: 10 },
          { name: 'Goblin', currentHp: 5 },
          { name: 'Skeleton', currentHp: 0 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      expect(setSecondaryTargetModal).toHaveBeenCalledTimes(1);
      const offered = setSecondaryTargetModal.mock.calls[0][0].targets.map((t) => t.name);
      expect(offered).toEqual(['Goblin']);
    });

    it('resolves HP for non-player creatures using creature properties', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc' },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      expect(setSecondaryTargetModal).toHaveBeenCalled();
    });

    it('stores attack info for cleave secondary attack', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc', currentHp: 10, maxHp: 20 },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const ctx = makeCtx({
        setSecondaryTargetModal: vi.fn(),
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });
      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      expect(ctx._cleaveAttackInfo.attackName).toBe('Greataxe');
      expect(ctx._cleaveAttackInfo.damageFormula).toBe('1d12');
      expect(ctx._cleaveAttackInfo.damageType).toBe('slashing');
    });

    it('handles onTargetSelected callback hitting', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc' },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const rollDamageMock = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
          abilities: [{ name: 'Strength', bonus: 3 }],
          proficiency: 3,
        },
        rollDamage: rollDamageMock,
      });

      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      // Trigger the callback
      const onTargetSelected = setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
      await onTargetSelected('Goblin');

      expect(rollDamageMock).toHaveBeenCalled();
    });

    it('handles onTargetSelected callback missing', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc' },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
          abilities: [{ name: 'Strength', bonus: 3 }],
          proficiency: 3,
        },
      });

      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      const onTargetSelected = setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
      await onTargetSelected('Goblin');
      // Should not throw even without rollDamage
    });

    it('logs ability_use for cleave hit', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc' },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const rollDamageMock = vi.fn();
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
          abilities: [{ name: 'Strength', bonus: 3 }],
          proficiency: 3,
        },
        rollDamage: rollDamageMock,
      });

      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      const onTargetSelected = setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
      await onTargetSelected('Goblin');

      expect(addEntry).toHaveBeenCalledWith(
        'test-campaign',
        expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Cleave',
          targetName: 'Goblin',
        }),
      );
    });

    it('onSkip closes the modal without consuming the latch (WM-001)', async () => {
      getRuntimeValue.mockImplementation((_characterKey, propertyName, _campaignName) => {
        if (propertyName === 'lastAttack') return { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' };
        return null;
      });
      loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Orc' },
          { name: 'Goblin', currentHp: 5, maxHp: 7 },
        ],
      });
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const setSecondaryTargetModal = vi.fn();
      const setRuntimeValue = (await import('../../../hooks/runtime/useRuntimeState.js')).setRuntimeValue;
      const ctx = makeCtx({
        setSecondaryTargetModal: setSecondaryTargetModal,
        attack: { name: 'Greataxe' },
        playerStats: {
          automation: { actions: [] },
          name: 'TestChar',
        },
      });

      const cleaveIdx = steps.map((s) => s.name).indexOf('cleaveMastery');
      await steps[cleaveIdx].handler(ctx);

      const onSkip = setSecondaryTargetModal.mock.calls[0][0].onSkip;
      onSkip();
      expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
      const latchWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === '_Cleave_UsedRound');
      expect(latchWrites).toHaveLength(0);
    });
  });
});
