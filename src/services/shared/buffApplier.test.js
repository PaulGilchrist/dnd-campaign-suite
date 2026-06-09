import { describe, it, expect } from 'vitest';
import {
  applyAbilityScoreIncreases,
  mergeDeduplicated,
  mergeAbilitiesByKey,
  resetMiscBonuses,
} from './buffApplier.js';

describe('applyAbilityScoreIncreases', () => {
  it('should return undefined when abilities is null', () => {
    expect(applyAbilityScoreIncreases(null, [])).toBeUndefined();
  });

  it('should return undefined when abilities is undefined', () => {
    expect(applyAbilityScoreIncreases(undefined, [])).toBeUndefined();
  });

  it('should return undefined when increases is null', () => {
    expect(applyAbilityScoreIncreases([{ name: 'Strength' }], null)).toBeUndefined();
  });

  it('should return undefined when increases is undefined', () => {
    expect(applyAbilityScoreIncreases([{ name: 'Strength' }], undefined)).toBeUndefined();
  });

  it('should do nothing with empty arrays', () => {
    const abilities = [{ name: 'Strength', miscBonus: 0 }];
    applyAbilityScoreIncreases(abilities, []);
    expect(abilities[0].miscBonus).toBe(0);
  });

  it('should apply bonus to matching ability name (case-insensitive)', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
      { name: 'Dexterity', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 2 }]);
    expect(abilities[0].miscBonus).toBe(2);
    expect(abilities[1].miscBonus).toBe(0);
  });

  it('should apply bonus when ability name matches exactly', () => {
    const abilities = [
      { name: 'Constitution', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'Constitution', amount: -1 }]);
    expect(abilities[0].miscBonus).toBe(-1);
  });

  it('should skip increases with name "any"', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
      { name: 'Dexterity', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'any', amount: 5 }]);
    expect(abilities[0].miscBonus).toBe(0);
    expect(abilities[1].miscBonus).toBe(0);
  });

  it('should accumulate bonuses on same ability from multiple increases', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [
      { name: 'strength', amount: 2 },
      { name: 'Strength', amount: 3 },
    ]);
    expect(abilities[0].miscBonus).toBe(5);
  });

  it('should accumulate bonuses when ability already has a miscBonus', () => {
    const abilities = [
      { name: 'Intelligence', miscBonus: 4 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'intelligence', amount: 1 }]);
    expect(abilities[0].miscBonus).toBe(5);
  });

  it('should handle ability.miscBonus being undefined (treats as 0)', () => {
    const abilities = [
      { name: 'Wisdom' }, // no miscBonus property
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'wisdom', amount: 2 }]);
    expect(abilities[0].miscBonus).toBe(2);
  });

  it('should not affect non-matching abilities', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
      { name: 'Dexterity', miscBonus: 3 },
      { name: 'Constitution', miscBonus: 1 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'charisma', amount: 5 }]);
    expect(abilities[0].miscBonus).toBe(0);
    expect(abilities[1].miscBonus).toBe(3);
    expect(abilities[2].miscBonus).toBe(1);
  });

  it('should handle mixed case increases and abilities', () => {
    const abilities = [
      { name: 'CHARISMA', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'cHaRiSmA', amount: 2 }]);
    expect(abilities[0].miscBonus).toBe(2);
  });

  it('should handle multiple increases affecting different abilities', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
      { name: 'Dexterity', miscBonus: 0 },
      { name: 'Constitution', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [
      { name: 'strength', amount: 2 },
      { name: 'dexterity', amount: 1 },
      { name: 'constitution', amount: -1 },
    ]);
    expect(abilities[0].miscBonus).toBe(2);
    expect(abilities[1].miscBonus).toBe(1);
    expect(abilities[2].miscBonus).toBe(-1);
  });

  it('should not mutate abilities array length', () => {
    const abilities = [{ name: 'Strength', miscBonus: 0 }];
    applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 2 }]);
    expect(abilities.length).toBe(1);
  });

  it('should handle "any" mixed with specific increases', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
      { name: 'Dexterity', miscBonus: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [
      { name: 'any', amount: 10 }, // should be skipped
      { name: 'strength', amount: 2 },
    ]);
    expect(abilities[0].miscBonus).toBe(2);
    expect(abilities[1].miscBonus).toBe(0);
  });

  it('should handle increase with missing name property gracefully', () => {
    const abilities = [{ name: 'Strength', miscBonus: 0 }];
    applyAbilityScoreIncreases(abilities, [{ amount: 5 }]); // no name
    expect(abilities[0].miscBonus).toBe(0);
  });

  it('should handle increase with undefined name gracefully', () => {
    const abilities = [{ name: 'Strength', miscBonus: 0 }];
    applyAbilityScoreIncreases(abilities, [{ name: undefined, amount: 5 }]);
    expect(abilities[0].miscBonus).toBe(0);
  });
});

