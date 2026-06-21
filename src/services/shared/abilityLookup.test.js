// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  getAbility,
  getAbilityBonus,
  getAbilityModifier,
  getAbilitySaveModifier,
} from './abilityLookup.js';

const FULL_ABILITIES = [
  { name: 'Strength', bonus: 3 },
  { name: 'Dexterity', bonus: 2 },
  { name: 'Constitution', bonus: 4 },
  { name: 'Intelligence', bonus: 1 },
  { name: 'Wisdom', bonus: 5 },
  { name: 'Charisma', bonus: 0 },
];

const PLAYER_STATS = { abilities: FULL_ABILITIES };

const ABILITY_LOOKUP_TESTS = [
  { abbreviation: 'str', fullName: 'strength', canonical: 'Strength', bonus: 3, save: 5 },
  { abbreviation: 'dex', fullName: 'dexterity', canonical: 'Dexterity', bonus: 2, save: 4 },
  { abbreviation: 'con', fullName: 'constitution', canonical: 'Constitution', bonus: 4, save: 6 },
  { abbreviation: 'int', fullName: 'intelligence', canonical: 'Intelligence', bonus: 1, save: 3 },
  { abbreviation: 'wis', fullName: 'wisdom', canonical: 'Wisdom', bonus: 5, save: 7 },
  { abbreviation: 'cha', fullName: 'charisma', canonical: 'Charisma', bonus: 0, save: 2 },
];

describe('getAbility', () => {
  it('should return null when playerStats is null', () => {
    expect(getAbility(null, 'str')).toBeNull();
  });

  it('should return null when playerStats has no abilities', () => {
    expect(getAbility({}, 'str')).toBeNull();
    expect(getAbility({ abilities: null }, 'str')).toBeNull();
    expect(getAbility({ abilities: [] }, 'str')).toBeNull();
  });

  it('should return null for unknown ability names', () => {
    expect(getAbility(PLAYER_STATS, 'finesse')).toBeNull();
    expect(getAbility(PLAYER_STATS, 'hit points')).toBeNull();
    expect(getAbility(PLAYER_STATS, '')).toBeNull();
    expect(getAbility(PLAYER_STATS, null)).toBeNull();
    expect(getAbility(PLAYER_STATS, undefined)).toBeNull();
  });

  it('should find abilities by abbreviation (case-insensitive)', () => {
    const abilities = [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 4 },
      { name: 'Intelligence', bonus: 1 },
      { name: 'Wisdom', bonus: 5 },
      { name: 'Charisma', bonus: 0 },
    ];
    const stats = { abilities };
    expect(getAbility(stats, 'str').name).toBe('Strength');
    expect(getAbility(stats, 'STR').name).toBe('Strength');
    expect(getAbility(stats, 'dex').name).toBe('Dexterity');
    expect(getAbility(stats, 'DEX').name).toBe('Dexterity');
    expect(getAbility(stats, 'con').name).toBe('Constitution');
    expect(getAbility(stats, 'int').name).toBe('Intelligence');
    expect(getAbility(stats, 'wis').name).toBe('Wisdom');
    expect(getAbility(stats, 'cha').name).toBe('Charisma');
  });

  it('should find abilities by full name (case-insensitive)', () => {
    expect(getAbility(PLAYER_STATS, 'strength').name).toBe('Strength');
    expect(getAbility(PLAYER_STATS, 'STRENGTH').name).toBe('Strength');
    expect(getAbility(PLAYER_STATS, 'dexterity').name).toBe('Dexterity');
    expect(getAbility(PLAYER_STATS, 'constitution').name).toBe('Constitution');
    expect(getAbility(PLAYER_STATS, 'intelligence').name).toBe('Intelligence');
    expect(getAbility(PLAYER_STATS, 'wisdom').name).toBe('Wisdom');
    expect(getAbility(PLAYER_STATS, 'charisma').name).toBe('Charisma');
  });

  it('should return the matching ability object with correct properties', () => {
    const result = getAbility(PLAYER_STATS, 'str');
    expect(result).toEqual({ name: 'Strength', bonus: 3 });
  });

  it('should return null when ability name contains spaces that prevent matching', () => {
    expect(getAbility(PLAYER_STATS, 'strength ability')).toBeNull();
  });
});

