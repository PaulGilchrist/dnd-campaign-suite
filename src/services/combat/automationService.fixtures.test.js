import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Imports from the fixtures module ──────────────────────────────
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── Mocked module: attackCalc.js ──────────────────────────────────
import { parseMagicItemName } from '../rules/core/attackCalc.js'

// ── Mocked module: abilityLookup.js ───────────────────────────────
import { getAbilityModifier } from '../shared/abilityLookup.js'

// ── makePlayerStats ───────────────────────────────────────────────
describe('makePlayerStats', () => {
  it('returns a player stats object with default values', () => {
    const ps = makePlayerStats()
    expect(ps.name).toBe('TestCharacter')
    expect(ps.proficiency).toBe(2)
    expect(ps.level).toBe(3)
    expect(ps.class.name).toBe('Barbarian')
    expect(ps.class.levels).toBe(3)
  })

  it('includes all six ability scores with default bonuses', () => {
    const ps = makePlayerStats()
    const abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
    expect(ps.abilities.length).toBe(6)
    abilityNames.forEach(name => {
      const ability = ps.abilities.find(a => a.name === name)
      expect(ability).toBeDefined()
    })
  })

  it('has correct default ability bonuses', () => {
    const ps = makePlayerStats()
    const expected = {
      Strength: 5,
      Dexterity: 2,
      Constitution: 3,
      Intelligence: -1,
      Wisdom: 0,
      Charisma: 1,
    }
    ps.abilities.forEach(a => {
      expect(a.bonus).toBe(expected[a.name])
    })
  })

  it('merges overrides into the base object', () => {
    const ps = makePlayerStats({ name: 'Grog', level: 10 })
    expect(ps.name).toBe('Grog')
    expect(ps.level).toBe(10)
    // defaults preserved
    expect(ps.proficiency).toBe(2)
    expect(ps.class.name).toBe('Barbarian')
  })

  it('overrides the abilities array entirely', () => {
    const customAbilities = [
      { name: 'Strength', bonus: 10 },
      { name: 'Dexterity', bonus: 8 },
    ]
    const ps = makePlayerStats({ abilities: customAbilities })
    expect(ps.abilities).toBe(customAbilities)
    expect(ps.abilities.length).toBe(2)
  })

  it('overrides the class object', () => {
    const ps = makePlayerStats({ class: { name: 'Wizard', levels: 5 } })
    expect(ps.class.name).toBe('Wizard')
    expect(ps.class.levels).toBe(5)
  })

  it('allows overriding proficiency', () => {
    const ps = makePlayerStats({ proficiency: 6 })
    expect(ps.proficiency).toBe(6)
  })

  it('preserves default abilities when not overridden', () => {
    const ps = makePlayerStats({ name: 'Test' })
    expect(ps.abilities.length).toBe(6)
    expect(ps.abilities.find(a => a.name === 'Strength').bonus).toBe(5)
  })
})

// ── makeFeature ───────────────────────────────────────────────────
describe('makeFeature', () => {
  it('returns an object with name and automation properties', () => {
    const feature = makeFeature({ type: 'passive_rule' })
    expect(feature).toHaveProperty('name')
    expect(feature).toHaveProperty('automation')
  })

  it('uses "Test Feature" as the default name', () => {
    const feature = makeFeature({ type: 'passive_rule' })
    expect(feature.name).toBe('Test Feature')
  })

  it('accepts a custom name', () => {
    const feature = makeFeature({ type: 'passive_rule' }, 'Flame Blade')
    expect(feature.name).toBe('Flame Blade')
  })

  it('passes through the automation object as-is', () => {
    const automation = { type: 'action', effect: 'damage' }
    const feature = makeFeature(automation)
    expect(feature.automation).toBe(automation)
  })

  it('passes through null automation', () => {
    const feature = makeFeature(null)
    expect(feature.automation).toBeNull()
  })

  it('passes through undefined automation', () => {
    const feature = makeFeature(undefined)
    expect(feature.automation).toBeUndefined()
  })

  it('creates independent objects (no shared reference)', () => {
    const auto = { type: 'passive_rule' }
    const f1 = makeFeature(auto)
    const f2 = makeFeature(auto)
    expect(f1.automation).toBe(auto)
    expect(f2.automation).toBe(auto)
  })
})

