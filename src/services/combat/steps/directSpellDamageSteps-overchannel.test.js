// @maintained-by-ai
// spellOverchannel + spellProceedToDamage lane — directSpellDamageSteps.js steps[4]/[5].
// spellOverchannel ROLLS plain dice (self-damage, CLA-244 RAW: dicePerLevel =
// max(2, useCount), totalDice = dicePerLevel x spellLevel — source :197-199) and
// logs the Necrotic self-hit. FIX #1044 no-free-ride: cost-roll null REFUSES the
// metamagic — console.error + overchannel_refused log (§5 refusal convention, a skip
// MUST log) + base-bytes handoff (crit-aware re-roll matching spellRollDamage's
// no-overchannel dispatcher :152), never the old silent {data:{}} pass-through that
// delivered the maximized total uncosted. Double-failure resolves null (fix#69
// null = pipeline ABORT — nothing honest to hand downstream). It must never call the
// maximizer or write runtime state (no latch here — zero-applied-must-not-burn
// #950/#1026; the escalating overchannelUseCount is owned upstream by
// computeOverchannel): the maximizer throws a lane sentinel (#1043 VERBATIM, per
// #1042 dedupe-guard owner); the doubled roller answers ONLY the crit-refusal table
// and throws on every other formula (#1044 crit-strip is legal here, all else is
// the rolling lane's).
//
// directSpellDamageSteps family map (same module, other seams):
//   directSpellDamageSteps-structure.test.js                   step count/names/subscribe-emit chain (incl. 'spellOverchannel'/'spellProceedToDamage' index)
//   directSpellDamageSteps-context.test.js                   spellContext formula assembly (#1043 exemplar)
//   directSpellDamageSteps-cla120-empowered-evocation.test.js CLA-120 pre-baked '[EE]' dedupe guard
//   directSpellDamageSteps-radiantSoul.test.js               CLA-279 '[Radiant Soul]' append + consumption latch
//   directSpellDamageSteps-rolling.test.js                   spellRollDamage roll dispatch (overchannel MAXIMIZES the spell dice there — different step, different dice)
//   directSpellDamageSteps-riders.test.js                    spellFeatureRiders featureModules dispatch
//   THIS FILE                                                spellOverchannel self-damage roll/log + spellProceedToDamage handoff
//
// Math hand-derived ONCE (#815/#710, never re-derived from the mock):
//   (useCount 2, level 1): max(2,2)=2 -> 2x1=2 -> '2d12'; table rolls [3,6] -> 9
//   (useCount 3, level 2): max(2,3)=3 -> 3x2=6 -> '6d12'; rolls 11+2+9+4+12+7 -> 45
//   (3,2)->6 falsifies 2*level ('4d12') and max+level ('5d12' shape) — the dropped
//   old (2,2)->'4d12' / (3,3)->'9d12' rows add no discriminating power (#1043 fold).
//   #1044 refusal rows: spellLevel undefined -> totalDice NaN -> cost 'NaNd12' misses
//   the table (null). Base '8d6' [5,4,3,6,2,1,6,3] -> 5+4+3+6+2+1+6+3=30; the
//   upstream maximized byte carried in ctx.total is 8x6=48 — 30!=48 proves the strip.
//   Crit base '4d6' [5,4,3,3] -> 15, doubled 30; upstream maximized 4x6=24.
//
// old -> new map (15 tests -> 7):
//   condition x6 (:102-147)                      -> 1 truth-table it: boundary 1-false/2-true near-miss (#943/#986); undefined->false honest NaN coercion (#940); active-false leg; useCount 0 folded into 1 (same `> 1` numeric comparison — carried rec #1043)
//   formula x3 (:151-189)                        -> handler table rows 1-2 (exact '2d12'/'6d12', exact full log entry #829/#1007, distinguishable bytes #1022, campaign-keyed #1021)
//   log-object (:191-214) + name (:216-228)    -> handler table row 2 (Elminster exact bytes kept)
//   null-name (:230-242)                         -> kept as its own falsifier row (#948)
//   addEntry reject (:244-254)                   -> kept + console.error pin (.catch is not silent)
//   roll-null (:256-267)                         -> RETIRED by fix#1044 free-ride fix: old pin
//     asserted the defect ('still resolving { data: {} }', addEntry never called). Replaced by
//     refusal battery: plain-strip row (exact refusal log + stripped base bytes + console.error),
//     crit-strip row (doubled dispatcher, single-set rolls), double-failure abort row (null).
//   proceed condition x5 (:283-307)             -> 1 truth-table it ('!= null': 0-true pins loose-null leniency #940, '1d6'-true vs undefined/null-false; number 10 folded into string leg)
//   proceed handler x2 (:311-340)               -> 1 it (exact payload + exact result; '_done' dup subsumed)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';

