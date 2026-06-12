import { describe, it, expect } from 'vitest';
import {
  getAbility,
  getAbilityBonus,
  getAbilityModifier,
  getAbilitySaveModifier,
} from './abilityLookup.js';

describe('normalizeAbilityName (internal)', () => {
  it('should return null for falsy values', () => {
    expect(getAbility(null, null)).toBeNull();
    expect(getAbility(null, undefined)).toBeNull();
    expect(getAbility(null, '')).toBeNull();
  });

  it('should normalize lowercase abbreviations to canonical names', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 4 },
        { name: 'Intelligence', bonus: 1 },
        { name: 'Wisdom', bonus: 5 },
        { name: 'Charisma', bonus: 0 },
      ],
    };
    expect(getAbility(playerStats, 'str')).toEqual(playerStats.abilities[0]);
    expect(getAbility(playerStats, 'dex')).toEqual(playerStats.abilities[1]);
    expect(getAbility(playerStats, 'con')).toEqual(playerStats.abilities[2]);
    expect(getAbility(playerStats, 'int')).toEqual(playerStats.abilities[3]);
    expect(getAbility(playerStats, 'wis')).toEqual(playerStats.abilities[4]);
    expect(getAbility(playerStats, 'cha')).toEqual(playerStats.abilities[5]);
  });

  it('should normalize uppercase abbreviations to canonical names', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, 'STR')).toEqual(playerStats.abilities[0]);
  });

  it('should normalize full ability names (case-insensitive)', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 4 },
        { name: 'Intelligence', bonus: 1 },
        { name: 'Wisdom', bonus: 5 },
        { name: 'Charisma', bonus: 0 },
      ],
    };
    expect(getAbility(playerStats, 'strength')).toEqual(playerStats.abilities[0]);
    expect(getAbility(playerStats, 'STRENGTH')).toEqual(playerStats.abilities[0]);
    expect(getAbility(playerStats, 'dexterity')).toEqual(playerStats.abilities[1]);
    expect(getAbility(playerStats, 'constitution')).toEqual(playerStats.abilities[2]);
    expect(getAbility(playerStats, 'intelligence')).toEqual(playerStats.abilities[3]);
    expect(getAbility(playerStats, 'wisdom')).toEqual(playerStats.abilities[4]);
    expect(getAbility(playerStats, 'charisma')).toEqual(playerStats.abilities[5]);
  });

  it('should normalize ability names with spaces', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, 'strength ability')).toBeNull();
    // Spaces are removed so "strength ability" becomes "strengthability" which doesn't match
  });

  it('should return null for unknown ability names', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, 'finesse')).toBeNull();
    expect(getAbility(playerStats, 'hit points')).toBeNull();
    expect(getAbility(playerStats, 'foo')).toBeNull();
  });
});

describe('getAbility', () => {
  it('should return null when playerStats is null', () => {
    expect(getAbility(null, 'str')).toBeNull();
  });

  it('should return null when playerStats is undefined', () => {
    expect(getAbility(undefined, 'str')).toBeNull();
  });

  it('should return null when playerStats has no abilities', () => {
    expect(getAbility({}, 'str')).toBeNull();
  });

  it('should return null when abilities array is empty', () => {
    expect(getAbility({ abilities: [] }, 'str')).toBeNull();
  });

  it('should return the matching ability object', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
      ],
    };
    const result = getAbility(playerStats, 'str');
    expect(result).toEqual({ name: 'Strength', bonus: 3 });
  });

  it('should return null when ability name is not found in abilities array', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, 'dex')).toBeNull();
  });

  it('should return null when abilityName is null', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, null)).toBeNull();
  });

  it('should return null when abilityName is undefined', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, undefined)).toBeNull();
  });

  it('should return null when abilityName is empty string', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbility(playerStats, '')).toBeNull();
  });

  it('should match ability name case-insensitively using abbreviation', () => {
    const playerStats = {
      abilities: [
        { name: 'Wisdom', bonus: 1 },
      ],
    };
    expect(getAbility(playerStats, 'wis')).toEqual(playerStats.abilities[0]);
    expect(getAbility(playerStats, 'WIS')).toEqual(playerStats.abilities[0]);
  });

  it('should match ability name case-insensitively using full name', () => {
    const playerStats = {
      abilities: [
        { name: 'Charisma', bonus: 5 },
      ],
    };
    expect(getAbility(playerStats, 'charisma')).toEqual(playerStats.abilities[0]);
    expect(getAbility(playerStats, 'CHARISMA')).toEqual(playerStats.abilities[0]);
    expect(getAbility(playerStats, 'ChaRiSmA')).toEqual(playerStats.abilities[0]);
  });

  it('should return the first matching ability', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
      ],
    };
    expect(getAbility(playerStats, 'str').name).toBe('Strength');
  });
});

