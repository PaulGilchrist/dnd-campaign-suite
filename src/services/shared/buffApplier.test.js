import { describe, it, expect } from 'vitest';
import {
  applyAbilityScoreIncreases,
  mergeDeduplicated,
} from './buffApplier.js';

describe('applyAbilityScoreIncreases', () => {
  it('returns undefined when abilities is null', () => {
    expect(applyAbilityScoreIncreases(null, [])).toBeUndefined();
  });

  it('returns undefined when abilities is undefined', () => {
    expect(applyAbilityScoreIncreases(undefined, [])).toBeUndefined();
  });

  it('returns undefined when increases is null', () => {
    expect(applyAbilityScoreIncreases([], null)).toBeUndefined();
  });

  it('returns undefined when increases is undefined', () => {
    expect(applyAbilityScoreIncreases([], undefined)).toBeUndefined();
  });

  it('does nothing when both arrays are empty', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    const result = applyAbilityScoreIncreases(abilities, []);
    expect(result).toBeUndefined();
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('accumulates bonus to matching ability case-insensitively', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'Intelligence', featIncrease: 4 },
      { name: 'Wisdom' },
    ];
    applyAbilityScoreIncreases(abilities, [
      { name: 'strength', amount: 2 },
      { name: 'Strength', amount: 3 },
      { name: 'dexterity', amount: 1 },
      { name: 'intelligence', amount: 1 },
      { name: 'wisdom', amount: 2 },
      { name: 'constitution', amount: -1 },
    ]);
    expect(abilities[0].featIncrease).toBe(5);
    expect(abilities[1].featIncrease).toBe(1);
    expect(abilities[2].featIncrease).toBe(5);
    expect(abilities[3].featIncrease).toBe(2);
  });

  it('skips increases with name "any"', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    applyAbilityScoreIncreases(abilities, [
      { name: 'any', amount: 5 },
    ]);
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('skips increases with missing name', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    applyAbilityScoreIncreases(abilities, [
      { amount: 5 },
    ]);
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('skips increases with undefined name', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    applyAbilityScoreIncreases(abilities, [
      { name: undefined, amount: 5 },
    ]);
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('uses 0 as default featIncrease when property is missing', () => {
    const abilities = [{ name: 'Strength' }];
    applyAbilityScoreIncreases(abilities, [
      { name: 'Strength', amount: 3 },
    ]);
    expect(abilities[0].featIncrease).toBe(3);
  });

  it('does not modify abilities when increase name has no match', () => {
    const abilities = [{ name: 'Strength', featIncrease: 0 }];
    applyAbilityScoreIncreases(abilities, [
      { name: 'Constitution', amount: 5 },
    ]);
    expect(abilities[0].featIncrease).toBe(0);
  });

  it('applies negative amounts correctly', () => {
    const abilities = [{ name: 'Strength', featIncrease: 4 }];
    applyAbilityScoreIncreases(abilities, [
      { name: 'Strength', amount: -2 },
    ]);
    expect(abilities[0].featIncrease).toBe(2);
  });
});

describe('mergeDeduplicated', () => {
  it('returns early when newItems is null', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', null);
    expect(target.langs).toEqual(['Common']);
  });

  it('returns early when newItems is undefined', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', undefined);
    expect(target.langs).toEqual(['Common']);
  });

  it('returns early when newItems is an empty array', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', []);
    expect(target.langs).toEqual(['Common']);
  });

  it('adds new items while skipping duplicates case-insensitively, preserving first occurrence casing', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['common', 'Elvish', 'COMMON', 'Dwarvish', 'elvish', 'Halfling']);
    expect(target.langs).toEqual(['Common', 'Elvish', 'Dwarvish', 'Halfling']);
  });

  it('deduplicates within newItems itself, keeping first occurrence', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['Elvish', 'elvish', 'ELVISH']);
    expect(target.langs).toEqual(['Elvish']);
  });

  it('initializes the array on target when key does not exist', () => {
    const target = {};
    mergeDeduplicated(target, 'langs', ['Common', 'Elvish']);
    expect(target.langs).toEqual(['Common', 'Elvish']);
  });

  it('handles empty string items as distinct values', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', ['', 'Elvish', '']);
    expect(target.langs).toEqual(['Common', '', 'Elvish']);
  });
});
