// @maintained-by-ai
// Lane: WM-001 Cleave once-per-turn LATCH at the cleaveMastery step (attackRollPostDamage.js).
// This lane owns the latch wiring only — the two seams where the latch meets the step:
//   OFFER gate (handler entry): unset→offer, same-round→refuse+block-log, round-wrap→re-arm,
//   holder-scoped store (other attacker still offered — FT-082/#1036 falsifier).
//   CONSUME gate (onTargetSelected): stamps the latch exactly once on hit OR miss (honest
//   per WM-001: the bonus attack was made), campaign-keyed write bytes (#1021), double-click
//   refused with a key-symmetric fake store (#950/#1028), skip never burns (#1026 zero-applied).
// Cited, not re-pinned here:
// - Generic latch truth table (legacy number format, stale cs mirror, holder store scoping):
//   automation/common/oncePerTurn.test.js (infra owner, FT-082).
// - Modal offer bytes, _cleaveAttackInfo formula strip, map-lane 5ft/8ft gates, exact
//   rollDamage payload + ability_use log, no-callback guards: attackRollDamageSteps-cleaveMastery.test.js (step lane #1031).
// - Gridless candidate exclusion (allies/attacker/first-target/dead): owned here (t5), consulted by #1031.
// Old->new: offer-unset + latch-refuse + re-arm -> t1 truth-table (added different-holder leg);
// consume-stamp + miss-consumes -> t2 hit/miss legs (added exact write bytes + RNG pin);
// double-click -> t3 (added single-stamp + modal-closed pins, holder-keyed store);
// skip -> t4 (added observable re-offer); gridless candidates -> t5 verbatim.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (module-graph stubs so attackRollPostDamage.js loads; only
//    latch-lane behaviors asserted. oncePerTurn.js stays REAL — the latch
//    contract under test flows through it.) ─────────────────────────

// Deterministic dice stub (#1026): any formula rolls a flat 6.
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
const LATCH_KEY = '_Cleave_UsedRound';

