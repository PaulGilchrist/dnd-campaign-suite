// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import {
  CONDITIONS,
  CONDITION_SAVE_DC,
  CONDITION_SAVE_MAP,
  ABILITY_LABELS,
  getDefaultAbility,
  getAbilityLabel,
  getAbilitySaveBonus,
} from './conditionUtils.js'

describe('CONDITIONS', () => {
  it('is an array of condition objects with key and label', () => {
    expect(Array.isArray(CONDITIONS)).toBe(true)
    expect(CONDITIONS.length).toBeGreaterThan(0)
    for (const c of CONDITIONS) {
      expect(c).toHaveProperty('key')
      expect(c).toHaveProperty('label')
      expect(typeof c.key).toBe('string')
      expect(typeof c.label).toBe('string')
      expect(c.key).toBeTruthy()
      expect(c.label).toBeTruthy()
    }
  })

  it('contains all standard D&D conditions', () => {
    const keys = CONDITIONS.map(c => c.key)
    const expectedConditions = [
      'blinded', 'charmed', 'cursed', 'deafened', 'frightened',
      'grappled', 'incapacitated', 'paralyzed', 'petrified',
      'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
    ]
    for (const key of expectedConditions) {
      expect(keys).toContain(key)
    }
  })
})

describe('CONDITION_SAVE_DC', () => {
  it('is 10', () => {
    expect(CONDITION_SAVE_DC).toBe(10)
  })
})

describe('CONDITION_SAVE_MAP', () => {
  it('maps each condition to its save ability or null', () => {
    const conditionsWithSaves = ['charmed', 'frightened', 'cursed', 'paralyzed', 'poisoned', 'stunned', 'grappled', 'restrained']
    const conditionsWithoutSaves = ['blinded', 'deafened', 'incapacitated', 'petrified', 'prone', 'unconscious']

    for (const key of conditionsWithSaves) {
      expect(CONDITION_SAVE_MAP[key]).toBeTruthy()
      expect(typeof CONDITION_SAVE_MAP[key]).toBe('string')
    }

    for (const key of conditionsWithoutSaves) {
      expect(CONDITION_SAVE_MAP[key]).toBe(null)
    }
  })

  it('maps conditions to the correct ability scores', () => {
    expect(CONDITION_SAVE_MAP.charmed).toBe('wis')
    expect(CONDITION_SAVE_MAP.frightened).toBe('wis')
    expect(CONDITION_SAVE_MAP.grappled).toBe('str')
    expect(CONDITION_SAVE_MAP.restrained).toBe('str')
    expect(CONDITION_SAVE_MAP.cursed).toBe('con')
    expect(CONDITION_SAVE_MAP.paralyzed).toBe('con')
    expect(CONDITION_SAVE_MAP.poisoned).toBe('con')
    expect(CONDITION_SAVE_MAP.stunned).toBe('con')
  })

  it('is consistent with the CONDITIONS array', () => {
    const mapKeys = Object.keys(CONDITION_SAVE_MAP)
    const conditionKeys = CONDITIONS.map(c => c.key)
    expect(mapKeys.sort()).toEqual(conditionKeys.sort())
  })
})

describe('ABILITY_LABELS', () => {
  it('maps all six ability abbreviations to their full names', () => {
    expect(ABILITY_LABELS).toEqual({
      str: 'Strength',
      dex: 'Dexterity',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Wisdom',
      cha: 'Charisma',
    })
  })
})

