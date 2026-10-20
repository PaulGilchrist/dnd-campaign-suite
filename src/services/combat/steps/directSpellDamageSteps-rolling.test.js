// @maintained-by-ai
// Rolling lane — directSpellDamageSteps.js steps[2] spellRollDamage (direct-spell path).
// Contract (source :122-151): dispatch EXACTLY ONE roller on ctx.formula, passed verbatim
// (#1019): overchannelActive → rollExpressionMaximized even when isCrit is also set
// (near-miss #1044); else isCrit → rollExpressionDoubled; else → rollExpression.
// Roller null → step returns null (:133) — no fallback formula, no throw, no state write.
// Output is pure passthrough: { data: { formula, total, rolls, modifier } } — the
// rollers' doubledRolls/maximized extras must NOT leak (exact full-result toEqual
// #829/#1007; rolls==reported pin #1027: crit reports base rolls, not doubledRolls).
// This IS the rolling lane of the family: faithful ROLL_TABLE hand-derived ONCE (#815/
// #1032/#841), never a formula-re-parsing oracle (#710); distinguishable bytes #1022;
// mutually-exclusive roller spies with not.toHaveBeenCalled discriminators #1032.
//
// Math hand-derived once, written literally in the assertions (never re-derived in mocks):
//   normal   '2d6+3': 2+5=7, +3 mod -> total 10
//   crit     '4d6'  : 1+6+2+5=14 dice -> doubled 28, modifier 0; reported rolls = base dice
//   overchan. '8d6'  : maximized 8x6 -> total 48 (all-dice-max by RAW definition)
//
// Radiant Soul once-per-turn stamp also lives at idx 2 (:136-146) but its stamp/latch
// falsifiers are OWNED by directSpellDamageSteps-radiantSoul.test.js (#1045 applied rec
// "cut any latch dupes citing it, keep roll-math yours"). No fixture here carries a
// radiant_soul passive, so setRuntimeValue throws — any stamp attempt is a loud lane
// violation (#1043/#1044 sentinel convention).
//
// directSpellDamageSteps family idx map (same module, other seams):
//   0 spellHousekeeping / 1 spellContext       → context #1043 + cla120 #1042 + radiantSoul #1045
//   2 spellRollDamage                            → THIS FILE (roll dispatch, crit/overchannel/null)
//   3 spellFeatureRiders                         → riders #1046 ("this lane never rolls")
//   4 spellOverchannel / 5 spellProceedToDamage→ overchannel #1044 (different dice: self-damage d12s)
//   names/subscribe/emit chain (incl. idx-2 'spell:formulas'→'spell:rolled') → structure lane
//
// old -> new map (8 tests -> 3 it.each blocks / 11 discriminating rows):
//   condition trio (:101-114)                    -> truth table (5 rows; both-arms-true folded,
//     same shape as #1043 condition fold; '' falsy + missing-attack optional-chain falsifiers #940)
//   normal-roll pair (:118-147)                  -> dispatch row 1 (exact toEqual replaces
//     expect.any(Number) range-only checks #872/#973; formula verbatim passthrough)
//   crit (:151-160)                              -> dispatch row 2 (exact bytes + exclusivity)
//   overchannel pair (:164-185)                  -> dispatch rows 3-4 (near-miss maximizer
//     beats crit #1044; doubled/maximized/normal mutually-not-called #1032)
//   null (:189-196)                              -> null truth table (2 rows: '0' context-fallback
//     formula + undefined pinning verbatim handoff, no default injection)
// Dead-mock purge #1032: proceedWithDamage and the featureModules getter-ref were never
// reached by idx 2; logService now throws (logs belong to overchannel #1044).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';

// Faithful roller shapes match diceRoller.js returns (#1032): normal {total,rolls,modifier},
// doubled adds doubledRolls, maximized adds maximized:true. Hand-written entries only;
// unknown formulas return null via ?? null so any un-tabled roll fails loudly (#815).
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({
    '2d6+3': { total: 10, rolls: [2, 5], modifier: 3 },
  })[formula] ?? null),
  rollExpressionDoubled: vi.fn((formula) => ({
    '4d6': { total: 28, rolls: [1, 6, 2, 5], doubledRolls: [1, 6, 2, 5, 1, 6, 2, 5], modifier: 0 },
  })[formula] ?? null),
  rollExpressionMaximized: vi.fn((formula) => ({
    '8d6': { total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0, maximized: true },
  })[formula] ?? null),
}));

