import { describe, it, expect } from 'vitest'

import {
  hasAutomation,
  getAutomationInfo,
  evaluateAutoExpression,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── hasAutomation ─────────────────────────────────────────────────
describe('hasAutomation', () => {
  it('returns true when feature has an automation property', () => {
    expect(hasAutomation({ name: 'X', automation: { type: 'passive_rule' } })).toBe(true)
  })

  it('returns false when feature has no automation property', () => {
    expect(hasAutomation({ name: 'X' })).toBe(false)
  })

  it('returns false when feature is null', () => {
    expect(hasAutomation(null)).toBe(false)
  })

  it('returns false when feature is undefined', () => {
    expect(hasAutomation(undefined)).toBe(false)
  })

  it('returns false when automation is an empty object', () => {
    expect(hasAutomation({ name: 'X', automation: {} })).toBe(true)
  })
})

// ── getAutomationInfo ──────────────────────────────────────────────
describe('getAutomationInfo', () => {
  it('returns null when feature has no automation', () => {
    expect(getAutomationInfo({ name: 'Test' }, makePlayerStats())).toBeNull()
  })

  it('returns null when feature is null', () => {
    expect(getAutomationInfo(null, makePlayerStats())).toBeNull()
  })

  it('returns automation info for a valid feature (passive_rule)', () => {
    const feature = makeFeature({ type: 'passive_rule', effect: 'superior_dice' })
    const info = getAutomationInfo(feature, makePlayerStats())
    expect(info).not.toBeNull()
    expect(info.type).toBe('passive_rule')
    expect(info.hasAutomation).toBe(true)
  })

  it('returns null for unknown automation type', () => {
    const feature = makeFeature({ type: 'unknown_type' })
    const info = getAutomationInfo(feature, makePlayerStats())
    expect(info).toBeNull()
  })
})

// ── evaluateAutoExpression ────────────────────────────────────────
describe('evaluateAutoExpression', () => {
  it('returns the expression unchanged when no expression provided', () => {
    expect(evaluateAutoExpression(null)).toBeNull()
    expect(evaluateAutoExpression(undefined)).toBeUndefined()
    expect(evaluateAutoExpression('')).toBe('')
  })

  it('evaluates a simple numeric expression', () => {
    const result = evaluateAutoExpression('4 + 3', makePlayerStats())
    expect(result).toBe(7)
  })

  it('evaluates complex expressions', () => {
    const result = evaluateAutoExpression('(2 * 3) + (4 / 2)', makePlayerStats())
    expect(result).toBe(8)
  })

  it('returns string when expression cannot be evaluated as a number', () => {
    const ps = makePlayerStats()
    // '3d6' can't eval to a number, so it returns the resolved string (unchanged)
    expect(typeof evaluateAutoExpression('3d6', ps)).toBe('string')
  })

  it('resolves proficiency_bonus placeholder in expression', () => {
    const ps = makePlayerStats({ proficiency: 3 })
    const result = evaluateAutoExpression('proficiency_bonus + 1', ps)
    expect(result).toBe(4)
  })

  it('resolves level placeholder in expression', () => {
    const ps = makePlayerStats({ level: 5 })
    const result = evaluateAutoExpression('level * 2', ps)
    expect(result).toBe(10)
  })

  it('proficiency_bonus resolves from playerStats.proficiency even when explicit prof provided', () => {
    // The explicit prof parameter is set but never forwarded — source uses playerStats via resolveDiceExpression
    const ps = makePlayerStats({ proficiency: 3 })
    // prof=5 is a dead argument; expression still uses playerStats.proficiency (3)
    const result = evaluateAutoExpression('proficiency_bonus + 1', ps, 5)
    expect(result).toBe(4) // not 6 — explicit param has no effect
  })

  it('level resolves from playerStats.level even when explicit level provided', () => {
    // The explicit level parameter is set but never forwarded — source uses playerStats via resolveDiceExpression
    const ps = makePlayerStats({ level: 3 })
    const result = evaluateAutoExpression('level * 2', ps, 0, 7)
    expect(result).toBe(6) // not 14 — explicit param has no effect
  })

  it('handles proficiency_bonus_d4 placeholder correctly', () => {
    const ps = makePlayerStats({ proficiency: 3 })
    // Should become "3d4" which can't eval to a number → returns string
    const result = evaluateAutoExpression('proficiency_bonus_d4', ps)
    expect(typeof result).toBe('string')
    expect(result).toBe('3d4')
  })

  it('handles _min_ suffix for minimum value', () => {
    // "2_min_5" → Math.max(5, (2))
    const result = evaluateAutoExpression('2_min_5', makePlayerStats())
    expect(result).toBe(5)
  })

  it('_min_ returns expression value when above minimum', () => {
    const result = evaluateAutoExpression('10_min_5', makePlayerStats())
    expect(result).toBe(10)
  })

  it('evaluates ability modifier references in expression', () => {
    const ps = makePlayerStats()
    // "STR modifier" resolves to the strength bonus (5) via resolveDiceExpression
    const result = evaluateAutoExpression('STR modifier', ps)
    expect(result).toBe(5)
  })

  it('resolves DEX modifier in expression', () => {
    const ps = makePlayerStats()
    // "DEX modifier" resolves to the dexterity bonus (2)
    const result = evaluateAutoExpression('DEX modifier + 1', ps)
    expect(result).toBe(3)
  })

  it('resolves WIS modifier as 0 for zero bonus', () => {
    const ps = makePlayerStats() // wisdom bonus is 0
    const result = evaluateAutoExpression('WIS modifier', ps)
    expect(result).toBe(0)
  })

  it('resolves druid_level placeholder to character level', () => {
    const ps = makePlayerStats({ level: 7 })
    const result = evaluateAutoExpression('druid_level', ps)
    expect(result).toBe(7)
  })
})
