import { describe, it, expect, vi } from 'vitest'
import {
  getHitDieSize,
  getShortRestResourceLabels,
  computeHitDieRecovery,
  computeShortRestHpNewCurrent,
  getShortRestResources,
  getLongRestResources,
  spellSlotLevels,
} from './restRules.js'

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, _key, _campaign) => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}))

describe('restRules', () => {
  describe('getHitDieSize', () => {
    it('returns the parsed die number from hit_point_die', () => {
      const stats = { class: { hit_point_die: 'd12' } }
      expect(getHitDieSize(stats)).toBe(12)
    })

    it('returns the parsed die number from hit_die', () => {
      const stats = { class: { hit_die: 'd8' } }
      expect(getHitDieSize(stats)).toBe(8)
    })

    it('returns 8 as default when no hit die found', () => {
      expect(getHitDieSize({})).toBe(8)
    })

    it('returns 8 when playerStats is null', () => {
      expect(getHitDieSize(null)).toBe(8)
    })

    it('returns 8 when hitDieStr is null', () => {
      expect(getHitDieSize({ class: { hit_point_die: null } })).toBe(8)
    })
  })

  describe('getShortRestResourceLabels', () => {
    it('returns Channel Divinity for Cleric', () => {
      const stats = { class: { name: 'Cleric' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Channel Divinity')
    })

    it('returns Channel Divinity for Paladin', () => {
      const stats = { class: { name: 'Paladin' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Channel Divinity')
    })

    it('returns Wild Shape for Druid', () => {
      const stats = { class: { name: 'Druid' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Wild Shape')
    })

    it('returns Second Wind and Action Surge for Fighter', () => {
      const stats = { class: { name: 'Fighter' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Second Wind')
      expect(labels).toContain('Action Surge')
    })

    it('returns Focus Points for Monk', () => {
      const stats = { class: { name: 'Monk' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Focus Points')
    })

    it('filters subclasses correctly', () => {
      const stats = { class: { name: 'Fighter', subclass: { name: 'Psi Warrior' } } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Psionic Energy')
    })

    it('excludes subclass when not matching', () => {
      const stats = { class: { name: 'Fighter', subclass: { name: 'Eldritch Knight' } } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).not.toContain('Psionic Energy')
    })

    it('uses major.name as fallback for subclass', () => {
      const stats = { class: { name: 'Druid', major: { name: 'Circle of the Land' } } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Natural Recovery (Spell Slots)')
    })

    it('returns empty array for unknown class', () => {
      const stats = { class: { name: 'Rogue' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toEqual([])
    })
  })

  describe('computeHitDieRecovery', () => {
    it('adds roll value and conBonus', () => {
      expect(computeHitDieRecovery(5, 3)).toBe(8)
    })

    it('returns at least 1 even when sum is negative', () => {
      expect(computeHitDieRecovery(1, -5)).toBe(1)
    })

    it('handles zero values', () => {
      expect(computeHitDieRecovery(0, 0)).toBe(1)
    })
  })

  describe('computeShortRestHpNewCurrent', () => {
    it('adds recovered amount to currentHp capped at maxHp', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 5)).toBe(15)
    })

    it('caps at maxHp when recovery would exceed', () => {
      expect(computeShortRestHpNewCurrent(18, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is null', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is empty string', () => {
      expect(computeShortRestHpNewCurrent('', 20, 5)).toBe(20)
    })

    it('returns maxHp when recoveredAmount is 0', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 0)).toBe(10)
    })

    it('returns currentHp when recoveredAmount is undefined', () => {
      expect(computeShortRestHpNewCurrent(10, 20, undefined)).toBe(10)
    })
  })

  describe('getShortRestResources', () => {
    it('returns a copy of SHORT_REST_RESOURCES', () => {
      const resources = getShortRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
    })

    it('returns a new array each call', () => {
      const a = getShortRestResources()
      const b = getShortRestResources()
      expect(a).not.toBe(b)
    })
  })

  describe('getLongRestResources', () => {
    it('returns a copy of LONG_REST_RESOURCES', () => {
      const resources = getLongRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
    })

    it('returns a new array each call', () => {
      const a = getLongRestResources()
      const b = getLongRestResources()
      expect(a).not.toBe(b)
    })
  })

  describe('spellSlotLevels', () => {
    it('returns levels 1 through 9', () => {
      const levels = spellSlotLevels()
      expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })
})
