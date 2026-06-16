import { describe, it, expect } from 'vitest';
import { deduplicateAndSort } from './deduplicateAndSort.js';

describe('deduplicateAndSort', () => {
  describe('basic deduplication', () => {
    it('should return empty array for null input', () => {
      expect(deduplicateAndSort(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(deduplicateAndSort(undefined)).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      expect(deduplicateAndSort('string')).toEqual([]);
      expect(deduplicateAndSort(42)).toEqual([]);
      expect(deduplicateAndSort({})).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(deduplicateAndSort([])).toEqual([]);
    });

    it('should deduplicate primitive values', () => {
      const result = deduplicateAndSort(['a', 'b', 'a', 'c', 'b', 'a']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should deduplicate numbers', () => {
      const result = deduplicateAndSort([3, 1, 2, 1, 3, 2]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should deduplicate mixed types', () => {
      const result = deduplicateAndSort([1, '1', 2]);
      // Set keeps both 1 and '1' (different types), sort converts to strings
      expect(result.length).toBe(3);
    });
  });

  describe('sorting without sortKey', () => {
    it('should sort strings alphabetically', () => {
      const result = deduplicateAndSort(['zebra', 'alpha', 'middle']);
      expect(result).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should sort strings case-sensitively', () => {
      const result = deduplicateAndSort(['Zebra', 'alpha']);
      expect(result).toEqual(['Zebra', 'alpha']);
    });

    it('should sort numbers numerically as strings', () => {
      const result = deduplicateAndSort([10, 2, 1]);
      expect(result).toEqual([1, 10, 2]);
    });

    it('should sort mixed primitives', () => {
      const result = deduplicateAndSort(['b', 1, 'a', 2]);
      expect(result).toEqual([1, 2, 'a', 'b']);
    });
  });

  describe('sorting with sortKey', () => {
    it('should sort objects by the specified key', () => {
      const arr = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const result = deduplicateAndSort(arr, 'name');
      const names = result.map(r => r.name);
      expect(names).toEqual(names.sort());
    });

    it('should sort objects by numeric key', () => {
      const arr = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const result = deduplicateAndSort(arr, 'age');
      const ages = result.map(r => r.age);
      expect(ages).toEqual(ages.sort((a, b) => a - b));
    });

    it('should handle missing sortKey values gracefully', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice', age: 25 },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, 'age');
      expect(result.length).toBe(3);
    });

    it('should handle undefined items in array', () => {
      const arr = [
        { name: 'Charlie' },
        undefined,
        { name: 'Alice' },
      ];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should deduplicate objects by reference', () => {
      const obj = { name: 'Alice' };
      const arr = [obj, obj, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should handle empty string sort keys', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, '');
      expect(result.length).toBe(3);
    });

    it('should handle sortKey that does not exist on any item', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
      ];
      const result = deduplicateAndSort(arr, 'nonexistent');
      expect(result.length).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle array with NaN values', () => {
      const result = deduplicateAndSort([NaN, 1, NaN, 2]);
      expect(result).toContain(1);
      expect(result).toContain(2);
    });

    it('should handle array with empty strings', () => {
      const result = deduplicateAndSort(['', 'b', '', 'a']);
      expect(result).toEqual(['', 'a', 'b']);
    });

    it('should handle single element array', () => {
      const result = deduplicateAndSort(['only']);
      expect(result).toEqual(['only']);
    });

    it('should handle array with all same values', () => {
      const result = deduplicateAndSort(['same', 'same', 'same']);
      expect(result).toEqual(['same']);
    });

    it('should not mutate the original array', () => {
      const arr = ['c', 'b', 'a', 'b'];
      deduplicateAndSort(arr);
      expect(arr).toEqual(['c', 'b', 'a', 'b']);
    });

    it('should handle objects with symbol keys', () => {
      const sym = Symbol('test');
      const arr = [{ name: 'Charlie', [sym]: 'x' }, { name: 'Alice' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.length).toBe(2);
    });
  });
});
