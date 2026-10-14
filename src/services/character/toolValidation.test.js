import { describe, it, expect } from 'vitest';
import { normalizeCategory } from './toolValidation.js';

describe('toolValidation - normalizeCategory', () => {
  it('should return null/undefined unchanged', () => {
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(undefined)).toBeUndefined();
  });

  it('should return empty string as-is', () => {
    expect(normalizeCategory('')).toBe('');
  });

  it('should return whitespace-only string as empty after trim', () => {
    expect(normalizeCategory('   ')).toBe('');
  });
});
