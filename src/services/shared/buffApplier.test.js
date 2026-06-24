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
  it('returns void and mutates nothing when abilities is null', () => {
    expect(applyAbilityScoreIncreases(null, [])).toBeUndefined();
  });

  it('returns void and mutates nothing when abilities is undefined', () => {
    expect(applyAbilityScoreIncreases(undefined, [])).toBeUndefined();
  });

  it('returns void and mutates nothing when increases is nullish', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    expect(applyAbilityScoreIncreases(abilities, null)).toBeUndefined();
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('applies bonus to matching ability case-insensitively', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 2 }]);
    expect(abilities[0].featIncrease).toBe(2);
    expect(abilities[1].featIncrease).toBe(0);
  });

  it('accumulates bonuses from multiple increases on the same ability', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    applyAbilityScoreIncreases(abilities, [
      { name: 'strength', amount: 2 },
      { name: 'Strength', amount: 3 },
    ]);
    expect(abilities[0].featIncrease).toBe(5);
  });

  it('adds to existing featIncrease value', () => {
    const abilities = [{ name: 'Intelligence', featIncrease: 4 }];
    applyAbilityScoreIncreases(abilities, [{ name: 'intelligence', amount: 1 }]);
    expect(abilities[0].featIncrease).toBe(5);
  });

  it('treats missing featIncrease as 0', () => {
    const abilities = [{ name: 'Wisdom' }];
    applyAbilityScoreIncreases(abilities, [{ name: 'wisdom', amount: 2 }]);
    expect(abilities[0].featIncrease).toBe(2);
  });

  it('supports negative amounts', () => {
    const abilities = [{ name: 'Constitution', featIncrease: 0 }];
    applyAbilityScoreIncreases(abilities, [{ name: 'Constitution', amount: -1 }]);
    expect(abilities[0].featIncrease).toBe(-1);
  });

  it('handles zero amount without changing value', () => {
    const abilities = [{ name: 'Strength', featIncrease: 3 }];
    applyAbilityScoreIncreases(abilities, [{ name: 'strength', amount: 0 }]);
    expect(abilities[0].featIncrease).toBe(3);
  });

  it('skips increases with name "any"', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ name: 'any', amount: 5 }]);
    expect(abilities[0].featIncrease).toBe(0);
    expect(abilities[1].featIncrease).toBe(0);
  });

  it('skips increases with missing or undefined name', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [{ amount: 5 }, { name: undefined, amount: 5 }]);
    expect(abilities[0].featIncrease).toBe(0);
    expect(abilities[1].featIncrease).toBe(0);
  });

  it('does not affect non-matching abilities', () => {
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

  it('applies increases across different abilities in one call', () => {
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

  it('handles "any" mixed with specific increases', () => {
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

describe('mergeDeduplicated', () => {
  it('returns void and does not mutate when newItems is nullish or empty', () => {
    const target = { langs: ['Common'] };
    expect(mergeDeduplicated(target, 'langs', null)).toBeUndefined();
    expect(target.langs).toEqual(['Common']);
  });

  it('adds items that do not already exist', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['Elvish']);
    expect(target.langs).toEqual(['Common', 'Elvish']);
  });

  it('skips items that already exist case-insensitively', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['common']);
    expect(target.langs).toEqual(['Common']);
  });

  it('deduplicates across mixed casing keeping first occurrence', () => {
    const target = { langs: ['ELVISH'] };
    mergeDeduplicated(target, 'langs', ['elvish', 'Elvish']);
    expect(target.langs).toEqual(['ELVISH']);
  });

  it('does not add duplicates from within newItems itself', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['Elvish', 'elvish']);
    expect(target.langs).toEqual(['Elvish']);
  });

  it('preserves casing of existing items and initializes key if missing', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['Gnoll']);
    expect(target.langs).toEqual(['Gnoll']);
  });

  it('handles target[key] being undefined by initializing it', () => {
    const target = { langs: undefined };
    mergeDeduplicated(target, 'langs', ['Dwarvish']);
    expect(target.langs).toEqual(['Dwarvish']);
  });

  it('does not affect other keys on the target object', () => {
    const target = { attacks: [{ name: 'Sword' }], otherData: [1, 2] };
    mergeDeduplicated(target, 'attacks', []);
    expect(target.otherData).toEqual([1, 2]);
  });

  it('handles empty string items', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['']);
    expect(target.langs).toEqual(['']);
  });

  it('adds multiple new items while skipping duplicates in a mixed batch', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['common', 'Elvish', 'COMMON', 'Dwarvish', 'Halfling']);
    expect(target.langs).toEqual(['Common', 'Elvish', 'Dwarvish', 'Halfling']);
  });
});