// Read by spellContext (idx 1) only — import-stability stubs (#1046 VERBATIM shape).
vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

// idx 2 never logs — log legs owned by the overchannel lane (#1044 sentinel).
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => { throw new Error('spellRollDamage must not log — log legs owned by directSpellDamageSteps-overchannel.test.js'); }),
}));

// Latch writes owned by radiantSoul #1045; idx 2 stamps only with a radiant_soul passive,
// which no fixture here carries — a write is therefore a lane violation (#1043 sentinel).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => { throw new Error('spellRollDamage latch stamp owned by directSpellDamageSteps-radiantSoul.test.js (#1045)'); }),
}));
vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

// Never read by idx 2 — riders #1046 owns featureModules dispatch.
vi.mock('./features/index.js', () => ({ featureModules: [] }));

const { rollExpression, rollExpressionDoubled, rollExpressionMaximized } = await import('../../dice/diceRoller.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: { name: 'TestWizard', automation: {} },
    campaignName: 'test-campaign',
    ...overrides,
  };
}

describe('buildDirectSpellDamageSteps — steps[2] spellRollDamage', () => {
  let steps;
  let step;

  beforeEach(() => {
    vi.clearAllMocks();
    steps = buildDirectSpellDamageSteps();
    step = steps[2];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { label: 'attack.damage arm', ctx: { attack: { damage: '1d6' } }, expected: true },
    { label: 'autoFormulaOverride arm alone', ctx: { attack: {}, autoFormulaOverride: '2d4' }, expected: true },
    { label: 'neither arm', ctx: { attack: {} }, expected: false },
    { label: "empty-string near-miss ('' is falsy on both arms)", ctx: { attack: { damage: '' }, autoFormulaOverride: '' }, expected: false },
    { label: 'missing attack (optional chain)', ctx: { attack: undefined }, expected: false },
  ])('condition $label → $expected', ({ ctx, expected }) => {
    expect(step.condition(makeCtx(ctx))).toBe(expected);
  });

  it.each([
    {
      label: 'normal roll (no crit, no overchannel)',
      ctx: { attack: { damage: '2d6+3' }, formula: '2d6+3' },
      roller: 'rollExpression',
      expected: { data: { formula: '2d6+3', total: 10, rolls: [2, 5], modifier: 3 } },
    },
    {
      label: 'crit doubles — reports BASE rolls, doubledRolls never leaks',
      ctx: { attack: { damage: '4d6' }, formula: '4d6', isCrit: true },
      roller: 'rollExpressionDoubled',
      expected: { data: { formula: '4d6', total: 28, rolls: [1, 6, 2, 5], modifier: 0 } },
    },
    {
      label: 'overchannel maximizes',
      ctx: { attack: { damage: '8d6' }, formula: '8d6', overchannelActive: true },
      roller: 'rollExpressionMaximized',
      expected: { data: { formula: '8d6', total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 } },
    },
    {
      label: 'near-miss: overchannel wins over crit (#1044)',
      ctx: { attack: { damage: '8d6' }, formula: '8d6', overchannelActive: true, isCrit: true },
      roller: 'rollExpressionMaximized',
      expected: { data: { formula: '8d6', total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 } },
    },
  ])('handler $label — exactly one roller, exact full result (#1032/#829)', async ({ ctx, roller, expected }) => {
    const rollers = {
      rollExpression,
      rollExpressionDoubled,
      rollExpressionMaximized,
    };
    const result = await step.handler(makeCtx(ctx));
    expect(rollers[roller]).toHaveBeenCalledWith(ctx.formula);
    for (const [name, fn] of Object.entries(rollers)) {
      if (name !== roller) expect(fn).not.toHaveBeenCalled();
    }
    expect(result).toEqual(expected);
  });

  it.each([
    { label: "'0' fallback formula", formula: '0' },
    { label: 'undefined formula (no default injected)', formula: undefined },
  ])('handler returns null when the roller returns null ($label)', async ({ formula }) => {
    const result = await step.handler(makeCtx({ attack: { damage: formula }, formula }));
    expect(rollExpression).toHaveBeenCalledWith(formula);
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollExpressionMaximized).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
