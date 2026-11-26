// @maintained-by-ai 2026-10-20
// Lane: computeCover rules TABLE (items / doors / walls / geometry) — SOLE OWNER.
// Consumer lanes cite here, never re-drive the table:
//   services/maps/effectiveWalls.test.js .. walls Set/array/nullish coercion + secret-door
//                                           derivation internals (row "w" below only wires them
//                                           THROUGH computeCover as consumers see them)
//   services/combat/coverService.test.js .. intervening-CREATURE −2 lane (different module)
//   automation/contextBuilder-*.test.js ... computeCover MOCKED there
//
// One parameterized truth table; every row is an exact pinned outcome with a distinct
// falsifier. Ray interiors hand-derived ONCE from bresenham (never re-run as oracle):
//   (0,0)->(4,0): interior (1,0),(2,0),(3,0)     (0,0)->(3,3): interior (1,1),(2,2)
//   (4,0)->(0,0): interior (3,0),(2,0),(1,0)     (0,0)->(-3,-3): interior (-1,-1),(-2,-2)
//   (0,0)->(2,4): interior (0,1),(1,2),(1,3)     (0,0)<->(5,5) same cell / (0,0)->(1,0): no interior
// Two-cell occupancy: vertical = (x,y)+(x,y+1); horizontal/default = (x,y)+(x+1,y).
//
// Old->new map: 4 bespoke no-cover tests + nullish-walls coercion -> rows a,b,v (coercion
// cited to effectiveWalls); full-cover wall/door/array/multi/2-cell -> rows b,c,w;
// ¾ item loop -> rows e-h; half loop + extra-props -> rows i-o; priority suite -> rows d,p;
// two-cell suites -> rows r,s (+ occupancy in e-h); diagonals/edges -> rows w,x,r-t,y-aa;
// door "stops at first" -> dropped (set-membership, same path as row c);
// constants toContain/Set-size -> exact golden-object pins.
// Furniture tiers additionally pin sourceLabel (the covering item's consumer
// name — rows e-p, y, z, ab, ac; named item row j proves the rename law).
// coverSourceLabel's own faces pinned in the describe at the bottom.
import { describe, it, expect } from 'vitest'
import { computeCover, coverSourceLabel, COVER, COVER_AC_BONUS } from './coverService.js'

describe('COVER constants', () => {
  it('pins the serialized level strings and AC bonuses (wire contract with all consumers)', () => {
    expect(COVER).toEqual({
      FULL: 'full',
      THREE_QUARTER: 'threeQuarter',
      HALF: 'half',
      NONE: 'none',
    })
    expect(COVER_AC_BONUS).toEqual({ full: null, threeQuarter: 5, half: 2, none: 0 })
  })
})

