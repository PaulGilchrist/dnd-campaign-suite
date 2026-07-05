// @cleaned-by-ai
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