describe('mergeDeduplicated', () => {
  it('should return undefined when newItems is null', () => {
    const target = {};
    expect(mergeDeduplicated(target, 'langs', null)).toBeUndefined();
  });

  it('should return undefined when newItems is undefined', () => {
    const target = {};
    expect(mergeDeduplicated(target, 'langs', undefined)).toBeUndefined();
  });

  it('should return undefined when newItems is an empty array', () => {
    const target = {};
    expect(mergeDeduplicated(target, 'langs', [])).toBeUndefined();
  });

  it('should add items that do not already exist', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['Elvish']);
    expect(target.langs).toEqual(['Common', 'Elvish']);
  });

  it('should skip items that already exist (case-insensitive)', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['common']);
    expect(target.langs).toEqual(['Common']);
  });

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

  it('should deduplicate across mixed casing', () => {
    const target = { langs: ['ELVISH'] };
    mergeDeduplicated(target, 'langs', ['elvish', 'Elvish']);
    expect(target.langs).toEqual(['ELVISH']);
  });

  it('should add multiple new items at once', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['Elvish', 'Dwarvish', 'Halfling']);
    expect(target.langs).toEqual(['Common', 'Elvish', 'Dwarvish', 'Halfling']);
  });

  it('should add new items but skip duplicates in mixed batch', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['common', 'Elvish', 'COMMON']);
    expect(target.langs).toEqual(['Common', 'Elvish']);
  });

  it('should not add duplicates from within the newItems array itself', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['Elvish', 'elvish']);
    expect(target.langs).toEqual(['Elvish']);
  });

  it('should not mutate existing items casing when deduplicating', () => {
    const target = { langs: ['COMMON'] };
    mergeDeduplicated(target, 'langs', ['common']);
    expect(target.langs[0]).toBe('COMMON');
  });

  it('should work with a non-existent key on the target object', () => {
    const target = { otherKey: [1, 2, 3] };
    mergeDeduplicated(target, 'proficiencies', ['Medium Armor']);
    expect(target.proficiencies).toEqual(['Medium Armor']);
    expect(target.otherKey).toEqual([1, 2, 3]);
  });

  it('should handle empty string item', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['']);
    expect(target.langs).toEqual(['']);
  });

  it('should not add a duplicate empty string', () => {
    const target = { langs: [''] };
    mergeDeduplicated(target, 'langs', ['']);
    expect(target.langs).toEqual(['']);
  });
});