// Faithful ROLL_TABLE (#1032/#1026): fixed distinguishable rolls, hand-derived totals
// written literally in the assertions — the old regex-parsing oracle is retired (#710).
// Unknown formulas return null (rolls fail). '8d6' is the #1044 non-crit refuse base
// (5+4+3+6+2+1+6+3=30). The maximizer stays a throw sentinel (rolling lane owns it);
// the doubled roller answers only the #1044 crit-refuse base '4d6' ([5,4,3,3] x2 -> 30)
// and throws on anything else — a plain roll must never be doubled here.
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const ROLL_TABLE = {
      '2d12': { total: 9, rolls: [3, 6], modifier: 0 },
      '6d12': { total: 45, rolls: [11, 2, 9, 4, 12, 7], modifier: 0 },
      '8d6': { total: 30, rolls: [5, 4, 3, 6, 2, 1, 6, 3], modifier: 0 },
    };
    return ROLL_TABLE[formula] ?? null;
  }),
  rollExpressionDoubled: vi.fn((formula) => {
    if (formula === '4d6') {
      return { total: 30, rolls: [5, 4, 3, 3], doubledRolls: [5, 4, 3, 3, 5, 4, 3, 3], modifier: 0 };
    }
    throw new Error('spellOverchannel may double only the #1044 crit-refusal base re-roll — crit lane otherwise owned by the rolling lane');
  }),
  rollExpressionMaximized: vi.fn(() => { throw new Error('spellOverchannel self-damage must not be maximized here — maximizer owned by the rolling lane'); }),
}));

// Not read by steps[4]/[5] — module-load isolation only (spellContext/riders lanes own them).
vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));
vi.mock('./features/index.js', () => ({ featureModules: [] }));
vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

// No latch in this lane: any runtime write here burns a consumption flag that does
// not belong to spellOverchannel (#950 zero-applied-must-not-burn).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => { throw new Error('spellOverchannel must not read runtime state'); }),
  setRuntimeValue: vi.fn(() => { throw new Error('spellOverchannel must not write runtime state — consumption flags owned by the rolling/radiantSoul lanes'); }),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

