// @maintained-by-ai
// Lane: cleaveMastery step ASSEMBLED via buildAttackRollDamageSteps() (attackRollDamageSteps.js:29).
// Cleave Mastery (2024 feat): on a hit you may make ONE extra weapon attack against a
// SECOND creature — weapon dice only, ability modifier stripped from damage.
// Family map — cited, not re-pinned here:
// - Structure (name / subscribe 'cleave:check' / emit 'cleave:done' / indices): attackRollDamageSteps.test.js structure lane.
// - WM-001 once-per-turn latch offer/block/re-arm, double-click guard, onSkip dismissal,
//   gridless candidate exclusion (allies/attacker/first-target/dead), miss consumes latch:
//   attackRollPostDamage.cleaveOncePerTurn.test.js (owner).
// - Mastery collection + weapon-KIND gate (#969/#970): collectWeaponMastery is a boundary
//   here (passives-module lanes own its collection/kind-gate semantics).
// This lane owns: condition arms, handler guard arms with zero-write pins, modal offer
// shape + _cleaveAttackInfo (formula strip), map adjacency gate (5 ft of first / 8 ft
// reach), and the resolve contract — rollDamage receives the stripped weapon-dice formula
// with modifier 0 (no ability bonus on cleave damage), exact log entry, no-callback guards.
// Old->new: condition x4 -> t1; early-return guards x4 -> t2; prompt + strip + attack-info
// x3 -> t3; map positions -> t4; callback-hit + ability_use log -> t5; callback-missing
// -> t6; ally-exclusion / enemy-HP-resolution / onSkip: REMOVED (owned by cleaveOncePerTurn
// sibling lane, verbatim overlap — strongest version kept there).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (module-graph stubs for the assembled pipeline; only cleave-lane
//    behaviors below are asserted) ────────────────────────────────

// Deterministic dice stub (#1026 convention: mid roll = floor(sides/2)+1):
// 1d12 -> rolls [7] total 7; doubled doubles the total; maximized = count*sides.
vi.mock('../../dice/diceRoller.js', () => {
  const parse = (formula) => {
    const base = formula ? formula.replace(/\s*\[.*?\]\s*/g, '').trim() : '';
    const m = base.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) return null;
    return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10), mod: m[3] ? parseInt(m[3], 10) : 0 };
  };
  const mid = (d) => Array(d.count).fill(Math.floor(d.sides / 2) + 1);
  const fallback = (total) => ({ total, rolls: [total], modifier: 0 });
  return {
    rollExpression: vi.fn((formula) => {
      if (!formula || formula === '0') return null;
      const d = parse(formula);
      if (!d) return fallback(6);
      const rolls = mid(d);
      return { total: rolls.reduce((s, r) => s + r, 0) + d.mod, rolls, modifier: d.mod };
    }),
    rollExpressionDoubled: vi.fn((formula) => {
      if (!formula || formula === '0') return null;
      const d = parse(formula);
      if (!d) return fallback(12);
      const rolls = mid(d);
      return { total: rolls.reduce((s, r) => s + r, 0) * 2 + d.mod, rolls, doubledRolls: rolls.concat(rolls), modifier: d.mod };
    }),
    rollExpressionMaximized: vi.fn((formula) => {
      if (!formula) return null;
      const d = parse(formula);
      if (!d) return fallback(12);
      return { total: d.count * d.sides + d.mod, rolls: Array(d.count).fill(d.sides), modifier: d.mod, maximized: true };
    }),
  };
});

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve({})),
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
  isWithinRange: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { getCombatContext } = await import('../../rules/combat/damageUtils.js');
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

// Campaign-keyed runtime stub (#1029): lastAttack + optional latch on the
// holder's own store. checkOncePerTurn (real module, unmocked) reads the
// latch via getRuntimeValue(holder, '_Cleave_UsedRound').
function stubRuntime(lastAttack = { hit: true }, latch = null) {
  getRuntimeValue.mockImplementation((characterKey, propertyName) => {
    if (propertyName === 'lastAttack') return lastAttack;
    if (propertyName === '_Cleave_UsedRound' && characterKey === 'TestChar') return latch;
    return null;
  });
}

