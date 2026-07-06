// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import {
  applyAbilityScoreIncreases,
  mergeDeduplicated,
} from './buffApplier.js';

describe('applyAbilityScoreIncreases', () => {
  it('returns early when abilities or increases is falsy', () => {
    expect(applyAbilityScoreIncreases(null, [])).toBeUndefined();
    expect(applyAbilityScoreIncreases([], null)).toBeUndefined();
  });

  it('applies bonus to matching ability case-insensitively, accumulating across multiple increases', () => {
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

  it('skips increases with name "any" or missing/undefined name', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
    ];
    applyAbilityScoreIncreases(abilities, [
      { name: 'any', amount: 5 },
      { amount: 5 },
      { name: undefined, amount: 5 },
      { name: 'strength', amount: 2 },
    ]);
    expect(abilities[0].featIncrease).toBe(2);
    expect(abilities[1].featIncrease).toBe(0);
  });
});

describe('mergeDeduplicated', () => {
  it('returns early when newItems is nullish or empty', () => {
    const target = { langs: ['Common'] };
    mergeDeduplicated(target, 'langs', null);
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
});
