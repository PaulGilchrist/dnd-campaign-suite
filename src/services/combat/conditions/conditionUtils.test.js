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
  it('is an array of 14 condition objects', () => {
    expect(Array.isArray(CONDITIONS)).toBe(true)
    expect(CONDITIONS.length).toBe(14)
   })

  it('each entry has a key and label', () => {
    for (const c of CONDITIONS) {
      expect(c).toHaveProperty('key')
      expect(c).toHaveProperty('label')
      expect(typeof c.key).toBe('string')
      expect(typeof c.label).toBe('string')
    }
  })

  it('contains all standard conditions', () => {
    const keys = CONDITIONS.map(c => c.key)
    expect(keys).toContain('blinded')
    expect(keys).toContain('charmed')
    expect(keys).toContain('cursed')
    expect(keys).toContain('deafened')
    expect(keys).toContain('frightened')
    expect(keys).toContain('grappled')
    expect(keys).toContain('incapacitated')
    expect(keys).toContain('paralyzed')
    expect(keys).toContain('petrified')
    expect(keys).toContain('poisoned')
    expect(keys).toContain('prone')
    expect(keys).toContain('restrained')
    expect(keys).toContain('stunned')
    expect(keys).toContain('unconscious')
  })

  it('labels match capitalized keys', () => {
    for (const c of CONDITIONS) {
      const expectedLabel = c.key.charAt(0).toUpperCase() + c.key.slice(1)
      expect(c.label).toBe(expectedLabel)
    }
  })
})

describe('CONDITION_SAVE_DC', () => {
  it('equals 10', () => {
    expect(CONDITION_SAVE_DC).toBe(10)
  })
})

describe('CONDITION_SAVE_MAP', () => {
  it('has entries for all CONDITIONS keys', () => {
    for (const c of CONDITIONS) {
      expect(Object.prototype.hasOwnProperty.call(CONDITION_SAVE_MAP, c.key)).toBe(true)
    }
  })

  it('maps charmed and frightened to wis', () => {
    expect(CONDITION_SAVE_MAP.charmed).toBe('wis')
    expect(CONDITION_SAVE_MAP.frightened).toBe('wis')
  })

  it('maps grappled and restrained to str', () => {
    expect(CONDITION_SAVE_MAP.grappled).toBe('str')
    expect(CONDITION_SAVE_MAP.restrained).toBe('str')
  })

  it('maps cursed, paralyzed, poisoned, and stunned to con', () => {
    expect(CONDITION_SAVE_MAP.cursed).toBe('con')
    expect(CONDITION_SAVE_MAP.paralyzed).toBe('con')
    expect(CONDITION_SAVE_MAP.poisoned).toBe('con')
    expect(CONDITION_SAVE_MAP.stunned).toBe('con')
  })

  it('has null for conditions with no saving throw', () => {
    expect(CONDITION_SAVE_MAP.blinded).toBe(null)
    expect(CONDITION_SAVE_MAP.deafened).toBe(null)
    expect(CONDITION_SAVE_MAP.incapacitated).toBe(null)
    expect(CONDITION_SAVE_MAP.petrified).toBe(null)
    expect(CONDITION_SAVE_MAP.prone).toBe(null)
    expect(CONDITION_SAVE_MAP.unconscious).toBe(null)
  })

  it('does not have entries for non-condition keys', () => {
    expect(Object.prototype.hasOwnProperty.call(CONDITION_SAVE_MAP, 'invisible')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(CONDITION_SAVE_MAP, 'exhaustion')).toBe(false)
  })
})

describe('ABILITY_LABELS', () => {
  it('maps all six ability abbreviations to full names', () => {
    expect(ABILITY_LABELS.str).toBe('Strength')
    expect(ABILITY_LABELS.dex).toBe('Dexterity')
    expect(ABILITY_LABELS.con).toBe('Constitution')
    expect(ABILITY_LABELS.int).toBe('Intelligence')
    expect(ABILITY_LABELS.wis).toBe('Wisdom')
    expect(ABILITY_LABELS.cha).toBe('Charisma')
  })

  it('has exactly six entries', () => {
    expect(Object.keys(ABILITY_LABELS).length).toBe(6)
  })
})

