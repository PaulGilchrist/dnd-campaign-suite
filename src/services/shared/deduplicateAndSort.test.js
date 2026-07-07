import { describe, it, expect } from 'vitest';
import { deduplicateAndSort } from './deduplicateAndSort.js';

describe('deduplicateAndSort', () => {
  describe('invalid / empty inputs', () => {
    it('should return empty array for null, non-array types, and empty array', () => {
      expect(deduplicateAndSort(null)).toEqual([]);
      expect(deduplicateAndSort('string')).toEqual([]);
      expect(deduplicateAndSort(42)).toEqual([]);
      expect(deduplicateAndSort({})).toEqual([]);
      expect(deduplicateAndSort([])).toEqual([]);
    });
  });

  describe('deduplication and sorting', () => {
    it('should deduplicate and sort string primitives', () => {
      const result = deduplicateAndSort(['c', 'a', 'b', 'a', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should deduplicate objects by reference equality when using sortKey', () => {
      const obj = { name: 'Alice' };
      const arr = [obj, obj, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should sort objects by sortKey using localeCompare', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      expect(deduplicateAndSort(arr, 'name').map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });
});
