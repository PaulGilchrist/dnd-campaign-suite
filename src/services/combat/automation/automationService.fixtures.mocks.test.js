// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import fixtures to activate vi.mock hoisting for mocked modules
import './automationService.fixtures.js'

// Import the mocked implementations to verify their actual behavior
// These are the vi.fn() mocks from automationService.fixtures.js
import { parseMagicItemName } from '../../rules/core/attackCalc.js'
import { getAbilityModifier } from '../../shared/abilityLookup.js'

// ── Fixture data ──────────────────────────────────────────────────
const testAbilities = [
  { name: 'Strength', bonus: 5 },
  { name: 'Dexterity', bonus: 2 },
  { name: 'Constitution', bonus: 3 },
  { name: 'Intelligence', bonus: -1 },
  { name: 'Wisdom', bonus: 0 },
  { name: 'Charisma', bonus: 1 },
]

// ── parseMagicItemName mock ───────────────────────────────────────
describe('parseMagicItemName mock', () => {
  beforeEach(() => {
    parseMagicItemName.mockClear()
  })

  it('is a vi.fn() mock function', () => {
    expect(vi.isMockFunction(parseMagicItemName)).toBe(true)
  })

  describe('magic item parsing', () => {
    const testCases = [
      { input: '+1 Longsword', baseName: 'Longsword', magicBonus: 1 },
      { input: '+2 Shortbow', baseName: 'Shortbow', magicBonus: 2 },
      { input: '+3 Greatsword', baseName: 'Greatsword', magicBonus: 3 },
      { input: '+0 Rusty Sword', baseName: 'Rusty Sword', magicBonus: 0 },
    ]

    for (const { input, baseName, magicBonus } of testCases) {
      it(`parses "${input}" correctly`, () => {
        const result = parseMagicItemName(input)
        expect(result).toEqual({ baseName, magicBonus })
      })
    }
  })

  describe('non-magic items', () => {
    it('returns baseName unchanged for non-magic items', () => {
      const result = parseMagicItemName('Longsword')
      expect(result).toEqual({ baseName: 'Longsword', magicBonus: 0 })
    })

    it('handles items with spaces', () => {
      const result = parseMagicItemName('Rusty Longsword')
      expect(result).toEqual({ baseName: 'Rusty Longsword', magicBonus: 0 })
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = parseMagicItemName('')
      expect(result).toEqual({ baseName: '', magicBonus: 0 })
    })

    it('handles null input', () => {
      const result = parseMagicItemName(null)
      expect(result).toEqual({ baseName: null, magicBonus: 0 })
    })

    it('handles undefined input', () => {
      const result = parseMagicItemName(undefined)
      expect(result).toEqual({ baseName: undefined, magicBonus: 0 })
    })

    it('handles + with no valid digit after', () => {
      const result = parseMagicItemName('+ Longsword')
      expect(result.magicBonus).toBe(0)
      expect(result.baseName).toBe('ongsword')
    })

    it('handles + with non-digit after', () => {
      const result = parseMagicItemName('+a Longsword')
      expect(result.magicBonus).toBe(0)
      expect(result.baseName).toBe('Longsword')
    })
  })

  describe('mock call tracking', () => {
    it('tracks call arguments', () => {
      parseMagicItemName('+1 Sword')
      parseMagicItemName('Axe')

      expect(parseMagicItemName.mock.calls).toHaveLength(2)
      expect(parseMagicItemName.mock.calls[0][0]).toBe('+1 Sword')
      expect(parseMagicItemName.mock.calls[1][0]).toBe('Axe')
    })

    it('tracks return values', () => {
      parseMagicItemName('+2 Bow')
      expect(parseMagicItemName.mock.results[0].value.magicBonus).toBe(2)

      parseMagicItemName('Dagger')
      expect(parseMagicItemName.mock.results[1].value.magicBonus).toBe(0)
    })

    it('resets call tracking when cleared', () => {
      parseMagicItemName('+1 Item')
      parseMagicItemName.mockClear()

      expect(parseMagicItemName.mock.calls).toHaveLength(0)
    })
  })
})

