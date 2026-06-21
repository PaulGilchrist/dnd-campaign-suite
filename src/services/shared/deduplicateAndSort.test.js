// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { deduplicateAndSort } from './deduplicateAndSort.js';

describe('deduplicateAndSort', () => {
  describe('invalid / empty inputs', () => {
    it('should return empty array for null, undefined, non-array, and empty array', () => {
      expect(deduplicateAndSort(null)).toEqual([]);
      expect(deduplicateAndSort(undefined)).toEqual([]);
      expect(deduplicateAndSort('string')).toEqual([]);
      expect(deduplicateAndSort(42)).toEqual([]);
      expect(deduplicateAndSort({})).toEqual([]);
      expect(deduplicateAndSort([])).toEqual([]);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate and sort string primitives', () => {
      const result = deduplicateAndSort(['a', 'b', 'a', 'c', 'b', 'a']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should deduplicate and sort number primitives', () => {
      const result = deduplicateAndSort([3, 1, 2, 1, 3, 2]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should treat different types as distinct values', () => {
      const result = deduplicateAndSort([1, '1', 2]);
      expect(result).toEqual([1, '1', 2]);
    });

    it('should deduplicate objects by reference equality', () => {
      const obj = { name: 'Alice' };
      const arr = [obj, obj, { name: 'Bob' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should deduplicate mixed-type primitives', () => {
      const result = deduplicateAndSort(['b', 1, 'a', 2, 'b', 1]);
      expect(result).toEqual([1, 2, 'a', 'b']);
    });
  });

  describe('sorting without sortKey', () => {
    it('should sort strings alphabetically using localeCompare', () => {
      const result = deduplicateAndSort(['zebra', 'alpha', 'middle']);
      expect(result).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should sort strings case-sensitively (uppercase before lowercase)', () => {
      const result = deduplicateAndSort(['Zebra', 'alpha']);
      expect(result).toEqual(['Zebra', 'alpha']);
    });

    it('should sort numbers lexicographically (not numerically)', () => {
      const result = deduplicateAndSort([10, 2, 1]);
      expect(result).toEqual([1, 10, 2]);
    });

    it('should sort mixed primitives lexicographically', () => {
      const result = deduplicateAndSort(['b', 1, 'a', 2]);
      expect(result).toEqual([1, 2, 'a', 'b']);
    });

    it('should handle empty strings in the array', () => {
      const result = deduplicateAndSort(['', 'b', '', 'a']);
      expect(result).toEqual(['', 'a', 'b']);
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

    it('should sort objects lexicographically by a numeric key', () => {
      const arr = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const result = deduplicateAndSort(arr, 'age');
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie', 'Bob']);
    });

    it('should handle missing sortKey values by treating them as empty string (sorts missing first)', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice', age: 25 },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, 'age');
      // Items with missing age get '' which sorts before numeric strings via localeCompare
      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Alice');
    });

    it('should include undefined items in array when sortKey is provided', () => {
      const arr = [
        { name: 'Charlie' },
        undefined,
        { name: 'Alice' },
      ];
      const result = deduplicateAndSort(arr, 'name');
      // undefined?.[sortKey] || '' = '', so undefined items sort to front but are included
      expect(result.length).toBe(3);
      expect(result.some(r => r === undefined)).toBe(true);
      expect(result.filter(r => r && r.name).map(r => r.name)).toEqual(['Alice', 'Charlie']);
    });

    it('should handle empty string sortKey by falling back to default sort', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ];
      const result = deduplicateAndSort(arr, '');
      // !sortKey is true for '', so uses default sort() which calls toString() on objects
      expect(result.length).toBe(3);
    });

    it('should handle sortKey that does not exist on any item (all get empty string, preserves order)', () => {
      const arr = [
        { name: 'Charlie' },
        { name: 'Alice' },
      ];
      const result = deduplicateAndSort(arr, 'nonexistent');
      // All items get '' for the nonexistent key, localeCompare('', '') === 0, so order is preserved
      expect(result.map(r => r.name)).toEqual(['Charlie', 'Alice']);
    });

    it('should handle objects with symbol keys alongside regular keys', () => {
      const sym = Symbol('test');
      const arr = [{ name: 'Charlie', [sym]: 'x' }, { name: 'Alice' }];
      const result = deduplicateAndSort(arr, 'name');
      expect(result.map(r => r.name)).toEqual(['Alice', 'Charlie']);
    });
  });

  describe('edge cases', () => {
    it('should deduplicate NaN values (Set treats all NaN as equal) but sort() places NaN last', () => {
      const result = deduplicateAndSort([NaN, 1, NaN, 2]);
      // Set deduplicates NaN to one entry, then sort() puts NaN at the end
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result.some(v => Number.isNaN(v))).toBe(true);
    });

    it('should return single element for single-element array', () => {
      const result = deduplicateAndSort(['only']);
      expect(result).toEqual(['only']);
    });

    it('should collapse all identical values to a single element', () => {
      const result = deduplicateAndSort(['same', 'same', 'same']);
      expect(result).toEqual(['same']);
    });
  });
});
