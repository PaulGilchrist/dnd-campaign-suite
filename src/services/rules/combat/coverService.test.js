import { describe, it, expect } from 'vitest'
import { computeCover, COVER } from './coverService.js'

describe('computeCover', () => {
  it('returns no cover when attacker and target are at the same position', () => {
    const result = computeCover(
      { gridX: 5, gridY: 5 },
      { gridX: 5, gridY: 5 },
      new Set(),
      [],
    )
    expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
  })

  it('returns no cover when no obstacles on the line', () => {
    const result = computeCover(
      { gridX: 0, gridY: 0 },
      { gridX: 5, gridY: 0 },
      new Set(),
      [],
    )
    expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
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

  it('returns no cover when an open door is on the line', () => {
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

  it('returns full cover when a wall cell is on the line', () => {
    const result = computeCover(
      { gridX: 0, gridY: 0 },
      { gridX: 3, gridY: 0 },
      new Set(['2,0']),
      [],
    )
    expect(result).toEqual({ level: COVER.FULL, acBonus: null })
  })

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

  it('returns full cover when both wall and 3/4 cover on the line (full has priority)', () => {
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

  it('returns 3/4 cover when both 3/4 and 1/2 items on the line (3/4 has priority)', () => {
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

  it('returns no cover for melee adjacency (no intermediate cells)', () => {
    const result = computeCover(
      { gridX: 0, gridY: 0 },
      { gridX: 1, gridY: 0 },
      new Set(),
      [],
    )
    expect(result).toEqual({ level: COVER.NONE, acBonus: 0 })
  })

  it('returns 3/4 cover when a 2-cell item (table) secondary cell is on the line', () => {
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

  it('returns 3/4 cover when vertical 2-cell item (bed) secondary cell is on the line', () => {
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

  it('handles walls as array (JSON format)', () => {
    const result = computeCover(
      { gridX: 0, gridY: 0 },
      { gridX: 3, gridY: 0 },
      ['2,0'],
      [],
    )
    expect(result).toEqual({ level: COVER.FULL, acBonus: null })
  })
})
