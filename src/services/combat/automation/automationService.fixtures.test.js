// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'

// ── Imports from the fixtures module ──────────────────────────────
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── makePlayerStats ───────────────────────────────────────────────
describe('makePlayerStats', () => {
  describe('defaults', () => {
    it('returns a player stats object with correct defaults', () => {
      const ps = makePlayerStats()

      expect(ps.name).toBe('TestCharacter')
      expect(ps.proficiency).toBe(2)
      expect(ps.level).toBe(3)
      expect(ps.class.name).toBe('Barbarian')
      expect(ps.class.levels).toBe(3)
      expect(ps.abilities.length).toBe(6)
    })

    it('returns correct ability bonuses', () => {
      const ps = makePlayerStats()
      const bonuses = {}
      ps.abilities.forEach(a => { bonuses[a.name] = a.bonus })
      expect(bonuses).toEqual({
        Strength: 5,
        Dexterity: 2,
        Constitution: 3,
        Intelligence: -1,
        Wisdom: 0,
        Charisma: 1,
      })
    })
  })

  describe('overrides', () => {
    it('merges primitive overrides into the base object', () => {
      const ps = makePlayerStats({ name: 'Grog', level: 10 })

      expect(ps.name).toBe('Grog')
      expect(ps.level).toBe(10)
      expect(ps.proficiency).toBe(2)
      expect(ps.class.name).toBe('Barbarian')
    })

    it('overrides nested objects like class', () => {
      const ps = makePlayerStats({ class: { name: 'Wizard', levels: 5 } })

      expect(ps.class.name).toBe('Wizard')
      expect(ps.class.levels).toBe(5)
    })

    it('overrides the abilities array entirely', () => {
      const customAbilities = [
        { name: 'Strength', bonus: 10 },
        { name: 'Dexterity', bonus: 8 },
      ]
      const ps = makePlayerStats({ abilities: customAbilities })

      expect(ps.abilities).toBe(customAbilities)
    })

    it('handles empty overrides', () => {
      const ps = makePlayerStats({})
      expect(ps.name).toBe('TestCharacter')
    })
  })
})

// ── makeFeature ───────────────────────────────────────────────────
describe('makeFeature', () => {
  it('returns an object with name and automation properties', () => {
    const feature = makeFeature({ type: 'passive_rule' })
    expect(feature).toHaveProperty('name')
    expect(feature).toHaveProperty('automation')
    expect(feature.name).toBe('Test Feature')
  })

  it('accepts a custom name as second argument', () => {
    const feature = makeFeature({ type: 'passive_rule' }, 'Flame Blade')
    expect(feature.name).toBe('Flame Blade')
  })

  it('passes through automation as-is (no cloning)', () => {
    const auto = { type: 'passive_rule' }
    const f1 = makeFeature(auto)
    const f2 = makeFeature(auto)
    expect(f1.automation).toBe(auto)
    expect(f2.automation).toBe(auto)
  })

  it('handles null/undefined automation', () => {
    expect(makeFeature(null).automation).toBeNull()
    expect(makeFeature(undefined).automation).toBeUndefined()
  })
})
