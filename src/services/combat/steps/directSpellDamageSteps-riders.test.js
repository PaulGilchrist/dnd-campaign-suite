// @maintained-by-ai
// Lane: directSpellDamageSteps.js steps[3] spellFeatureRiders — the generic spell-side
// rider dispatch loop. Contract (source :162-174): seed prevData {formula,total,rolls}
// from ctx (rolls copied), gate each featureModules entry on condition(ctx), await
// handler(ctx, data), then per result: null → continue, modal → ABORT returning the
// whole result verbatim, data → replace, sideEffects → awaited inline before the loop
// advances. Spell riders here are feature-module dispatch only — no dice math (that is
// the rolling lane, idx 2) and no builder routing (attack-path riders live in
// attackRollRiders #1041; this loop shares no helpers with it).
//
// directSpellDamageSteps family idx map:
//   0 spellHousekeeping / 1 spellContext      → cla120 #1042 (VERBATIM baseline),
//     context #1043 (multi-option gate, throwing sentinels), radiantSoul #1045 (latch)
//   2 spellRollDamage                           → rolling lane (owns roll lanes + RS stamp)
//   3 spellFeatureRiders                        → THIS FILE (dispatch contract only)
//   4 spellOverchannel / 5 spellProceedToDamage → overchannel #1044
//   names/subscribe/emit structure table        → structure lane (cited, not repeated)
//   Siblings pin featureModules statically [] — dispatch lives nowhere else.
//
// old -> new map (8 -> 4):
//   'returns data with formula, total, and copied rolls' + 'handles missing rolls
//     gracefully'          → T1: exact full-result toEqual, copy semantics pinned, co-located
//   'skips false' + 'calls when true' + 'passes prevData' → T2: armed/unarmed pair,
//     ctx identity on condition, exact seed bytes, null-result passthrough
//   'updates data' + 'calls sideEffects' + 'processes multiple in sequence' → T3:
//     one replace→chain flow with inline ordering, pending-sideEffect not-resolved pin,
//     null-preserves-data
//   'returns modal result' + 'stops processing when modal' → T4: verbatim whole-result
//     abort (extra key proves `return result`, not a rebuild), later feature never gated
//
// Dead-mock purge: the old diceRoller parse-loop was a re-implemented dice oracle that
// this lane never calls (rolling lives at idx 2) — stubbed to inert vi.fn imports only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildDirectSpellDamageSteps } from './directSpellDamageSteps.js';

// Import-stability stubs only: diceRoller/postCastRiderService/logService/choiceStorage
// are consulted by OTHER idx lanes, never by spellFeatureRiders. Zero network (#841).
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));
vi.mock('../../rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

const _featureModulesRef = { value: [] };
vi.mock('./features/index.js', () => ({
  get featureModules() { return _featureModulesRef.value; },
}));

describe('buildDirectSpellDamageSteps — steps[3] spellFeatureRiders dispatch', () => {
  let steps;

  beforeEach(() => {
    _featureModulesRef.value = [];
    steps = buildDirectSpellDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passthrough: seeds exact {formula,total,rolls} and never mutates ctx.rolls', async () => {
    const rolls = [6, 5, 4, 3, 2, 4];
    const ctx = { formula: '8d6', total: 24, rolls };
    const result = await steps[3].handler(ctx);
    expect(result).toEqual({ data: { formula: '8d6', total: 24, rolls: [6, 5, 4, 3, 2, 4] } });
    // Copy semantics: a rider mutating pipeline data cannot corrupt the caller's ctx.
    expect(result.data.rolls).not.toBe(rolls);
    expect(ctx.rolls).toEqual([6, 5, 4, 3, 2, 4]);

    // Near-miss co-located: missing rolls seeds [] (not undefined).
    const bare = await steps[3].handler({ formula: '8d6', total: 24 });
    expect(bare).toEqual({ data: { formula: '8d6', total: 24, rolls: [] } });
  });

  it('condition(ctx) gate: unarmed skipped, armed called once with ctx and the exact seed', async () => {
    const armed = { condition: vi.fn(() => true), handler: vi.fn(async () => null) };
    const unarmed = { condition: vi.fn(() => false), handler: vi.fn() };
    _featureModulesRef.value = [unarmed, armed];

    const ctx = { formula: '8d6', total: 24, rolls: [6, 5] };
    const result = await steps[3].handler(ctx);

    expect(unarmed.condition).toHaveBeenCalledWith(ctx);
    expect(armed.condition).toHaveBeenCalledWith(ctx);
    expect(unarmed.handler).not.toHaveBeenCalled();
    expect(armed.handler).toHaveBeenCalledTimes(1);
    expect(armed.handler).toHaveBeenCalledWith(ctx, { formula: '8d6', total: 24, rolls: [6, 5] });
    // null result → continue: seed passes through untouched.
    expect(result).toEqual({ data: { formula: '8d6', total: 24, rolls: [6, 5] } });
  });

  it('replace-then-chain: sideEffect awaited inline before the next feature, which sees the replaced data', async () => {
    const replaced = { formula: '8d6 + 6 [Test Rider]', total: 30, rolls: [6] };
    const tracker = [];
    let resolveSide;
    const f1 = {
      condition: () => true,
      handler: vi.fn(async () => {
        tracker.push('f1');
        return {
          data: replaced,
          sideEffects: vi.fn(() => {
            tracker.push('side');
            return new Promise((resolve) => { resolveSide = resolve; });
          }),
        };
      }),
    };
    const f2 = { condition: () => true, handler: vi.fn(async () => { tracker.push('f2'); return null; }) };
    _featureModulesRef.value = [f1, f2];

    const pending = steps[3].handler({ formula: '8d6', total: 24, rolls: [6] });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    // Pending sideEffect blocks the step AND the next feature (inline await, no race).
    expect(tracker).toEqual(['f1', 'side']);
    resolveSide();
    const result = await pending;

    expect(tracker).toEqual(['f1', 'side', 'f2']);
    expect(f2.handler.mock.calls[0][1]).toEqual(replaced);
    // f2's null result preserves f1's replacement as the final data.
    expect(result).toEqual({ data: replaced });
  });

  it('modal aborts: whole rider result returned verbatim, later features never gated', async () => {
    const modalResult = {
      modal: { type: 'rider-modal', props: { token: 'abort-42' } },
      data: { formula: '8d6', total: 77, rolls: [6] },
    };
    const tracker = [];
    const f1 = {
      condition: () => true,
      handler: vi.fn(async () => { tracker.push('f1'); return { data: { formula: '8d6', total: 28, rolls: [6] } }; }),
    };
    const f2 = { condition: () => true, handler: vi.fn(async () => { tracker.push('f2'); return modalResult; }) };
    const f3 = { condition: vi.fn(() => true), handler: vi.fn(async () => { tracker.push('f3'); return { data: { total: 999 } }; }) };
    _featureModulesRef.value = [f1, f2, f3];

    const result = await steps[3].handler({ formula: '8d6', total: 24, rolls: [6] });

    // Verbatim return of the feature's FULL result (extra data key survives — proof
    // this is `return result`, not a {modal} rebuild; f1's 28 is gone, f3's 999 never).
    expect(result).toEqual(modalResult);
    expect(tracker).toEqual(['f1', 'f2']);
    expect(f3.condition).not.toHaveBeenCalled();
  });
});
