// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  applyAbilityScoreIncreases,
  mergeDeduplicated,
  mergeAbilitiesByKey,
  resetMiscBonuses,
  resetFeatIncreases,
  resetBackgroundIncreases,
} from './buffApplier.js';

describe('applyAbilityScoreIncreases', () => {
  describe('null/undefined guards', () => {
    it('should return undefined when abilities or increases is nullish', () => {
      expect(applyAbilityScoreIncreases(null, [])).toBeUndefined();
      expect(applyAbilityScoreIncreases(undefined, [])).toBeUndefined();
      expect(applyAbilityScoreIncreases([], null)).toBeUndefined();
      expect(applyAbilityScoreIncreases([], undefined)).toBeUndefined();
    });
  });

  describe('matching behavior', () => {
    it('should apply bonus to matching ability name case-insensitively', () => {
      const abilities = [
        { name: 'Strength', featIncrease: 0 },
        { name: 'Dexterity', featIncrease: 0 },
      ];
      applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 2 }]);
      expect(abilities[0].featIncrease).toBe(2);
      expect(abilities[1].featIncrease).toBe(0);
    });

    it('should accumulate bonuses from multiple increases on the same ability', () => {
      const abilities = [{ name: 'Strength', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, [
        { name: 'strength', amount: 2 },
        { name: 'Strength', amount: 3 },
      ]);
      expect(abilities[0].featIncrease).toBe(5);
    });

    it('should add to existing featIncrease value', () => {
      const abilities = [{ name: 'Intelligence', featIncrease: 4 }];
      applyAbilityScoreIncreases(abilities, [{ name: 'intelligence', amount: 1 }]);
      expect(abilities[0].featIncrease).toBe(5);
    });

    it('should treat missing featIncrease as 0', () => {
      const abilities = [{ name: 'Wisdom' }];
      applyAbilityScoreIncreases(abilities, [{ name: 'wisdom', amount: 2 }]);
      expect(abilities[0].featIncrease).toBe(2);
    });

    it('should support negative amounts', () => {
      const abilities = [{ name: 'Constitution', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, [{ name: 'Constitution', amount: -1 }]);
      expect(abilities[0].featIncrease).toBe(-1);
    });

    it('should handle zero amount without changing value', () => {
      const abilities = [{ name: 'Strength', featIncrease: 3 }];
      applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 0 }]);
      expect(abilities[0].featIncrease).toBe(3);
    });
  });

  describe('skipping rules', () => {
    it('should skip increases with name "any"', () => {
      const abilities = [
        { name: 'Strength', featIncrease: 0 },
        { name: 'Dexterity', featIncrease: 0 },
      ];
      applyAbilityScoreIncreases(abilities, [{ name: 'any', amount: 5 }]);
      expect(abilities[0].featIncrease).toBe(0);
      expect(abilities[1].featIncrease).toBe(0);
    });

    it('should skip increases with missing name property', () => {
      const abilities = [{ name: 'Strength', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, [{ amount: 5 }]);
      expect(abilities[0].featIncrease).toBe(0);
    });

    it('should skip increases with undefined name', () => {
      const abilities = [{ name: 'Strength', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, [{ name: undefined, amount: 5 }]);
      expect(abilities[0].featIncrease).toBe(0);
    });

    it('should not affect non-matching abilities', () => {
      const abilities = [
        { name: 'Strength', featIncrease: 0 },
        { name: 'Dexterity', featIncrease: 3 },
        { name: 'Constitution', featIncrease: 1 },
      ];
      applyAbilityScoreIncreases(abilities, [{ name: 'charisma', amount: 5 }]);
      expect(abilities[0].featIncrease).toBe(0);
      expect(abilities[1].featIncrease).toBe(3);
      expect(abilities[2].featIncrease).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should do nothing with empty increases array', () => {
      const abilities = [{ name: 'Strength', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, []);
      expect(abilities[0].featIncrease).toBe(0);
    });

    it('should not mutate abilities array length', () => {
      const abilities = [{ name: 'Strength', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 2 }]);
      expect(abilities.length).toBe(1);
    });

    it('should handle mixed case between abilities and increases', () => {
      const abilities = [{ name: 'CHARISMA', featIncrease: 0 }];
      applyAbilityScoreIncreases(abilities, [{ name: 'cHaRiSmA', amount: 2 }]);
      expect(abilities[0].featIncrease).toBe(2);
    });

    it('should handle multiple increases affecting different abilities', () => {
      const abilities = [
        { name: 'Strength', featIncrease: 0 },
        { name: 'Dexterity', featIncrease: 0 },
        { name: 'Constitution', featIncrease: 0 },
      ];
      applyAbilityScoreIncreases(abilities, [
        { name: 'strength', amount: 2 },
        { name: 'dexterity', amount: 1 },
        { name: 'constitution', amount: -1 },
      ]);
      expect(abilities[0].featIncrease).toBe(2);
      expect(abilities[1].featIncrease).toBe(1);
      expect(abilities[2].featIncrease).toBe(-1);
    });

    it('should handle "any" mixed with specific increases', () => {
      const abilities = [
        { name: 'Strength', featIncrease: 0 },
        { name: 'Dexterity', featIncrease: 0 },
      ];
      applyAbilityScoreIncreases(abilities, [
        { name: 'any', amount: 10 },
        { name: 'strength', amount: 2 },
      ]);
      expect(abilities[0].featIncrease).toBe(2);
      expect(abilities[1].featIncrease).toBe(0);
    });
  });
});

