// @improved-by-ai
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

  it.each([
    [null, false],
    [undefined, false],
    [0, false],
    [false, false],
    ['', false],
  ])('returns %s for %s', (input, expected) => {
    expect(hasAutomation(input)).toBe(expected)
  })

  it('returns true when automation is an empty object', () => {
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

  it('evaluates simple arithmetic expressions', () => {
    const result = evaluateAutoExpression('4 + 3', makePlayerStats())
    expect(result).toBe(7)
  })

  it('evaluates expressions with parentheses and mixed operators', () => {
    const result = evaluateAutoExpression('(2 * 3) + (4 / 2)', makePlayerStats())
    expect(result).toBe(8)
  })

  it('returns the unresolved string when expression contains non-numeric tokens', () => {
    const ps = makePlayerStats()
    const result = evaluateAutoExpression('3d6', ps)
    expect(result).toBe('3d6')
  })

  it('resolves proficiency_bonus placeholder to playerStats.proficiency value', () => {
    const ps = makePlayerStats({ proficiency: 3 })
    const result = evaluateAutoExpression('proficiency_bonus + 1', ps)
    expect(result).toBe(4)
  })

  it('resolves level placeholder to playerStats.level value', () => {
    const ps = makePlayerStats({ level: 5 })
    const result = evaluateAutoExpression('level * 2', ps)
    expect(result).toBe(10)
  })

  it('replaces proficiency_bonus_d4 with a dice expression string', () => {
    const ps = makePlayerStats({ proficiency: 3 })
    const result = evaluateAutoExpression('proficiency_bonus_d4', ps)
    expect(result).toBe('3d4')
  })

  it('applies _min_ suffix to enforce minimum value via Math.max', () => {
    const result = evaluateAutoExpression('2_min_5', makePlayerStats())
    expect(result).toBe(5)
  })

  it('returns the expression value when it exceeds the minimum', () => {
    const result = evaluateAutoExpression('10_min_5', makePlayerStats())
    expect(result).toBe(10)
  })

  it('resolves STR modifier from playerStats.abilities', () => {
    const ps = makePlayerStats()
    const result = evaluateAutoExpression('STR modifier', ps)
    expect(result).toBe(5)
  })

  it('resolves DEX modifier from playerStats.abilities in a compound expression', () => {
    const ps = makePlayerStats()
    const result = evaluateAutoExpression('DEX modifier + 1', ps)
    expect(result).toBe(3)
  })

  it('resolves WIS modifier as 0 when ability bonus is 0', () => {
    const ps = makePlayerStats()
    const result = evaluateAutoExpression('WIS modifier', ps)
    expect(result).toBe(0)
  })

  it('resolves druid_level placeholder to character level', () => {
    const ps = makePlayerStats({ level: 7 })
    const result = evaluateAutoExpression('druid_level', ps)
    expect(result).toBe(7)
  })

  it('handles negative ability modifiers in expressions', () => {
    const ps = makePlayerStats()
    const result = evaluateAutoExpression('INT modifier + 10', ps)
    expect(result).toBe(9)
  })

  it('handles _min_ with a negative value', () => {
    const result = evaluateAutoExpression('-10_min_5', makePlayerStats())
    expect(result).toBe(5)
  })

  it('applies _min_ with unresolved dice tokens producing a Math.max string', () => {
    const result = evaluateAutoExpression('proficiency_bonus_d4_min_3', makePlayerStats())
    expect(typeof result).toBe('string')
    expect(result).toContain('Math.max')
  })

  it('handles proficiency_bonus with zero proficiency', () => {
    const ps = makePlayerStats({ proficiency: 0 })
    const result = evaluateAutoExpression('proficiency_bonus + 5', ps)
    expect(result).toBe(5)
  })

  it('handles proficiency_bonus with negative proficiency (edge case)', () => {
    const ps = makePlayerStats({ proficiency: -1 })
    const result = evaluateAutoExpression('proficiency_bonus + 3', ps)
    expect(result).toBe(2)
  })

  it('returns 0 when expression evaluates to zero', () => {
    const result = evaluateAutoExpression('5 - 5', makePlayerStats())
    expect(result).toBe(0)
  })

  it('evaluates a complex expression with multiple placeholders and arithmetic', () => {
    const ps = makePlayerStats({ proficiency: 4, level: 10 })
    const result = evaluateAutoExpression('proficiency_bonus + STR modifier + level', ps)
    expect(result).toBe(19)
  })

  it('returns the unresolved string when expression contains invalid syntax', () => {
    const result = evaluateAutoExpression('@@invalid@@', makePlayerStats())
    expect(typeof result).toBe('string')
  })
})
