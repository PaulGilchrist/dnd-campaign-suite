// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import fixtures to activate vi.mock hoisting for mocked modules
import './automationService.fixtures.js'

// Import the mocked implementations to verify their actual behavior
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
      expect(parseMagicItemName('Longsword')).toEqual({ baseName: 'Longsword', magicBonus: 0 })
    })

    it('handles items with spaces', () => {
      expect(parseMagicItemName('Rusty Longsword')).toEqual({ baseName: 'Rusty Longsword', magicBonus: 0 })
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(parseMagicItemName('')).toEqual({ baseName: '', magicBonus: 0 })
    })

    it('handles null/undefined input', () => {
      expect(parseMagicItemName(null)).toEqual({ baseName: null, magicBonus: 0 })
      expect(parseMagicItemName(undefined)).toEqual({ baseName: undefined, magicBonus: 0 })
    })

    it('handles + with no valid digit after', () => {
      const result = parseMagicItemName('+ Longsword')
      expect(result.magicBonus).toBe(0)
      expect(result.baseName).toBe('ongsword')
    })
  })

  describe('mock call tracking', () => {
    it('tracks call arguments and results', () => {
      parseMagicItemName('+1 Sword')
      parseMagicItemName('Axe')

      expect(parseMagicItemName.mock.calls).toHaveLength(2)
      expect(parseMagicItemName.mock.calls[0][0]).toBe('+1 Sword')
      expect(parseMagicItemName.mock.calls[1][0]).toBe('Axe')
      expect(parseMagicItemName.mock.results[0].value.magicBonus).toBe(1)
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

  describe('guard clauses', () => {
    it('returns 0 when abilities or abilityName is null/undefined/empty', () => {
      expect(getAbilityModifier(null, 'str')).toBe(0)
      expect(getAbilityModifier(undefined, 'str')).toBe(0)
      expect(getAbilityModifier(testAbilities, '')).toBe(0)
      expect(getAbilityModifier(testAbilities, null)).toBe(0)
      expect(getAbilityModifier(testAbilities, undefined)).toBe(0)
    })

    it('returns 0 when abilities is not an array', () => {
      expect(getAbilityModifier({ Strength: 5 }, 'str')).toBe(0)
      expect(getAbilityModifier('abilities', 'str')).toBe(0)
    })
  })

  describe('ability name canonicalization', () => {
    const testCases = [
      ['str', 'Strength', 5],
      ['dex', 'Dexterity', 2],
      ['con', 'Constitution', 3],
      ['int', 'Intelligence', -1],
      ['wis', 'Wisdom', 0],
      ['cha', 'Charisma', 1],
      ['STR', 'Strength', 5],
      ['DEX', 'Dexterity', 2],
      ['Strength', 'Strength', 5],
      ['Dexterity', 'Dexterity', 2],
      ['sTrEnGtH', 'Strength', 5],
    ]

    for (const [input, expectedName, expectedBonus] of testCases) {
      it(`maps "${input}" to ${expectedName} (${expectedBonus})`, () => {
        expect(getAbilityModifier(testAbilities, input)).toBe(expectedBonus)
      })
    }
  })

  describe('unrecognized inputs', () => {
    it('returns 0 for unknown ability names or malformed input', () => {
      expect(getAbilityModifier(testAbilities, 'Foo')).toBe(0)
      expect(getAbilityModifier(testAbilities, 'Strength Modifier')).toBe(0)
      expect(getAbilityModifier(testAbilities, '   ')).toBe(0)
    })

    it('returns 0 when ability is not in the array', () => {
      expect(getAbilityModifier([{ name: 'Strength', bonus: 5 }], 'dex')).toBe(0)
    })

    it('returns 0 when abilities array is empty', () => {
      expect(getAbilityModifier([], 'str')).toBe(0)
    })
  })

  describe('mock call tracking', () => {
    it('tracks call arguments and return values', () => {
      getAbilityModifier(testAbilities, 'str')
      getAbilityModifier(testAbilities, 'dex')

      expect(getAbilityModifier.mock.calls).toHaveLength(2)
      expect(getAbilityModifier.mock.calls[0][1]).toBe('str')
      expect(getAbilityModifier.mock.calls[1][1]).toBe('dex')
      expect(getAbilityModifier.mock.results[0].value).toBe(5)
      expect(getAbilityModifier.mock.results[1].value).toBe(2)
    })

    it('resets call tracking when cleared', () => {
      getAbilityModifier(testAbilities, 'str')
      getAbilityModifier.mockClear()
      expect(getAbilityModifier.mock.calls).toHaveLength(0)
    })
  })
})