// ── Mocked module: parseMagicItemName ─────────────────────────────
describe('parseMagicItemName (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses a +2 weapon name correctly', () => {
    const result = parseMagicItemName('+2 Longsword')
    expect(result.magicBonus).toBe(2)
    expect(result.baseName).toBe('Longsword')
  })

  it('parses a +1 weapon name correctly', () => {
    const result = parseMagicItemName('+1 Dagger')
    expect(result.magicBonus).toBe(1)
    expect(result.baseName).toBe('Dagger')
  })

  it('returns magicBonus 0 for non-magic item names', () => {
    const result = parseMagicItemName('Longsword')
    expect(result.magicBonus).toBe(0)
    expect(result.baseName).toBe('Longsword')
  })

  it('returns magicBonus 0 for empty string', () => {
    const result = parseMagicItemName('')
    expect(result.magicBonus).toBe(0)
    expect(result.baseName).toBe('')
  })

  it('returns magicBonus 0 for null', () => {
    const result = parseMagicItemName(null)
    expect(result.magicBonus).toBe(0)
    expect(result.baseName).toBeNull()
  })

  it('returns magicBonus 0 for undefined', () => {
    const result = parseMagicItemName(undefined)
    expect(result.magicBonus).toBe(0)
    expect(result.baseName).toBeUndefined()
  })

  it('returns magicBonus 0 for non-string types', () => {
    const result1 = parseMagicItemName(42)
    expect(result1.magicBonus).toBe(0)

    const result2 = parseMagicItemName({})
    expect(result2.magicBonus).toBe(0)
  })
})

// ── Mocked module: getAbilityModifier ─────────────────────────────
describe('getAbilityModifier (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 when abilities is null', () => {
    const result = getAbilityModifier(null, 'Strength')
    expect(result).toBe(0)
  })

  it('returns 0 when abilityName is null', () => {
    const result = getAbilityModifier([], null)
    expect(result).toBe(0)
  })

  it('returns 0 when abilityName is undefined', () => {
    const result = getAbilityModifier([], undefined)
    expect(result).toBe(0)
  })

  it('returns 0 when abilities is not an array', () => {
    const result = getAbilityModifier({ Strength: 5 }, 'Strength')
    expect(result).toBe(0)
  })

  it('returns 0 when abilities is an object instead of array', () => {
    const abilities = { Strength: { bonus: 5 } }
    const result = getAbilityModifier(abilities, 'Strength')
    expect(result).toBe(0)
  })

  it('returns the bonus for a matching canonical ability name', () => {
    const abilities = [
      { name: 'Strength', bonus: 5 },
      { name: 'Dexterity', bonus: 2 },
    ]
    const result = getAbilityModifier(abilities, 'Strength')
    expect(result).toBe(5)
  })

  it('supports lowercase ability name shortcuts', () => {
    const abilities = [
      { name: 'Strength', bonus: 5 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 3 },
      { name: 'Intelligence', bonus: -1 },
      { name: 'Wisdom', bonus: 0 },
      { name: 'Charisma', bonus: 1 },
    ]
    expect(getAbilityModifier(abilities, 'str')).toBe(5)
    expect(getAbilityModifier(abilities, 'dex')).toBe(2)
    expect(getAbilityModifier(abilities, 'con')).toBe(3)
    expect(getAbilityModifier(abilities, 'int')).toBe(-1)
    expect(getAbilityModifier(abilities, 'wis')).toBe(0)
    expect(getAbilityModifier(abilities, 'cha')).toBe(1)
  })

  it('does not match multi-word ability names like "Strength Modifier" (spaces are stripped)', () => {
    // "Strength Modifier" -> "Strengthmodifier" after canonicalization, which doesn't match "Strength"
    const abilities = [{ name: 'Strength', bonus: 5 }]
    const result = getAbilityModifier(abilities, 'Strength Modifier')
    expect(result).toBe(0)
  })

  it('returns 0 for non-matching ability name', () => {
    const abilities = [
      { name: 'Strength', bonus: 5 },
      { name: 'Dexterity', bonus: 2 },
    ]
    const result = getAbilityModifier(abilities, 'Magic')
    expect(result).toBe(0)
  })

  it('returns 0 when ability has no bonus property', () => {
    const abilities = [{ name: 'Strength' }]
    const result = getAbilityModifier(abilities, 'Strength')
    expect(result).toBe(0)
  })

  it('handles empty abilities array', () => {
    const result = getAbilityModifier([], 'Strength')
    expect(result).toBe(0)
  })
})
