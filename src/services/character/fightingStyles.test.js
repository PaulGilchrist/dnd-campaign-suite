// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { FIGHTING_STYLES, getFightingStyle } from './fightingStyles.js';

describe('fightingStyles', () => {
  describe('FIGHTING_STYLES', () => {
    it.each([
      'Archery',
      'Blind Fighting',
      'Defense',
      'Dueling',
      'Great Weapon Fighting',
      'Interception',
      'Protection',
      'Thrown Weapon Fighting',
      'Two-Weapon Fighting',
      'Unarmed Fighting',
      'Blessed Warrior',
      'Druidic Warrior',
      'Superior Technique',
    ])('exports %s with required properties', (name) => {
      const style = FIGHTING_STYLES[name];
      expect(style).toBeDefined();
      expect(style.name).toBe(name);
      expect(style.description).toBeTypeOf('string');
      expect(style.description.length).toBeGreaterThan(0);
    });

    it('exports exactly 13 fighting styles', () => {
      expect(Object.keys(FIGHTING_STYLES)).toHaveLength(13);
    });

    it('provides referentially stable style objects', () => {
      expect(FIGHTING_STYLES['Great Weapon Fighting']).toBe(FIGHTING_STYLES['Great Weapon Fighting']);
      expect(FIGHTING_STYLES['Protection']).toBe(FIGHTING_STYLES['Protection']);
    });
  });

  describe('getFightingStyle', () => {
    it('returns the style object for a known name', () => {
      const result = getFightingStyle('Great Weapon Fighting');
      expect(result).toBe(FIGHTING_STYLES['Great Weapon Fighting']);
    });

    it('returns referentially stable results matching the export', () => {
      expect(getFightingStyle('Great Weapon Fighting')).toBe(FIGHTING_STYLES['Great Weapon Fighting']);
      expect(getFightingStyle('Protection')).toBe(FIGHTING_STYLES['Protection']);
    });

    it('returns null for unknown names', () => {
      expect(getFightingStyle('Unknown Style')).toBeNull();
      expect(getFightingStyle('')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getFightingStyle('')).toBeNull();
    });

    it('returns null for null', () => {
      expect(getFightingStyle(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(getFightingStyle(undefined)).toBeNull();
    });

    it('returns null for falsy values that do not match any key', () => {
      expect(getFightingStyle(0)).toBeNull();
      expect(getFightingStyle(false)).toBeNull();
    });
  });
});