describe('getAbilityBonus', () => {
  it('should return 0 when playerStats is null', () => {
    expect(getAbilityBonus(null, 'str')).toBe(0);
  });

  it('should return 0 when playerStats is undefined', () => {
    expect(getAbilityBonus(undefined, 'str')).toBe(0);
  });

  it('should return 0 when playerStats has no abilities', () => {
    expect(getAbilityBonus({}, 'str')).toBe(0);
  });

  it('should return 0 when ability is not found', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbilityBonus(playerStats, 'dex')).toBe(0);
  });

  it('should return 0 when abilityName is null', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbilityBonus(playerStats, null)).toBe(0);
  });

  it('should return 0 when abilityName is undefined', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbilityBonus(playerStats, undefined)).toBe(0);
  });

  it('should return 0 when abilityName is empty string', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
      ],
    };
    expect(getAbilityBonus(playerStats, '')).toBe(0);
  });

  it('should return the bonus from the matching ability', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Constitution', bonus: 4 },
      ],
    };
    expect(getAbilityBonus(playerStats, 'str')).toBe(3);
    expect(getAbilityBonus(playerStats, 'dex')).toBe(2);
    expect(getAbilityBonus(playerStats, 'con')).toBe(4);
  });

  it('should handle bonus of 0', () => {
    const playerStats = {
      abilities: [
        { name: 'Charisma', bonus: 0 },
      ],
    };
    expect(getAbilityBonus(playerStats, 'cha')).toBe(0);
  });

  it('should handle negative bonus', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength', bonus: -2 },
      ],
    };
    expect(getAbilityBonus(playerStats, 'str')).toBe(-2);
  });

  it('should handle positive bonus', () => {
    const playerStats = {
      abilities: [
        { name: 'Intelligence', bonus: 5 },
      ],
    };
    expect(getAbilityBonus(playerStats, 'int')).toBe(5);
  });

  it('should match ability name case-insensitively', () => {
    const playerStats = {
      abilities: [
        { name: 'Wisdom', bonus: 1 },
      ],
    };
    expect(getAbilityBonus(playerStats, 'wis')).toBe(1);
    expect(getAbilityBonus(playerStats, 'WIS')).toBe(1);
    expect(getAbilityBonus(playerStats, 'wisdom')).toBe(1);
  });

  it('should return 0 when ability exists but bonus is undefined', () => {
    const playerStats = {
      abilities: [
        { name: 'Strength' }, // no bonus property
      ],
    };
    expect(getAbilityBonus(playerStats, 'str')).toBe(0);
  });
});

describe('getAbilityModifier', () => {
  it('should return 0 when abilities is null', () => {
    expect(getAbilityModifier(null, 'str')).toBe(0);
  });

  it('should return 0 when abilities is undefined', () => {
    expect(getAbilityModifier(undefined, 'str')).toBe(0);
  });

  it('should return 0 when abilities is an empty array', () => {
    expect(getAbilityModifier([], 'str')).toBe(0);
  });

  it('should return 0 when abilityName is null', () => {
    expect(getAbilityModifier([{ name: 'Strength', bonus: 3 }], null)).toBe(0);
  });

  it('should return 0 when abilityName is undefined', () => {
    expect(getAbilityModifier([{ name: 'Strength', bonus: 3 }], undefined)).toBe(0);
  });

  it('should return 0 when abilityName is empty string', () => {
    expect(getAbilityModifier([{ name: 'Strength', bonus: 3 }], '')).toBe(0);
  });

  it('should return 0 when ability name is not found', () => {
    const abilities = [
      { name: 'Strength', bonus: 3 },
    ];
    expect(getAbilityModifier(abilities, 'dex')).toBe(0);
  });

  it('should return the bonus from the matching ability', () => {
    const abilities = [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 4 },
    ];
    expect(getAbilityModifier(abilities, 'str')).toBe(3);
    expect(getAbilityModifier(abilities, 'dex')).toBe(2);
    expect(getAbilityModifier(abilities, 'con')).toBe(4);
  });

  it('should handle bonus of 0', () => {
    const abilities = [
      { name: 'Charisma', bonus: 0 },
    ];
    expect(getAbilityModifier(abilities, 'cha')).toBe(0);
  });

  it('should handle negative bonus', () => {
    const abilities = [
      { name: 'Strength', bonus: -2 },
    ];
    expect(getAbilityModifier(abilities, 'str')).toBe(-2);
  });

  it('should match ability name case-insensitively', () => {
    const abilities = [
      { name: 'Intelligence', bonus: 1 },
    ];
    expect(getAbilityModifier(abilities, 'int')).toBe(1);
    expect(getAbilityModifier(abilities, 'INT')).toBe(1);
    expect(getAbilityModifier(abilities, 'intelligence')).toBe(1);
  });

  it('should return 0 when ability exists but bonus is undefined', () => {
    const abilities = [
      { name: 'Strength' }, // no bonus property
    ];
    expect(getAbilityModifier(abilities, 'str')).toBe(0);
  });

  it('should match using full ability name', () => {
    const abilities = [
      { name: 'Wisdom', bonus: 5 },
    ];
    expect(getAbilityModifier(abilities, 'wisdom')).toBe(5);
    expect(getAbilityModifier(abilities, 'WISDOM')).toBe(5);
  });
});

