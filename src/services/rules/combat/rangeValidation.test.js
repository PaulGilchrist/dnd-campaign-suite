// @maintained-by-ai
import {
  getDistanceFeet,
  computeRangeEffect,
  computeMeleeProximityEffect,
  isHostileNPC,
  getNearestPlacedItem,
  rangeToFeet,
  computeEffectiveSpellRange,
} from './rangeValidation.js'

// Unit owner for all seven exports (siblings mock this module; rangeCheck.test.js
// defers grid math: "Euclidean via getDistanceFeet (owned by rangeValidation.test.js)").
// Pure module — no store stubs needed.

describe('getDistanceFeet', () => {
  // Guard falsifier: missing positions must yield null, never NaN/0 coercion.
  it('returns null when either position is missing', () => {
    expect(getDistanceFeet(null, { gridX: 0, gridY: 0 })).toBeNull()
    expect(getDistanceFeet({ gridX: 0, gridY: 0 }, undefined)).toBeNull()
  })

  // 5 ft/cell Euclidean conversion. Negative-direction row kills a
  // dropped-square mutant that the positive rows cannot see.
  it.each([
    ['same cell', { gridX: 5, gridY: 5 }, { gridX: 5, gridY: 5 }, 0],
    ['orthogonal 2 cells', { gridX: 0, gridY: 0 }, { gridX: 2, gridY: 0 }, 10],
    ['orthogonal 3 cells', { gridX: 0, gridY: 0 }, { gridX: 0, gridY: 3 }, 15],
    ['3-4-5 diagonal', { gridX: 0, gridY: 0 }, { gridX: 3, gridY: 4 }, 25],
    ['1-1 diagonal', { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 1 }, 7.071],
    ['negative-direction 3-4-5', { gridX: 4, gridY: 4 }, { gridX: 1, gridY: 0 }, 25],
  ])('%s → %s ft', (_label, pos1, pos2, feet) => {
    expect(getDistanceFeet(pos1, pos2)).toBeCloseTo(feet, 2)
  })
})

describe('rangeToFeet', () => {
  // Unparseable inputs pin toBeNull (not just falsy) — kills 0/NaN-coercion mutants.
  it.each([
    // numbers pass through untouched (converter, not validator)
    [100, 100], [0, 0], [-10, -10],
    // special strings (case-insensitive)
    ['Touch', 8], ['touch', 8], ['TOUCH', 8],
    ['Self', null], ['Self (cone)', null], ['SELF', null],
    ['Sight', Infinity], ['SIGHT', Infinity], ['Unlimited', Infinity],
    ['Special', null], ['SPECIAL', null],
    // numeric range strings: feet / foot / ft / ft. / fractional
    ['120 feet', 120], ['120 FEET', 120], ['30 ft', 30], ['10 ft.', 10],
    ['60 foot', 60], ['10.5 feet', 10.5],
    // miles × 5280
    ['1 mile', 5280], ['1 MILE', 5280], ['0.5 mile', 2640],
    // unparseable → null
    [null, null], [undefined, null], ['', null], ['  ', null],
    ['abc', null], ['yards', null], ['120 feet extra', null],
  ])('rangeToFeet(%p) → %p', (range, feet) => {
    const result = rangeToFeet(range)
    if (feet === null) expect(result).toBeNull()
    else expect(result).toBe(feet)
  })
})

describe('computeEffectiveSpellRange', () => {
  // Touch→30 row kills a generic-doubles-everything mutant (generic would give 16).
  // Self/Special rows stay null even with metamagic.
  it.each([
    ['base feet without metamagic', '120 feet', {}, 120],
    ['Touch base is 8 without metamagic', 'Touch', {}, 8],
    ['Distant doubles numeric range', '120 feet', { metamagicDistant: true }, 240],
    ['Distant doubles short range', '30 ft', { metamagicDistant: true }, 60],
    ['Distant promotes Touch to 30 ft', 'Touch', { metamagicDistant: true }, 30],
    ['Self stays null with Distant', 'Self', { metamagicDistant: true }, null],
    ['Self (cone) stays null with Distant', 'Self (cone)', { metamagicDistant: true }, null],
    ['Special stays null with Distant', 'Special', { metamagicDistant: true }, null],
  ])('%s', (_label, spellRange, metaCtx, feet) => {
    const result = computeEffectiveSpellRange(spellRange, metaCtx)
    if (feet === null) expect(result).toBeNull()
    else expect(result).toBe(feet)
  })
})

