// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  hasAutomation,
  getAutomationInfo,
  evaluateAutoExpression,
  resolveNumericExpression,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

// ── hasAutomation ─────────────────────────────────────────────────

describe('hasAutomation', () => {
  it('returns true when feature has an automation property (even empty object)', () => {
    expect(hasAutomation({ name: 'X', automation: { type: 'passive_rule' } })).toBe(true)
    expect(hasAutomation({ name: 'X', automation: {} })).toBe(true)
  })

  it('returns false when feature has no automation property or automation is falsy', () => {
    expect(hasAutomation({ name: 'X' })).toBe(false)
    expect(hasAutomation(null)).toBe(false)
    expect(hasAutomation(undefined)).toBe(false)
    expect(hasAutomation(0)).toBe(false)
    expect(hasAutomation(false)).toBe(false)
    expect(hasAutomation('')).toBe(false)
  })
})

// ── getAutomationInfo ──────────────────────────────────────────────

describe('getAutomationInfo', () => {
  it('returns null when feature has no automation or feature is null', () => {
    expect(getAutomationInfo({ name: 'Test' }, makePlayerStats())).toBeNull()
    expect(getAutomationInfo(null, makePlayerStats())).toBeNull()
  })

  it('returns automation info for a valid feature', () => {
    const feature = makeFeature({ type: 'passive_rule', effect: 'superior_dice' })
    const info = getAutomationInfo(feature, makePlayerStats())
    expect(info).toMatchObject({ hasAutomation: true, type: 'passive_rule' })
  })

  it('returns null for unknown automation type', () => {
    const feature = makeFeature({ type: 'unknown_type' })
    const info = getAutomationInfo(feature, makePlayerStats())
    expect(info).toBeNull()
  })
})

// ── evaluateAutoExpression ────────────────────────────────────────

describe('evaluateAutoExpression', () => {
  it('returns the input unchanged when expression is falsy', () => {
    expect(evaluateAutoExpression(null)).toBeNull()
    expect(evaluateAutoExpression(undefined)).toBeUndefined()
    expect(evaluateAutoExpression('')).toBe('')
  })

  it('evaluates simple arithmetic and compound expressions with placeholders', () => {
    expect(evaluateAutoExpression('4 + 3', makePlayerStats())).toBe(7)
    expect(evaluateAutoExpression('(2 * 3) + (4 / 2)', makePlayerStats())).toBe(8)
    expect(evaluateAutoExpression('proficiency_bonus + 1', makePlayerStats({ proficiency: 3 }))).toBe(4)
    expect(evaluateAutoExpression('level * 2', makePlayerStats({ level: 5 }))).toBe(10)
    expect(evaluateAutoExpression('proficiency_bonus + STR modifier + level', makePlayerStats({ proficiency: 4, level: 10 }))).toBe(19)
  })

  it('resolves ability modifiers from playerStats.abilities', () => {
    const ps = makePlayerStats()
    expect(evaluateAutoExpression('STR modifier', ps)).toBe(5)
    expect(evaluateAutoExpression('DEX modifier + 1', ps)).toBe(3)
    expect(evaluateAutoExpression('WIS modifier', ps)).toBe(0)
    expect(evaluateAutoExpression('INT modifier + 10', ps)).toBe(9)
  })

  it('handles proficiency_bonus_d4 and _min_ suffix', () => {
    const ps = makePlayerStats({ proficiency: 3 })
    expect(evaluateAutoExpression('proficiency_bonus_d4', ps)).toBe('3d4')
    expect(evaluateAutoExpression('2_min_5', makePlayerStats())).toBe(5)
    expect(evaluateAutoExpression('10_min_5', makePlayerStats())).toBe(10)
    expect(evaluateAutoExpression('-10_min_5', makePlayerStats())).toBe(5)
    expect(evaluateAutoExpression('proficiency_bonus_d4_min_3', makePlayerStats())).toContain('Math.max')
  })

  it('handles edge cases: zero proficiency, negative proficiency, zero result', () => {
    expect(evaluateAutoExpression('proficiency_bonus + 5', makePlayerStats({ proficiency: 0 }))).toBe(5)
    expect(evaluateAutoExpression('proficiency_bonus + 3', makePlayerStats({ proficiency: -1 }))).toBe(2)
    expect(evaluateAutoExpression('5 - 5', makePlayerStats())).toBe(0)
  })

  it('returns unresolved string for non-numeric tokens or invalid syntax', () => {
    expect(typeof evaluateAutoExpression('3d6', makePlayerStats())).toBe('string')
    expect(typeof evaluateAutoExpression('@@invalid@@', makePlayerStats())).toBe('string')
  })
})

// ── evaluateAutoExpression: dice is a documented outcome, not noise ─────
describe('evaluateAutoExpression console behaviour', () => {
  afterEach(() => vi.restoreAllMocks())

  it('does NOT warn for dice notation (the string fallback is intentional)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(evaluateAutoExpression('1d8 + 3', makePlayerStats())).toBe('1d8 + 3')
    expect(evaluateAutoExpression('3d6', makePlayerStats())).toBe('3d6')
    expect(warn).not.toHaveBeenCalled()
  })

  it('does NOT warn for a clamped dice group (rolls after the clamp)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(evaluateAutoExpression('proficiency_bonus_d4_min_3', makePlayerStats({ proficiency: 3 }))).toBe('Math.max(3, (3d4))')
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns with the expression text only for genuinely malformed expressions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(typeof evaluateAutoExpression('@@invalid@@', makePlayerStats())).toBe('string')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]).toContain('@@invalid@@')
  })
})

// ── resolveNumericExpression ───────────────────────────────────────
describe('resolveNumericExpression', () => {
  it('evaluates arithmetic to an exact number', () => {
    expect(resolveNumericExpression('proficiency_bonus + 1', makePlayerStats({ proficiency: 3 }))).toBe(4)
  })

  it('rolls a dice formula to a number in range', () => {
    for (let i = 0; i < 20; i++) {
      const total = resolveNumericExpression('2d6', makePlayerStats())
      expect(typeof total).toBe('number')
      expect(total).toBeGreaterThanOrEqual(2)
      expect(total).toBeLessThanOrEqual(12)
    }
  })

  it('rolls dice plus modifier formulas from real feature data', () => {
    const total = resolveNumericExpression('1d10 + CON modifier', makePlayerStats())
    expect(total).toBeGreaterThanOrEqual(1 + 3)
    expect(total).toBeLessThanOrEqual(10 + 3)
  })

  it('maximizes when rollOptions.maximize is set', () => {
    expect(resolveNumericExpression('4d6', makePlayerStats(), undefined, { maximize: true })).toBe(24)
  })

  it('clamps dice after the roll for _min_ formulas', () => {
    const total = resolveNumericExpression('proficiency_bonus_d4_min_3', makePlayerStats({ proficiency: 3 }))
    expect(total).toBeGreaterThanOrEqual(3)
    expect(total).toBeLessThanOrEqual(12)
  })

  it('returns null for genuinely unresolvable expressions', () => {
    expect(resolveNumericExpression('@@bogus@@', makePlayerStats())).toBeNull()
  })
})