describe('getAbilitySaveModifier', () => {
  it('should return 0 when abilities is null', () => {
    expect(getAbilitySaveModifier(null, 'str')).toBe(0);
  });

  it('should return 0 when abilities is undefined', () => {
    expect(getAbilitySaveModifier(undefined, 'str')).toBe(0);
  });

  it('should return 0 when abilities is an empty array', () => {
    expect(getAbilitySaveModifier([], 'str')).toBe(0);
  });

  it('should return 0 when abilityName is null', () => {
    expect(getAbilitySaveModifier([{ name: 'Strength', bonus: 3 }], null)).toBe(0);
  });

  it('should return 0 when abilityName is undefined', () => {
    expect(getAbilitySaveModifier([{ name: 'Strength', bonus: 3 }], undefined)).toBe(0);
  });

  it('should return 0 when abilityName is empty string', () => {
    expect(getAbilitySaveModifier([{ name: 'Strength', bonus: 3 }], '')).toBe(0);
  });

  it('should return 0 when ability name is not found', () => {
    const abilities = [
      { name: 'Strength', bonus: 3 },
    ];
    expect(getAbilitySaveModifier(abilities, 'dex')).toBe(0);
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
    const abilities = [
      { name: 'Constitution', bonus: 4 }, // no save property
    ];
    expect(getAbilitySaveModifier(abilities, 'con')).toBe(4);
  });

  it('should return save even when bonus is 0', () => {
    const abilities = [
      { name: 'Charisma', bonus: 0, save: 3 },
    ];
    expect(getAbilitySaveModifier(abilities, 'cha')).toBe(3);
  });

  it('should return bonus when save is 0', () => {
    const abilities = [
      { name: 'Intelligence', bonus: 1, save: 0 },
    ];
    expect(getAbilitySaveModifier(abilities, 'int')).toBe(0);
  });

  it('should handle negative save and bonus values', () => {
    const abilities = [
      { name: 'Wisdom', bonus: -2, save: -1 },
    ];
    expect(getAbilitySaveModifier(abilities, 'wis')).toBe(-1);
    expect(getAbilitySaveModifier([{ name: 'Wisdom', bonus: -2 }], 'wis')).toBe(-2);
  });

  it('should match ability name case-insensitively', () => {
    const abilities = [
      { name: 'Strength', bonus: 3, save: 5 },
    ];
    expect(getAbilitySaveModifier(abilities, 'str')).toBe(5);
    expect(getAbilitySaveModifier(abilities, 'STR')).toBe(5);
    expect(getAbilitySaveModifier(abilities, 'strength')).toBe(5);
  });

  it('should return 0 when ability exists but both save and bonus are undefined', () => {
    const abilities = [
      { name: 'Strength' }, // no save or bonus
    ];
    expect(getAbilitySaveModifier(abilities, 'str')).toBe(0);
  });

  it('should return save when bonus is present but save takes priority', () => {
    const abilities = [
      { name: 'Dexterity', bonus: 2, save: 8 },
    ];
    expect(getAbilitySaveModifier(abilities, 'dex')).toBe(8);
  });

  it('should handle all six ability saves', () => {
    const abilities = [
      { name: 'Strength', bonus: 3, save: 5 },
      { name: 'Dexterity', bonus: 2, save: 4 },
      { name: 'Constitution', bonus: 4, save: 6 },
      { name: 'Intelligence', bonus: 1, save: 3 },
      { name: 'Wisdom', bonus: 5, save: 7 },
      { name: 'Charisma', bonus: 0, save: 2 },
    ];
    expect(getAbilitySaveModifier(abilities, 'str')).toBe(5);
    expect(getAbilitySaveModifier(abilities, 'dex')).toBe(4);
    expect(getAbilitySaveModifier(abilities, 'con')).toBe(6);
    expect(getAbilitySaveModifier(abilities, 'int')).toBe(3);
    expect(getAbilitySaveModifier(abilities, 'wis')).toBe(7);
    expect(getAbilitySaveModifier(abilities, 'cha')).toBe(2);
  });
});
