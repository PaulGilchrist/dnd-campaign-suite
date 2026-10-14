import { describe, it, expect } from 'vitest';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';

describe('extractDamageDiceFromDescription', () => {
  describe('early returns', () => {
    it('returns truthy existingDamageDice, ignoring description', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3)', '2d6+4')).toBe('2d6+4');
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3)', '1d8')).toBe('1d8');
    });

    it('returns null when description is null, undefined, or empty string', () => {
      expect(extractDamageDiceFromDescription(null, null)).toBe(null);
      expect(extractDamageDiceFromDescription(undefined, null)).toBe(null);
      expect(extractDamageDiceFromDescription('', null)).toBe(null);
    });

    it('falls through to regex when existingDamageDice is falsy but description has dice', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (2d8+4) fire damage.', '')).toBe('2d8+4');
      expect(extractDamageDiceFromDescription('Hit: 5 (1d4+2) cold damage.', 0)).toBe('1d4+2');
      expect(extractDamageDiceFromDescription('Hit: 3 (1d4) poison damage.', false)).toBe('1d4');
    });
  });

  describe('regex extraction from Hit/Failure/Success lines', () => {
    it('extracts dice with optional modifier and optional damage type', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('Failure: 3 (1d4) poison damage.')).toBe('1d4');
      expect(extractDamageDiceFromDescription('Hit: 5 (1d4-1) bludgeoning damage.')).toBe('1d4-1');
      expect(extractDamageDiceFromDescription('Hit: 12 (2d6+10) radiant damage.')).toBe('2d6+10');
      expect(extractDamageDiceFromDescription('Hit: 8 (3d6+2)')).toBe('3d6+2');
    });

    it('handles case-insensitive Hit/Failure/Success keywords', () => {
      expect(extractDamageDiceFromDescription('success: 5 (2d6+2) radiant damage.')).toBe('2d6+2');
      expect(extractDamageDiceFromDescription('hit: 5 (1d8) slashing.')).toBe('1d8');
      expect(extractDamageDiceFromDescription('failure: 3 (1d10-1) acid.')).toBe('1d10-1');
      expect(extractDamageDiceFromDescription('HIT: 5 (1d8) slashing.')).toBe('1d8');
      expect(extractDamageDiceFromDescription('FAILURE: 3 (1d10-1) acid.')).toBe('1d10-1');
      expect(extractDamageDiceFromDescription('SUCCESS: 5 (2d6+2) radiant.')).toBe('2d6+2');
    });

    it('normalizes internal whitespace in the dice expression', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6  +  3) piercing damage.')).toBe('1d6 + 3');
    });

    it('does not match dice with spaces between die count and d', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 ( 2 d6 + 1 ) damage.')).toBe(null);
    });

    it('extracts the first matching dice expression when multiple exist', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3) fire, then 2d8+2 cold.')).toBe('1d6+3');
    });
  });

  describe('returns null for non-matching descriptions', () => {
    it('returns null when the description does not contain a valid Hit/Failure/Success dice pattern', () => {
      expect(extractDamageDiceFromDescription('The creature makes a melee weapon attack.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 (advantage) slashing damage.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 slashing damage.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 (12) slashing damage.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: no damage')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 (resisted) damage.')).toBe(null);
    });
  });
});
