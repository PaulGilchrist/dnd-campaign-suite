// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { deduplicateAndSort } from './deduplicateAndSort.js';

// Unit home for deduplicateAndSort (src/services/shared/deduplicateAndSort.js):
// pure canonicalizer — fresh-array purity (NOT the in-place push of sibling
// mergeDeduplicated, buffApplier.js:15, whose case-insensitive-append canon is
// buffApplier.test.js:97). Identity law here is Set SameValueZero, CASE-SENSITIVE
// (contrast mergeDeduplicated's toLowerCase gate): 'a'/'A' survive as distinct,
// distinct objects with identical values survive; SameValueZero collisions
// collapse with -0 normalized to +0 per Set spec (js:10) and NaN collapses where === would not. Sort law splits on
// sortKey truthiness (js:11-12): falsy sortKey -> default ASCII sort() coercing
// every member to string ('10' before '2'); truthy sortKey -> localeCompare on
// String(a?.[sortKey] || '') (falsy keys coerce to '', sort first), which is
// case-INSENSITIVE-primary, so it orders 'a' before 'B' where the default branch
// orders 'B' before 'a'. Ties are stable (ES2019). No clocks, no store, zero mocks.

describe('deduplicateAndSort', () => {
  it('returns [] for missing, falsy, or non-array input', () => {
    expect(deduplicateAndSort()).toStrictEqual([]);
    expect(deduplicateAndSort(null)).toStrictEqual([]);
    expect(deduplicateAndSort(undefined)).toStrictEqual([]);
    expect(deduplicateAndSort(0)).toStrictEqual([]);
    expect(deduplicateAndSort('')).toStrictEqual([]);
    expect(deduplicateAndSort(false)).toStrictEqual([]);
    expect(deduplicateAndSort(NaN)).toStrictEqual([]);
    expect(deduplicateAndSort('string')).toStrictEqual([]);
    expect(deduplicateAndSort(42)).toStrictEqual([]);
    expect(deduplicateAndSort({})).toStrictEqual([]);
    expect(deduplicateAndSort(true)).toStrictEqual([]);
    expect(deduplicateAndSort([])).toStrictEqual([]);
  });

  it('collapses SameValueZero-equal members (NaN collapses, -0 normalized to +0), and value-twins objects survive', () => {
    expect(deduplicateAndSort(['c', 'a', 'b', 'a', 'c'])).toStrictEqual(['a', 'b', 'c']);
    expect(deduplicateAndSort(['x', 'x', 'x'])).toStrictEqual(['x']);
    expect(deduplicateAndSort(['a', 'A'])).toStrictEqual(['A', 'a']);
    expect(deduplicateAndSort([NaN, NaN])).toStrictEqual([NaN]);
    const signedZero = deduplicateAndSort([-0, 0]);
    expect(signedZero.length).toBe(1);
    expect(Object.is(signedZero[0], 0)).toBe(true); // Set spec normalizes -0 to +0
    expect(Object.is(deduplicateAndSort([0, -0])[0], 0)).toBe(true);
    expect(deduplicateAndSort([{ name: 'Alice' }, { name: 'Alice' }])).toStrictEqual([{ name: 'Alice' }, { name: 'Alice' }]);
  });

  it('default-sort coerces every member to string by ASCII code-unit order', () => {
    expect(deduplicateAndSort([10, 2, 1, 2])).toStrictEqual([1, 10, 2]);
    expect(deduplicateAndSort([3, -1, 0, -1, 3])).toStrictEqual([-1, 0, 3]);
    expect(deduplicateAndSort(['b', 1, 'a', 1])).toStrictEqual([1, 'a', 'b']);
    expect(deduplicateAndSort(['Charlie', 'alice', 'Bob'])).toStrictEqual(['Bob', 'Charlie', 'alice']);
  });

  it('keeps falsy members distinct and sorts their string forms in place', () => {
    expect(deduplicateAndSort(['b', '', 'a', '', 0, null, undefined, 0])).toStrictEqual(['', 0, 'a', 'b', null, undefined]);
  });

  it('returns a fresh array, leaves the input unmutated, and preserves object references', () => {
    const input = ['c', 'a', 'b', 'a'];
    const result = deduplicateAndSort(input);
    expect(result).not.toBe(input);
    expect(result).toStrictEqual(['a', 'b', 'c']);
    expect(input).toStrictEqual(['c', 'a', 'b', 'a']);

    const shared = { name: 'shared' };
    const other = { name: 'other' };
    const objects = deduplicateAndSort([shared, shared, other]);
    expect(objects.length).toBe(2);
    expect(objects[0]).toBe(shared);
    expect(objects[1]).toBe(other);
  });

  it('sortKey sorts by localeCompare on String(key), coercing missing/null/undefined/0/false keys to "" which sort first', () => {
    expect(deduplicateAndSort([{ name: 'Charlie' }, { other: 'Alice' }, { name: 'Alice' }], 'name')).toStrictEqual([{ other: 'Alice' }, { name: 'Alice' }, { name: 'Charlie' }]);
    expect(deduplicateAndSort([{ rank: 10 }, { rank: 2 }, { rank: 1 }], 'rank')).toStrictEqual([{ rank: 1 }, { rank: 10 }, { rank: 2 }]);
    expect(deduplicateAndSort([{ name: null }, { name: undefined }, { name: 0 }, { name: false }, { name: 'Charlie' }], 'name')).toStrictEqual([{ name: null }, { name: undefined }, { name: 0 }, { name: false }, { name: 'Charlie' }]);
  });

  it('sortKey branch is locale-aware (a before B) while the default branch is ASCII (B before a)', () => {
    expect(deduplicateAndSort(['a', 'B'])).toStrictEqual(['B', 'a']);
    expect(deduplicateAndSort([{ n: 'B' }, { n: 'a' }], 'n')).toStrictEqual([{ n: 'a' }, { n: 'B' }]);
    expect(deduplicateAndSort([{ n: 'b' }, { n: 'A' }], 'n')).toStrictEqual([{ n: 'A' }, { n: 'b' }]);
  });

  it('keeps comparator ties stable, ignores string members under any truthy sortKey, and falls through falsy sortKeys to default sort', () => {
    expect(deduplicateAndSort([{ k: 'x', i: 1 }, { k: 'x', i: 2 }], 'k')).toStrictEqual([{ k: 'x', i: 1 }, { k: 'x', i: 2 }]);
    expect(deduplicateAndSort([{ k: 'x', i: 2 }, { k: 'x', i: 1 }], 'k')).toStrictEqual([{ k: 'x', i: 2 }, { k: 'x', i: 1 }]);
    expect(deduplicateAndSort(['b', 'a'], 'name')).toStrictEqual(['b', 'a']);
    expect(deduplicateAndSort(['b', 'a'], '')).toStrictEqual(['a', 'b']);
    expect(deduplicateAndSort([{ q: 2 }, { q: 1 }], '')).toStrictEqual([{ q: 2 }, { q: 1 }]);
  });

  it('is idempotent and input-order-insensitive, with arity 2 and extra args ignored', () => {
    const once = deduplicateAndSort(['c', 'b', 'a', 'c', 'b']);
    const twice = deduplicateAndSort(once);
    expect(twice).toStrictEqual(once);
    expect(twice).not.toBe(once);
    expect(deduplicateAndSort(['b', 'c', 'a', 'b', 'c'])).toStrictEqual(once);
    expect(deduplicateAndSort.length).toBe(2);
    expect(deduplicateAndSort(['c', 'a', 'b', 'a'], undefined, 'ignored', 'args')).toStrictEqual(once);
  });
});
