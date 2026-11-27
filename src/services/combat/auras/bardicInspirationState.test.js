// @maintained-by-ai 2026-11-27
// bardicInspirationState lane — unit home for the granted-inspiration runtime
// readers (consumers: the popup-inline BI offer/commit lanes — handlePlainDamage.js
// and useLoggedDiceRollAttack.js gate the offense button through
// hasBardicInspirationOffense; CharSheet/DiceRoll hooks, which mock this module
// in their own lanes). The <name>-biPrompt modal/key lane was DELETED
// 2026-11-18 (bug-bi-offense-modal-rider-gate-arg-shape, owner decision: the
// popup-inline button is the single offense lane, mirroring the 1a308c928
// defense adjudication) — no rider/prompt producer may be reintroduced.
// Constitution pins:
// - No wall-clock anywhere in this module (grep-verified: no Date.now /
//   setTimeout / setInterval). Inspiration offers wait indefinitely; state only
//   moves at explicit seams (grant → runtime keys, consume → the popup commit
//   handler nulls the die/options/grantedBy trio). Purity test below proves
//   readers never mutate state.
// - Runtime keys are the envelope: bardicInspirationDie / GrantedBy /
//   CombatOptions / Uses. Ordered full mock.calls censuses pin every read by
//   (name, key, campaign) exactly once per call — tests survive call-order
//   refactors that positional Once-chains would not, and the granted-defense
//   census doubles as proof the arm never touches the uses key.
// - Die-size ladder verified against disk, not fabricated: 5e Bard stores the
//   die in class_specific.bardic_inspiration_die, 2024 Bard in bardic_die —
//   one dataset exercises each branch (d6 → d8@5 → d10@10 → d12@15).
// - Uses envelope is dual-shape: plain number or { current };
//   _trackedResources is the last-resort fallback when the runtime uses key is
//   null — pinned once per function (defense and offense carry their own copy
//   of that branch).
// - DEAD EXPORTS UNPINNED (grep-verified 2026-11-27: hasBardicInspiration and
//   getBardicInspirationGrantedBy have zero callers outside this module).
//   hasBardicInspiration's truthiness gate is covered through the defense
//   census; grantedBy is pinned nowhere. Do not re-pin — retire the exports.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import {
  hasBardicInspirationDefense,
  hasBardicInspirationOffense,
  getBardicInspirationDieSize,
  getBardicInspirationDieSizeFromClass,
} from './bardicInspirationState.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

import classes5e from '../../../../public/data/classes.json';
import classes2024 from '../../../../public/data/2024/classes.json';

// Runtime store stand-in: mutable per-key map, read by exact key.
let runtime;
let warnSpy;

beforeEach(() => {
  vi.resetAllMocks();
  runtime = {};
  getRuntimeValue.mockImplementation((_name, key) => runtime[key]);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

const bard = (extra = {}) => ({
  name: 'BardPlayer',
  class: { name: 'Bard' },
  level: 1,
  ...extra,
});

describe('hasBardicInspirationDefense', () => {
  it.each([
    [JSON.stringify(['defense_add_to_ac']), true],
    [JSON.stringify(['offense_add_to_damage']), false],
    [JSON.stringify([]), false],
  ])('granted die with options %s gates defense solely on defense_add_to_ac', (options, expected) => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: options,
    });
    // null stats proves the granted arm adjudicates from runtime keys alone.
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(expected);
    // Census: the granted arm reads die + options and NEVER the uses key.
    expect(getRuntimeValue.mock.calls).toEqual([
      ['BardPlayer', 'bardicInspirationDie', 'Campaign'],
      ['BardPlayer', 'bardicInspirationCombatOptions', 'Campaign'],
    ]);
  });

  it('unparseable combatOptions fail closed (no defense) with a warning, never a throw', () => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: 'not valid json',
    });
    expect(hasBardicInspirationDefense('BardPlayer', 'Campaign', null)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it.each([
    { label: 'number uses above zero', rawUses: 3, stats: bard(), expected: true },
    { label: 'number uses at zero', rawUses: 0, stats: bard(), expected: false },
    { label: '{ current } uses above zero', rawUses: { current: 2 }, stats: bard(), expected: true },
    { label: '{ current } uses at zero', rawUses: { current: 0 }, stats: bard(), expected: false },
    {
      label: 'null key falls back to _trackedResources current 1',
      rawUses: null,
      stats: bard({ _trackedResources: { bardicInspirationUses: { current: 1 } } }),
      expected: true,
    },
    {
      label: 'null key falls back to _trackedResources current 0',
      rawUses: null,
      stats: bard({ _trackedResources: { bardicInspirationUses: { current: 0 } } }),
      expected: false,
    },
    {
      label: 'non-Bard class never qualifies even with uses on the key',
      rawUses: 5,
      stats: { name: 'Fighter', class: { name: 'Fighter' } },
      expected: false,
    },
    {
      label: 'missing stats short-circuit before the uses read',
      rawUses: 5,
      stats: null,
      expected: false,
      reads: ['bardicInspirationDie'],
    },
  ])('without a granted die: $label → $expected', ({ rawUses, stats, expected, reads }) => {
    runtime.bardicInspirationUses = rawUses;
    const name = stats?.name ?? 'BardPlayer';
    expect(hasBardicInspirationDefense(name, 'Campaign', stats)).toBe(expected);
    expect(getRuntimeValue.mock.calls).toEqual(
      (reads ?? ['bardicInspirationDie', 'bardicInspirationUses']).map((key) => [name, key, 'Campaign'])
    );
  });
});