describe('getAbilityBonus', () => {
  it('should return 0 for null/undefined playerStats', () => {
    expect(getAbilityBonus(null, 'str')).toBe(0);
    expect(getAbilityBonus(undefined, 'str')).toBe(0);
    expect(getAbilityBonus({}, 'str')).toBe(0);
  });

  it('should return 0 when ability is not found or name is invalid', () => {
    expect(getAbilityBonus(PLAYER_STATS, 'finesse')).toBe(0);
    expect(getAbilityBonus(PLAYER_STATS, '')).toBe(0);
    expect(getAbilityBonus(PLAYER_STATS, null)).toBe(0);
    expect(getAbilityBonus(PLAYER_STATS, undefined)).toBe(0);
  });

  it('should return the correct bonus for each ability', () => {
    expect(getAbilityBonus(PLAYER_STATS, 'str')).toBe(3);
    expect(getAbilityBonus(PLAYER_STATS, 'dex')).toBe(2);
    expect(getAbilityBonus(PLAYER_STATS, 'con')).toBe(4);
    expect(getAbilityBonus(PLAYER_STATS, 'int')).toBe(1);
    expect(getAbilityBonus(PLAYER_STATS, 'wis')).toBe(5);
    expect(getAbilityBonus(PLAYER_STATS, 'cha')).toBe(0);
  });

  it('should handle negative bonuses', () => {
    const stats = { abilities: [{ name: 'Strength', bonus: -2 }] };
    expect(getAbilityBonus(stats, 'str')).toBe(-2);
  });

  it('should return 0 when ability exists but bonus is undefined', () => {
    const stats = { abilities: [{ name: 'Strength' }] };
    expect(getAbilityBonus(stats, 'str')).toBe(0);
  });

  it('should match ability names case-insensitively', () => {
    expect(getAbilityBonus(PLAYER_STATS, 'STR')).toBe(3);
    expect(getAbilityBonus(PLAYER_STATS, 'STRENGTH')).toBe(3);
    expect(getAbilityBonus(PLAYER_STATS, 'strength')).toBe(3);
  });
});

describe('getAbilityModifier', () => {
  it('should return 0 for null/undefined/empty abilities', () => {
    expect(getAbilityModifier(null, 'str')).toBe(0);
    expect(getAbilityModifier(undefined, 'str')).toBe(0);
    expect(getAbilityModifier([], 'str')).toBe(0);
  });

  it('should return 0 when abilityName is invalid', () => {
    expect(getAbilityModifier(FULL_ABILITIES, '')).toBe(0);
    expect(getAbilityModifier(FULL_ABILITIES, null)).toBe(0);
    expect(getAbilityModifier(FULL_ABILITIES, undefined)).toBe(0);
    expect(getAbilityModifier(FULL_ABILITIES, 'finesse')).toBe(0);
  });

  it('should return the bonus from the matching ability', () => {
    expect(getAbilityModifier(FULL_ABILITIES, 'str')).toBe(3);
    expect(getAbilityModifier(FULL_ABILITIES, 'dex')).toBe(2);
    expect(getAbilityModifier(FULL_ABILITIES, 'con')).toBe(4);
  });

  it('should handle negative bonuses', () => {
    const abilities = [{ name: 'Strength', bonus: -2 }];
    expect(getAbilityModifier(abilities, 'str')).toBe(-2);
  });

  it('should return 0 when ability exists but bonus is undefined', () => {
    const abilities = [{ name: 'Strength' }];
    expect(getAbilityModifier(abilities, 'str')).toBe(0);
  });

  it('should match by abbreviation and full name case-insensitively', () => {
    expect(getAbilityModifier(FULL_ABILITIES, 'wis')).toBe(5);
    expect(getAbilityModifier(FULL_ABILITIES, 'WIS')).toBe(5);
    expect(getAbilityModifier(FULL_ABILITIES, 'wisdom')).toBe(5);
    expect(getAbilityModifier(FULL_ABILITIES, 'WISDOM')).toBe(5);
  });
});