describe('computeRangeEffect', () => {
  // Boundary pairs falsify off-by-one in both directions on every lane:
  // melee 8 in / 8.1 out; reach+5 13 in / 13.1 out; ranged 100·200·200.1;
  // multiplier shifts the 100 boundary to 200; ignoresLongRangeDisadvantage
  // turns the 150-disadvantage row into normal but still misses past 2×.
  it.each([
    ['ranged within range', 100, 50, {}, 'normal'],
    ['ranged exact range boundary', 100, 100, {}, 'normal'],
    ['ranged just beyond range', 100, 100.1, {}, 'disadvantage'],
    ['ranged exact long-range (2x) boundary', 100, 200, {}, 'disadvantage'],
    ['ranged just beyond 2x', 100, 200.1, {}, 'miss'],
    ['Touch parses to 8 ft melee lane', 'Touch', 8, {}, 'normal'],
    ['Touch beyond 8 ft auto-miss', 'Touch', 10, {}, 'miss'],
    ['melee at exact 8 ft', 5, 8, {}, 'normal'],
    ['melee just beyond 8 ft auto-miss', 5, 8.1, {}, 'miss'],
    ['reach bonus +5 exact extended boundary', 5, 13, { meleeReachBonus: 5 }, 'normal'],
    ['reach bonus +5 just beyond extended', 5, 13.1, { meleeReachBonus: 5 }, 'miss'],
    ['rangeMultiplier 2x at doubled boundary', 100, 200, { rangeMultiplier: 2 }, 'normal'],
    ['rangeMultiplier 2x just beyond doubled', 100, 200.1, { rangeMultiplier: 2 }, 'disadvantage'],
    ['rangeMultiplier 2x beyond quadrupled', 100, 401, { rangeMultiplier: 2 }, 'miss'],
    ['ignores long range: 1.5x now normal', 100, 150, { ignoresLongRangeDisadvantage: true }, 'normal'],
    ['ignores long range: exact 2x still normal', 100, 200, { ignoresLongRangeDisadvantage: true }, 'normal'],
    ['ignores long range: just beyond 2x still miss', 100, 200.1, { ignoresLongRangeDisadvantage: true }, 'miss'],
  ])('%s', (_label, attackRange, distanceFt, featEffects, mode) => {
    expect(computeRangeEffect(attackRange, distanceFt, featEffects).mode).toBe(mode)
  })

  // Lenient-open guards, falsified as strict-comparison mutants:
  // undefined distance (=== null mutant → miss) and integer range with huge distance.
  it('skips the check for null/undefined distance or self/special/unparseable ranges', () => {
    expect(computeRangeEffect(5, null)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect(5, undefined)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Self', 10)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('Special', 1000000)).toEqual({ mode: 'normal' })
    expect(computeRangeEffect('abc', 1000000)).toEqual({ mode: 'normal' })
  })

  // Verbatim reason templates (integer distances avoid Math.round artifacts).
  it('pins miss and disadvantage reason strings verbatim', () => {
    expect(computeRangeEffect(5, 12)).toEqual({ mode: 'miss', reason: 'Target out of melee range (12 ft > 8 ft)' })
    expect(computeRangeEffect(100, 150)).toEqual({ mode: 'disadvantage', reason: 'Beyond normal range (150 ft > 100 ft)' })
    expect(computeRangeEffect(100, 201)).toEqual({ mode: 'miss', reason: 'Out of range (201 ft > 200 ft)' })
    expect(computeRangeEffect(100, 201, { ignoresLongRangeDisadvantage: true }))
      .toEqual({ mode: 'miss', reason: 'Out of range (201 ft > 200 ft)' })
  })
})

describe('computeMeleeProximityEffect', () => {
  // Guard lanes: threats sit on the attacker's own cell, so dropping any
  // guard (melee attack, feat, no threats, no attackerPos) flips to disadvantage.
  it('returns normal when guarded even with adjacent threats', () => {
    const at = { gridX: 10, gridY: 10 }
    const adjacent = [{ gridX: 10, gridY: 10, name: 'Goblin' }]
    expect(computeMeleeProximityEffect(false, at, adjacent)).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, at, adjacent, { ignoresMeleeDisadvantage: true })).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, at, [])).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, null, adjacent)).toEqual({ mode: 'normal' })
    expect(computeMeleeProximityEffect(true, undefined, adjacent)).toEqual({ mode: 'normal' })
  })

  // Threat reach is the 8 ft melee tolerance (via rangeCheck.isDistanceInRange,
  // covered there by its own table) — diagonal ≈7.1 ft counts, 10 ft does not.
  it.each([
    ['same cell', { gridX: 10, gridY: 10 }, 'disadvantage'],
    ['orthogonally adjacent 5 ft', { gridX: 11, gridY: 10 }, 'disadvantage'],
    ['diagonally adjacent ~7.1 ft', { gridX: 11, gridY: 11 }, 'disadvantage'],
    ['two cells away 10 ft', { gridX: 12, gridY: 10 }, 'normal'],
  ])('ranged threat at %s → %s', (_label, threatPos, mode) => {
    const result = computeMeleeProximityEffect(true, { gridX: 10, gridY: 10 }, [{ ...threatPos, name: 'Goblin' }], {})
    expect(result.mode).toBe(mode)
  })

  // Verbatim reason template; nameless threat falls back to generic label.
  it('reports the first threatening creature with name fallback', () => {
    const attacker = { gridX: 5, gridY: 5 }
    const result = computeMeleeProximityEffect(true, attacker, [
      { gridX: 1, gridY: 1, name: 'Far Orc' },
      { gridX: 5, gridY: 6, name: 'Close Goblin' },
    ], {})
    expect(result).toEqual({ mode: 'disadvantage', reason: 'Firing in melee range of Close Goblin' })

    const nameless = computeMeleeProximityEffect(true, attacker, [{ gridX: 5, gridY: 6 }], {})
    expect(nameless.reason).toBe('Firing in melee range of hostile creature')
  })
})

