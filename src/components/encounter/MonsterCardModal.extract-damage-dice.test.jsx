// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';

describe('extractDamageDiceFromDescription', () => {
  describe('early returns', () => {
    it('returns existingDamageDice when provided, ignoring description', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3)', '2d6+4')).toBe('2d6+4');
    });

    it('returns null when description is falsy', () => {
      expect(extractDamageDiceFromDescription(null, null)).toBe(null);
    });
  });

  describe('regex extraction from Hit/Failure/Success lines', () => {
    it('extracts dice with optional modifier and damage type', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('Failure: 3 (1d4) poison damage.')).toBe('1d4');
      expect(extractDamageDiceFromDescription('success: 5 (2d6+2) radiant damage.')).toBe('2d6+2');
      expect(extractDamageDiceFromDescription('Hit: 5 (1d4-1) bludgeoning damage.')).toBe('1d4-1');
    });

    it('normalizes whitespace inside the dice expression', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6  +  3) piercing damage.')).toBe('1d6 + 3');
    });
  });

  describe('returns null for non-matching descriptions', () => {
    it('returns null when there is no Hit/Failure/Success line or non-dice content in parens', () => {
      expect(extractDamageDiceFromDescription('The creature makes a melee weapon attack.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 slashing damage.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 (advantage) slashing damage.')).toBe(null);
    });
  });
});
