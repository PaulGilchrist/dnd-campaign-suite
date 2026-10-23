// @maintained-by-ai
// Contract lane for the vi.mock factories in automationService.test-utils.js — the ONLY
// thing this file owns. Both mocks contain real authored logic (a '+N Name' parser and an
// ability-canonicalization lookup) that 14 automation consumer lanes execute through.
// Pins the mock's exact contract, including deliberate deviations from the real modules
// (non-array tolerance where the real abilityLookup.js:19-23 would throw TypeError).
// The parseMagicItemName mock mirrors the real grammar fixed at the shared source
// (rules/core/attackWeaponUtils.js, #1234): full digit run bonus, digit-less '+ Name'
// read as plain name.
//
// Deleted faces (canonical owners / #923 canon — vi.fn() semantics are not helper behavior):
// - "is a vi.fn() mock function" x2          → vitest itself; covered by vitest docs, not us
// - "mock call tracking" / "resets when cleared" x4 → plain vi.fn() wrapper trivia
// - 12 per-case parse/canonicalization micro-tests → consolidated into the tables below
// - makePlayerStats / makeFeature fixtures   → owner: ./automationService.test-utils.test.js
// - REAL parseMagicItemName / getAbilityModifier → owners: rules/core/attackCalc.test.js,
//   rules/helpers + abilityLookup consumers (this lane pins the MOCK, not the real code)

import { describe, it, expect } from 'vitest'

// Import fixtures to activate vi.mock hoisting for mocked modules
import './automationService.test-utils.js'

// Import the mocked implementations to verify their actual behavior
import { parseMagicItemName } from '../../rules/core/attackCalc.js'
import { getAbilityModifier } from '../../shared/abilityLookup.js'

const testAbilities = [
  { name: 'Strength', bonus: 5 },
  { name: 'Dexterity', bonus: 2 },
  { name: 'Constitution', bonus: 3 },
  { name: 'Intelligence', bonus: -1 },
  { name: 'Wisdom', bonus: 0 },
  { name: 'Charisma', bonus: 1 },
]

describe('parseMagicItemName mock contract (test-utils.js:2-12)', () => {
  it('parses "+N Name" into exact baseName/magicBonus bytes', () => {
    expect(parseMagicItemName('+1 Longsword')).toEqual({ baseName: 'Longsword', magicBonus: 1 })
    expect(parseMagicItemName('+2 Shortbow')).toEqual({ baseName: 'Shortbow', magicBonus: 2 })
    expect(parseMagicItemName('+3 Greatsword')).toEqual({ baseName: 'Greatsword', magicBonus: 3 })
    expect(parseMagicItemName('+0 Rusty Sword')).toEqual({ baseName: 'Rusty Sword', magicBonus: 0 })
    // Grammar fixed at the shared source (rules/core/attackWeaponUtils.js, #1234):
    // the full digit run is the bonus; a digit-less '+ Name' drops only the '+'
    // marker — nothing is eaten from the name (mock mirrors the real parser).
    expect(parseMagicItemName('+ Longsword')).toEqual({ baseName: 'Longsword', magicBonus: 0 })
    expect(parseMagicItemName('+10 Sword')).toEqual({ baseName: 'Sword', magicBonus: 10 })
  })

  it('passes non-magic input through by identity with bonus 0', () => {
    expect(parseMagicItemName('Longsword')).toEqual({ baseName: 'Longsword', magicBonus: 0 })
    expect(parseMagicItemName('Rusty Longsword')).toEqual({ baseName: 'Rusty Longsword', magicBonus: 0 })
    expect(parseMagicItemName('')).toEqual({ baseName: '', magicBonus: 0 })
    expect(parseMagicItemName(null)).toEqual({ baseName: null, magicBonus: 0 })
    expect(parseMagicItemName(undefined)).toEqual({ baseName: undefined, magicBonus: 0 })
  })
})

describe('getAbilityModifier mock contract (test-utils.js:14-29)', () => {
  it('canonicalizes abbreviations, case, and whitespace, then resolves bonus', () => {
    const cases = [
      ['str', 5], ['dex', 2], ['con', 3], ['int', -1], ['wis', 0], ['cha', 1],
      ['STR', 5], ['DEX', 2],
      ['Dexterity', 2], ['sTrEnGtH', 5], ['  Cha  ', 1],
    ]
    for (const [input, expected] of cases) {
      expect(getAbilityModifier(testAbilities, input)).toBe(expected)
    }
  })

  it('returns 0 for missing, malformed, or non-array abilities (mock is lenient where real impl throws)', () => {
    // Guard clauses
    expect(getAbilityModifier(null, 'str')).toBe(0)
    expect(getAbilityModifier(undefined, 'str')).toBe(0)
    expect(getAbilityModifier(testAbilities, '')).toBe(0)
    expect(getAbilityModifier(testAbilities, null)).toBe(0)
    expect(getAbilityModifier(testAbilities, undefined)).toBe(0)
    expect(getAbilityModifier(testAbilities, '   ')).toBe(0)
    expect(getAbilityModifier(testAbilities, 'Foo')).toBe(0)
    expect(getAbilityModifier(testAbilities, 'Strength Modifier')).toBe(0)
    // Mock-specific tolerance: real abilityLookup.js would TypeError on .find of {}
    expect(getAbilityModifier({ Strength: 5 }, 'str')).toBe(0)
    expect(getAbilityModifier('abilities', 'str')).toBe(0)
    // Misses and absent bonus
    expect(getAbilityModifier([], 'str')).toBe(0)
    expect(getAbilityModifier([{ name: 'Strength', bonus: 5 }], 'dex')).toBe(0)
    expect(getAbilityModifier([{ name: 'Strength' }], 'str')).toBe(0)
  })
})
