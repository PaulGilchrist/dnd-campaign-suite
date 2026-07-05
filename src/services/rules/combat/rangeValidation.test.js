// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import {
  getDistanceFeet,
  computeRangeEffect,
  computeMeleeProximityEffect,
  isHostileNPC,
  getNearestPlacedItem,
  rangeToFeet,
  computeEffectiveSpellRange,
} from './rangeValidation.js'

describe('getDistanceFeet', () => {
  it('returns null if either position is null or undefined', () => {
    expect(getDistanceFeet(null, { gridX: 0, gridY: 0 })).toBeNull()
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, null)).toBeNull()
    expect(getDistanceFeet(null, null)).toBeNull()
    expect(getDistanceFeet(undefined, { gridX: 0, gridY: 0 })).toBeNull()
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, undefined)).toBeNull()
  })

  it('returns 0 for same position', () => {
    expect(getDistanceFeet({ gridX: 5, gridY: 5 }, { gridX: 5, gridY: 5 })).toBe(0)
  })

  it('converts grid distance to feet (1 cell = 5 ft)', () => {
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 2, gridY: 0 })).toBe(10)
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 0, gridY: 3 })).toBe(15)
  })

  it('computes diagonal distance using Euclidean formula', () => {
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 4 })).toBeCloseTo(25)
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, { gridX: 1, gridY: 1 })).toBeCloseTo(5 * Math.sqrt(2))
  })
})