const { rollExpression, rollExpressionDoubled } = await import('../../dice/diceRoller.js');
const { addEntry } = await import('../../ui/logService.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: { name: 'TestWizard' },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

describe('spellOverchannel (steps[4])', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks(); // keeps factory impls; each row re-arms what it overrides
    steps = buildDirectSpellDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition: runs only when overchannelActive and useCount > 1', () => {
    // Boundary census at the `> 1` edge (#943/#986): exact-1 false, near-miss 2 true;
    // undefined honest NaN-coercion (#940); useCount 0 folded — same numeric leg (#1043).
    expect(steps[4].condition(makeCtx({ overchannelActive: true, overchannelUseCount: 2 }))).toBe(true);
    expect(steps[4].condition(makeCtx({ overchannelActive: true, overchannelUseCount: 1 }))).toBe(false);
    expect(steps[4].condition(makeCtx({ overchannelActive: true }))).toBe(false);
    expect(steps[4].condition(makeCtx({ overchannelActive: false, overchannelUseCount: 2 }))).toBe(false);
  });

  it('rolls max(2, useCount) x spellLevel d12 and logs the exact self-damage entry (CLA-244 RAW)', async () => {
    // Formula + log totals hand-derived ONCE from source :186-188 + ROLL_TABLE (#815):
    //   (2,1): max(2,2)=2, 2*1=2 -> '2d12' -> [3,6] -> 9
    //   (3,2): max(2,3)=3, 3*2=6 -> '6d12' -> 11+2+9+4+12+7=45
    const rows = [
      { useCount: 2, spellLevel: 1, name: 'TestWizard', formula: '2d12', rolls: [3, 6], total: 9 },
      { useCount: 3, spellLevel: 2, name: 'Elminster', formula: '6d12', rolls: [11, 2, 9, 4, 12, 7], total: 45 },
    ];
    for (const row of rows) {
      addEntry.mockClear();
      const ctx = makeCtx({
        overchannelActive: true,
        overchannelUseCount: row.useCount,
        overchannelSpellLevel: row.spellLevel,
        playerStats: { name: row.name },
      });
      const result = await steps[4].handler(ctx);
      expect(rollExpression).toHaveBeenCalledWith(row.formula);
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'roll',
        characterName: row.name,
        rollType: 'overchannel-damage',
        name: 'Overchannel',
        formula: row.formula,
        rolls: row.rolls,
        total: row.total,
        modifier: 0,
        damageType: 'Necrotic',
        targetName: row.name,
        finalDamage: row.total,
        note: 'Overchannel self-damage (ignores resistance/immunity)',
      });
      expect(result).toEqual({ data: {} });
    }
  });

  it('logs characterName "unknown" and targetName undefined when playerStats is missing', async () => {
    const ctx = makeCtx({
      overchannelActive: true,
      overchannelUseCount: 2,
      overchannelSpellLevel: 1,
      playerStats: null,
    });
    await steps[4].handler(ctx);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      characterName: 'unknown',
      targetName: undefined,
    }));
  });

  it('#1044 roll-null refuses the metamagic: loud console.error + §5 refusal log + stripped base bytes (never the old {data:{}} free ride)', async () => {
    // spellLevel undefined -> totalDice NaN -> cost 'NaNd12' misses the table (null).
    // ctx carries the UPSTREAM maximized bytes (8x6=48) — proof of the strip is the
    // handoff landing on the plain base 30, not 48, with overchannelActive flipped to
    // false and overchannelRefused flagged. The doubled roller would THROW here —
    // a non-crit refuse must re-roll plain.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx({
      overchannelActive: true,
      overchannelUseCount: 2,
      formula: '8d6',
      total: 48,
      rolls: [6, 6, 6, 6, 6, 6, 6, 6],
      modifier: 0,
    });
    const result = await steps[4].handler(ctx);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Overchannel cost roll failed (NaNd12)'));
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'automation',
      characterName: 'TestWizard',
      automationType: 'overchannel_refused',
      abilityName: 'Overchannel',
      note: 'overchannel_refused',
      reason: 'cost roll failed (NaNd12)',
      description: 'Overchannel refused (cost roll failed: NaNd12) — maximized bonus stripped, spell cast at base dice for 30. No necrotic self-damage rolled.',
      timestamp: expect.any(Number),
    });
    expect(result).toEqual({
      data: { formula: '8d6', total: 30, rolls: [5, 4, 3, 6, 2, 1, 6, 3], modifier: 0, overchannelActive: false, overchannelRefused: true },
    });
  });

  it('#1044 crit-refusal re-rolls through the rolling lane dispatcher: doubled total, single-set rolls', async () => {
    // overchannel beat crit upstream (maximized 4x6=24 carried in ctx.total); once
    // refused, the base is the CRIT cast: doubled 15x2=30, rolls single set [5,4,3,3]
    // — exact shape spellRollDamage :152/:160 would have emitted without overchannel.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx({
      overchannelActive: true,
      overchannelUseCount: 3,
      isCrit: true,
      formula: '4d6',
      total: 24,
      rolls: [6, 6, 6, 6],
      modifier: 0,
    });
    const result = await steps[4].handler(ctx);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Overchannel cost roll failed (NaNd12)'));
    expect(rollExpressionDoubled).toHaveBeenCalledWith('4d6');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      automationType: 'overchannel_refused',
      description: 'Overchannel refused (cost roll failed: NaNd12) — maximized bonus stripped, spell cast at base dice for 30. No necrotic self-damage rolled.',
    }));
    expect(result).toEqual({
      data: { formula: '4d6', total: 30, rolls: [5, 4, 3, 3], modifier: 0, overchannelActive: false, overchannelRefused: true },
    });
  });

  it('#1044 double-failure resolves null — fix#69 abort token, never {data:{}}; refusal logged with abort wording', async () => {
    // Cost 'NaNd12' AND base 'gibberish' both miss the table. Nothing honest exists
    // to hand spellProceedToDamage — the old {data:{}} would have fired the
    // maximized total. null breaks the chain (actionPipeline:36); no roll was
    // granted, so the refusal log says aborted.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx({
      overchannelActive: true,
      overchannelUseCount: 2,
      formula: 'gibberish',
      total: 48,
      rolls: [6, 6, 6, 6, 6, 6, 6, 6],
      modifier: 0,
    });
    await expect(steps[4].handler(ctx)).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Overchannel cost roll failed (NaNd12)'));
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      automationType: 'overchannel_refused',
      description: 'Overchannel refused (cost roll failed: NaNd12) and base damage (gibberish) could not be rolled — spell aborted, no damage applied.',
    }));
  });

  it('#1044 refusal path burns nothing: no maximizer call, first-free-use (useCount 1) never reaches the refuse arm', async () => {
    // Condition census already pins useCount 1 -> step never runs (first use is RAW
    // free, maximized bytes flow untouched). Here: the plain-success rows above prove
    // the maximizer throw-sentinel is never tripped, and a refuse row leaves the
    // cost roll as the only failed dice contact — addEntry sees exactly ONE entry
    // (the refusal), zero overchannel-damage self-hit logs for a cost never rolled.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = makeCtx({
      overchannelActive: true,
      overchannelUseCount: 2,
      formula: '8d6',
      total: 48,
      rolls: [6, 6, 6, 6, 6, 6, 6, 6],
      modifier: 0,
    });
    await steps[4].handler(ctx);
    expect(addEntry).toHaveBeenCalledTimes(1); // refusal only — never a costed-hit double log
    expect(addEntry.mock.calls[0][1].rollType).toBeUndefined();
  });

  it('resolves { data: {} } even when addEntry rejects — .catch logs via console.error, not silent', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    addEntry.mockRejectedValueOnce(new Error('Network error'));
    const ctx = makeCtx({
      overchannelActive: true,
      overchannelUseCount: 2,
      overchannelSpellLevel: 1,
    });
    await expect(steps[4].handler(ctx)).resolves.toEqual({ data: {} });
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('spellProceedToDamage (steps[5])', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    steps = buildDirectSpellDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition: runs when formula != null (0 passes), skips null/undefined', () => {
    // `!= null` loose check: 0-true pins the deliberate leniency (#940); number/string
    // hit the same leg (#1043 fold); null and undefined both fall through.
    expect(steps[5].condition(makeCtx({ formula: '1d6' }))).toBe(true);
    expect(steps[5].condition(makeCtx({ formula: 0 }))).toBe(true);
    expect(steps[5].condition(makeCtx({ formula: null }))).toBe(false);
    const ctx = makeCtx();
    delete ctx.formula;
    expect(steps[5].condition(ctx)).toBe(false);
  });

  it('hands the rolled result to proceedWithDamage with an exact payload and returns { data: { _done: true } }', async () => {
    const ctx = makeCtx({
      attack: { name: 'Fireball' },
      formula: '8d6',
      total: 28,
      rolls: [6, 5, 4, 3, 6, 2, 1, 1],
      modifier: 0,
    });
    const result = await steps[5].handler(ctx);
    expect(ctx.proceedWithDamage).toHaveBeenCalledWith({
      attack: { name: 'Fireball' },
      formula: '8d6',
      total: 28,
      rolls: [6, 5, 4, 3, 6, 2, 1, 1],
      modifier: 0,
    });
    expect(result).toEqual({ data: { _done: true } });
  });
});
