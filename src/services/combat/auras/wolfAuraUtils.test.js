// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

// ── Imports ─────────────────────────────────────────────────────

import { getWolfAdvantageAgainst } from './wolfAuraUtils.js'
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

// ── Helpers ─────────────────────────────────────────────────────

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeWolfBuff() {
  return { name: 'Rage of the Wilds', optionName: 'Wolf' }
}

function makeBearBuff() {
  return { name: 'Rage of the Wilds', optionName: 'Bear' }
}

// ── Tests ───────────────────────────────────────────────────────

describe('getWolfAdvantageAgainst', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
    // Default: no wolf buff from any player
    getRuntimeValue.mockReturnValue([])
  })

  // ── Early return: invalid inputs ──────────────────────────────

  describe('early return when mapData is invalid', () => {
    it.each([
      [undefined, false],
      [undefined, true],
      [null, false],
      [null, true],
    ])('returns { advantage: false } when mapData is %s (skipRangeCheck=%s)', (mapData, skipRangeCheck) => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData,
        skipRangeCheck,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when mapData has no players field', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: {},
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when mapData.players is empty', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })
  })

  describe('early return when targetPos is invalid', () => {
    it.each([undefined, null, '', 0, 42])('returns false when targetPos is %s', (targetPos) => {
      const result = getWolfAdvantageAgainst({
        targetPos,
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Barbarian')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })
  })

  // ── skipRangeCheck = true (no range checking) ────────────────

  describe('skipRangeCheck is true', () => {
    it('returns false when no player has the Wolf buff', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when getRuntimeValue returns a non-array', () => {
      getRuntimeValue.mockReturnValue('not-an-array')

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when getRuntimeValue returns null or undefined', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      // Default mock returns [], which is falsy-coerced to [] via || [], so this covers the null/undefined path too
      expect(result).toEqual({ advantage: false })
    })

    it('skips the attacker even if they have the Wolf buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Attacker' ? [makeWolfBuff()] : [],
      )

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns true with source when a non-attacker player has the Wolf buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('returns the first non-attacker player with the Wolf buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian1' || name === 'Barbarian2' ? [makeWolfBuff()] : [],
      )

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker'),
          makePlayer('Barbarian1'),
          makePlayer('Barbarian2'),
        ]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian1' })
    })

    it('finds a Wolf buff among other buff entries', () => {
      getRuntimeValue.mockReturnValue([
        makeBearBuff(),
        makeWolfBuff(),
      ])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('ignores a Wolf optionName when the buff name is not "Rage of the Wilds"', () => {
      getRuntimeValue.mockReturnValue([
        { name: 'Some Other Buff', optionName: 'Wolf' },
      ])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('does not call getDistanceFeet', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )

      getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })
  })

  // ── skipRangeCheck = false (range checking) ──────────────────

  describe('skipRangeCheck is false', () => {
    it('returns false when no other player has the Wolf buff', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('skips the attacker even if they have the Wolf buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Attacker' ? [makeWolfBuff()] : [],
      )

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns true when a Wolf-buffed player is within 5ft (inclusive)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(5)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('returns true when distance is under 5ft', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(3)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('returns true when distance is zero (same square)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(0)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian', 0, 0),
          makePlayer('Attacker', 0, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('returns false when distance is over 5ft', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(10)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when distance is just over 5ft (5.5)', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(5.5)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when getDistanceFeet returns null', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(null)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', null, null),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when getRuntimeValue returns a non-array', () => {
      getRuntimeValue.mockReturnValue('not-an-array')

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns false when getRuntimeValue returns null or undefined', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('ignores non-Wolf buffs on other players', () => {
      getRuntimeValue.mockReturnValue([makeBearBuff()])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('finds the Wolf buff among other buff entries', () => {
      getRuntimeValue.mockReturnValue([makeBearBuff(), makeWolfBuff()])
      getDistanceFeet.mockReturnValue(3)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian', 1, 0),
          makePlayer('Attacker', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('skips players without the Wolf buff and checks the next one', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Player2' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(3)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Player1'),
          makePlayer('Player2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Player2' })
    })

    it('skips players that are out of range and checks the next one', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian1' || name === 'Barbarian2' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValueOnce(15) // Barbarian1 out of range
      getDistanceFeet.mockReturnValueOnce(3) // Barbarian2 in range

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian1'),
          makePlayer('Barbarian2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian2' })
    })

    it('returns false when all Wolf-buffed players are out of range', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian1' || name === 'Barbarian2' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(15)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian1'),
          makePlayer('Barbarian2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('does not call getDistanceFeet when no player has the Wolf buff', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it('passes the correct positions to getDistanceFeet', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(5)

      getWolfAdvantageAgainst({
        targetPos: { gridX: 7, gridY: 11 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian', 2, 3),
          makePlayer('Attacker', 0, 0),
        ]),
        skipRangeCheck: false,
      })

      expect(getDistanceFeet).toHaveBeenCalledWith(
        { gridX: 2, gridY: 3 },
        { gridX: 7, gridY: 11 },
      )
    })

    it('passes campaignName to getRuntimeValue', () => {
      getRuntimeValue.mockReturnValue([])

      getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: 'MyCampaign',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Barbarian',
        'activeBuffs',
        'MyCampaign',
      )
    })
  })

  // ── skipRangeCheck edge cases ─────────────────────────────────

  describe('skipRangeCheck edge cases', () => {
    it('treats skipRangeCheck as false when undefined', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeWolfBuff()] : [],
      )
      getDistanceFeet.mockReturnValue(3)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
      })

      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('returns false when only the attacker is in mapData', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Attacker' ? [makeWolfBuff()] : [],
      )

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ advantage: false })
    })
  })
})