describe('rangeToFeet', () => {
  it('passes numbers through, returns 0 for zero, returns number for negative', () => {
    expect(rangeToFeet(5)).toBe(5)
    expect(rangeToFeet(100)).toBe(100)
    expect(rangeToFeet(0)).toBe(0)
    expect(rangeToFeet(-10)).toBe(-10)
  })

  it('converts special strings: Touch, Self, Sight, Unlimited, Special', () => {
    expect(rangeToFeet('Touch')).toBe(8)
    expect(rangeToFeet('touch')).toBe(8)
    expect(rangeToFeet('Self')).toBeNull()
    expect(rangeToFeet('Self (cone)')).toBeNull()
    expect(rangeToFeet('Self (15-foot cone)')).toBeNull()
    expect(rangeToFeet('Self (sphere)')).toBeNull()
    expect(rangeToFeet('Sight')).toBe(Infinity)
    expect(rangeToFeet('Unlimited')).toBe(Infinity)
    expect(rangeToFeet('Special')).toBeNull()
  })

  it('parses numeric ranges (feet, foot, ft, ft., mile)', () => {
    expect(rangeToFeet('120 feet')).toBe(120)
    expect(rangeToFeet('30 ft')).toBe(30)
    expect(rangeToFeet('10 ft.')).toBe(10)
    expect(rangeToFeet('60 foot')).toBe(60)
    expect(rangeToFeet('10.5 feet')).toBe(10.5)
    expect(rangeToFeet('1 mile')).toBe(5280)
    expect(rangeToFeet('0.5 mile')).toBe(2640)
  })

  it('returns null for null, undefined, empty string, whitespace, and unparseable strings', () => {
    expect(rangeToFeet(null)).toBeNull()
    expect(rangeToFeet(undefined)).toBeNull()
    expect(rangeToFeet('')).toBeNull()
    expect(rangeToFeet('  ')).toBeNull()
    expect(rangeToFeet('abc')).toBeNull()
    expect(rangeToFeet('yards')).toBeNull()
    expect(rangeToFeet('120 feet extra')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(rangeToFeet('TOUCH')).toBe(8)
    expect(rangeToFeet('SELF')).toBeNull()
    expect(rangeToFeet('SIGHT')).toBe(Infinity)
    expect(rangeToFeet('SPECIAL')).toBeNull()
    expect(rangeToFeet('120 FEET')).toBe(120)
    expect(rangeToFeet('1 MILE')).toBe(5280)
  })
})

describe('computeEffectiveSpellRange', () => {
  it('returns base feet without metamagic, doubles with Distant Spell', () => {
    expect(computeEffectiveSpellRange('Touch')).toBe(8)
    expect(computeEffectiveSpellRange('120 feet')).toBe(120)

    const meta = { metamagicDistant: true }
    expect(computeEffectiveSpellRange('120 feet', meta)).toBe(240)
    expect(computeEffectiveSpellRange('30 ft', meta)).toBe(60)
    expect(computeEffectiveSpellRange('Touch', meta)).toBe(30)
  })

  it('returns null for self/special ranges regardless of metamagic', () => {
    const meta = { metamagicDistant: true }
    expect(computeEffectiveSpellRange('Self', meta)).toBeNull()
    expect(computeEffectiveSpellRange('Self (cone)', meta)).toBeNull()
    expect(computeEffectiveSpellRange('Special', meta)).toBeNull()
  })
})

describe('computeRangeEffect', () => {
  it('returns normal for melee within 5 ft, auto-misses beyond 8 ft', () => {
    expect(computeRangeEffect(5, 0)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, 5)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, 8)).toEqual({ mode: 'normal' })

    const miss = computeRangeEffect(5, 8.1)
    expect(miss.mode).toBe('miss')
    expect(miss.reason).toContain('out of melee range')

    // includes actual distance and effective range in reason
    const miss2 = computeRangeEffect(5, 12)
    expect(miss2.reason).toContain('12 ft')
    expect(miss2.reason).toContain('8 ft')
  })

  it('returns normal when distance is null (no map), skips range check for unparseable ranges', () => {
    expect(computeRangeEffect(5, null)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(100, null)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Self', 10)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Special', 10)).toEqual({ mode: 'normal' })
  })

  it('handles Touch as melee range and ranged spell range with normal/disadvantage/miss', () => {
    // Touch adjacent
    expect(computeRangeEffect('Touch', 0)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Touch', 8)).toEqual({ mode: 'normal' })
    // Touch beyond
    expect(computeRangeEffect('Touch', 10).mode).toBe('miss')

    // Ranged: normal within range
    expect(computeRangeEffect('120 feet', 50).mode).toBe('normal')
    // disadvantage beyond normal
    expect(computeRangeEffect('120 feet', 150).mode).toBe('disadvantage')
    // miss beyond double
    expect(computeRangeEffect('120 feet', 250).mode).toBe('miss')
  })

  it('handles normal range, disadvantage at double, miss beyond double', () => {
    expect(computeRangeEffect(100, 50)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(100, 100)).toEqual({ mode: 'normal' })

    const dis = computeRangeEffect(100, 150)
    expect(dis.mode).toBe('disadvantage')
    expect(dis.reason).toContain('Beyond normal range')

    expect(computeRangeEffect(100, 199.9).mode).toBe('disadvantage')
    expect(computeRangeEffect(100, 200).mode).toBe('disadvantage')
    expect(computeRangeEffect(100, 201).mode).toBe('miss')
  })

  it('applies rangeMultiplier and meleeReachBonus', () => {
    expect(computeRangeEffect(100, 150, { rangeMultiplier: 2 }).mode).toBe('normal')
    expect(computeRangeEffect(100, 401, { rangeMultiplier: 2 }).mode).toBe('miss')
    expect(computeRangeEffect(5, 12, { meleeReachBonus: 5 }).mode).toBe('normal')
    expect(computeRangeEffect(5, 14, { meleeReachBonus: 5 }).mode).toBe('miss')
  })

  it('ignoresLongRangeDisadvantage removes disadvantage but still auto-misses beyond 2x', () => {
    const feats = { ignoresLongRangeDisadvantage: true }
    expect(computeRangeEffect(100, 150, feats)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(100, 100, feats)).toEqual({ mode: 'normal' })
    const miss = computeRangeEffect(100, 201, feats)
    expect(miss.mode).toBe('miss')
    expect(miss.reason).toContain('Out of range')
  })
})