describe('mergeAbilitiesByKey', () => {
  it('returns void and does not mutate when newItems is nullish or empty', () => {
    const target = { attacks: [{ name: 'Longsword' }] };
    const keyFn = (item) => item.name;
    expect(mergeAbilitiesByKey(target, 'attacks', null, keyFn)).toBeUndefined();
    expect(target.attacks).toEqual([{ name: 'Longsword' }]);
  });

  it('adds items whose key does not already exist', () => {
    const target = { attacks: [{ name: 'Longsword' }] };
    mergeAbilitiesByKey(target, 'attacks', [{ name: 'Dagger' }], (item) => item.name);
    expect(target.attacks).toEqual([{ name: 'Longsword' }, { name: 'Dagger' }]);
  });

  it('skips items whose key already exists case-insensitively', () => {
    const target = { attacks: [{ name: 'Longsword' }] };
    mergeAbilitiesByKey(target, 'attacks', [{ name: 'longsword' }], (item) => item.name);
    expect(target.attacks).toEqual([{ name: 'Longsword' }]);
  });

  it('deduplicates using custom keyFn for nested properties', () => {
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

  it('handles case-insensitive matching via keyFn result', () => {
    const target = { abilities: [{ type: 'STRONG ARM' }] };
    mergeAbilitiesByKey(
      target,
      'abilities',
      [{ type: 'strong arm' }],
      (item) => item.type,
    );
    expect(target.abilities).toEqual([{ type: 'STRONG ARM' }]);
  });

  it('preserves existing items casing when deduplicating', () => {
    const target = { proficiencies: [{ name: 'LIGHT ARMOR' }] };
    mergeAbilitiesByKey(
      target,
      'proficiencies',
      [{ name: 'light armor' }],
      (item) => item.name,
    );
    expect(target.proficiencies[0].name).toBe('LIGHT ARMOR');
  });

  it('does not add duplicates from within newItems itself', () => {
    const target = {};
    mergeAbilitiesByKey(target, 'tools', [{ name: 'Thieves' }, { name: 'thieves' }], (item) => item.name);
    expect(target.tools).toEqual([{ name: 'Thieves' }]);
  });

  it('adds multiple new items while deduplicating', () => {
    const target = { attacks: [{ name: 'Bite' }] };
    mergeAbilitiesByKey(target, 'attacks', [
      { name: 'Bite' },
      { name: 'Claw' },
      { name: 'Tail' },
    ], (item) => item.name);
    expect(target.attacks.map((a) => a.name)).toEqual(['Bite', 'Claw', 'Tail']);
  });

  it('initializes the key array if it does not exist on target', () => {
    const target = {};
    mergeAbilitiesByKey(target, 'attacks', [{ name: 'Spear' }], (item) => item.name);
    expect(target.attacks).toEqual([{ name: 'Spear' }]);
  });

  it('handles target[key] being undefined by initializing it', () => {
    const target = { attacks: undefined };
    mergeAbilitiesByKey(target, 'attacks', [{ name: 'Bow' }], (item) => item.name);
    expect(target.attacks).toEqual([{ name: 'Bow' }]);
  });

  it('does not mutate existing items when deduplicating', () => {
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

  it('handles keyFn returning empty string for deduplication', () => {
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

describe('resetMiscBonuses', () => {
  it('returns void and mutates nothing when abilities is nullish', () => {
    expect(resetMiscBonuses(null)).toBeUndefined();
    expect(resetMiscBonuses(undefined)).toBeUndefined();
  });

  it('resets all miscIncreases to 0', () => {
    const abilities = [
      { name: 'Strength', miscIncrease: 5 },
      { name: 'Dexterity', miscIncrease: -2 },
      { name: 'Constitution', miscIncrease: 3 },
    ];
    resetMiscBonuses(abilities);
    expect(abilities.map((a) => a.miscIncrease)).toEqual([0, 0, 0]);
  });

  it('sets miscIncrease to 0 when property is missing', () => {
    const abilities = [{ name: 'Intelligence' }];
    resetMiscBonuses(abilities);
    expect(abilities[0].miscIncrease).toBe(0);
  });

  it('only resets miscIncrease and not other properties', () => {
    const abilities = [
      { name: 'Charisma', baseScore: 15, miscIncrease: 3, profBonus: 2 },
    ];
    resetMiscBonuses(abilities);
    expect(abilities[0].name).toBe('Charisma');
    expect(abilities[0].baseScore).toBe(15);
    expect(abilities[0].miscIncrease).toBe(0);
    expect(abilities[0].profBonus).toBe(2);
  });

  it('does not mutate array length or order', () => {
    const abilities = [];
    for (let i = 1; i <= 6; i++) abilities.push({ name: `ability${i}`, miscIncrease: i });
    resetMiscBonuses(abilities);
    expect(abilities.length).toBe(6);
    expect(abilities.map((a) => a.name)).toEqual([
      'ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'ability6',
    ]);
  });
});

describe('resetFeatIncreases', () => {
  it('returns void and mutates nothing when abilities is nullish', () => {
    expect(resetFeatIncreases(null)).toBeUndefined();
    expect(resetFeatIncreases(undefined)).toBeUndefined();
  });

  it('resets all featIncreases to 0', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 5 },
      { name: 'Dexterity', featIncrease: -2 },
    ];
    resetFeatIncreases(abilities);
    expect(abilities.map((a) => a.featIncrease)).toEqual([0, 0]);
  });

  it('sets featIncrease to 0 when property is missing', () => {
    const abilities = [{ name: 'Intelligence' }];
    resetFeatIncreases(abilities);
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('does not affect other properties', () => {
    const abilities = [{ name: 'Charisma', baseScore: 15, featIncrease: 3 }];
    resetFeatIncreases(abilities);
    expect(abilities[0].baseScore).toBe(15);
    expect(abilities[0].featIncrease).toBe(0);
  });
});

describe('resetBackgroundIncreases', () => {
  it('returns void and mutates nothing when abilities is nullish', () => {
    expect(resetBackgroundIncreases(null)).toBeUndefined();
    expect(resetBackgroundIncreases(undefined)).toBeUndefined();
  });

  it('resets all backgroundIncreases to 0', () => {
    const abilities = [
      { name: 'Strength', backgroundIncrease: 5 },
      { name: 'Dexterity', backgroundIncrease: -1 },
    ];
    resetBackgroundIncreases(abilities);
    expect(abilities.map((a) => a.backgroundIncrease)).toEqual([0, 0]);
  });

  it('sets backgroundIncrease to 0 when property is missing', () => {
    const abilities = [{ name: 'Intelligence' }];
    resetBackgroundIncreases(abilities);
    expect(abilities[0].backgroundIncrease).toBe(0);
  });

  it('does not affect other properties', () => {
    const abilities = [{ name: 'Charisma', baseScore: 15, backgroundIncrease: 2 }];
    resetBackgroundIncreases(abilities);
    expect(abilities[0].baseScore).toBe(15);
    expect(abilities[0].backgroundIncrease).toBe(0);
  });
});
