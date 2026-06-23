import { describe, it, expect } from 'vitest'
import { getEvasionEffects, getAllSaveProficiencies } from './automationService.js'

// @improved-by-ai

// ── getEvasionEffects ──────────────────────────────────────────────

describe('getEvasionEffects', () => {
  it('returns empty array when features is falsy', () => {
    for (const falsy of [null, undefined, []]) {
      expect(getEvasionEffects(falsy)).toEqual([])
    }
  })

  it('returns empty array when features have no automation', () => {
    expect(getEvasionEffects([{ name: 'Test' }])).toEqual([])
  })

  it('returns empty array when automation is null', () => {
    expect(getEvasionEffects([{ name: 'Test', automation: null }])).toEqual([])
  })

  it('collects evasion effect with default saveType DEX', () => {
    const features = [{
      name: 'Evasion',
      automation: { type: 'evasion' },
    }]
    expect(getEvasionEffects(features)).toEqual([{
      source: 'Evasion',
      saveType: 'DEX',
      shareable: false,
      shareRange: 0,
    }])
  })

  it('normalizes saveType casing to uppercase', () => {
    const features = [{
      name: 'Constitutional Evasion',
      automation: { type: 'evasion', saveType: 'con' },
    }]
    expect(getEvasionEffects(features)).toEqual([{
      source: 'Constitutional Evasion',
      saveType: 'CON',
      shareable: false,
      shareRange: 0,
    }])
  })

  it('collects shareable flag and range when present', () => {
    const features = [{
      name: 'Shared Evasion',
      automation: { type: 'evasion', shareable: true, shareRange: 15 },
    }]
    expect(getEvasionEffects(features)).toEqual([{
      source: 'Shared Evasion',
      saveType: 'DEX',
      shareable: true,
      shareRange: 15,
    }])
  })

  it('uses shareRange value when provided regardless of shareable', () => {
    const features = [{
      name: 'Evasion',
      automation: { type: 'evasion', shareable: false, shareRange: 15 },
    }]
    expect(getEvasionEffects(features)).toEqual([{
      source: 'Evasion',
      saveType: 'DEX',
      shareable: false,
      shareRange: 15,
    }])
  })

  it('handles array automation collecting only evasion types', () => {
    const features = [{
      name: 'Mixed',
      automation: [
        { type: 'evasion' },
        { type: 'other' },
      ],
    }]
    expect(getEvasionEffects(features)).toEqual([{
      source: 'Mixed',
      saveType: 'DEX',
      shareable: false,
      shareRange: 0,
    }])
  })

  it('collects multiple evasion effects from multiple features', () => {
    const features = [
      { name: 'Evasion A', automation: { type: 'evasion', saveType: 'dex' } },
      { name: 'Evasion B', automation: { type: 'evasion', saveType: 'con' } },
    ]
    expect(getEvasionEffects(features)).toEqual([
      { source: 'Evasion A', saveType: 'DEX', shareable: false, shareRange: 0 },
      { source: 'Evasion B', saveType: 'CON', shareable: false, shareRange: 0 },
    ])
  })

  it('collects multiple evasion effects from a single feature with array automation', () => {
    const features = [{
      name: 'MultiEvasion',
      automation: [
        { type: 'evasion', saveType: 'dex' },
        { type: 'evasion', saveType: 'wis' },
      ],
    }]
    expect(getEvasionEffects(features)).toEqual([
      { source: 'MultiEvasion', saveType: 'DEX', shareable: false, shareRange: 0 },
      { source: 'MultiEvasion', saveType: 'WIS', shareable: false, shareRange: 0 },
    ])
  })

  it('throws when automation array contains null entries', () => {
    const features = [{
      name: 'Mixed',
      automation: [
        { type: 'evasion' },
        null,
        { type: 'evasion', saveType: 'con' },
      ],
    }]
    expect(() => getEvasionEffects(features)).toThrow(TypeError)
  })

  it('skips non-evasion types in automation array', () => {
    const features = [{
      name: 'Mixed',
      automation: [
        { type: 'auto_reroll', target: 'saving_throw' },
        { type: 'other' },
        { type: 'evasion', saveType: 'str' },
      ],
    }]
    expect(getEvasionEffects(features)).toEqual([{
      source: 'Mixed',
      saveType: 'STR',
      shareable: false,
      shareRange: 0,
    }])
  })
})

// ── getAllSaveProficiencies ────────────────────────────────────────