describe('getAbilitySaveModifier', () => {
  it('should return 0 for null/undefined/empty abilities', () => {
    expect(getAbilitySaveModifier(null, 'str')).toBe(0);
    expect(getAbilitySaveModifier(undefined, 'str')).toBe(0);
    expect(getAbilitySaveModifier([], 'str')).toBe(0);
  });

  it('should return 0 when abilityName is invalid', () => {
    expect(getAbilitySaveModifier(FULL_ABILITIES, '')).toBe(0);
    expect(getAbilitySaveModifier(FULL_ABILITIES, null)).toBe(0);
    expect(getAbilitySaveModifier(FULL_ABILITIES, undefined)).toBe(0);
    expect(getAbilitySaveModifier(FULL_ABILITIES, 'finesse')).toBe(0);
  });

  it('should return save when ability has a save property', () => {
    const abilities = [
      { name: 'Strength', bonus: 3, save: 5 },
      { name: 'Dexterity', bonus: 2, save: 4 },
    ];
    expect(getAbilitySaveModifier(abilities, 'str')).toBe(5);
    expect(getAbilitySaveModifier(abilities, 'dex')).toBe(4);
  });

  it('should fall back to bonus when save is not defined', () => {
    const abilities = [{ name: 'Constitution', bonus: 4 }];
    expect(getAbilitySaveModifier(abilities, 'con')).toBe(4);
  });

  it('should prioritize save over bonus when both exist', () => {
    const abilities = [{ name: 'Dexterity', bonus: 2, save: 8 }];
    expect(getAbilitySaveModifier(abilities, 'dex')).toBe(8);
  });

  it('should return save even when bonus is 0', () => {
    const abilities = [{ name: 'Charisma', bonus: 0, save: 3 }];
    expect(getAbilitySaveModifier(abilities, 'cha')).toBe(3);
  });

  it('should return bonus when save is 0', () => {
    const abilities = [{ name: 'Intelligence', bonus: 1, save: 0 }];
    expect(getAbilitySaveModifier(abilities, 'int')).toBe(0);
  });

  it('should handle negative save and bonus values', () => {
    const abilities = [{ name: 'Wisdom', bonus: -2, save: -1 }];
    expect(getAbilitySaveModifier(abilities, 'wis')).toBe(-1);
    expect(getAbilitySaveModifier([{ name: 'Wisdom', bonus: -2 }], 'wis')).toBe(-2);
  });

  it('should return 0 when ability exists but both save and bonus are undefined', () => {
    const abilities = [{ name: 'Strength' }];
    expect(getAbilitySaveModifier(abilities, 'str')).toBe(0);
  });

  it('should match ability names case-insensitively', () => {
    const abilities = [{ name: 'Strength', bonus: 3, save: 5 }];
    expect(getAbilitySaveModifier(abilities, 'str')).toBe(5);
    expect(getAbilitySaveModifier(abilities, 'STR')).toBe(5);
    expect(getAbilitySaveModifier(abilities, 'strength')).toBe(5);
  });

  it('should handle all six ability saves', () => {
    const abilities = ABILITY_LOOKUP_TESTS.map(a => ({
      name: a.canonical,
      bonus: a.bonus,
      save: a.save,
    }));
    for (const test of ABILITY_LOOKUP_TESTS) {
      expect(getAbilitySaveModifier(abilities, test.abbreviation)).toBe(test.save);
      expect(getAbilitySaveModifier(abilities, test.fullName)).toBe(test.save);
    }
  });
});
