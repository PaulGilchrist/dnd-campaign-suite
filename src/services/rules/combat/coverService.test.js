// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { computeCover, COVER, COVER_AC_BONUS } from './coverService.js'

describe('COVER constants', () => {
  it('defines all four cover levels as distinct string values', () => {
    const levels = [COVER.FULL, COVER.THREE_QUARTER, COVER.HALF, COVER.NONE]
    expect(new Set(levels).size).toBe(4)
    expect(levels).toContain('full')
    expect(levels).toContain('threeQuarter')
    expect(levels).toContain('half')
    expect(levels).toContain('none')
  })

  it('maps each cover level to the correct AC bonus', () => {
    expect(COVER_AC_BONUS[COVER.FULL]).toBeNull()
    expect(COVER_AC_BONUS[COVER.THREE_QUARTER]).toBe(5)
    expect(COVER_AC_BONUS[COVER.HALF]).toBe(2)
    expect(COVER_AC_BONUS[COVER.NONE]).toBe(0)
  })
})

describe('computeCover', () => {
  describe('no cover scenarios', () => {
    it('returns no cover when attacker and target are at the same position', () => {
      const result = computeCover(
        { gridX: 5, gridY: 5 },
        { gridX: 5, gridY: 5 },
        new Set(),
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover when no obstacles exist on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 5, gridY: 0 },
        new Set(),
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover for melee adjacency (no intermediate cells)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 1, gridY: 0 },
        new Set(),
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover when only open doors are on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 1, gridY: 0, open: true },
          { type: 'door', gridX: 2, gridY: 0, open: true },
        ],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover when cover items are off the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 5, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 0, gridY: 2 },
          { type: 'altar', gridX: 3, gridY: 1 },
        ],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover for unknown item types not in cover tables', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'torch', gridX: 1, gridY: 0 },
          { type: 'flag', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('handles null walls argument', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        null,
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('handles undefined walls argument', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        undefined,
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('handles empty walls array', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        [],
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('handles empty placedItems array with no walls', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })
  })

  describe('full cover scenarios', () => {
    it('returns full cover when a wall cell is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(['2,0']),
        [],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when a closed door is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 2, gridY: 0, open: false },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when a closed door is on the line using walls-as-array format', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        ['2,0'],
        [],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when multiple walls exist (first one on line triggers)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(['1,0', '3,0']),
        [],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when a closed door occupies a two-cell item space', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 2, gridY: 0, open: false },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('prioritizes full cover over lower cover types', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(['3,0']),
        [
          { type: 'table', gridX: 1, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })
  })

  describe('three-quarter cover scenarios', () => {
    it('returns 3/4 cover when an altar is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'altar', gridX: 2, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a table is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'table', gridX: 2, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a bed is on the line (horizontal)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'bed', gridX: 2, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a bookshelf is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'bookshelf', gridX: 2, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a two-cell item secondary cell is on the line (horizontal table)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'table', gridX: 2, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a two-cell item secondary cell is on the line (vertical bed)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 0, gridY: 4 },
        new Set(),
        [
          { type: 'bed', gridX: 0, gridY: 2, rotation: 90 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a two-cell item primary cell is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'altar', gridX: 1, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a two-cell item has undefined rotation (defaults horizontal)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'table', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('prioritizes 3/4 cover over lower cover types', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
          { type: 'table', gridX: 3, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover on a diagonal line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 3 },
        new Set(),
        [
          { type: 'altar', gridX: 1, gridY: 1, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a two-cell item secondary cell is on a diagonal line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 3 },
        new Set(),
        [
          { type: 'bed', gridX: 1, gridY: 1, rotation: 90 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })
  })

  describe('half cover scenarios', () => {
    it('returns 1/2 cover when a barrel is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns 1/2 cover when a chair is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'chair', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns 1/2 cover when a chest is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'chest', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns 1/2 cover when a crate is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'crate', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns 1/2 cover when a fountain is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'fountain', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns 1/2 cover when a pillar is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'pillar', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns 1/2 cover when a statue is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'statue', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('prioritizes half cover over no cover', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })
  })

  describe('cover priority and interactions', () => {
    it('prioritizes full cover over three-quarter cover', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(['3,0']),
        [
          { type: 'table', gridX: 1, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('prioritizes three-quarter cover over half cover', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
          { type: 'table', gridX: 3, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns the highest cover when multiple items of the same type block the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
          { type: 'barrel', gridX: 3, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns full cover when both a wall and a half-cover item are on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(['3,0']),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when both a closed door and a three-quarter cover item are on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 1, gridY: 0, open: false },
          { type: 'altar', gridX: 3, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })
  })

  describe('two-cell items', () => {
    it('registers both cells for a horizontal two-cell item', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'table', gridX: 2, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('registers both cells for a vertical two-cell item', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 0, gridY: 4 },
        new Set(),
        [
          { type: 'bed', gridX: 0, gridY: 2, rotation: 90 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('registers both cells for a vertical altar', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 0, gridY: 4 },
        new Set(),
        [
          { type: 'altar', gridX: 0, gridY: 2, rotation: 90 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('registers both cells for a vertical bookshelf', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 0, gridY: 4 },
        new Set(),
        [
          { type: 'bookshelf', gridX: 0, gridY: 2, rotation: 90 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when both primary and secondary cells of a two-cell item are on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 5, gridY: 0 },
        new Set(),
        [
          { type: 'table', gridX: 3, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when the primary cell of a two-cell item is on the line', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'table', gridX: 1, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })
  })

  describe('walls as different input types', () => {
    it('accepts walls as a Set of strings', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(['1,0', '2,0']),
        [],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('accepts walls as an array of strings', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        ['1,0', '2,0'],
        [],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('accepts walls as null converted to empty set', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        null,
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('accepts walls as undefined converted to empty set', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        undefined,
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('accepts walls as an empty array', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        [],
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })
  })

  describe('diagonal and non-axis-aligned lines', () => {
    it('detects cover on a diagonal line (equal x and y)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 3 },
        new Set(),
        [
          { type: 'altar', gridX: 1, gridY: 1, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('detects cover on a diagonal line (equal with wall)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 3 },
        new Set(['1,1']),
        [],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('detects cover on a shallow diagonal (more x than y)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 1 },
        new Set(),
        [
          { type: 'barrel', gridX: 2, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('detects cover on a steep diagonal (more y than x)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 1, gridY: 4 },
        new Set(),
        [
          { type: 'altar', gridX: 0, gridY: 2, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('detects no cover on a diagonal with no obstacles', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 3 },
        new Set(),
        [],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })
  })

  describe('door-specific behavior', () => {
    it('returns no cover for an open door', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 2, gridY: 0, open: true },
        ],
      )
      expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns full cover for a closed door', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 2, gridY: 0, open: false },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns no cover when only one of multiple doors is closed (open door first on line)', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 4, gridY: 0 },
        new Set(),
        [
          { type: 'door', gridX: 1, gridY: 0, open: true },
          { type: 'door', gridX: 3, gridY: 0, open: false },
        ],
      )
      expect(result).toEqual({ level: COVER.FULL, acBonus: null })
    })
  })

  describe('edge cases', () => {
    it('returns correct cover when attacker position is at origin', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns correct cover when target position is at origin', () => {
      const result = computeCover(
        { gridX: 3, gridY: 0 },
        { gridX: 0, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns correct cover when both positions are negative', () => {
      const result = computeCover(
        { gridX: -3, gridY: 0 },
        { gridX: 0, gridY: 0 },
        new Set(),
        [
          { type: 'altar', gridX: -1, gridY: 0, rotation: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('handles large grid distances', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 50, gridY: 0 },
        new Set(),
        [
          { type: 'pillar', gridX: 25, gridY: 0 },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('handles items with extra properties beyond what the function uses', () => {
      const result = computeCover(
        { gridX: 0, gridY: 0 },
        { gridX: 3, gridY: 0 },
        new Set(),
        [
          { type: 'barrel', gridX: 1, gridY: 0, name: 'Oil Barrel', hp: 15, locked: false },
        ],
      )
      expect(result).toEqual({ level: COVER.HALF, acBonus: 2 })
    })
  })
})