describe('computeMeleeProximityEffect', () => {
  it('returns normal for non-ranged attacks, when feat ignores melee disadvantage, no threats, or null/undefined attacker position', () => {
    expect(computeMeleeProximityEffect(false, { gridX: 0, gridY: 0 }, [{ gridX: 0, gridY: 0, name: 'Goblin' }])).toEqual({ mode: 'normal' })

    const feats = { ignoresMeleeDisadvantage: true }
    expect(computeMeleeProximityEffect(true, { gridX: 0, gridY: 0 }, [], feats)).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, { gridX: 0, gridY: 0 }, [])).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, null, [{ gridX: 0, gridY: 0 }])).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, undefined, [{ gridX: 0, gridY: 0 }])).toEqual({ mode: 'normal' })
  })

  it('returns disadvantage when hostile NPC within 5 ft, includes fallback name when threat has no name', () => {
    const attacker = { gridX: 10, gridY: 10 }

    let result = computeMeleeProximityEffect(true, attacker, [{ gridX: 10, gridY: 11, name: 'Goblin' }], {})
    expect(result.mode).toBe('disadvantage')
    expect(result.reason).toContain('Goblin')

    result = computeMeleeProximityEffect(true, attacker, [{ gridX: 10, gridY: 11 }], {})
    expect(result.mode).toBe('disadvantage')
    expect(result.reason).toContain('hostile creature')
  })

  it('returns normal when NPC is beyond 5 ft, disadvantage when exactly 5 ft (same cell)', () => {
    const attacker = { gridX: 10, gridY: 10 }
    expect(computeMeleeProximityEffect(true, attacker, [{ gridX: 12, gridY: 10, name: 'Goblin' }], {})).toEqual({ mode: 'normal' })

    const result = computeMeleeProximityEffect(true, attacker, [{ gridX: 10, gridY: 10, name: 'Goblin' }], {})
    expect(result.mode).toBe('disadvantage')
  })

  it('checks all threats and returns first disadvantage found', () => {
    const attacker = { gridX: 5, gridY: 5 }
    const result = computeMeleeProximityEffect(true, attacker, [
      { gridX: 1, gridY: 1, name: 'Far Orc' },
      { gridX: 5, gridY: 6, name: 'Close Goblin' },
    ], {})
    expect(result.mode).toBe('disadvantage')
    expect(result.reason).toContain('Close Goblin')
  })
})

describe('getNearestPlacedItem', () => {
  it('returns the item when there is a single match', () => {
    const items = [{ name: 'Goblin', gridX: 5, gridY: 5 }]
    expect(getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })).toEqual(items[0])
  })

  it('returns the nearest item when there are multiple matches, including name number suffix', () => {
    let items = [
      { name: 'Goblin', gridX: 10, gridY: 10 },
      { name: 'Goblin', gridX: 2, gridY: 2 },
    ]
    expect(getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })).toEqual(items[1])

    items = [
      { name: 'Goblin 1', gridX: 10, gridY: 10 },
      { name: 'Goblin 2', gridX: 2, gridY: 2 },
    ]
    expect(getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })).toEqual(items[1])
  })

  it('returns null when no items match or placedItems is empty', () => {
    expect(getNearestPlacedItem([{ name: 'Orc', gridX: 5, gridY: 5 }], 'Goblin', { gridX: 0, gridY: 0 })).toBeNull()
    expect(getNearestPlacedItem([], 'Goblin', { gridX: 0, gridY: 0 })).toBeNull()
  })

  it('returns exact name match over prefix match, and does not match prefix with non-numeric suffix', () => {
    const items = [
      { name: 'Goblin', gridX: 10, gridY: 10 },
      { name: 'Goblin King', gridX: 2, gridY: 2 },
    ]
    expect(getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })).toEqual(items[0])

    expect(getNearestPlacedItem([{ name: 'Goblin King', gridX: 2, gridY: 2 }], 'Goblin', { gridX: 0, gridY: 0 })).toBeNull()
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

  it('returns true for negative/extreme opposition attitude (case-insensitive)', () => {
    expect(isHostileNPC({ attitude: 'negative' })).toBe(true)
    expect(isHostileNPC({ attitude: 'Negative' })).toBe(true)
    expect(isHostileNPC({ attitude: 'NEGATIVE' })).toBe(true)
    expect(isHostileNPC({ attitude: 'extreme opposition' })).toBe(true)
    expect(isHostileNPC({ attitude: 'Extreme Opposition' })).toBe(true)
  })

  it('returns false for positive attitudes', () => {
    expect(isHostileNPC({ attitude: 'positive' })).toBe(false)
    expect(isHostileNPC({ attitude: 'deep bonds' })).toBe(false)
    expect(isHostileNPC({ attitude: 'neutral' })).toBe(false)
  })
})
