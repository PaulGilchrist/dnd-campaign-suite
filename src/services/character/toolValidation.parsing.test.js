import { describe, it, expect } from 'vitest';

import {
  parseToolChoiceString,
  parseFeatToolProficiency,
} from './toolValidation.js';

describe('toolValidation - parseToolChoiceString', () => {
  it('should return default for null, non-string, and empty inputs', () => {
    expect(parseToolChoiceString(null)).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString(123)).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString({})).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString([])).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString('')).toEqual({ count: 0, categories: [], isChoice: false });
  });

  it('should return default for strings not starting with "Choose"', () => {
    expect(parseToolChoiceString('Gaming Sets')).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString("Artisan's Tools")).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString('choose one type of Gaming Sets')).toEqual({ count: 0, categories: [], isChoice: false });
  });

  it('should parse "Choose one type of A or B" format with singular normalization', () => {
    const result = parseToolChoiceString('Choose one type of Gaming Sets or Musical Instruments');
    expect(result).toEqual({ count: 1, categories: ['Gaming Sets', 'Musical Instrument'], isChoice: true });

    const resultSingular = parseToolChoiceString('Choose one type of Gaming Set or Musical Instrument');
    expect(resultSingular).toEqual({ count: 1, categories: ['Gaming Sets', 'Musical Instrument'], isChoice: true });
  });

  it('should parse "Choose X of category" format with various suffixes', () => {
    const resultNoSuffix = parseToolChoiceString("Choose 3 Artisan's Tools");
    expect(resultNoSuffix).toEqual({ count: 3, categories: ["Artisan's Tools"], isChoice: true });

    const resultChoiceSuffix = parseToolChoiceString("Choose 2 Artisan's Tools of your choice");
    expect(resultChoiceSuffix).toEqual({ count: 2, categories: ["Artisan's Tools"], isChoice: true });

    const resultParenthetical = parseToolChoiceString("Choose 1 Artisan's Tools (see Equipment)");
    expect(resultParenthetical).toEqual({ count: 1, categories: ["Artisan's Tools"], isChoice: true });
  });

  it('should parse "Choose one/kind of category" format', () => {
    const resultOneKind = parseToolChoiceString('Choose one kind of Gaming Sets');
    expect(resultOneKind).toEqual({ count: 1, categories: ['Gaming Sets'], isChoice: true });

    const resultKind = parseToolChoiceString('Choose kind of Musical Instruments');
    expect(resultKind).toEqual({ count: 1, categories: ['Musical Instrument'], isChoice: true });
  });

  it('should return default for unrecognized Choose patterns', () => {
    expect(parseToolChoiceString('Choose something weird')).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString('Choose')).toEqual({ count: 0, categories: [], isChoice: false });
    expect(parseToolChoiceString('Choose 1')).toEqual({ count: 0, categories: [], isChoice: false });
  });
});

describe('toolValidation - parseFeatToolProficiency', () => {
  it('should return null for null/undefined feat, missing/empty benefits', () => {
    expect(parseFeatToolProficiency(null)).toBeNull();
    expect(parseFeatToolProficiency(undefined)).toBeNull();
    expect(parseFeatToolProficiency({})).toBeNull();
    expect(parseFeatToolProficiency({ benefits: [] })).toBeNull();
    expect(parseFeatToolProficiency({ benefits: [{ type: 'ability_score_increase', description: '+1 STR' }] })).toBeNull();
  });

  it('should return null for proficiency benefit without tool/instrument keywords', () => {
    expect(parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency in a skill' }]
    })).toBeNull();
  });

  it('should return null for missing or empty description', () => {
    expect(parseFeatToolProficiency({
      benefits: [{ type: 'proficiency' }]
    })).toBeNull();
    expect(parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: '' }]
    })).toBeNull();
  });

  it('should parse "X different Artisan\'s Tools of your choice" with word numbers', () => {
    const one = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with one different Artisan\'s Tools of your choice' }]
    });
    expect(one).toEqual({ count: 1, categories: ["Artisan's Tools"], isAny: false });

    const three = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with three different Artisan\'s Tools of your choice' }]
    });
    expect(three).toEqual({ count: 3, categories: ["Artisan's Tools"], isAny: false });

    const two = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with two different Artisan\'s Tools of your choice' }]
    });
    expect(two).toEqual({ count: 2, categories: ["Artisan's Tools"], isAny: false });
  });

  it('should parse "skills or tools" pattern with word numbers', () => {
    const three = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency in any combination of three skills or tools of your choice' }]
    });
    expect(three).toEqual({ count: 3, categories: [], isAny: true });

    const two = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency in any combination of two skills or tools of your choice' }]
    });
    expect(two).toEqual({ count: 2, categories: [], isAny: true });
  });

  it('should parse numeric digits in artisan tools pattern (defaults to 1)', () => {
    const result = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with 2 different Artisan\'s Tools of your choice' }]
    });
    expect(result).toEqual({ count: 1, categories: ["Artisan's Tools"], isAny: false });
  });

  it('should parse "X category of your choice" generic pattern with word numbers', () => {
    const one = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with one Gaming Tool of your choice' }]
    });
    expect(one).toEqual({ count: 1, categories: ['Gaming Tool'], isAny: false });

    const three = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with three Gaming Tools of your choice' }]
    });
    expect(three).toEqual({ count: 3, categories: ['Gaming Tools'], isAny: false });
  });

  it('should parse numeric digits in generic pattern (defaults to 1)', () => {
    const result = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with 2 Gaming Tools of your choice' }]
    });
    expect(result).toEqual({ count: 1, categories: ['Gaming Tools'], isAny: false });
  });

  it('should parse "X Musical Instruments of your choice"', () => {
    const result = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with two Musical Instruments of your choice' }]
    });
    expect(result).toEqual({ count: 2, categories: ['Musical Instrument'], isAny: false });
  });

  it('should return null for unrecognized patterns', () => {
    const result = parseFeatToolProficiency({
      benefits: [{ type: 'proficiency', description: 'You gain proficiency with a sword' }]
    });
    expect(result).toBeNull();
  });
});
