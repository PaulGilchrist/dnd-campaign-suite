// @maintained-by-ai
/**
 * prismaticSpray SEXTET lane #1941 — canonical home for the internals of the
 * ONLY exported helper of prismaticSprayHandler.js: isPrismaticSprayBlocked
 * (L320-344). LIVE gate — consumers verified at source: attackBlockers.js
 * L5/L12 dispatches check(attackerName, targetName, campaignName) inside
 * checkAttackBlockers; the consumer lane (useLoggedDiceRollAttack.blocked-attacks)
 * smoke-mocks it and pins only that call signature — internals canon is HERE.
 *
 * Export enumeration at source: prismaticSprayHandler.js exports exactly
 * { isPrismaticSprayBlocked, handle }. handle is #1940's lane, not this one.
 * Everything else (pickRays, selectSprayTargets, queueRaySave, applyRayDamage,
 * resolveSpraySaveOutcome, resolveTargetImmunityList, spraySaveDescription,
 * applyIndigo/VioletEffect) is module-private — unreachable as unit exports;
 * those fragments are covered through handle in the sibling lanes:
 *  - 12d6 formulas + '12d6' fallback → damage-regression (SP-092 sole home)
 *  - target selection, ray-roll dispatch, refusals → .handle #1940
 *  - per-ray save payloads, status/targetEffect writes, expirations → .rays #1942
 *  - save_result/addTargetResult plumbing, immunity skip → .save-results #1943
 *  - summary popup composition → .summaries #1944
 *
 * Canonical content here (banishment #1874 pattern): exact two-arg store-read
 * contract + purity, short-circuit ORDER before the store read, full
 * presence/source truth table incl. strict-equality filter and the
 * undefined-source quirk lock.
 *
 * Turn-based: pure read predicate — no writes, no game timers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isPrismaticSprayBlocked } from './prismaticSprayHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

beforeEach(() => {
  vi.clearAllMocks();
});

// Trap store: Orc carries a prismatic_spray effect. Any call that skips the
// falsy-name short-circuit (L321) would read it and return TRUE.
const TRAP_STORE = [
  { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'CasterX' },
];

describe('isPrismaticSprayBlocked — store-read contract (L323)', () => {
  it("reads campaign:targetEffects with exactly two args, once per call — campaignName is deliberately NOT forwarded (L320 '_campaignName')", () => {
    getRuntimeValue.mockReturnValue([]);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(false);

    expect(getRuntimeValue).toHaveBeenCalledTimes(1);
    // 2-arg arity pin: also asserts the 3rd campaignName arg is not passed
    // (same blocker read pattern as banishment/isBanishmentBlocked).
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('null or undefined store coerces via || [] — reports false without throwing', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(false);

    getRuntimeValue.mockReturnValue(undefined);
    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(false);

    expect(getRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe.each([
  { attacker: '', target: 'Orc' },
  { attacker: null, target: 'Orc' },
  { attacker: undefined, target: 'Orc' },
  { attacker: 'Goblin', target: '' },
  { attacker: 'Goblin', target: null },
  { attacker: 'Goblin', target: undefined },
])('falsy names (%s)', ({ attacker, target }) => {
  it('short-circuits false BEFORE the store read (L321) — trap store never consulted', () => {
    getRuntimeValue.mockReturnValue(TRAP_STORE);

    expect(isPrismaticSprayBlocked(attacker, target, campaignName)).toBe(false);
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('isPrismaticSprayBlocked — presence/source truth table (L325-343)', () => {
  // Blocked iff exactly one side carries a prismatic_spray indigo/violet
  // effect, or both do but share no caster (attackBlockers.js uses this to
  // deny attacks crossing the demiplane boundary).
  it.each([
    {
      name: 'neither target affected',
      store: [],
      expected: false,
    },
    {
      name: 'attacker only (indigo)',
      store: [{ target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' }],
      expected: true,
    },
    {
      name: 'attacker only (violet)',
      store: [{ target: 'Goblin', effect: 'prismatic_spray_violet', source: 'CasterA' }],
      expected: true,
    },
    {
      name: 'target only (indigo)',
      store: [{ target: 'Orc', effect: 'prismatic_spray_indigo', source: 'CasterA' }],
      expected: true,
    },
    {
      name: 'target only (violet)',
      store: [{ target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterA' }],
      expected: true,
    },
    {
      name: 'both affected, same caster',
      store: [
        { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
        { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterA' },
      ],
      expected: false,
    },
    {
      name: 'both affected, disjoint casters',
      store: [
        { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
        { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterB' },
      ],
      expected: true,
    },
    {
      name: 'both affected, partial caster overlap (shared CasterB unlocks)',
      store: [
        { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
        { target: 'Goblin', effect: 'prismatic_spray_violet', source: 'CasterB' },
        { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'CasterB' },
      ],
      expected: false,
    },
    {
      name: 'both affected, multi-effect disjoint sets stay blocked',
      store: [
        { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
        { target: 'Goblin', effect: 'prismatic_spray_violet', source: 'CasterB' },
        { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'CasterC' },
        { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterD' },
      ],
      expected: true,
    },
    {
      name: 'undefined vs defined source share nothing — blocked',
      store: [
        { target: 'Goblin', effect: 'prismatic_spray_indigo', source: undefined },
        { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterB' },
      ],
      expected: true,
    },
    {
      name: 'undefined sources on both sides compare strict-equal — counted as shared, unblocked (quirk lock)',
      store: [
        { target: 'Goblin', effect: 'prismatic_spray_indigo' },
        { target: 'Orc', effect: 'prismatic_spray_violet' },
      ],
      expected: false,
    },
  ])('$name → blocked=$expected', ({ store, expected }) => {
    getRuntimeValue.mockReturnValue(store);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(expected);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('a fresh hit from the same caster replaces via store data, still unblocks (duplicate-source entries tolerated)', () => {
    // Two rays of the same caster on the same target: source sets dedupe
    // implicitly through .some/includes — must not flip blocked.
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'CasterA' },
      { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'CasterA' },
      { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterA' },
    ]);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(false);
  });
});

describe('isPrismaticSprayBlocked — strict effect-key filter (L326/L329 ===)', () => {
  it('other spells\' targetEffects never block (indigo/violet keys only)', () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'fear_end_on_los', source: 'TestWizard' },
      { target: 'Orc', effect: 'hypno_charm', source: 'TestWizard' },
      { target: 'Goblin', effect: 'banishment', source: 'TestWizard' },
      { target: 'Orc', effect: 'stunned', source: 'TestWizard' },
    ]);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(false);
  });

  it('near-miss and case-shifted keys fail strict equality — attacker side is not a prismatic target', () => {
    // 'Prismatic_Spray_Indigo' / prefix+suffix variants / '' never match.
    // Goblin carries only near-misses, Orc a REAL indigo: with the filter
    // working, only Orc counts → blocked. A broken (e.g. includes-based)
    // filter would read both as affected, share 'TestWizard', and unblock.
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'Prismatic_Spray_Indigo', source: 'TestWizard' },
      { target: 'Goblin', effect: 'prismatic_spray_indigo_extra', source: 'TestWizard' },
      { target: 'Goblin', effect: 'prismatic_spray', source: 'TestWizard' },
      { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'TestWizard' },
    ]);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(true);
  });

  it('non-prismatic effects never contribute sources to the shared-caster check', () => {
    // Both share source TestWizard, but only Orc has a prismatic effect, so
    // the one-sided branch fires: blocked despite the shared non-prismatic
    // source in the store.
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'hypno_charm', source: 'TestWizard' },
      { target: 'Orc', effect: 'prismatic_spray_indigo', source: 'TestWizard' },
    ]);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(true);
  });

  it('case-shifted sources never count as shared (strict source comparison)', () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'casterA' },
      { target: 'Orc', effect: 'prismatic_spray_violet', source: 'CasterA' },
    ]);

    expect(isPrismaticSprayBlocked('Goblin', 'Orc', campaignName)).toBe(true);
  });
});
