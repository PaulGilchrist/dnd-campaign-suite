// WM-001: Cleave once-per-turn latch, modal dismissal and enemy-only candidates.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (mirrors folder step-test mock shapes) ─────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [], round: 1 }),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve({})),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn(() => ({ baseMastery: 'Cleave', extraMasteries: [] })),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

vi.mock('../../automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn(() => true),
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'p', promise: Promise.resolve({ success: true }) })),
}));

vi.mock('../../combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

const { buildCleaveMasteryStep } = await import('./attackRollPostDamage.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { getCombatContext } = await import('../../rules/combat/damageUtils.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');

// ── Helpers ────────────────────────────────────────────────────────

const LAST_ATTACK = { hit: true, targetName: 'Bandit 1', attackName: 'Greataxe', damageFormula: '1d12+5', damageType: 'Slashing' };

function stubRuntime(latch) {
  getRuntimeValue.mockImplementation((characterKey, propertyName) => {
    if (propertyName === 'lastAttack') return LAST_ATTACK;
    if (propertyName === '_Cleave_UsedRound' && characterKey === 'TestChar') return latch;
    return null;
  });
}

function makeCtx(overrides = {}) {
  return {
    attack: { name: 'Greataxe' },
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Strength', bonus: 5 }],
      automation: { actions: [], passives: [] },
      proficiency: 6,
    },
    campaignName: 'test-campaign',
    rollDamage: vi.fn(),
    setSecondaryTargetModal: vi.fn(),
    ...overrides,
  };
}

const csEnemyBoard = {
  creatures: [
    { name: 'TestChar', type: 'player', currentHp: 165 },
    { name: 'Bandit 1', type: 'npc', ac: 12, currentHp: 7 },
    { name: 'Bandit 2', type: 'npc', ac: 12, currentHp: 11 },
    { name: 'ElderPaladin', type: 'player', currentHp: 224 },
    { name: 'Skeleton', type: 'npc', ac: 12, currentHp: 0 },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────

describe('cleaveMastery step — WM-001 once-per-turn / dismissal / candidates', () => {
  let step;

  beforeEach(() => {
    vi.resetAllMocks();
    step = buildCleaveMasteryStep();
    getCombatContext.mockResolvedValue({ creatures: [], round: 1 });
    loadCombatSummary.mockResolvedValue(csEnemyBoard);
    stubRuntime(null);
  });

  it('offers cleave modal when the latch is unset', async () => {
    const ctx = makeCtx();
    const result = await step.handler(ctx);

    expect(result.data._cleavePending).toBe(true);
    expect(ctx.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-offer once latched the same round and logs automation blocked', async () => {
    stubRuntime({ round: 1, activeCreature: 'TestChar' });
    const ctx = makeCtx();
    const result = await step.handler(ctx);

    expect(ctx.setSecondaryTargetModal).not.toHaveBeenCalled();
    expect(result.data).toEqual({});
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'automation blocked', abilityName: 'Cleave' }),
    );
  });

  it('re-arms on a fresh round', async () => {
    stubRuntime({ round: 1, activeCreature: 'TestChar' });
    getCombatContext.mockResolvedValue({ creatures: [], round: 2 });
    const ctx = makeCtx();
    const result = await step.handler(ctx);

    expect(result.data._cleavePending).toBe(true);
    expect(ctx.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
  });

  it('marks the latch, closes the modal and logs the cleave roll when Attack resolves', async () => {
    const ctx = makeCtx();
    await step.handler(ctx);

    const onTargetSelected = ctx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
    await onTargetSelected('Bandit 2');

    const latchWrite = setRuntimeValue.mock.calls.find((c) => c[1] === '_Cleave_UsedRound');
    expect(latchWrite).toBeTruthy();
    expect(latchWrite[2]).toEqual({ round: 1, activeCreature: 'TestChar' });
    expect(ctx.rollDamage).toHaveBeenCalledTimes(1);
    expect(ctx.rollDamage.mock.calls[0][0].modifier).toBe(0);
    expect(ctx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'roll', rollType: 'attack', name: 'Greataxe (Cleave)', targetName: 'Bandit 2' }),
    );
  });

  it('double-click on Attack does not fire a second cleave (latch guard)', async () => {
    const store = {};
    getRuntimeValue.mockImplementation((characterKey, propertyName) => {
      if (propertyName === 'lastAttack') return LAST_ATTACK;
      return store[propertyName] ?? null;
    });
    setRuntimeValue.mockImplementation((characterKey, propertyName, value) => {
      store[propertyName] = value;
      return Promise.resolve({});
    });

    const ctx = makeCtx();
    await step.handler(ctx);
    const onTargetSelected = ctx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;

    await onTargetSelected('Bandit 2');
    ctx.rollDamage.mockClear();
    await onTargetSelected('Bandit 2');

    expect(ctx.rollDamage).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'automation blocked', abilityName: 'Cleave' }),
    );
  });

  it('skip closes the modal and does NOT consume the latch', async () => {
    const ctx = makeCtx();
    await step.handler(ctx);
    const onSkip = ctx.setSecondaryTargetModal.mock.calls[0][0].onSkip;

    onSkip();

    expect(ctx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    expect(setRuntimeValue.mock.calls.filter((c) => c[1] === '_Cleave_UsedRound')).toHaveLength(0);
  });

  it('gridless candidates exclude allies, first target, attacker and dead', async () => {
    const ctx = makeCtx();
    await step.handler(ctx);

    const offered = ctx.setSecondaryTargetModal.mock.calls[0][0].targets.map((t) => t.name);
    expect(offered).toEqual(['Bandit 2']);
  });

  it('miss still consumes the latch once and closes the modal', async () => {
    loadCombatSummary.mockResolvedValue({
      creatures: [{ name: 'Bandit 1', type: 'npc', ac: 12, currentHp: 7 }, { name: 'IronGolem', type: 'npc', ac: 40, currentHp: 20 }],
    });
    const ctx = makeCtx();
    await step.handler(ctx);
    const onTargetSelected = ctx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;

    await onTargetSelected('IronGolem');

    expect(setRuntimeValue.mock.calls.some((c) => c[1] === '_Cleave_UsedRound')).toBe(true);
    expect(ctx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    const rollLog = addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.rollType === 'attack' && /Cleave/.test(e.name || ''));
    expect(rollLog).toBeTruthy();
  });
});
