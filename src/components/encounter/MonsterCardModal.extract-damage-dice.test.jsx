/* @improved-by-ai */
import { describe, it, expect } from 'vitest';

describe('extractDamageDiceFromDescription', () => {
  // Replicate the function from MonsterCardModal.jsx for direct testing
  function extractDamageDiceFromDescription(description, existingDamageDice) {
    if (existingDamageDice) return existingDamageDice;
    if (!description) return null;
    const hitMatch = description.match(/Hit:\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
    return hitMatch ? hitMatch[1].replace(/\s+/g, ' ').trim() : null;
  }

  describe('existingDamageDice takes precedence', () => {
    it('returns existingDamageDice when provided', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3)', '2d6+4')).toBe('2d6+4');
    });

    it('returns existingDamageDice even when description has valid dice', () => {
      expect(extractDamageDiceFromDescription('Hit: 10 (2d8+4) slashing', '1d12+5')).toBe('1d12+5');
    });
  });

  describe('null/undefined handling', () => {
    it('returns null when description is null', () => {
      expect(extractDamageDiceFromDescription(null, null)).toBe(null);
    });

    it('returns null when description is undefined', () => {
      expect(extractDamageDiceFromDescription(undefined, null)).toBe(null);
    });

    it('returns null when description is empty string', () => {
      expect(extractDamageDiceFromDescription('', null)).toBe(null);
    });
  });

  describe('regex matching', () => {
    it('extracts simple dice from Hit line', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
    });

    it('extracts dice with addition', () => {
      expect(extractDamageDiceFromDescription('Hit: 10 (2d8+4) slashing damage.')).toBe('2d8+4');
    });

    it('extracts dice with subtraction', () => {
      expect(extractDamageDiceFromDescription('Hit: 5 (1d4-1) bludgeoning damage.')).toBe('1d4-1');
    });

    it('extracts dice without modifier', () => {
      expect(extractDamageDiceFromDescription('Hit: 4 (1d4) piercing damage.')).toBe('1d4');
    });

    it('handles spaces around the modifier', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6 + 3) slashing damage.')).toBe('1d6 + 3');
    });

    it('is case insensitive for Hit:', () => {
      expect(extractDamageDiceFromDescription('hit: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
      expect(extractDamageDiceFromDescription('HIT: 7 (1d6+3) piercing damage.')).toBe('1d6+3');
    });

    it('handles large dice counts', () => {
      expect(extractDamageDiceFromDescription('Hit: 40 (8d8+16) fire damage.')).toBe('8d8+16');
    });

    it('handles very large dice counts', () => {
      expect(extractDamageDiceFromDescription('Hit: 91 (18d6+27) bludgeoning damage.')).toBe('18d6+27');
    });
  });

  describe('non-matching descriptions', () => {
    it('returns null when description has no Hit: line', () => {
      expect(extractDamageDiceFromDescription('The creature makes a melee weapon attack.')).toBe(null);
    });

    it('returns null when description has no dice in parens', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 slashing damage.')).toBe(null);
    });

    it('returns null when description has non-dice content in parens', () => {
      expect(extractDamageDiceFromDescription('Hit: 7 (advantage) slashing damage.')).toBe(null);
    });

    it('returns null when description is just text', () => {
      expect(extractDamageDiceFromDescription('The goblin bites you.')).toBe(null);
    });
  });

  describe('whitespace normalization', () => {
    it('collapses spaces inside the dice expression to single space', () => {
      // The regex captures `1d6  +  3` but the replace normalizes it
      expect(extractDamageDiceFromDescription('Hit: 7 (1d6  +  3) piercing damage.')).toBe('1d6 + 3');
    });
  });
});
