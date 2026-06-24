// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { deduplicateAndSort } from './deduplicateAndSort.js';

describe('deduplicateAndSort', () => {
  describe('invalid / empty inputs', () => {
    it('should return empty array for null', () => {
      expect(deduplicateAndSort(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(deduplicateAndSort(undefined)).toEqual([]);
    });

    it('should return empty array for non-array types (string, number, object)', () => {
      expect(deduplicateAndSort('string')).toEqual([]);
      expect(deduplicateAndSort(42)).toEqual([]);
      expect(deduplicateAndSort({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(deduplicateAndSort([])).toEqual([]);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate string primitives', () => {
      const result = deduplicateAndSort(['a', 'b', 'a', 'c', 'b', 'a']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should deduplicate number primitives', () => {
      const result = deduplicateAndSort([3, 1, 2, 1, 3, 2]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should treat different types as distinct values', () => {
      const result = deduplicateAndSort([1, '1', 2]);
      expect(result).toEqual([1, '1', 2]);
    });

    it('should deduplicate objects by reference equality when using sortKey', () => {
      const obj = { name: 'Alice' };
      const arr = [obj, obj, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should deduplicate NaN values via Set (all NaN are equal)', () => {
      const result = deduplicateAndSort([NaN, 1, NaN, 2]);
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result.some(v => Number.isNaN(v))).toBe(true);
    });

    it('should preserve all items when no duplicates exist', () => {
      const result = deduplicateAndSort(['a', 'b', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('sorting without sortKey', () => {
    it('should sort strings alphabetically using default sort', () => {
      const result = deduplicateAndSort(['zebra', 'alpha', 'middle']);
      expect(result).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should sort strings case-sensitively with uppercase before lowercase', () => {
      const result = deduplicateAndSort(['Zebra', 'alpha']);
      expect(result).toEqual(['Zebra', 'alpha']);
    });

    it('should sort numbers using default sort (string coercion, not numeric)', () => {
      const result = deduplicateAndSort([10, 2, 1]);
      expect(result).toEqual([1, 10, 2]);
    });

    it('should handle empty strings in the array', () => {
      const result = deduplicateAndSort(['', 'b', '', 'a']);
      expect(result).toEqual(['', 'a', 'b']);
    });

    it('should sort single element array', () => {
      const result = deduplicateAndSort(['only']);
      expect(result).toEqual(['only']);
    });

    it('should collapse all identical values to a single element', () => {
      const result = deduplicateAndSort(['same', 'same', 'same']);
      expect(result).toEqual(['same']);
    });
  });

  describe('sorting with sortKey', () => {
    it('should sort objects alphabetically by the specified string key', () => {
      const arr = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should sort objects lexicographically by a numeric key (string coercion)', () => {
      const arr = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const result = deduplicateAndSort(arr, 'age');
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie', 'Bob']);
    });

    it('should treat missing sortKey values as empty string (sorts to front)', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice', age: 25 },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, 'age');
      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Alice');
    });

    it('should treat null property values as empty string when sorting', () => {
      const arr = [
        { name: 'Charlie', score: null },
        { name: 'Alice', score: 10 },
        { name: 'Bob', score: 5 },
      ];
      const result = deduplicateAndSort(arr, 'score');
      // null || '' → '', String(10) → '10', String(5) → '5'
      // localeCompare('', '10') < 0, localeCompare('10', '5') < 0 (lexicographic)
      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Alice');
      expect(result[2].name).toBe('Bob');
    });

    it('should treat 0 property values as empty string when sorting', () => {
      const arr = [
        { name: 'Charlie', count: 0 },
        { name: 'Alice', count: 5 },
        { name: 'Bob', count: 10 },
      ];
      const result = deduplicateAndSort(arr, 'count');
      // 0 || '' → '', String(5) → '5', String(10) → '10'
      // localeCompare('', '10') < 0, localeCompare('10', '5') < 0 (lexicographic)
      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Alice');
    });

    it('should treat false property values as empty string when sorting', () => {
      const arr = [
        { name: 'Charlie', active: false },
        { name: 'Alice', active: true },
      ];
      const result = deduplicateAndSort(arr, 'active');
      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Alice');
    });

    it('should include undefined items in array when sortKey is provided', () => {
      const arr = [
        { name: 'Charlie' },
        undefined,
        { name: 'Alice' },
      ];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.length).toBe(3);
      expect(result.some(r => r === undefined)).toBe(true);
      expect(result.filter(r => r && r.name).map(r => r.name)).toEqual(['Alice', 'Charlie']);
    });

    it('should sort objects when sortKey is an empty string (falls back to default sort preserving order)', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, '');
      // !'' is true, so uses default sort() which calls toString() on objects → all '[object Object]'
      // Stable sort preserves original order
      expect(result.map(r => r.name)).toEqual(['Charlie', 'Alice', 'Bob']);
    });

    it('should preserve relative order when sortKey does not exist on any item (stable sort)', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
      ];
      const result = deduplicateAndSort(arr, 'nonexistent');
      expect(result.map(r => r.name)).toEqual(['Charlie', 'Alice']);
    });

    it('should handle objects with symbol keys alongside regular keys', () => {
      const sym = Symbol('test');
      const arr = [{ name: 'Charlie', [sym]: 'x' }, { name: 'Alice' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie']);
    });

    it('should sort objects with boolean property values alphabetically', () => {
      const arr = [
        { name: 'Charlie', active: true },
        { name: 'Alice', active: false },
      ];
      const result = deduplicateAndSort(arr, 'active');
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie']);
    });

    it('should handle sortKey that is a numeric zero (falsy, treated as no sortKey, preserves order)', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, 0);
      // !0 is true, so uses default sort() → all '[object Object]' → stable sort preserves order
      expect(result.map(r => r.name)).toEqual(['Charlie', 'Alice', 'Bob']);
    });
  });

  describe('edge cases', () => {
    it('should handle arrays with mixed null and undefined values (preserves them after dedup)', () => {
      const result = deduplicateAndSort([null, undefined, null, 'a']);
      // Set deduplicates null to one, keeps undefined, sort() puts null/undefined at end
      expect(result).toEqual(['a', null, undefined]);
    });

    it('should handle arrays with function references', () => {
      const fn = () => {};
      const result = deduplicateAndSort([fn, fn, () => {}]);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(fn);
    });

    it('should handle deeply nested objects with sortKey', () => {
      const arr = [
        { data: { name: 'Charlie' } },
        { data: { name: 'Alice' } },
      ];
      const result = deduplicateAndSort(arr, 'data');
      // sortKey 'data' returns the nested object, String(object) = '[object Object]'
      // All items get the same string, so order is preserved (stable sort)
      expect(result.map(r => r.data.name)).toEqual(['Charlie', 'Alice']);
    });
  });
});
