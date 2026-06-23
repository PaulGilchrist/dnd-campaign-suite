// @improved-by-ai
import { describe, it, expect } from 'vitest'

// ── Imports from the fixtures module ──────────────────────────────
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── makePlayerStats ───────────────────────────────────────────────
describe('makePlayerStats', () => {
  describe('default values', () => {
    it('returns a player stats object with default values', () => {
      const ps = makePlayerStats()

      expect(ps.name).toBe('TestCharacter')
      expect(ps.proficiency).toBe(2)
      expect(ps.level).toBe(3)
      expect(ps.class.name).toBe('Barbarian')
      expect(ps.class.levels).toBe(3)
    })

    it('includes all six ability scores with correct default bonuses', () => {
      const ps = makePlayerStats()

      const expected = {
        Strength: 5,
        Dexterity: 2,
        Constitution: 3,
        Intelligence: -1,
        Wisdom: 0,
        Charisma: 1,
      }

      expect(ps.abilities.length).toBe(6)
      const bonuses = {}
      ps.abilities.forEach(a => { bonuses[a.name] = a.bonus })
      expect(bonuses).toEqual(expected)
    })
  })

  describe('overrides', () => {
    it('merges primitive overrides into the base object', () => {
      const ps = makePlayerStats({ name: 'Grog', level: 10 })

      expect(ps.name).toBe('Grog')
      expect(ps.level).toBe(10)
      // defaults preserved
      expect(ps.proficiency).toBe(2)
      expect(ps.class.name).toBe('Barbarian')
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

    it('overrides the abilities array entirely', () => {
      const customAbilities = [
        { name: 'Strength', bonus: 10 },
        { name: 'Dexterity', bonus: 8 },
      ]
      const ps = makePlayerStats({ abilities: customAbilities })

      expect(ps.abilities).toBe(customAbilities)
      expect(ps.abilities.length).toBe(2)
    })

    it('preserves default abilities when not overridden', () => {
      const ps = makePlayerStats({ name: 'Test' })

      expect(ps.abilities.length).toBe(6)
      expect(ps.abilities.find(a => a.name === 'Strength').bonus).toBe(5)
    })

    it('preserves default class when only name is overridden', () => {
      const ps = makePlayerStats({ name: 'Custom' })

      expect(ps.class.name).toBe('Barbarian')
      expect(ps.class.levels).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('handles empty overrides object', () => {
      const ps = makePlayerStats({})

      expect(ps.name).toBe('TestCharacter')
      expect(ps.abilities.length).toBe(6)
    })

    it('handles undefined overrides', () => {
      const ps = makePlayerStats(undefined)

      expect(ps.name).toBe('TestCharacter')
      expect(ps.proficiency).toBe(2)
    })
  })
})

// ── makeFeature ───────────────────────────────────────────────────
describe('makeFeature', () => {
  describe('default behavior', () => {
    it('returns an object with name and automation properties', () => {
      const feature = makeFeature({ type: 'passive_rule' })

      expect(feature).toHaveProperty('name')
      expect(feature).toHaveProperty('automation')
    })

    it('uses "Test Feature" as the default name', () => {
      const feature = makeFeature({ type: 'passive_rule' })
      expect(feature.name).toBe('Test Feature')
    })

    it('passes through the automation object as-is', () => {
      const automation = { type: 'action', effect: 'damage' }
      const feature = makeFeature(automation)
      expect(feature.automation).toBe(automation)
    })
  })

  describe('custom name', () => {
    it('accepts a custom name as second argument', () => {
      const feature = makeFeature({ type: 'passive_rule' }, 'Flame Blade')
      expect(feature.name).toBe('Flame Blade')
    })

    it('accepts an empty string as custom name', () => {
      const feature = makeFeature({ type: 'test' }, '')
      expect(feature.name).toBe('')
    })
  })

  describe('null/undefined automation', () => {
    it('passes through null automation', () => {
      const feature = makeFeature(null)
      expect(feature.automation).toBeNull()
    })

    it('passes through undefined automation', () => {
      const feature = makeFeature(undefined)
      expect(feature.automation).toBeUndefined()
    })
  })

  describe('reference behavior', () => {
    it('shares the same automation reference across calls (identity preserved)', () => {
      const auto = { type: 'passive_rule' }
      const f1 = makeFeature(auto)
      const f2 = makeFeature(auto)

      expect(f1.automation).toBe(auto)
      expect(f2.automation).toBe(auto)
      expect(f1.automation).toBe(f2.automation)
    })
  })
})
