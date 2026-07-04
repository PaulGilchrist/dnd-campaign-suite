import { describe, it, expect } from 'vitest';
import { extractDamageDiceFromDescription } from './MonsterCardModal.jsx';

describe('extractDamageDiceFromDescription', () => {
  describe('existingDamageDice takes precedence', () => {
    it('returns existingDamageDice when provided, ignoring description', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3)', '2d6+4')).toBe('2d6+4');
      expect(extractDamageDiceFromDescription('Hit: 10 (2d8+4) slashing', '1d12+5')).toBe('1d12+5');
    });
  });

  describe('falsy description returns null', () => {
    it('returns null when description is null, undefined, or empty string', () => {
      expect(extractDamageDiceFromDescription(null, null)).toBe(null);
      expect(extractDamageDiceFromDescription(undefined, null)).toBe(null);
      expect(extractDamageDiceFromDescription('', null)).toBe(null);
    });
  });

  describe('regex extraction from Hit/Failure/Success lines', () => {
    it('extracts dice with optional modifier and damage type text', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('Hit: 10 (2d8+4) slashing damage.')).toBe('2d8+4');
      expect(extractDamageDiceFromDescription('Hit: 5 (1d4-1) bludgeoning damage.')).toBe('1d4-1');
      expect(extractDamageDiceFromDescription('Hit: 4 (1d4) piercing damage.')).toBe('1d4');
    });

    it('normalizes whitespace inside the dice expression', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6  +  3) piercing damage.')).toBe('1d6 + 3');
    });

    it('matches Hit, Failure, and Success keywords case-insensitively', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('HIT: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('Failure: 3 (1d4) poison damage.')).toBe('1d4');
      expect(extractDamageDiceFromDescription('Success: 5 (2d6+2) radiant damage.')).toBe('2d6+2');
    });
  });

  describe('returns null for non-matching descriptions', () => {
    it('returns null when there is no Hit/Failure/Success line, no dice in parens, or non-dice content in parens', () => {
      expect(extractDamageDiceFromDescription('The creature makes a melee weapon attack.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 slashing damage.')).toBe(null);
      expect(extractDamageDiceFromDescription('Hit: 7 (advantage) slashing damage.')).toBe(null);
      expect(extractDamageDiceFromDescription('The goblin bites you.')).toBe(null);
    });
  });
});