describe('mergeDeduplicated', () => {
  describe('null/undefined/empty guards', () => {
    it('should return undefined when newItems is nullish or empty', () => {
      const target = { langs: ['Common'] };
      expect(mergeDeduplicated(target, 'langs', null)).toBeUndefined();
      expect(mergeDeduplicated(target, 'langs', undefined)).toBeUndefined();
      expect(mergeDeduplicated(target, 'langs', [])).toBeUndefined();
    });
  });

  describe('deduplication', () => {
    it('should add items that do not already exist', () => {
      const target = { langs: ['Common'] };
      mergeDeduplicated(target, 'langs', ['Elvish']);
      expect(target.langs).toEqual(['Common', 'Elvish']);
    });

    it('should skip items that already exist case-insensitively', () => {
      const target = { langs: ['Common'] };
      mergeDeduplicated(target, 'langs', ['common']);
      expect(target.langs).toEqual(['Common']);
    });

    it('should deduplicate across mixed casing keeping first occurrence', () => {
      const target = { langs: ['ELVISH'] };
      mergeDeduplicated(target, 'langs', ['elvish', 'Elvish']);
      expect(target.langs).toEqual(['ELVISH']);
    });

    it('should not add duplicates from within newItems itself', () => {
      const target = {};
      mergeDeduplicated(target, 'langs', ['Elvish', 'elvish']);
      expect(target.langs).toEqual(['Elvish']);
    });

    it('should preserve casing of existing items', () => {
      const target = { langs: ['COMMON'] };
      mergeDeduplicated(target, 'langs', ['common']);
      expect(target.langs[0]).toBe('COMMON');
    });

    it('should add new items but skip duplicates in mixed batch', () => {
      const target = { langs: ['Common'] };
      mergeDeduplicated(target, 'langs', ['common', 'Elvish', 'COMMON']);
      expect(target.langs).toEqual(['Common', 'Elvish']);
    });
  });

  describe('key initialization', () => {
    it('should initialize the key array if it does not exist on target', () => {
      const target = {};
      mergeDeduplicated(target, 'langs', ['Gnoll']);
      expect(target.langs).toEqual(['Gnoll']);
    });

    it('should handle target[key] being undefined by initializing it', () => {
      const target = { langs: undefined };
      mergeDeduplicated(target, 'langs', ['Dwarvish']);
      expect(target.langs).toEqual(['Dwarvish']);
    });

    it('should work with a non-existent key on the target object', () => {
      const target = { otherKey: [1, 2, 3] };
      mergeDeduplicated(target, 'proficiencies', ['Medium Armor']);
      expect(target.proficiencies).toEqual(['Medium Armor']);
      expect(target.otherKey).toEqual([1, 2, 3]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string items', () => {
      const target = {};
      mergeDeduplicated(target, 'langs', ['']);
      expect(target.langs).toEqual(['']);
    });

    it('should not add duplicate empty strings', () => {
      const target = { langs: [''] };
      mergeDeduplicated(target, 'langs', ['']);
      expect(target.langs).toEqual(['']);
    });

    it('should add multiple new items at once', () => {
      const target = { langs: ['Common'] };
      mergeDeduplicated(target, 'langs', ['Elvish', 'Dwarvish', 'Halfling']);
      expect(target.langs).toEqual(['Common', 'Elvish', 'Dwarvish', 'Halfling']);
    });
  });
});

describe('mergeAbilitiesByKey', () => {
  describe('null/undefined/empty guards', () => {
    it('should return undefined when newItems is nullish or empty', () => {
      const target = { attacks: [{ name: 'Longsword' }] };
      const keyFn = (item) => item.name;
      expect(mergeAbilitiesByKey(target, 'attacks', null, keyFn)).toBeUndefined();
      expect(mergeAbilitiesByKey(target, 'attacks', undefined, keyFn)).toBeUndefined();
      expect(mergeAbilitiesByKey(target, 'attacks', [], keyFn)).toBeUndefined();
    });
  });

  describe('deduplication', () => {
    it('should add items whose key does not already exist', () => {
      const target = { attacks: [{ name: 'Longsword' }] };
      mergeAbilitiesByKey(target, 'attacks', [{ name: 'Dagger' }], (item) => item.name);
      expect(target.attacks).toEqual([{ name: 'Longsword' }, { name: 'Dagger' }]);
    });

    it('should skip items whose key already exists case-insensitively', () => {
      const target = { attacks: [{ name: 'Longsword' }] };
      mergeAbilitiesByKey(target, 'attacks', [{ name: 'longsword' }], (item) => item.name);
      expect(target.attacks).toEqual([{ name: 'Longsword' }]);
    });

    it('should deduplicate using custom keyFn for nested properties', () => {
      const target = { spells: [{ id: 'fireball', level: 3 }] };
      mergeAbilitiesByKey(
        target,
        'spells',
        [{ id: 'fireball', level: 5 }, { id: 'magic-missile' }],
        (item) => item.id,
      );
      expect(target.spells).toEqual([
        { id: 'fireball', level: 3 },
        { id: 'magic-missile' },
      ]);
    });

    it('should handle case-insensitive matching via keyFn result', () => {
      const target = { abilities: [{ type: 'STRONG ARM' }] };
      mergeAbilitiesByKey(
        target,
        'abilities',
        [{ type: 'strong arm' }],
        (item) => item.type,
      );
      expect(target.abilities).toEqual([{ type: 'STRONG ARM' }]);
    });

    it('should preserve existing items casing when deduplicating', () => {
      const target = { proficiencies: [{ name: 'LIGHT ARMOR' }] };
      mergeAbilitiesByKey(
        target,
        'proficiencies',
        [{ name: 'light armor' }],
        (item) => item.name,
      );
      expect(target.proficiencies[0].name).toBe('LIGHT ARMOR');
    });

    it('should not add duplicates from within newItems itself', () => {
      const target = {};
      mergeAbilitiesByKey(target, 'tools', [{ name: 'Thieves' }, { name: 'thieves' }], (item) => item.name);
      expect(target.tools).toEqual([{ name: 'Thieves' }]);
    });

    it('should add multiple new items while deduplicating', () => {
      const target = { attacks: [{ name: 'Bite' }] };
      mergeAbilitiesByKey(target, 'attacks', [
        { name: 'Bite' },
        { name: 'Claw' },
        { name: 'Tail' },
      ], (item) => item.name);
      expect(target.attacks.map((a) => a.name)).toEqual(['Bite', 'Claw', 'Tail']);
    });
  });

  describe('key initialization', () => {
    it('should initialize the key array if it does not exist on target', () => {
      const target = {};
      mergeAbilitiesByKey(target, 'attacks', [{ name: 'Spear' }], (item) => item.name);
      expect(target.attacks).toEqual([{ name: 'Spear' }]);
    });

    it('should handle target[key] being undefined by initializing it', () => {
      const target = { attacks: undefined };
      mergeAbilitiesByKey(target, 'attacks', [{ name: 'Bow' }], (item) => item.name);
      expect(target.attacks).toEqual([{ name: 'Bow' }]);
    });
  });

  describe('keyFn validation', () => {
    it('should throw TypeError when keyFn returns undefined', () => {
      const target = {};
      expect(
        () => mergeAbilitiesByKey(
          target,
          'items',
          [{ name: 'A' }],
          (item) => item.missingKey,
        ),
      ).toThrow(TypeError);
    });

    it('should throw TypeError when keyFn returns a non-string value', () => {
      const target = { items: [{ id: 1 }] };
      expect(
        () => mergeAbilitiesByKey(target, 'items', [{ id: 2 }], (item) => item.id),
      ).toThrow(TypeError);
    });
  });

  describe('side effects and isolation', () => {
    it('should not mutate existing items when deduplicating', () => {
      const originalItem = { name: 'Shield', bonus: 2 };
      const target = { defenses: [originalItem] };
      mergeAbilitiesByKey(
        target,
        'defenses',
        [{ name: 'shield', bonus: 5 }],
        (item) => item.name,
      );
      expect(target.defenses[0].bonus).toBe(2);
      expect(target.defenses.length).toBe(1);
    });

    it('should not affect other keys on the target object', () => {
      const target = { attacks: [{ name: 'Sword' }], otherData: [1, 2] };
      mergeAbilitiesByKey(target, 'attacks', [], (item) => item.name);
      expect(target.otherData).toEqual([1, 2]);
    });

    it('should handle keyFn returning empty string for deduplication', () => {
      const target = {};
      mergeAbilitiesByKey(
        target,
        'items',
        [{ label: '' }, { label: '' }],
        (item) => item.label,
      );
      expect(target.items.length).toBe(1);
      expect(target.items[0].label).toBe('');
    });
  });
});

describe('resetMiscBonuses', () => {
  describe('null/undefined guards', () => {
    it('should return undefined when abilities is nullish', () => {
      expect(resetMiscBonuses(null)).toBeUndefined();
      expect(resetMiscBonuses(undefined)).toBeUndefined();
    });
  });

  describe('reset behavior', () => {
    it('should reset all miscIncreases to 0', () => {
      const abilities = [
        { name: 'Strength', miscIncrease: 5 },
        { name: 'Dexterity', miscIncrease: -2 },
        { name: 'Constitution', miscIncrease: 3 },
      ];
      resetMiscBonuses(abilities);
      expect(abilities[0].miscIncrease).toBe(0);
      expect(abilities[1].miscIncrease).toBe(0);
      expect(abilities[2].miscIncrease).toBe(0);
    });

    it('should set miscIncrease to 0 when property is missing', () => {
      const abilities = [{ name: 'Intelligence' }];
      resetMiscBonuses(abilities);
      expect(abilities[0].miscIncrease).toBe(0);
    });

    it('should only reset miscIncrease and not touch other properties', () => {
      const abilities = [
        { name: 'Charisma', baseScore: 15, miscIncrease: 3, profBonus: 2 },
      ];
      resetMiscBonuses(abilities);
      expect(abilities[0].name).toBe('Charisma');
      expect(abilities[0].baseScore).toBe(15);
      expect(abilities[0].miscIncrease).toBe(0);
      expect(abilities[0].profBonus).toBe(2);
    });

    it('should handle abilities that already have miscIncrease of 0', () => {
      const abilities = [{ name: 'Strength', miscIncrease: 0 }];
      resetMiscBonuses(abilities);
      expect(abilities[0].miscIncrease).toBe(0);
    });

    it('should handle negative miscIncrease values', () => {
      const abilities = [{ name: 'Strength', miscIncrease: -5 }];
      resetMiscBonuses(abilities);
      expect(abilities[0].miscIncrease).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty abilities array', () => {
      const abilities = [];
      resetMiscBonuses(abilities);
      expect(abilities.length).toBe(0);
    });

    it('should not mutate array length or order', () => {
      const abilities = [];
      for (let i = 1; i <= 6; i++) abilities.push({ name: `ability${i}`, miscIncrease: i });
      resetMiscBonuses(abilities);
      expect(abilities.length).toBe(6);
      expect(abilities.map((a) => a.name)).toEqual([
        'ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'ability6',
      ]);
    });
  });
});

describe('resetFeatIncreases', () => {
  it('should return undefined when abilities is nullish', () => {
    expect(resetFeatIncreases(null)).toBeUndefined();
    expect(resetFeatIncreases(undefined)).toBeUndefined();
  });

  it('should reset all featIncreases to 0', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 5 },
      { name: 'Dexterity', featIncrease: -2 },
    ];
    resetFeatIncreases(abilities);
    expect(abilities[0].featIncrease).toBe(0);
    expect(abilities[1].featIncrease).toBe(0);
  });

  it('should set featIncrease to 0 when property is missing', () => {
    const abilities = [{ name: 'Intelligence' }];
    resetFeatIncreases(abilities);
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('should not affect other properties', () => {
    const abilities = [{ name: 'Charisma', baseScore: 15, featIncrease: 3 }];
    resetFeatIncreases(abilities);
    expect(abilities[0].baseScore).toBe(15);
    expect(abilities[0].featIncrease).toBe(0);
  });
});

describe('resetBackgroundIncreases', () => {
  it('should return undefined when abilities is nullish', () => {
    expect(resetBackgroundIncreases(null)).toBeUndefined();
    expect(resetBackgroundIncreases(undefined)).toBeUndefined();
  });

  it('should reset all backgroundIncreases to 0', () => {
    const abilities = [
      { name: 'Strength', backgroundIncrease: 5 },
      { name: 'Dexterity', backgroundIncrease: -1 },
    ];
    resetBackgroundIncreases(abilities);
    expect(abilities[0].backgroundIncrease).toBe(0);
    expect(abilities[1].backgroundIncrease).toBe(0);
  });

  it('should set backgroundIncrease to 0 when property is missing', () => {
    const abilities = [{ name: 'Intelligence' }];
    resetBackgroundIncreases(abilities);
    expect(abilities[0].backgroundIncrease).toBe(0);
  });

  it('should not affect other properties', () => {
    const abilities = [{ name: 'Charisma', baseScore: 15, backgroundIncrease: 2 }];
    resetBackgroundIncreases(abilities);
    expect(abilities[0].baseScore).toBe(15);
    expect(abilities[0].backgroundIncrease).toBe(0);
  });
});
