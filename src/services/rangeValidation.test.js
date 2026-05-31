import { describe, it, expect } from 'vitest'
import {
  getDistanceFeet,
  computeRangeEffect,
  computeMeleeProximityEffect,
  isHostileNPC,
} from './rangeValidation.js'

describe('getDistanceFeet', () => {
  it('returns null if either position is null', () => {
    expect(getDistanceFeet(null, { gridX: 0, gridY: 0 })).toBeNull()
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, null)).toBeNull()
    expect(getDistanceFeet(null, null)).toBeNull()
  })

  it('returns 0 for same position', () => {
    expect(getDistanceFeet({ gridX: 5, gridY: 5 }, { gridX: 5, gridY: 5 })).toBe(0)
  })

  it('converts grid distance to feet (1 cell = 5 ft)', () => {
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 2, gridY: 0 })).toBe(10)
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 0, gridY: 3 })).toBe(15)
  })

  it('computes diagonal distance', () => {
    const dist = getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 4 })
    expect(dist).toBeCloseTo(25)
  })
})

describe('computeRangeEffect', () => {
  it('returns normal for melee attacks within 5 ft', () => {
    expect(computeRangeEffect(5, 0)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, 5)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, 3)).toEqual({ mode: 'normal' })
  })

  it('returns auto-miss for melee attacks beyond 5 ft', () => {
    const result = computeRangeEffect(5, 5.1)
    expect(result.mode).toBe('miss')
    expect(result.reason).toContain('out of melee range')
  })

  it('returns auto-miss for melee attacks at long distance', () => {
    const result = computeRangeEffect(5, 50)
    expect(result.mode).toBe('miss')
    expect(result.reason).toContain('out of melee range')
  })

  it('returns normal for melee attacks when distance is null (no map)', () => {
    expect(computeRangeEffect(5, null)).toEqual({ mode: 'normal' })
  })

  it('returns normal for touch attacks when distance is null', () => {
    expect(computeRangeEffect(0, null)).toEqual({ mode: 'normal' })
  })

  it('returns normal when distance is null', () => {
    expect(computeRangeEffect(100, null)).toEqual({ mode: 'normal' })
  })

  it('returns normal when within attack range', () => {
    expect(computeRangeEffect(100, 50)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(100, 100)).toEqual({ mode: 'normal' })
  })

  it('returns disadvantage when beyond normal range but within double range', () => {
    const result = computeRangeEffect(100, 150)
    expect(result.mode).toBe('disadvantage')
    expect(result.reason).toContain('Beyond normal range')
    expect(result.reason).toContain('150 ft')
    expect(result.reason).toContain('100 ft')
  })

  it('handles just under double range as disadvantage', () => {
    const result = computeRangeEffect(100, 199.9)
    expect(result.mode).toBe('disadvantage')
  })

  it('handles exactly double range as disadvantage (at the limit)', () => {
    const result = computeRangeEffect(100, 200)
    expect(result.mode).toBe('disadvantage')
  })

  it('handles just beyond double range as auto-miss', () => {
    const result = computeRangeEffect(100, 201)
    expect(result.mode).toBe('miss')
  })

  it('applies rangeMultiplier to effective range', () => {
    const result = computeRangeEffect(100, 150, { rangeMultiplier: 2 })
    expect(result.mode).toBe('normal')
  })

  it('ignoresLongRangeDisadvantage removes disadvantage but still auto-misses beyond 2x', () => {
    const feats = { ignoresLongRangeDisadvantage: true }
    expect(computeRangeEffect(100, 150, feats)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(100, 100, feats)).toEqual({ mode: 'normal' })
    const miss = computeRangeEffect(100, 201, feats)
    expect(miss.mode).toBe('miss')
  })
})

describe('computeMeleeProximityEffect', () => {
  it('returns normal for non-ranged attacks', () => {
    expect(computeMeleeProximityEffect(false, { gridX: 0, gridY: 0 }, [{ gridX: 0, gridY: 0, name: 'Goblin' }])).toEqual({ mode: 'normal' })
  })

  it('returns normal when feat ignores melee disadvantage', () => {
    const feats = { ignoresMeleeDisadvantage: true }
    const threats = [{ gridX: 0, gridY: 0, name: 'Goblin' }]
    expect(computeMeleeProximityEffect(true, { gridX: 0, gridY: 0 }, threats, feats)).toEqual({ mode: 'normal' })
  })

  it('returns normal when no nearby threats', () => {
    expect(computeMeleeProximityEffect(true, { gridX: 0, gridY: 0 }, [])).toEqual({ mode: 'normal' })
  })

  it('returns normal when attacker position is null', () => {
    expect(computeMeleeProximityEffect(true, null, [{ gridX: 0, gridY: 0 }])).toEqual({ mode: 'normal' })
  })

  it('returns disadvantage when hostile NPC within 5 ft', () => {
    const attacker = { gridX: 10, gridY: 10 }
    const threats = [{ gridX: 10, gridY: 11, name: 'Goblin' }]
    const result = computeMeleeProximityEffect(true, attacker, threats, {})
    expect(result.mode).toBe('disadvantage')
    expect(result.reason).toContain('Goblin')
  })

  it('returns normal when hostile NPC is beyond 5 ft', () => {
    const attacker = { gridX: 10, gridY: 10 }
    const threats = [{ gridX: 12, gridY: 10, name: 'Goblin' }]
    expect(computeMeleeProximityEffect(true, attacker, threats, {})).toEqual({ mode: 'normal' })
  })

  it('returns disadvantage when NPC is exactly 5 ft away (same cell)', () => {
    const attacker = { gridX: 10, gridY: 10 }
    const threats = [{ gridX: 10, gridY: 10, name: 'Goblin' }]
    const result = computeMeleeProximityEffect(true, attacker, threats, {})
    expect(result.mode).toBe('disadvantage')
  })
})

describe('isHostileNPC', () => {
  it('returns false for null/undefined NPC', () => {
    expect(isHostileNPC(null)).toBe(false)
    expect(isHostileNPC(undefined)).toBe(false)
  })

  it('returns true when attitude is null (monster without attitude)', () => {
    expect(isHostileNPC({ name: 'Orc' })).toBe(true)
    expect(isHostileNPC({ name: 'Orc', attitude: null })).toBe(true)
  })

  it('returns true for negative attitude', () => {
    expect(isHostileNPC({ attitude: 'negative' })).toBe(true)
    expect(isHostileNPC({ attitude: 'Negative' })).toBe(true)
  })

  it('returns true for extreme opposition attitude', () => {
    expect(isHostileNPC({ attitude: 'extreme opposition' })).toBe(true)
  })

  it('returns false for positive attitudes', () => {
    expect(isHostileNPC({ attitude: 'positive' })).toBe(false)
    expect(isHostileNPC({ attitude: 'deep bonds' })).toBe(false)
    expect(isHostileNPC({ attitude: 'neutral' })).toBe(false)
  })
})
