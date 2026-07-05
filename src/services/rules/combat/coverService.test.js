// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { computeCover, COVER, COVER_AC_BONUS } from './coverService.js'

describe('COVER constants', () => {
  it('defines all four cover levels as distinct string values with correct AC bonuses', () => {
    const levels = [COVER.FULL, COVER.THREE_QUARTER, COVER.HALF, COVER.NONE]
    expect(new Set(levels).size).toBe(4)
    expect(levels).toContain('full')
    expect(levels).toContain('threeQuarter')
    expect(levels).toContain('half')
    expect(levels).toContain('none')

    expect(COVER_AC_BONUS[COVER.FULL]).toBeNull()
    expect(COVER_AC_BONUS[COVER.THREE_QUARTER]).toBe(5)
    expect(COVER_AC_BONUS[COVER.HALF]).toBe(2)
    expect(COVER_AC_BONUS[COVER.NONE]).toBe(0)
  })
})

describe('computeCover', () => {
  // --- No cover ---

  describe('no cover scenarios', () => {
    it('returns no cover when attacker and target are at the same position', () => {
      expect(computeCover(
        { gridX: 5, gridY: 5 }, { gridX: 5, gridY: 5 }, new Set(), []
      )).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover when no obstacles exist on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set(), []
      )).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover for melee adjacency (no intermediate cells)', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 }, new Set(), []
      )).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover when only open doors or off-line items are present', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 1, gridY: 0, open: true },
          { type: 'door', gridX: 2, gridY: 0, open: true },
        ]
      )).toEqual({ level: COVER.NONE, acBonus: 0 })

      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set(), [
          { type: 'barrel', gridX: 0, gridY: 2 },
          { type: 'altar', gridX: 3, gridY: 1 },
        ]
      )).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('returns no cover for unknown item types not in cover tables', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
          { type: 'torch', gridX: 1, gridY: 0 },
          { type: 'flag', gridX: 2, gridY: 0 },
        ]
      )).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('handles null, undefined, empty array, or empty Set walls arguments', () => {
      expect(computeCover({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, null, [])).toEqual({ level: COVER.NONE, acBonus: 0 })
      expect(computeCover({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, undefined, [])).toEqual({ level: COVER.NONE, acBonus: 0 })
      expect(computeCover({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, [], [])).toEqual({ level: COVER.NONE, acBonus: 0 })
      expect(computeCover({ gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [])).toEqual({ level: COVER.NONE, acBonus: 0 })
    })
  })

  // --- Full cover ---

  describe('full cover scenarios', () => {
    it('returns full cover when a wall cell is on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(['2,0']), []
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when a closed door is on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 2, gridY: 0, open: false },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when walls are provided as array of strings', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, ['2,0'], []
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when multiple walls exist on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(['1,0', '3,0']), []
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when a closed door occupies a two-cell item space', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 2, gridY: 0, open: false },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })
  })

  // --- Three-quarter cover ---

  describe('three-quarter cover scenarios', () => {
    const itemTypes = [
      { type: 'altar', gridX: 2, gridY: 0, rotation: 0 },
      { type: 'table', gridX: 2, gridY: 0, rotation: 0 },
      { type: 'bed', gridX: 2, gridY: 0, rotation: 0 },
      { type: 'bookshelf', gridX: 2, gridY: 0, rotation: 0 },
    ]

    for (const item of itemTypes) {
      it(`returns 3/4 cover when a ${item.type} is on the line`, () => {
        expect(computeCover(
          { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [item]
        )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
      })
    }

    it('returns 3/4 cover when a two-cell item secondary cell is on the line', () => {
      // horizontal table secondary cell
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'table', gridX: 2, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })

      // vertical bed secondary cell
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 0, gridY: 4 }, new Set(), [
          { type: 'bed', gridX: 0, gridY: 2, rotation: 90 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when a two-cell item has undefined rotation (defaults horizontal)', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'table', gridX: 2, gridY: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover on diagonal lines', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 3 }, new Set(), [
          { type: 'altar', gridX: 1, gridY: 1, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })

      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 3 }, new Set(), [
          { type: 'bed', gridX: 1, gridY: 1, rotation: 90 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })
  })

  // --- Half cover ---

  describe('half cover scenarios', () => {
    const halfCoverTypes = ['barrel', 'chair', 'chest', 'crate', 'fountain', 'pillar', 'statue']

    for (const type of halfCoverTypes) {
      it(`returns 1/2 cover when a ${type} is on the line`, () => {
        expect(computeCover(
          { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
            { type, gridX: 2, gridY: 0 },
          ]
        )).toEqual({ level: COVER.HALF, acBonus: 2 })
      })
    }
  })

  // --- Priority ---

  describe('cover priority and interactions', () => {
    it('prioritizes full cover over three-quarter cover', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(['3,0']), [
          { type: 'table', gridX: 1, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('prioritizes three-quarter cover over half cover', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'barrel', gridX: 1, gridY: 0 },
          { type: 'table', gridX: 3, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns the highest cover when multiple items of the same type block the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'barrel', gridX: 1, gridY: 0 },
          { type: 'barrel', gridX: 3, gridY: 0 },
        ]
      )).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('returns full cover when both a wall and a half-cover item are on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(['3,0']), [
          { type: 'barrel', gridX: 1, gridY: 0 },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when both a closed door and a three-quarter cover item are on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 1, gridY: 0, open: false },
          { type: 'altar', gridX: 3, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })
  })

  // --- Two-cell items ---

  describe('two-cell items', () => {
    it('registers both cells for horizontal and vertical two-cell items', () => {
      // horizontal table
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'table', gridX: 2, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })

      // vertical bed
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 0, gridY: 4 }, new Set(), [
          { type: 'bed', gridX: 0, gridY: 2, rotation: 90 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })

      // vertical altar
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 0, gridY: 4 }, new Set(), [
          { type: 'altar', gridX: 0, gridY: 2, rotation: 90 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })

      // vertical bookshelf
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 0, gridY: 4 }, new Set(), [
          { type: 'bookshelf', gridX: 0, gridY: 2, rotation: 90 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when both primary and secondary cells of a two-cell item are on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 5, gridY: 0 }, new Set(), [
          { type: 'table', gridX: 3, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns 3/4 cover when only the primary cell of a two-cell item is on the line', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'table', gridX: 1, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })
  })

  // --- Diagonal and edge cases ---

  describe('diagonal and edge cases', () => {
    it('detects cover on diagonal lines with walls and items', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 3 }, new Set(['1,1']), []
      )).toEqual({ level: COVER.FULL, acBonus: null })

      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 1 }, new Set(), [
          { type: 'barrel', gridX: 2, gridY: 0 },
        ]
      )).toEqual({ level: COVER.HALF, acBonus: 2 })

      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 4 }, new Set(), [
          { type: 'altar', gridX: 0, gridY: 2, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })
    })

    it('returns no cover on a diagonal with no obstacles', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 3 }, new Set(), []
      )).toEqual({ level: COVER.NONE, acBonus: 0 })
    })

    it('handles origin, negative, and large grid distances', () => {
      // target at origin
      expect(computeCover(
        { gridX: 3, gridY: 0 }, { gridX: 0, gridY: 0 }, new Set(), [
          { type: 'barrel', gridX: 1, gridY: 0 },
        ]
      )).toEqual({ level: COVER.HALF, acBonus: 2 })

      // negative positions
      expect(computeCover(
        { gridX: -3, gridY: 0 }, { gridX: 0, gridY: 0 }, new Set(), [
          { type: 'altar', gridX: -1, gridY: 0, rotation: 0 },
        ]
      )).toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 })

      // large grid distance
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 50, gridY: 0 }, new Set(), [
          { type: 'pillar', gridX: 25, gridY: 0 },
        ]
      )).toEqual({ level: COVER.HALF, acBonus: 2 })
    })

    it('handles items with extra properties beyond what the function uses', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
          { type: 'barrel', gridX: 1, gridY: 0, name: 'Oil Barrel', hp: 15, locked: false },
        ]
      )).toEqual({ level: COVER.HALF, acBonus: 2 })
    })
  })

  // --- Door-specific ---

  describe('door-specific behavior', () => {
    it('returns no cover for an open door, full cover for a closed door', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 2, gridY: 0, open: true },
        ]
      )).toEqual({ level: COVER.NONE, acBonus: 0 })

      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 2, gridY: 0, open: false },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })

    it('returns full cover when the first door on the line is closed (stops at first)', () => {
      expect(computeCover(
        { gridX: 0, gridY: 0 }, { gridX: 4, gridY: 0 }, new Set(), [
          { type: 'door', gridX: 1, gridY: 0, open: true },
          { type: 'door', gridX: 3, gridY: 0, open: false },
        ]
      )).toEqual({ level: COVER.FULL, acBonus: null })
    })
  })
})
