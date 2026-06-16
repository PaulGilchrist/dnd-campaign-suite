import { describe, it, expect } from 'vitest'
import { getEvasionEffects, getAllSaveProficiencies } from './automationService.js'

// ── getEvasionEffects ──────────────────────────────────────────────

describe('getEvasionEffects', () => {
  it('returns empty array when features is null', () => {
    expect(getEvasionEffects(null)).toEqual([])
  })

  it('returns empty array when features is undefined', () => {
    expect(getEvasionEffects(undefined)).toEqual([])
  })

  it('returns empty array when features is empty', () => {
    expect(getEvasionEffects([])).toEqual([])
  })

  it('returns empty array when features have no automation', () => {
    expect(getEvasionEffects([{ name: 'Test' }])).toEqual([])
  })

  it('collects evasion effect with default saveType DEX', () => {
    const features = [{
      name: 'Evasion',
      automation: { type: 'evasion' },
    }]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      source: 'Evasion',
      saveType: 'DEX',
      shareable: false,
      shareRange: 0,
    })
  })

  it('collects evasion effect with custom saveType', () => {
    const features = [{
      name: 'Evasion',
      automation: { type: 'evasion', saveType: 'con' },
    }]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].saveType).toBe('CON')
  })

  it('collects shareable flag', () => {
    const features = [{
      name: 'Evasion',
      automation: { type: 'evasion', shareable: true, shareRange: 15 },
    }]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].shareable).toBe(true)
    expect(result[0].shareRange).toBe(15)
  })

  it('handles array automation', () => {
    const features = [{
      name: 'Mixed',
      automation: [
        { type: 'evasion' },
        { type: 'other' },
      ],
    }]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('Mixed')
  })

  it('collects multiple evasion effects from multiple features', () => {
    const features = [
      { name: 'Evasion A', automation: { type: 'evasion', saveType: 'dex' } },
      { name: 'Evasion B', automation: { type: 'evasion', saveType: 'con' } },
    ]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(2)
    expect(result[0].saveType).toBe('DEX')
    expect(result[1].saveType).toBe('CON')
  })
})

// ── getAllSaveProficiencies ────────────────────────────────────────

describe('getAllSaveProficiencies', () => {
  it('returns all six saves when features is null', () => {
    const result = getAllSaveProficiencies(null, {})
    expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
  })

  it('returns all six saves when features is undefined', () => {
    const result = getAllSaveProficiencies(undefined, {})
    expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
  })

  it('returns empty array when features is empty', () => {
    const result = getAllSaveProficiencies([], {})
    expect(result).toEqual([])
  })

  it('returns empty array when features have no automation', () => {
    const result = getAllSaveProficiencies([{ name: 'Test' }], {})
    expect(result).toEqual([])
  })

  it('adds all saves when auto_reroll with target saving_throw exists', () => {
    const features = [{
      name: 'Relentless Endurance',
      automation: { type: 'auto_reroll', target: 'saving_throw' },
    }]
    const result = getAllSaveProficiencies(features, {})
    expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
  })

  it('adds save proficiency from save_proficiency type', () => {
    const features = [{
      name: 'Fey Ancestry',
      automation: { type: 'save_proficiency', saveType: 'con' },
    }]
    const result = getAllSaveProficiencies(features, {})
    expect(result).toContain('Con')
  })

  it('normalizes saveType casing', () => {
    const features = [{
      name: 'Test',
      automation: { type: 'save_proficiency', saveType: 'Constitution' },
    }]
    const result = getAllSaveProficiencies(features, {})
    expect(result).toContain('Constitution')
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
    const result = getAllSaveProficiencies(features, playerStats)
    // Constitution already proficent, so picks first fallback (WIS)
    expect(result).toContain('Wisdom')
    expect(result).not.toContain('Charisma')
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
    const result = getAllSaveProficiencies(features, playerStats)
    expect(result).toContain('Wisdom')
    expect(result).not.toContain('Charisma')
  })

  it('returns empty array when features have no automation', () => {
    const features = [{ name: 'No Auto' }]
    const result = getAllSaveProficiencies(features, {})
    expect(result).toEqual([])
  })

  it('handles null features in array', () => {
    const features = [null]
    const result = getAllSaveProficiencies(features, {})
    expect(result).toEqual([])
  })

  it('handles multiple save_proficiency features', () => {
    const features = [
      { name: 'A', automation: { type: 'save_proficiency', saveType: 'str' } },
      { name: 'B', automation: { type: 'save_proficiency', saveType: 'dex' } },
    ]
    const result = getAllSaveProficiencies(features, {})
    expect(result).toContain('Str')
    expect(result).toContain('Dex')
  })

  it('handles auto_reroll alongside save_proficiency', () => {
    const features = [
      { name: 'Relentless', automation: { type: 'auto_reroll', target: 'saving_throw' } },
      { name: 'Save Prof', automation: { type: 'save_proficiency', saveType: 'str' } },
    ]
    const result = getAllSaveProficiencies(features, {})
    // auto_reroll adds all saves, save_proficiency adds Str (already in set)
    expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma', 'Str'])
  })
})