describe('getAllSaveProficiencies', () => {
  it('returns all six saves when features is falsy', () => {
    const expected = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
    expect(getAllSaveProficiencies(null, {})).toEqual(expected)
    expect(getAllSaveProficiencies(undefined, {})).toEqual(expected)
  })

  it('returns empty array when features is empty', () => {
    expect(getAllSaveProficiencies([], {})).toEqual([])
  })

  it('returns empty array when features have no automation', () => {
    expect(getAllSaveProficiencies([{ name: 'Test' }], {})).toEqual([])
  })

  it('adds all saves when auto_reroll with target saving_throw exists', () => {
    const features = [{
      name: 'Relentless Endurance',
      automation: { type: 'auto_reroll', target: 'saving_throw' },
    }]
    expect(getAllSaveProficiencies(features, {})).toEqual([
      'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma',
    ])
  })

  it('adds save proficiency from save_proficiency type', () => {
    const features = [{
      name: 'Fey Ancestry',
      automation: { type: 'save_proficiency', saveType: 'con' },
    }]
    expect(getAllSaveProficiencies(features, {})).toEqual(['Con'])
  })

  it('normalizes saveType casing to capitalize-first-lowercase-rest', () => {
    const features = [{
      name: 'Test',
      automation: { type: 'save_proficiency', saveType: 'Constitution' },
    }]
    expect(getAllSaveProficiencies(features, {})).toEqual(['Constitution'])
  })

  it('uses fallback types when character already has save proficiency', () => {
    const playerStats = {
      class: { saving_throw_proficiencies: ['Constitution'] },
    }
    const features = [{
      name: 'Test',
      automation: {
        type: 'save_proficiency',
        saveType: 'constitution',
        fallbackTypes: ['wisdom', 'charisma'],
      },
    }]
    expect(getAllSaveProficiencies(features, playerStats)).toEqual(['Wisdom'])
  })

  it('uses fallback types when already in result set from another feature', () => {
    const features = [
      { name: 'A', automation: { type: 'save_proficiency', saveType: 'str' } },
      { name: 'B', automation: { type: 'save_proficiency', saveType: 'strength', fallbackTypes: ['dex'] } },
    ]
    expect(getAllSaveProficiencies(features, {})).toEqual(['Str', 'Strength'])
  })

  it('adds save proficiency when character does not have it', () => {
    const playerStats = {}
    const features = [{
      name: 'Test',
      automation: {
        type: 'save_proficiency',
        saveType: 'wisdom',
        fallbackTypes: ['charisma'],
      },
    }]
    expect(getAllSaveProficiencies(features, playerStats)).toEqual(['Wisdom'])
  })

  it('handles null features in array', () => {
    const features = [null]
    expect(getAllSaveProficiencies(features, {})).toEqual([])
  })

  it('handles multiple save_proficiency features', () => {
    const features = [
      { name: 'A', automation: { type: 'save_proficiency', saveType: 'str' } },
      { name: 'B', automation: { type: 'save_proficiency', saveType: 'dex' } },
    ]
    expect(getAllSaveProficiencies(features, {})).toEqual(['Str', 'Dex'])
  })

  it('deduplicates save proficiencies', () => {
    const features = [
      { name: 'A', automation: { type: 'save_proficiency', saveType: 'str' } },
      { name: 'B', automation: { type: 'save_proficiency', saveType: 'str' } },
    ]
    expect(getAllSaveProficiencies(features, {})).toEqual(['Str'])
  })

  it('handles auto_reroll alongside save_proficiency', () => {
    const features = [
      { name: 'Relentless', automation: { type: 'auto_reroll', target: 'saving_throw' } },
      { name: 'Save Prof', automation: { type: 'save_proficiency', saveType: 'str' } },
    ]
    expect(getAllSaveProficiencies(features, {})).toEqual([
      'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma', 'Str',
    ])
  })

  it('skips save_proficiency with no saveType', () => {
    const features = [{
      name: 'Test',
      automation: { type: 'save_proficiency' },
    }]
    expect(getAllSaveProficiencies(features, {})).toEqual([])
  })

  it('handles array automation with mixed types', () => {
    const features = [{
      name: 'Multi',
      automation: [
        { type: 'save_proficiency', saveType: 'str' },
        { type: 'auto_reroll', target: 'saving_throw' },
        { type: 'save_proficiency', saveType: 'dex' },
      ],
    }]
    expect(getAllSaveProficiencies(features, {})).toEqual([
      'Str', 'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma', 'Dex',
    ])
  })

  it('uses class saving_throw_proficiencies for existing proficiency check', () => {
    const playerStats = {
      class: { saving_throw_proficiencies: ['Dexterity'] },
    }
    const features = [{
      name: 'Test',
      automation: {
        type: 'save_proficiency',
        saveType: 'dexterity',
        fallbackTypes: ['wisdom'],
      },
    }]
    expect(getAllSaveProficiencies(features, playerStats)).toEqual(['Wisdom'])
  })
})