describe('computeCover', () => {
  const A = { gridX: 0, gridY: 0 }
  const T = { gridX: 4, gridY: 0 }

  // Straight ray A->T interior cells: (1,0),(2,0),(3,0).
  it.each([
    // [label, from, to, walls, placedItems, expected]
    ['a: clear line ⇒ no cover', A, T, new Set(), [], { level: COVER.NONE, acBonus: 0 }],
    ['b: wall on interior cell ⇒ full cover, null AC', A, T, new Set(['2,0']), [], { level: COVER.FULL, acBonus: null }],
    ['c: closed door ⇒ full cover', A, T, [], [{ type: 'door', gridX: 2, gridY: 0, open: false }], { level: COVER.FULL, acBonus: null }],
    ['d: wall outranks ¾ and half items ⇒ full cover', A, T, ['2,0'], [
      { type: 'altar', gridX: 1, gridY: 0, rotation: 0 },
      { type: 'barrel', gridX: 3, gridY: 0 },
    ], { level: COVER.FULL, acBonus: null }],
    ['e: table on line ⇒ ¾ cover', A, T, [], [{ type: 'table', gridX: 2, gridY: 0, rotation: 0 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Table' }],
    ['f: altar on line ⇒ ¾ cover', A, T, [], [{ type: 'altar', gridX: 2, gridY: 0, rotation: 0 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Altar' }],
    ['g: bed on line ⇒ ¾ cover', A, T, [], [{ type: 'bed', gridX: 2, gridY: 0, rotation: 0 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Bed' }],
    ['h: bookshelf on line ⇒ ¾ cover', A, T, [], [{ type: 'bookshelf', gridX: 2, gridY: 0, rotation: 0 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Bookshelf' }],
    ['i: ¾ item outranks half item ⇒ ¾ cover', A, T, [], [
      { type: 'table', gridX: 1, gridY: 0, rotation: 0 },
      { type: 'barrel', gridX: 3, gridY: 0 },
    ], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Table' }],
    ['j: barrel with production extra props ⇒ half cover', A, T, [], [{ type: 'barrel', gridX: 2, gridY: 0, name: 'Oil Barrel', hp: 15, locked: false }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Oil Barrel' }],
    ['k: chair on line ⇒ half cover', A, T, [], [{ type: 'chair', gridX: 2, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Chair' }],
    ['l: chest on line ⇒ half cover', A, T, [], [{ type: 'chest', gridX: 2, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Chest' }],
    ['m: crate on line ⇒ half cover', A, T, [], [{ type: 'crate', gridX: 2, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Crate' }],
    ['n: fountain on line ⇒ half cover', A, T, [], [{ type: 'fountain', gridX: 2, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Fountain' }],
    ['o: pillar on line ⇒ half cover', A, T, [], [{ type: 'pillar', gridX: 2, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Pillar' }],
    ['p: statue on line ⇒ half cover', A, T, [], [{ type: 'statue', gridX: 2, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Statue' }],
    ['q: closed door coexisting with open door on the line ⇒ full cover', A, T, [], [
      { type: 'door', gridX: 1, gridY: 0, open: true },
      { type: 'door', gridX: 3, gridY: 0, open: false },
    ], { level: COVER.FULL, acBonus: null }],
    ['r: reversed shot still sees the wall ⇒ full cover', T, A, new Set(['2,0']), [], { level: COVER.FULL, acBonus: null }],
    ['s: open door ⇒ no cover (falsifier of closed-door row c)', A, T, [], [{ type: 'door', gridX: 2, gridY: 0, open: true }], { level: COVER.NONE, acBonus: 0 }],
    ['t: hidden secret door, no base wall ⇒ full cover (added-side wiring)', A, T, new Set(), [{ type: 'secretDoor', gridX: 2, gridY: 0, visible: false }], { level: COVER.FULL, acBonus: null }],
    ['u: discovered secret door erases its base wall ⇒ no cover (deleted-side wiring)', A, T, ['2,0'], [{ type: 'secretDoor', gridX: 2, gridY: 0, visible: true }], { level: COVER.NONE, acBonus: 0 }],
    ['v: unknown types on line, ¾/half items off line ⇒ no cover', A, T, new Set(), [
      { type: 'torch', gridX: 1, gridY: 0 },
      { type: 'flag', gridX: 2, gridY: 0 },
      { type: 'barrel', gridX: 1, gridY: 1 },
      { type: 'table', gridX: 2, gridY: 2, rotation: 0 },
    ], { level: COVER.NONE, acBonus: 0 }],
    // Diagonal (0,0)->(3,3): interior (1,1),(2,2).
    ['w: wall on diagonal interior ⇒ full cover', A, { gridX: 3, gridY: 3 }, new Set(['1,1']), [], { level: COVER.FULL, acBonus: null }],
    ['x: wall beside diagonal line ⇒ no cover', A, { gridX: 3, gridY: 3 }, ['2,1'], [], { level: COVER.NONE, acBonus: 0 }],
    // Steep ray (0,0)->(2,4): interior (0,1),(1,2),(1,3).
    ['y: steep ray, vertical 2-cell item, secondary cell only ⇒ ¾ cover', A, { gridX: 2, gridY: 4 }, [], [{ type: 'bed', gridX: 1, gridY: 1, rotation: 90 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Bed' }],
    ['z: steep ray, missing rotation defaults horizontal, secondary cell only ⇒ ¾ cover', A, { gridX: 2, gridY: 4 }, [], [{ type: 'table', gridX: 0, gridY: 2 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Table' }],
    ['aa: steep ray, same spot but off the ray ⇒ no cover', A, { gridX: 2, gridY: 4 }, [], [{ type: 'barrel', gridX: 1, gridY: 1 }], { level: COVER.NONE, acBonus: 0 }],
    // Negative coords: (0,0)->(-3,-3) interior (-1,-1),(-2,-2).
    ['ab: altar on negative diagonal ⇒ ¾ cover', A, { gridX: -3, gridY: -3 }, [], [{ type: 'altar', gridX: -1, gridY: -1, rotation: 0 }], { level: COVER.THREE_QUARTER, acBonus: 5, sourceLabel: 'Altar' }],
    ['ac: pillar on a 50-cell shot ⇒ half cover', A, { gridX: 50, gridY: 0 }, new Set(), [{ type: 'pillar', gridX: 25, gridY: 0 }], { level: COVER.HALF, acBonus: 2, sourceLabel: 'Pillar' }],
    // Endpoints never count as cover (line interior is exclusive).
    ['ad: attacker and target on one walled cell ⇒ no cover', { gridX: 5, gridY: 5 }, { gridX: 5, gridY: 5 }, ['5,5'], [{ type: 'barrel', gridX: 5, gridY: 5 }], { level: COVER.NONE, acBonus: 0 }],
    ['ae: melee adjacency, closed door on target cell ⇒ no cover', A, { gridX: 1, gridY: 0 }, [], [{ type: 'door', gridX: 1, gridY: 0, open: false }], { level: COVER.NONE, acBonus: 0 }],
  ])('%s', (_label, from, to, walls, placedItems, expected) => {
    expect(computeCover(from, to, walls, placedItems)).toEqual(expected)
  })
})

describe('coverSourceLabel', () => {
  it('a GM rename wins over the type key', () => {
    expect(coverSourceLabel({ id: 'b', type: 'barrel', name: 'Oil Barrel', gridX: 2, gridY: 0 }))
      .toBe('Oil Barrel')
  })
  it('an unnamed item labels by its capitalized type key (no placedItemLabel cell suffix)', () => {
    expect(coverSourceLabel({ id: 'b', type: 'barrel', gridX: 2, gridY: 0 })).toBe('Barrel')
    expect(coverSourceLabel({ id: 't', type: 'bookshelf', gridX: 2, gridY: 0, rotation: 0 })).toBe('Bookshelf')
  })
  it('whitespace-only names fall back to the type key; nullish items label null', () => {
    expect(coverSourceLabel({ id: 'b', type: 'crate', name: '   ', gridX: 2, gridY: 0 })).toBe('Crate')
    expect(coverSourceLabel(null)).toBeNull()
    expect(coverSourceLabel(undefined)).toBeNull()
  })
})