describe('getNearestPlacedItem', () => {
  it('resolves exact name over prefix, numeric-suffix squads, and nearest of matches', () => {
    const origin = { gridX: 0, gridY: 0 }
    const exact = { name: 'Goblin', gridX: 10, gridY: 10 }
    // Exact match beats a nearer prefix match — 'Goblin King' is another creature.
    expect(getNearestPlacedItem([exact, { name: 'Goblin King', gridX: 2, gridY: 2 }], 'Goblin', origin)).toBe(exact)
    // 'Goblin N' suffixed tokens match; nearest to attacker wins.
    const near = { name: 'Goblin 2', gridX: 2, gridY: 2 }
    expect(getNearestPlacedItem([{ name: 'Goblin 1', gridX: 10, gridY: 10 }, near], 'Goblin', origin)).toBe(near)
    expect(getNearestPlacedItem([exact], 'Goblin', origin)).toBe(exact)
  })

  // 'Goblin 2x' falsifies a dropped /^\d+$/ suffix anchor.
  it('returns null when nothing matches', () => {
    const origin = { gridX: 0, gridY: 0 }
    expect(getNearestPlacedItem([], 'Goblin', origin)).toBeNull()
    expect(getNearestPlacedItem([{ name: 'Orc', gridX: 5, gridY: 5 }], 'Goblin', origin)).toBeNull()
    expect(getNearestPlacedItem([{ name: 'Goblin King', gridX: 2, gridY: 2 }], 'Goblin', origin)).toBeNull()
    expect(getNearestPlacedItem([{ name: 'Goblin 2x', gridX: 2, gridY: 2 }], 'Goblin', origin)).toBeNull()
  })
})

describe('isHostileNPC', () => {
  it('returns false for null/undefined NPC', () => {
    expect(isHostileNPC(null)).toBe(false)
    expect(isHostileNPC(undefined)).toBe(false)
  })

  // Missing attitude defaults to hostile (kills a default-friendly mutant);
  // 'hostile' itself is NOT a recognized attitude — only the two listed rows are.
  it.each([
    [undefined, true], [null, true],
    ['negative', true], ['Negative', true], ['NEGATIVE', true],
    ['extreme opposition', true], ['Extreme Opposition', true],
    ['positive', false], ['deep bonds', false], ['neutral', false],
    ['hostile', false],
  ])('isHostileNPC({ attitude: %p }) → %s', (attitude, expected) => {
    expect(isHostileNPC({ name: 'Orc', attitude })).toBe(expected)
  })
})