describe('getDefaultAbility', () => {
  it('returns null for conditions with no saving throw', () => {
    expect(getDefaultAbility('blinded')).toBe(null)
    expect(getDefaultAbility('deafened')).toBe(null)
    expect(getDefaultAbility('incapacitated')).toBe(null)
    expect(getDefaultAbility('petrified')).toBe(null)
    expect(getDefaultAbility('prone')).toBe(null)
    expect(getDefaultAbility('unconscious')).toBe(null)
  })

  it('returns the correct ability for conditions with a saving throw', () => {
    expect(getDefaultAbility('charmed')).toBe('wis')
    expect(getDefaultAbility('frightened')).toBe('wis')
    expect(getDefaultAbility('cursed')).toBe('con')
    expect(getDefaultAbility('paralyzed')).toBe('con')
    expect(getDefaultAbility('poisoned')).toBe('con')
    expect(getDefaultAbility('stunned')).toBe('con')
    expect(getDefaultAbility('grappled')).toBe('str')
    expect(getDefaultAbility('restrained')).toBe('str')
  })

  it('returns null for unknown condition keys', () => {
    expect(getDefaultAbility('invisible')).toBe(null)
    expect(getDefaultAbility('nonexistent')).toBe(null)
  })

  it('returns null for undefined or missing keys', () => {
    expect(getDefaultAbility(undefined)).toBe(null)
    expect(getDefaultAbility(null)).toBe(null)
    expect(getDefaultAbility('')).toBe(null)
  })
})

describe('getAbilityLabel', () => {
  it('returns full name for valid ability abbreviations', () => {
    expect(getAbilityLabel('str')).toBe('Strength')
    expect(getAbilityLabel('dex')).toBe('Dexterity')
    expect(getAbilityLabel('con')).toBe('Constitution')
    expect(getAbilityLabel('int')).toBe('Intelligence')
    expect(getAbilityLabel('wis')).toBe('Wisdom')
    expect(getAbilityLabel('cha')).toBe('Charisma')
  })

  it('returns the abbreviation itself when not in ABILITY_LABELS', () => {
    expect(getAbilityLabel('unknown')).toBe('unknown')
    expect(getAbilityLabel('STR')).toBe('STR')
    expect(getAbilityLabel('Strength')).toBe('Strength')
  })

  it('returns "None" for null input', () => {
    expect(getAbilityLabel(null)).toBe('None')
    expect(getAbilityLabel(undefined)).toBe('None')
  })

  it('returns "None" for empty string input', () => {
    expect(getAbilityLabel('')).toBe('None')
  })
})

describe('getAbilitySaveBonus', () => {
  // Valid ability object structure: { name, bonus, save }
  const makeCharacter = (abilities) => ({ abilities })
  const makeAbility = (name, bonus, save) => ({ name, bonus, save })

  it('returns 0 when character is null', () => {
    expect(getAbilitySaveBonus(null, 'str')).toBe(0)
  })

  it('returns 0 when character is undefined', () => {
    expect(getAbilitySaveBonus(undefined, 'str')).toBe(0)
  })

  it('returns 0 when character has no abilities array', () => {
    expect(getAbilitySaveBonus({}, 'str')).toBe(0)
  })

  it('returns 0 when abilityAbbr is falsy', () => {
    const character = makeCharacter([makeAbility('Strength', +3, +5)])
    expect(getAbilitySaveBonus(character, null)).toBe(0)
    expect(getAbilitySaveBonus(character, undefined)).toBe(0)
    expect(getAbilitySaveBonus(character, '')).toBe(0)
  })

  it('returns the save bonus when available', () => {
    const character = makeCharacter([makeAbility('Strength', +3, +5)])
    expect(getAbilitySaveBonus(character, 'str')).toBe(5)
  })

  it('falls back to raw bonus when save is not set', () => {
    const character = makeCharacter([makeAbility('Dexterity', +2, undefined)])
    expect(getAbilitySaveBonus(character, 'dex')).toBe(2)
  })

  it('returns 0 when ability is not found in the list', () => {
    const character = makeCharacter([makeAbility('Constitution', +1, +3)])
    expect(getAbilitySaveBonus(character, 'str')).toBe(0)
  })

  it('returns 0 when abilities array is empty', () => {
    const character = makeCharacter([])
    expect(getAbilitySaveBonus(character, 'str')).toBe(0)
  })

  it('handles case-insensitive ability abbreviation lookup', () => {
    const character = makeCharacter([makeAbility('Strength', +3, +5)])
     // The underlying getAbilitySaveModifier normalizes the name
    expect(getAbilitySaveBonus(character, 'STR')).toBe(5)
    expect(getAbilitySaveBonus(character, 'str')).toBe(5)
    })

  it('handles abilities with save of 0', () => {
    const character = makeCharacter([makeAbility('Strength', +3, 0)])
    expect(getAbilitySaveBonus(character, 'str')).toBe(0)
  })

  it('handles abilities with negative save bonus', () => {
    const character = makeCharacter([makeAbility('Constitution', -1, -2)])
    expect(getAbilitySaveBonus(character, 'con')).toBe(-2)
  })
})
