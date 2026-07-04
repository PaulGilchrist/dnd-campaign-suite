// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { deduplicateAndSort } from './deduplicateAndSort.js';

describe('deduplicateAndSort', () => {
  describe('invalid / empty inputs', () => {
    it('should return empty array for null, undefined, and non-array types', () => {
      expect(deduplicateAndSort(null)).toEqual([]);
      expect(deduplicateAndSort(undefined)).toEqual([]);
      expect(deduplicateAndSort('string')).toEqual([]);
      expect(deduplicateAndSort(42)).toEqual([]);
      expect(deduplicateAndSort({})).toEqual([]);
    });

  });

  describe('deduplication', () => {
    it('should deduplicate and sort string primitives', () => {
      const result = deduplicateAndSort(['c', 'a', 'b', 'a', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should treat same value with different types as distinct', () => {
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
  });

  describe('sorting', () => {
    it('should sort objects by string and numeric sortKey values', () => {
      const arr = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      expect(deduplicateAndSort(arr, 'name').map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(deduplicateAndSort(arr, 'age').map(r => r.name)).toEqual(['Alice', 'Charlie', 'Bob']);
    });
  });
});