// Latch lives on the HOLDER's own store ('TestChar') — faithful to
// checkOncePerTurn's read getRuntimeValue(characterName, key).
function stubRuntime(latch) {
  getRuntimeValue.mockImplementation((characterKey, propertyName) => {
    if (propertyName === 'lastAttack') return LAST_ATTACK;
    if (propertyName === LATCH_KEY && characterKey === 'TestChar') return latch;
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

const latchWrites = () => setRuntimeValue.mock.calls.filter((c) => c[1] === LATCH_KEY);

// RNG pinned (#872): d20 = floor(0.5*20)+1 = 11, bonus STR 5 + prof 6 = 11,
// total 22 — hits AC 12, misses AC 40.
function pinRng() {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
}

// ── Tests ──────────────────────────────────────────────────────────

describe('cleaveMastery latch — WM-001 once-per-turn wiring', () => {
  let step;

  beforeEach(() => {
    vi.resetAllMocks();
    step = buildCleaveMasteryStep();
    getCombatContext.mockResolvedValue({ creatures: [], round: 1 });
    loadCombatSummary.mockResolvedValue(csEnemyBoard);
    stubRuntime(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offer gate truth table: unset offers, same-round refuses, round-wrap re-arms, other holder is offered', async () => {
    const legs = [
      ['latch unset — offers', () => stubRuntime(null), (ctx, result) => {
        expect(result.data._cleavePending).toBe(true);
        expect(ctx.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
      }],
      ['latched round 1 at round 1 — refuses, logs blocked, zero writes', () => stubRuntime({ round: 1, activeCreature: 'TestChar' }), (ctx, result) => {
        expect(result.data).toEqual({});
        expect(ctx.setSecondaryTargetModal).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({ type: 'automation blocked', abilityName: 'Cleave' }),
        );
        expect(latchWrites()).toHaveLength(0);
      }],
      ['latched round 1 at round 2 — re-arms and offers', () => {
        stubRuntime({ round: 1, activeCreature: 'TestChar' });
        getCombatContext.mockResolvedValue({ creatures: [], round: 2 });
      }, (ctx, result) => {
        expect(result.data._cleavePending).toBe(true);
        expect(ctx.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
      }],
      ['TestChar latched, attacker OtherChar — holder-scoped store offers (#1036 falsifier)', () => {
        stubRuntime({ round: 1, activeCreature: 'TestChar' });
      }, (ctx, result) => {
        expect(result.data._cleavePending).toBe(true);
        expect(ctx.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
      }],
    ];

    for (const [label, setup, assertions] of legs) {
      setup();
      const isOtherHolder = label.includes('OtherChar');
      const ctx = isOtherHolder
        ? makeCtx({ playerStats: { name: 'OtherChar', abilities: [{ name: 'Strength', bonus: 5 }], automation: { actions: [], passives: [] }, proficiency: 6 } })
        : makeCtx();
      addEntry.mockClear();
      setRuntimeValue.mockClear();
      const result = await step.handler(ctx);
      try {
        assertions(ctx, result);
      } catch (e) {
        throw new Error(`${label}: ${e.message}`);
      }
    }
  });

  it('consume gate: selecting burns the latch exactly once — hit or miss — with holder-keyed campaign-scoped stamp bytes', async () => {
    pinRng();

    // Hit leg (AC 12, pinned total 22). AC lookups run through getCombatContext.
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'Bandit 2', ac: 12 }], round: 1 });
    const hitCtx = makeCtx();
    await step.handler(hitCtx);
    await hitCtx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Bandit 2');

    expect(hitCtx.rollDamage).toHaveBeenCalledTimes(1);
    expect(hitCtx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    expect(latchWrites()).toEqual([['TestChar', LATCH_KEY, { round: 1, activeCreature: 'TestChar' }, 'test-campaign']]);
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'roll', rollType: 'attack', name: 'Greataxe (Cleave)', targetName: 'Bandit 2', hit: true }),
    );

    // Miss leg (AC 40, pinned total 22) — miss honestly burns the latch:
    // WM-001 consumes on the attack being made, not on damage landing.
    setRuntimeValue.mockClear();
    addEntry.mockClear();
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'IronGolem', ac: 40 }], round: 1 });
    loadCombatSummary.mockResolvedValue({
      creatures: [
        { name: 'Bandit 1', type: 'npc', ac: 12, currentHp: 7 },
        { name: 'IronGolem', type: 'npc', ac: 40, currentHp: 20 },
      ],
    });
    const missCtx = makeCtx();
    await step.handler(missCtx);
    await missCtx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('IronGolem');

    expect(missCtx.rollDamage).toHaveBeenCalledTimes(1);
    expect(missCtx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    expect(latchWrites()).toHaveLength(1);
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'roll', rollType: 'attack', name: 'Greataxe (Cleave)', targetName: 'IronGolem', hit: false }),
    );
  });

  it('double-click on Attack does not fire a second cleave — latch guard with key-symmetric store (#950/#1028)', async () => {
    const store = {};
    getRuntimeValue.mockImplementation((characterKey, propertyName) => store[`${characterKey}:${propertyName}`] ?? (propertyName === 'lastAttack' ? LAST_ATTACK : null));
    setRuntimeValue.mockImplementation((characterKey, propertyName, value) => {
      store[`${characterKey}:${propertyName}`] = value;
      return Promise.resolve({});
    });

    const ctx = makeCtx();
    await step.handler(ctx);
    const onTargetSelected = ctx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;

    await onTargetSelected('Bandit 2');
    expect(ctx.rollDamage).toHaveBeenCalledTimes(1);

    ctx.rollDamage.mockClear();
    addEntry.mockClear();
    await onTargetSelected('Bandit 2');

    expect(ctx.rollDamage).not.toHaveBeenCalled();
    expect(latchWrites()).toHaveLength(1); // stamped once, never re-written on refusal
    expect(ctx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null); // refusal dismisses the modal
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({ type: 'automation blocked', abilityName: 'Cleave' }),
    );
  });

  it('skip closes the modal without burning the latch and a later hit is offered again', async () => {
    const ctx = makeCtx();
    await step.handler(ctx);
    ctx.setSecondaryTargetModal.mock.calls[0][0].onSkip();

    expect(ctx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    expect(latchWrites()).toHaveLength(0);

    const result = await step.handler(ctx);
    expect(result.data._cleavePending).toBe(true);
  });

  it('gridless candidates exclude allies, first target, attacker and dead', async () => {
    const ctx = makeCtx();
    await step.handler(ctx);

    const offered = ctx.setSecondaryTargetModal.mock.calls[0][0].targets.map((t) => t.name);
    expect(offered).toEqual(['Bandit 2']);
  });
});