describe('getDefaultAbility', () => {
  it('returns the ability for conditions with a saving throw', () => {
    expect(getDefaultAbility('charmed')).toBe('wis')
    expect(getDefaultAbility('frightened')).toBe('wis')
    expect(getDefaultAbility('grappled')).toBe('str')
    expect(getDefaultAbility('restrained')).toBe('str')
    expect(getDefaultAbility('cursed')).toBe('con')
    expect(getDefaultAbility('paralyzed')).toBe('con')
    expect(getDefaultAbility('poisoned')).toBe('con')
    expect(getDefaultAbility('stunned')).toBe('con')
  })

  it('returns null for conditions without a saving throw', () => {
    expect(getDefaultAbility('blinded')).toBe(null)
    expect(getDefaultAbility('deafened')).toBe(null)
    expect(getDefaultAbility('incapacitated')).toBe(null)
    expect(getDefaultAbility('petrified')).toBe(null)
    expect(getDefaultAbility('prone')).toBe(null)
    expect(getDefaultAbility('unconscious')).toBe(null)
  })

  it('returns null for unknown condition keys', () => {
    expect(getDefaultAbility('invisible')).toBe(null)
    expect(getDefaultAbility('')).toBe(null)
    expect(getDefaultAbility(null)).toBe(null)
    expect(getDefaultAbility(undefined)).toBe(null)
  })
})

describe('getAbilityLabel', () => {
  it('returns the full ability name for known abbreviations', () => {
    expect(getAbilityLabel('str')).toBe('Strength')
    expect(getAbilityLabel('dex')).toBe('Dexterity')
    expect(getAbilityLabel('con')).toBe('Constitution')
    expect(getAbilityLabel('int')).toBe('Intelligence')
    expect(getAbilityLabel('wis')).toBe('Wisdom')
    expect(getAbilityLabel('cha')).toBe('Charisma')
  })

  it('returns the input unchanged for unknown abbreviations', () => {
    expect(getAbilityLabel('unknown')).toBe('unknown')
    expect(getAbilityLabel('STR')).toBe('STR')
  })

  it('returns "None" for falsy inputs', () => {
    expect(getAbilityLabel(null)).toBe('None')
    expect(getAbilityLabel(undefined)).toBe('None')
    expect(getAbilityLabel('')).toBe('None')
  })
})

describe('getAbilitySaveBonus', () => {
  const makeAbility = (name, bonus, save) => ({ name, bonus, save })

  it('returns 0 when character is null or undefined', () => {
    expect(getAbilitySaveBonus(null, 'str')).toBe(0)
    expect(getAbilitySaveBonus(undefined, 'str')).toBe(0)
  })

  it('returns 0 when character has no abilities array', () => {
    expect(getAbilitySaveBonus({}, 'str')).toBe(0)
    expect(getAbilitySaveBonus({ name: 'Test' }, 'str')).toBe(0)
  })

  it('returns 0 when ability abbreviation is falsy', () => {
    const character = { abilities: [makeAbility('Strength', 3, 5)] }
    expect(getAbilitySaveBonus(character, null)).toBe(0)
    expect(getAbilitySaveBonus(character, undefined)).toBe(0)
    expect(getAbilitySaveBonus(character, '')).toBe(0)
  })

  it('returns the save bonus when available', () => {
    const character = { abilities: [makeAbility('Strength', 3, 5)] }
    expect(getAbilitySaveBonus(character, 'str')).toBe(5)
  })

  it('falls back to raw bonus when save is not set', () => {
    const character = { abilities: [makeAbility('Dexterity', 2, undefined)] }
    expect(getAbilitySaveBonus(character, 'dex')).toBe(2)
  })

  it('returns 0 when ability is not found in the list', () => {
    const character = { abilities: [makeAbility('Constitution', 1, 3)] }
    expect(getAbilitySaveBonus(character, 'str')).toBe(0)
  })

  it('returns 0 when abilities array is empty', () => {
    const character = { abilities: [] }
    expect(getAbilitySaveBonus(character, 'str')).toBe(0)
  })

  it('handles case-insensitive ability abbreviation lookup', () => {
    const character = { abilities: [makeAbility('Strength', 3, 5)] }
    expect(getAbilitySaveBonus(character, 'STR')).toBe(5)
    expect(getAbilitySaveBonus(character, 'str')).toBe(5)
  })

  it('handles abilities with save of 0', () => {
    const character = { abilities: [makeAbility('Strength', 3, 0)] }
    expect(getAbilitySaveBonus(character, 'str')).toBe(0)
  })

  it('handles negative save bonuses', () => {
    const character = { abilities: [makeAbility('Constitution', -1, -2)] }
    expect(getAbilitySaveBonus(character, 'con')).toBe(-2)
  })
})
