// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  applyAbilityScoreIncreases,
  mergeDeduplicated,
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