// ── getAbilityModifier mock ───────────────────────────────────────
describe('getAbilityModifier mock', () => {
  beforeEach(() => {
    getAbilityModifier.mockClear()
  })

  it('is a vi.fn() mock function', () => {
    expect(vi.isMockFunction(getAbilityModifier)).toBe(true)
  })

  describe('null/undefined guards', () => {
    it('returns 0 when abilities is null', () => {
      expect(getAbilityModifier(null, 'str')).toBe(0)
    })

    it('returns 0 when abilities is undefined', () => {
      expect(getAbilityModifier(undefined, 'str')).toBe(0)
    })

    it('returns 0 when abilityName is empty string', () => {
      expect(getAbilityModifier(testAbilities, '')).toBe(0)
    })

    it('returns 0 when abilityName is null', () => {
      expect(getAbilityModifier(testAbilities, null)).toBe(0)
    })

    it('returns 0 when abilityName is undefined', () => {
      expect(getAbilityModifier(testAbilities, undefined)).toBe(0)
    })
  })

  describe('non-array abilities', () => {
    it('returns 0 when abilities is an object', () => {
      expect(getAbilityModifier({ Strength: 5 }, 'str')).toBe(0)
    })

    it('returns 0 when abilities is a string', () => {
      expect(getAbilityModifier('abilities', 'str')).toBe(0)
    })
  })

  describe('3-letter abbreviation canonicalization', () => {
    const testCases = [
      ['str', 'Strength', 5],
      ['dex', 'Dexterity', 2],
      ['con', 'Constitution', 3],
      ['int', 'Intelligence', -1],
      ['wis', 'Wisdom', 0],
      ['cha', 'Charisma', 1],
      ['STR', 'Strength', 5],
      ['DEX', 'Dexterity', 2],
      ['CON', 'Constitution', 3],
      ['INT', 'Intelligence', -1],
      ['WIS', 'Wisdom', 0],
      ['CHA', 'Charisma', 1],
    ]

    for (const [input, expectedName, expectedBonus] of testCases) {
      it(`maps "${input}" to ${expectedName} (${expectedBonus})`, () => {
        expect(getAbilityModifier(testAbilities, input)).toBe(expectedBonus)
      })
    }
  })

  describe('full name canonicalization', () => {
    const testCases = [
      ['Strength', 'Strength', 5],
      ['Dexterity', 'Dexterity', 2],
      ['Constitution', 'Constitution', 3],
      ['Intelligence', 'Intelligence', -1],
      ['Wisdom', 'Wisdom', 0],
      ['Charisma', 'Charisma', 1],
      ['STRENGTH', 'Strength', 5],
      ['DEXTERITY', 'Dexterity', 2],
      ['CONSTITUTION', 'Constitution', 3],
      ['INTELLIGENCE', 'Intelligence', -1],
      ['WISDOM', 'Wisdom', 0],
      ['CHARISMA', 'Charisma', 1],
      ['sTrEnGtH', 'Strength', 5],
      ['dExTeRiTy', 'Dexterity', 2],
    ]

    for (const [input, expectedName, expectedBonus] of testCases) {
      it(`maps "${input}" to ${expectedName} (${expectedBonus})`, () => {
        expect(getAbilityModifier(testAbilities, input)).toBe(expectedBonus)
      })
    }
  })

  describe('names with spaces', () => {
    it('handles "Str" abbreviation', () => {
      expect(getAbilityModifier(testAbilities, 'Str')).toBe(5)
    })

    it('handles "strength" lowercase full name', () => {
      expect(getAbilityModifier(testAbilities, 'strength')).toBe(5)
    })

    it('returns 0 for unrecognized ability names', () => {
      expect(getAbilityModifier(testAbilities, 'Foo')).toBe(0)
    })

    it('returns 0 for ability names with extra content', () => {
      expect(getAbilityModifier(testAbilities, 'Strength Modifier')).toBe(0)
    })

    it('returns 0 for whitespace-only input', () => {
      expect(getAbilityModifier(testAbilities, '   ')).toBe(0)
    })
  })

  describe('ability not found in array', () => {
    it('returns 0 when ability name is valid but not in array', () => {
      const abilities = [{ name: 'Strength', bonus: 5 }]
      expect(getAbilityModifier(abilities, 'dex')).toBe(0)
    })

    it('returns 0 when abilities array is empty', () => {
      expect(getAbilityModifier([], 'str')).toBe(0)
    })

    it('returns 0 when ability exists but has no bonus property', () => {
      const abilities = [{ name: 'Strength' }]
      expect(getAbilityModifier(abilities, 'str')).toBe(0)
    })
  })

  describe('bonus value correctness', () => {
    it('returns negative bonus correctly', () => {
      expect(getAbilityModifier(testAbilities, 'int')).toBe(-1)
    })

    it('returns zero bonus correctly', () => {
      expect(getAbilityModifier(testAbilities, 'wis')).toBe(0)
    })

    it('returns positive bonus correctly', () => {
      expect(getAbilityModifier(testAbilities, 'str')).toBe(5)
    })
  })

  describe('mock call tracking', () => {
    it('tracks call arguments', () => {
      getAbilityModifier(testAbilities, 'str')
      getAbilityModifier(testAbilities, 'dex')

      expect(getAbilityModifier.mock.calls).toHaveLength(2)
      expect(getAbilityModifier.mock.calls[0][1]).toBe('str')
      expect(getAbilityModifier.mock.calls[1][1]).toBe('dex')
    })

    it('tracks return values', () => {
      getAbilityModifier(testAbilities, 'str')
      expect(getAbilityModifier.mock.results[0].value).toBe(5)

      getAbilityModifier(testAbilities, 'int')
      expect(getAbilityModifier.mock.results[1].value).toBe(-1)
    })

    it('resets call tracking when cleared', () => {
      getAbilityModifier(testAbilities, 'str')
      getAbilityModifier.mockClear()

      expect(getAbilityModifier.mock.calls).toHaveLength(0)
    })
  })
})
