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

describe('rangeToFeet', () => {
  it('passes numbers through', () => {
    expect(rangeToFeet(5)).toBe(5)
    expect(rangeToFeet(100)).toBe(100)
    expect(rangeToFeet(0)).toBe(0)
  })

  it('converts "Touch" to melee range', () => {
    expect(rangeToFeet('Touch')).toBe(8)
    expect(rangeToFeet('touch')).toBe(8)
  })

  it('returns null for self-targeted ranges', () => {
    expect(rangeToFeet('Self')).toBeNull()
    expect(rangeToFeet('Self (cone)')).toBeNull()
    expect(rangeToFeet('Self (15-foot cone)')).toBeNull()
    expect(rangeToFeet('Self (sphere)')).toBeNull()
  })

  it('returns Infinity for sight and unlimited', () => {
    expect(rangeToFeet('Sight')).toBe(Infinity)
    expect(rangeToFeet('Unlimited')).toBe(Infinity)
  })

  it('returns null for special', () => {
    expect(rangeToFeet('Special')).toBeNull()
  })

  it('parses numeric ranges', () => {
    expect(rangeToFeet('120 feet')).toBe(120)
    expect(rangeToFeet('30 ft')).toBe(30)
    expect(rangeToFeet('10 ft.')).toBe(10)
    expect(rangeToFeet('60 foot')).toBe(60)
  })

  it('parses mile ranges', () => {
    expect(rangeToFeet('1 mile')).toBe(5280)
    expect(rangeToFeet('0.5 mile')).toBe(2640)
  })

  it('returns null for unparseable strings', () => {
    expect(rangeToFeet(null)).toBeNull()
    expect(rangeToFeet(undefined)).toBeNull()
    expect(rangeToFeet('')).toBeNull()
  })

  it('returns null for strings that pass guard but match no pattern', () => {
    expect(rangeToFeet('abc')).toBeNull()
    expect(rangeToFeet('yards')).toBeNull()
    expect(rangeToFeet('  ')).toBeNull()
    expect(rangeToFeet('120 feet extra')).toBeNull() // trailing text doesn't match
  })
})

describe('computeEffectiveSpellRange', () => {
  it('returns base feet without metamagic', () => {
    expect(computeEffectiveSpellRange('Touch')).toBe(8)
    expect(computeEffectiveSpellRange('120 feet')).toBe(120)
  })

  it('doubles numeric ranges with Distant Spell', () => {
    const meta = { metamagicDistant: true }
    expect(computeEffectiveSpellRange('120 feet', meta)).toBe(240)
    expect(computeEffectiveSpellRange('30 ft', meta)).toBe(60)
  })

  it('converts Touch to 30 ft with Distant Spell', () => {
    const meta = { metamagicDistant: true }
    expect(computeEffectiveSpellRange('Touch', meta)).toBe(30)
  })

  it('returns null for self/special ranges', () => {
    expect(computeEffectiveSpellRange('Self')).toBeNull()
    expect(computeEffectiveSpellRange('Special')).toBeNull()
  })
})

describe('computeRangeEffect', () => {
  it('returns normal for melee attacks within 5 ft', () => {
    expect(computeRangeEffect(5, 0)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, 5)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, 3)).toEqual({ mode: 'normal' })
  })

  it('returns auto-miss for melee attacks beyond 8 ft', () => {
    const result = computeRangeEffect(5, 8.1)
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

  it('treats "Touch" as melee range and auto-misses beyond 8 ft', () => {
    const result = computeRangeEffect('Touch', 10)
    expect(result.mode).toBe('miss')
    expect(result.reason).toContain('out of melee range')
  })

  it('hits with touch range when adjacent', () => {
    expect(computeRangeEffect('Touch', 0)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Touch', 5)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Touch', 8)).toEqual({ mode: 'normal' })
  })

  it('parses "120 feet" string range for ranged spells', () => {
    expect(computeRangeEffect('120 feet', 50)).toEqual({ mode: 'normal' })
    const result = computeRangeEffect('120 feet', 150)
    expect(result.mode).toBe('disadvantage')
    const miss = computeRangeEffect('120 feet', 250)
    expect(miss.mode).toBe('miss')
  })

  it('skips range check for unparseable strings', () => {
    expect(computeRangeEffect('Self', 10)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Special', 10)).toEqual({ mode: 'normal' })
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

describe('getNearestPlacedItem', () => {
  it('returns the item when there is a single match', () => {
    const items = [
      { name: 'Goblin', gridX: 5, gridY: 5 },
    ]
    const result = getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })
    expect(result).toEqual(items[0])
  })

  it('returns the nearest item when there are multiple matches', () => {
    const items = [
      { name: 'Goblin', gridX: 10, gridY: 10 },
      { name: 'Goblin', gridX: 2, gridY: 2 },
    ]
    const result = getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })
    expect(result).toEqual(items[1])
  })

  it('returns the nearest item with name number suffix', () => {
    const items = [
      { name: 'Goblin 1', gridX: 10, gridY: 10 },
      { name: 'Goblin 2', gridX: 2, gridY: 2 },
    ]
    const result = getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })
    expect(result).toEqual(items[1])
  })

  it('returns null when no items match', () => {
    const items = [
      { name: 'Orc', gridX: 5, gridY: 5 },
    ]
    const result = getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })
    expect(result).toBeNull()
  })

  it('returns null when placedItems is empty', () => {
    const result = getNearestPlacedItem([], 'Goblin', { gridX: 0, gridY: 0 })
    expect(result).toBeNull()
  })

  it('returns exact name match over prefix match', () => {
    const items = [
      { name: 'Goblin', gridX: 10, gridY: 10 },
      { name: 'Goblin King', gridX: 2, gridY: 2 },
    ]
    const result = getNearestPlacedItem(items, 'Goblin', { gridX: 0, gridY: 0 })
    expect(result).toEqual(items[0])
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