const HIT_ON_ORC = {
  hit: true,
  targetName: 'Orc',
  attackName: 'Greataxe',
  damageFormula: '1d12+4',
  damageType: 'slashing',
};

function boardWithGoblin() {
  return {
    creatures: [
      { name: 'Orc', currentHp: 8 },
      { name: 'Goblin', currentHp: 5, maxHp: 7 },
    ],
  };
}

function cleaveStep(steps) {
  return steps.find((s) => s.name === 'cleaveMastery');
}

// ── Tests ────────────────────────────────────────────────────────

describe('cleaveMastery step (assembled)', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    getCombatContext.mockResolvedValue({ creatures: [], round: 1 });
    loadCombatSummary.mockResolvedValue({ creatures: [] });
    stubRuntime();
    steps = buildAttackRollDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition: armed only with secondary-target UI, a named attack, and automation', () => {
    const step = cleaveStep(steps);
    const arms = [
      ['all present', makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' } }), true],
      ['no setSecondaryTargetModal', makeCtx({ attack: { name: 'Greataxe' } }), false],
      ['attack.name missing', makeCtx({ setSecondaryTargetModal: vi.fn(), attack: {} }), false],
      ['playerStats.automation missing', makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' }, playerStats: { name: 'TestChar' } }), false],
    ];
    for (const [label, ctx, expected] of arms) {
      expect(step.condition(ctx) ? true : false, label).toBe(expected);
    }
  });

  it('refuses to offer cleave on every guard miss — data {} and zero writes/stamps', async () => {
    const step = cleaveStep(steps);
    const legs = [
      ['lastAttack missed', () => {
        stubRuntime({ hit: false, targetName: 'Orc', attackName: 'Greataxe' });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave' });
      }],
      ['collectWeaponMastery returns null', () => {
        stubRuntime(HIT_ON_ORC);
        collectWeaponMastery.mockReturnValue(null);
      }],
      ['Cleave absent from base+extra list', () => {
        stubRuntime(HIT_ON_ORC);
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: ['Graze'] });
      }],
      ['Cleave present but no live second creature', () => {
        stubRuntime(HIT_ON_ORC);
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Orc', currentHp: 8 }, { name: 'Skeleton', currentHp: 0 }] });
      }],
    ];

    for (const [label, setup] of legs) {
      setup();
      const ctx = makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' } });
      addEntry.mockClear();
      setRuntimeValue.mockClear();
      const result = await step.handler(ctx);
      expect(result.data, label).toEqual({});
      expect(ctx.setSecondaryTargetModal, label).not.toHaveBeenCalled();
      expect(addEntry, label).not.toHaveBeenCalled();
      expect(setRuntimeValue.mock.calls.filter((c) => c[1] === '_Cleave_UsedRound'), label).toHaveLength(0);
    }
  });

  it('offers the Cleave picker when Cleave is in extraMasteries — exact modal and attack info with ability bonus stripped', async () => {
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: ['Cleave'] });
    loadCombatSummary.mockResolvedValue(boardWithGoblin());

    const ctx = makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' } });
    const result = await cleaveStep(steps).handler(ctx);

    expect(result).toEqual({
      data: { _cleavePending: true },
      modal: {
        type: 'cleaveTargetSelection',
        props: {
          title: 'Cleave — Choose Second Target',
          targets: [{ name: 'Goblin', currentHp: 5, maxHp: 7 }],
        },
      },
    });
    expect(ctx._cleaveAttackInfo).toEqual({
      attackName: 'Greataxe',
      damageFormula: '1d12',
      damageType: 'slashing',
      lastTargetName: 'Orc',
    });
    expect(ctx.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
    expect(ctx.setSecondaryTargetModal.mock.calls[0][0]).toEqual(expect.objectContaining({
      title: 'Cleave — Choose Second Target',
      targets: [{ name: 'Goblin', currentHp: 5, maxHp: 7 }],
      onTargetSelected: expect.any(Function),
      onSkip: expect.any(Function),
    }));
  });

  it('map lane: gates candidates by 5 ft of first target and 8 ft reach; missing damageType falls back to same_as_weapon', async () => {
    stubRuntime({ hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4' });
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });
    loadCombatSummary.mockResolvedValue({
      creatures: [
        { name: 'Orc', position: { x: 0, y: 0 }, currentHp: 8 },
        { name: 'Goblin', position: { x: 3, y: 0 }, currentHp: 5, maxHp: 7 },
        { name: 'Kobold', position: { x: 30, y: 0 }, currentHp: 9 },
      ],
    });
    isWithinRange.mockImplementation((_a, b) => Promise.resolve(b === 'Goblin'));

    const ctx = makeCtx({
      setSecondaryTargetModal: vi.fn(),
      attack: { name: 'Greataxe' },
      playerStats: { name: 'TestChar', abilities: [{ name: 'Strength', bonus: 3 }], automation: { actions: [], passives: [] }, proficiency: 3, mapName: 'test-map' },
    });
    await cleaveStep(steps).handler(ctx);

    expect(isWithinRange).toHaveBeenCalledWith('Orc', 'Goblin', 5);
    expect(isWithinRange).toHaveBeenCalledWith('TestChar', 'Goblin', 8);
    expect(ctx.setSecondaryTargetModal.mock.calls[0][0].targets).toEqual([
      { name: 'Goblin', position: { x: 3, y: 0 }, currentHp: 5, maxHp: 7 },
    ]);
    expect(ctx._cleaveAttackInfo.damageType).toBe('same_as_weapon');
  });

  it('selecting a target resolves with stripped weapon dice only — no ability modifier, exact rollDamage payload and log', async () => {
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });
    loadCombatSummary.mockResolvedValue(boardWithGoblin());
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', ac: 12 }], round: 1 });
    // Pin RNG: d20 = floor(0.5*20)+1 = 11; bonus = STR 3 + prof 3 = 6; 17 >= AC 12 hit.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const rollDamage = vi.fn();
    const ctx = makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' }, rollDamage });
    await cleaveStep(steps).handler(ctx);

    await ctx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin');

    expect(rollDamage).toHaveBeenCalledTimes(1);
    expect(rollDamage).toHaveBeenCalledWith({
      name: 'Greataxe (Cleave)',
      formula: '1d12',
      total: 7,
      rolls: [7],
      modifier: 0,
      context: { targetName: 'Goblin', damageType: 'slashing', attackerName: 'TestChar' },
    });
    expect(ctx.setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    const abilityLog = addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.type === 'ability_use');
    expect(abilityLog).toEqual(expect.objectContaining({
      characterName: 'TestChar',
      abilityName: 'Cleave',
      targetName: 'Goblin',
      description: 'TestChar used Cleave on Greataxe against Goblin',
    }));
  });

  it('resolution guards: a selection with no rollDamage capability or no target consumes nothing', async () => {
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });
    loadCombatSummary.mockResolvedValue(boardWithGoblin());

    // Leg A: ctx without rollDamage — selection is a silent no-op.
    const ctxNoRoll = makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' } });
    await cleaveStep(steps).handler(ctxNoRoll);
    addEntry.mockClear();
    setRuntimeValue.mockClear();
    await ctxNoRoll.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin');
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue.mock.calls.filter((c) => c[1] === '_Cleave_UsedRound')).toHaveLength(0);

    // Leg B: empty selection name is a no-op even with rollDamage armed.
    const rollDamage = vi.fn();
    const ctx = makeCtx({ setSecondaryTargetModal: vi.fn(), attack: { name: 'Greataxe' }, rollDamage });
    await cleaveStep(steps).handler(ctx);
    addEntry.mockClear();
    setRuntimeValue.mockClear();
    await ctx.setSecondaryTargetModal.mock.calls[0][0].onTargetSelected(null);
    expect(rollDamage).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue.mock.calls.filter((c) => c[1] === '_Cleave_UsedRound')).toHaveLength(0);
  });
});