describe('hasBardicInspirationOffense', () => {
  it.each([
    {
      label: 'granted die + offense option arms even at zero uses',
      die: 'd6',
      options: ['offense_add_to_damage'],
      rawUses: 0,
      stats: bard(),
      expected: true,
    },
    {
      label: 'granted die without the offense option still qualifies on number uses',
      die: 'd6',
      options: [],
      rawUses: 3,
      stats: bard(),
      expected: true,
    },
    { label: '{ current } uses envelope above zero qualifies', rawUses: { current: 2 }, stats: bard(), expected: true },
    { label: '{ current } uses envelope at zero denies', rawUses: { current: 0 }, stats: bard(), expected: false },
    {
      label: 'null key falls back to _trackedResources current 1',
      rawUses: null,
      stats: bard({ _trackedResources: { bardicInspirationUses: { current: 1 } } }),
      expected: true,
    },
    {
      label: 'null key falls back to _trackedResources current 0',
      rawUses: null,
      stats: bard({ _trackedResources: { bardicInspirationUses: { current: 0 } } }),
      expected: false,
    },
    {
      label: 'non-Bard class never qualifies even with uses (class gate, not just the count)',
      rawUses: 5,
      stats: bard({ class: { name: 'Fighter' } }),
      expected: false,
    },
  ])('runtime reads: $label → $expected', ({ die, options = [], rawUses, stats, expected }) => {
    Object.assign(runtime, {
      bardicInspirationDie: die,
      bardicInspirationCombatOptions: JSON.stringify(options),
      bardicInspirationUses: rawUses,
    });
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(expected);
    // Census: the offense gate reads all three keys exactly once, in order,
    // scoped to (stats.name, key, campaign) — even when the runtime arm hits.
    expect(getRuntimeValue.mock.calls).toEqual([
      ['BardPlayer', 'bardicInspirationDie', 'Campaign'],
      ['BardPlayer', 'bardicInspirationCombatOptions', 'Campaign'],
      ['BardPlayer', 'bardicInspirationUses', 'Campaign'],
    ]);
  });

  it('unparseable combatOptions fail closed when there are no Bard uses', () => {
    Object.assign(runtime, {
      bardicInspirationDie: 'd6',
      bardicInspirationCombatOptions: 'invalid json',
      bardicInspirationUses: 0,
    });
    expect(hasBardicInspirationOffense(bard(), 'Campaign')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('ARG-SHAPE falsifier: a bare NAME STRING never arms — only the full playerStats object does', () => {
    // The deleted modal rider called this gate as
    // hasBardicInspirationOffense(ctx.playerStats.name, campaignName) — a
    // string whose .name is undefined — so every runtime lookup missed and the
    // offer died silently in every real lane while mocked-gate tests stayed
    // green. The gate signature is (playerStats, campaignName); callers on the
    // surviving popup-inline lane MUST pass the object. A future caller that
    // regresses to the string shape gets this exact false, never a true.
    // Name-scoped store: keys resolve ONLY under the holder's real name (the
    // production store is name-keyed; the shared mock's name-blind map would
    // mask the miss).
    Object.assign(runtime, {
      bardicInspirationDie: 8,
      bardicInspirationCombatOptions: JSON.stringify(['offense_add_to_damage']),
      bardicInspirationUses: { current: 1, max: 1 },
    });
    getRuntimeValue.mockImplementation((name, key) => (name === 'BardPlayer' ? runtime[key] : undefined));
    const stats = bard();
    expect(hasBardicInspirationOffense(stats, 'Campaign')).toBe(true);
    expect(hasBardicInspirationOffense(stats.name, 'Campaign')).toBe(false);
  });
});

describe('getBardicInspirationDieSize', () => {
  it('parses dX/number-string/plain-number dice to their numeric size; everything else is null', () => {
    const cases = [
      ['d4', 4], ['d6', 6], ['d8', 8], ['d10', 10], ['d12', 12], ['d20', 20],
      ['1d6', 6], [8, 8],
      [null, null], [undefined, null], ['', null], [0, null], [-4, null], ['invalid', null],
    ];
    for (const [die, expected] of cases) {
      runtime.bardicInspirationDie = die;
      expect(getBardicInspirationDieSize('BardPlayer', 'Campaign')).toBe(expected);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('BardPlayer', 'bardicInspirationDie', 'Campaign');
  });
});

describe('getBardicInspirationDieSizeFromClass', () => {
  const bard5e = classes5e.find((c) => c.name === 'Bard');
  const bard2024 = classes2024.find((c) => c.name === 'Bard');

  it('walks the disk Bard ladder d6 → d8@5 → d10@10 → d12@15 on both rulesets', () => {
    // 5e disk stores the die in class_specific.bardic_inspiration_die...
    expect(bard5e.class_levels.find((cl) => cl.level === 1).bardic_die).toBeUndefined();
    // ...2024 disk stores it in bardic_die — one dataset per source branch.
    expect(bard2024.class_levels.find((cl) => cl.level === 1).bardic_die).toBeDefined();

    for (const [level, die] of [[1, 6], [4, 6], [5, 8], [9, 8], [10, 10], [14, 10], [15, 12], [20, 12]]) {
      expect(getBardicInspirationDieSizeFromClass({ class: bard5e, level })).toBe(die);
      expect(getBardicInspirationDieSizeFromClass({ class: bard2024, level })).toBe(die);
    }
  });

  it('returns null for missing stats, missing class data, or no class_level matching the level', () => {
    for (const stats of [null, undefined, {}, { class: {} }, { class: { class_levels: [{ level: 2, bardic_die: 6 }] }, level: 5 }]) {
      expect(getBardicInspirationDieSizeFromClass(stats)).toBe(null);
    }
  });

  it('prefers bardic_die over class_specific, and treats a zero die on either key as none', () => {
    expect(getBardicInspirationDieSizeFromClass({
      class: { class_levels: [{ level: 1, bardic_die: 4, class_specific: { bardic_inspiration_die: 6 } }] },
      level: 1,
    })).toBe(4);
    // bardic_die 0 falls through to class_specific...
    expect(getBardicInspirationDieSizeFromClass({
      class: { class_levels: [{ level: 1, bardic_die: 0, class_specific: { bardic_inspiration_die: 6 } }] },
      level: 1,
    })).toBe(6);
    // ...and if both are zero/absent, there is no die.
    expect(getBardicInspirationDieSizeFromClass({
      class: { class_levels: [{ level: 1, bardic_die: 0, class_specific: { bardic_inspiration_die: 0 } }] },
      level: 1,
    })).toBe(null);
  });
});

describe('purity of inspiration queries', () => {
  it('status readers never write to the runtime store — offers wait indefinitely, consumption is the popup commit handler\'s explicit clear', () => {
    Object.assign(runtime, { bardicInspirationDie: 'd8', bardicInspirationCombatOptions: JSON.stringify([]), bardicInspirationUses: 2 });
    hasBardicInspirationDefense('BardPlayer', 'Campaign', bard());
    hasBardicInspirationDefense('BardPlayer', 'Campaign', null);
    hasBardicInspirationOffense(bard(), 'Campaign');
    getBardicInspirationDieSize('BardPlayer', 'Campaign');
    getBardicInspirationDieSizeFromClass(bard());
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