describe('mergeAbilitiesByKey', () => {
  it('should return undefined when newItems is null', () => {
    const target = {};
    expect(mergeAbilitiesByKey(target, 'attacks', null, (item) => item.name)).toBeUndefined();
  });

  it('should return undefined when newItems is undefined', () => {
    const target = {};
    expect(mergeAbilitiesByKey(target, 'attacks', undefined, (item) => item.name)).toBeUndefined();
  });

  it('should return undefined when newItems is an empty array', () => {
    const target = {};
    expect(mergeAbilitiesByKey(target, 'attacks', [], (item) => item.name)).toBeUndefined();
  });

  it('should add items whose key does not already exist', () => {
    const target = { attacks: [{ name: 'Longsword' }] };
    mergeAbilitiesByKey(target, 'attacks', [{ name: 'Dagger' }], (item) => item.name);
    expect(target.attacks).toEqual([{ name: 'Longsword' }, { name: 'Dagger' }]);
  });

  it('should skip items whose key already exists (case-insensitive)', () => {
    const target = { attacks: [{ name: 'Longsword' }] };
    mergeAbilitiesByKey(target, 'attacks', [{ name: 'longsword' }], (item) => item.name);
    expect(target.attacks).toEqual([{ name: 'Longsword' }]);
  });

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

  it('should deduplicate using custom keyFn for nested property', () => {
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

  it('should add multiple new items while deduplicating', () => {
    const target = { attacks: [{ name: 'Bite' }] };
    mergeAbilitiesByKey(target, 'attacks', [
      { name: 'Bite' },
      { name: 'Claw' },
      { name: 'Tail' },
    ], (item) => item.name);
    expect(target.attacks.map((a) => a.name)).toEqual(['Bite', 'Claw', 'Tail']);
  });

  it('should not add duplicates from within the newItems array itself', () => {
    const target = {};
    mergeAbilitiesByKey(target, 'tools', [{ name: 'Thieves' }, { name: 'thieves' }], (item) => item.name);
    expect(target.tools).toEqual([{ name: 'Thieves' }]);
  });

  it('should not affect other keys on the target object', () => {
    const target = { attacks: [{ name: 'Sword' }], otherData: [1, 2] };
    mergeAbilitiesByKey(target, 'attacks', [], (item) => item.name);
    expect(target.otherData).toEqual([1, 2]);
  });

  it('should throw TypeError when keyFn returns numeric value on existing items', () => {
    const target = { items: [{ id: 1 }], otherKey: [] };
    expect(() => mergeAbilitiesByKey(target, 'items', [{ id: 2 }], (item) => item.id))
       .toThrow(TypeError);
   });

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

  it('should throw TypeError when keyFn returns undefined', () => {
    const target = {};
    expect(
       () => mergeAbilitiesByKey(
            target,
            'items',
            [{ name: 'A' }],
            (item) => item.missingKey, // returns undefined
          ),
      ).toThrow(TypeError);
   });
});

describe('resetMiscBonuses', () => {
  it('should return undefined when abilities is null', () => {
    expect(resetMiscBonuses(null)).toBeUndefined();
  });

  it('should return undefined when abilities is undefined', () => {
    expect(resetMiscBonuses(undefined)).toBeUndefined();
  });

  it('should reset all miscBonuses to 0', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 5 },
      { name: 'Dexterity', miscBonus: -2 },
      { name: 'Constitution', miscBonus: 3 },
    ];
    resetMiscBonuses(abilities);
    expect(abilities[0].miscBonus).toBe(0);
    expect(abilities[1].miscBonus).toBe(0);
    expect(abilities[2].miscBonus).toBe(0);
  });

  it('should leave abilities without miscBonus set to 0', () => {
    const abilities = [
      { name: 'Intelligence' },
    ];
    resetMiscBonuses(abilities);
    expect(abilities[0].miscBonus).toBe(0);
  });

  it('should handle empty abilities array', () => {
    const abilities = [];
    resetMiscBonuses(abilities);
    expect(abilities.length).toBe(0);
  });

  it('should only reset miscBonus and not touch other properties', () => {
    const abilities = [
      { name: 'Charisma', baseScore: 15, miscBonus: 3, profBonus: 2 },
    ];
    resetMiscBonuses(abilities);
    expect(abilities[0].name).toBe('Charisma');
    expect(abilities[0].baseScore).toBe(15);
    expect(abilities[0].miscBonus).toBe(0);
    expect(abilities[0].profBonus).toBe(2);
  });

  it('should handle abilities that already have miscBonus of 0', () => {
    const abilities = [
      { name: 'Strength', miscBonus: 0 },
    ];
    resetMiscBonuses(abilities);
    expect(abilities[0].miscBonus).toBe(0);
  });

  it('should not mutate array length or order', () => {
    const abilities = [];
    for (let i = 1; i <= 6; i++) abilities.push({ name: `ability${i}`, miscBonus: i });
    resetMiscBonuses(abilities);
    expect(abilities.length).toBe(6);
    // Names should be unchanged
    expect(abilities.map((a) => a.name)).toEqual([
      'ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'ability6',
    ]);
  });
});
