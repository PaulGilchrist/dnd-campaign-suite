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
      expect(deduplicateAndSort(true)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(deduplicateAndSort([])).toEqual([]);
    });
  });

  describe('string primitives', () => {
    it('should deduplicate and sort strings alphabetically', () => {
      expect(deduplicateAndSort(['c', 'a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('should handle already sorted unique strings', () => {
      expect(deduplicateAndSort(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('should handle all identical elements', () => {
      expect(deduplicateAndSort(['x', 'x', 'x'])).toEqual(['x']);
    });

    it('should handle single element', () => {
      expect(deduplicateAndSort(['only'])).toEqual(['only']);
    });

    it('should handle mixed case strings', () => {
      // localeCompare sorts uppercase before lowercase
      expect(deduplicateAndSort(['Charlie', 'alice', 'Bob'])).toEqual(['Bob', 'Charlie', 'alice']);
    });
  });

  describe('numeric primitives', () => {
    it('should deduplicate and sort numbers as strings via localeCompare', () => {
      // .sort() without args converts to strings, so 10 comes before 2
      expect(deduplicateAndSort([10, 2, 1, 2])).toEqual([1, 10, 2]);
    });

    it('should handle negative numbers', () => {
      expect(deduplicateAndSort([3, -1, 0, -1, 3])).toEqual([-1, 0, 3]);
    });
  });

  describe('mixed types in same array', () => {
    it('should deduplicate and sort mixed types', () => {
      expect(deduplicateAndSort(['b', 1, 'a', 1])).toEqual([1, 'a', 'b']);
    });
  });

  describe('object deduplication by reference (no sortKey)', () => {
    it('should deduplicate objects by reference equality', () => {
      const shared = { name: 'Alice' };
      const result = deduplicateAndSort([shared, shared, { name: 'Bob' }]);
      expect(result).toHaveLength(2);
    });

    it('should keep distinct objects with same values', () => {
      const result = deduplicateAndSort([{ name: 'Alice' }, { name: 'Alice' }]);
      expect(result).toHaveLength(2);
    });
  });

  describe('object sorting with sortKey', () => {
    it('should sort objects by sortKey', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      expect(deduplicateAndSort(arr, 'name').map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should sort objects by numeric sortKey as strings', () => {
      const arr = [{ rank: 10 }, { rank: 2 }, { rank: 1 }];
      expect(deduplicateAndSort(arr, 'rank').map(r => r.rank)).toEqual([1, 10, 2]);
    });

    it('should handle objects with missing sortKey using empty string fallback', () => {
      const arr = [{ name: 'Charlie' }, { other: 'Alice' }, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.map(r => r.name || r.other)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should handle objects with undefined sortKey values', () => {
      const arr = [{ name: 'Charlie' }, { name: undefined }, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.map(r => r.name)).toEqual([undefined, 'Bob', 'Charlie']);
    });

    it('should handle objects with null sortKey values', () => {
      const arr = [{ name: 'Charlie' }, { name: null }, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      // null falls through to '' via || '', so sorts first
      expect(result[0].name).toBe(null);
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });

    it('should handle objects with boolean sortKey values', () => {
      // Set uses reference equality for objects, so all 3 distinct objects remain
      const arr = [{ active: true }, { active: false }, { active: true }];
      const result = deduplicateAndSort(arr, 'active');
      expect(result).toHaveLength(3);
      expect(result.map(r => r.active)).toEqual([false, true, true]);
    });

    it('should deduplicate objects by reference even when sortKey values differ', () => {
      const shared = { name: 'Alice' };
      const result = deduplicateAndSort([shared, shared, { name: 'Bob' }], 'name');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should handle empty sortKey string', () => {
      const arr = [{ a: 'b' }, { a: 'a' }];
      // Empty string is falsy, so falls through to default .sort() which converts objects to strings
      const result = deduplicateAndSort(arr, '');
      expect(result).toHaveLength(2);
    });
  });
});
