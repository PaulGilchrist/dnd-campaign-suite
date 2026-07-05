// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

// ── Imports ─────────────────────────────────────────────────────

import { getLionDisadvantageAgainst } from './lionAuraUtils.js'
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

// ── Helpers ─────────────────────────────────────────────────────

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeLionBuff(range) {
  const buff = { optionName: 'Lion' }
  if (range !== undefined) buff.range = range
  return buff
}

// ── Tests ───────────────────────────────────────────────────────

describe('getLionDisadvantageAgainst', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
  })

  describe('early returns when mapData is invalid', () => {
    it.each([undefined, null])('returns { disadvantage: false } when mapData is %s', (mapData) => {
      expect(getLionDisadvantageAgainst({ attackerName: 'A', mapData, skipRangeCheck: false }))
        .toEqual({ disadvantage: false })
    })

    it('returns { disadvantage: false } when mapData.players is missing or empty', () => {
      expect(getLionDisadvantageAgainst({ attackerName: 'A', mapData: {}, skipRangeCheck: false }))
        .toEqual({ disadvantage: false })
      expect(getLionDisadvantageAgainst({ attackerName: 'A', mapData: makeMapData([]), skipRangeCheck: false }))
        .toEqual({ disadvantage: false })
    })
  })

  describe('skipRangeCheck is true', () => {
    it('returns disadvantage for the first non-attacker player with Lion buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Barbarian' ? [makeLionBuff()] : []
      )

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker'),
          makePlayer('Barbarian'),
          makePlayer('Wizard'),
        ]),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
    })

    it('skips the attacker even if they have Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('returns false when no player has Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('skips non-Lion buffs and finds Lion among mixed buffs', () => {
      getRuntimeValue.mockImplementation(() => [
        { optionName: 'Bear' },
        makeLionBuff(),
      ])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
    })

    it('handles invalid buff types gracefully (null, undefined, non-array)', () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('not-an-array')
        .mockReturnValueOnce(42)
        .mockReturnValueOnce({ optionName: 'Lion' })

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('P1'),
          makePlayer('P2'),
          makePlayer('P3'),
          makePlayer('P4'),
          makePlayer('P5'),
        ]),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('does not call getDistanceFeet when skipRangeCheck is true', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })

      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it('calls getRuntimeValue with correct arguments per player', () => {
      getRuntimeValue.mockImplementation(() => [])

      getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: 'MyCampaign',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Barbarian',
        'activeBuffs',
        'MyCampaign',
      )
    })
  })

  describe('skipRangeCheck is false (range checking)', () => {
    it('returns false when attacker is not found in mapData.players', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'NonExistent',
        mapData: makeMapData([makePlayer('Barbarian')]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
      expect(getRuntimeValue).not.toHaveBeenCalled()
    })

    it('returns false when no other players have Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
        ]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage when Lion buff is within range at or under boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      getDistanceFeet.mockReturnValue(5)
      const result1 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result1).toEqual({ disadvantage: true, source: 'Barbarian' })

      getDistanceFeet.mockReturnValue(3)
      const result2 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result2).toEqual({ disadvantage: true, source: 'Barbarian' })
    })

    it('returns false when Lion buff is out of range or just over the range boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      getDistanceFeet.mockReturnValue(10)
      const result1 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result1).toEqual({ disadvantage: false })

      getDistanceFeet.mockReturnValue(10.5)
      const result2 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result2).toEqual({ disadvantage: false })
    })

    it('uses custom range from lionBuff.range (string, numeric, or NaN fallback)', () => {
      // String range
      getRuntimeValue.mockImplementation(() => [makeLionBuff('10 ft')])
      getDistanceFeet.mockReturnValue(8)
      const result1 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result1).toEqual({ disadvantage: true, source: 'Barbarian' })

      // Numeric range
      getRuntimeValue.mockImplementation(() => [{ optionName: 'Lion', range: 15 }])
      getDistanceFeet.mockReturnValue(12)
      const result2 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result2).toEqual({ disadvantage: true, source: 'Barbarian' })

      // NaN falls back to 5ft
      getRuntimeValue.mockImplementation(() => [makeLionBuff('unreachable')])
      getDistanceFeet.mockReturnValue(5)
      const result3 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result3).toEqual({ disadvantage: true, source: 'Barbarian' })

      // NaN fallback with distance exceeding 5
      getDistanceFeet.mockReturnValue(10)
      const result4 = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result4).toEqual({ disadvantage: false })
    })

    it('returns false when getDistanceFeet returns null', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(null)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', null, null),
        ]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('passes correct grid coordinates to getDistanceFeet', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(5)

      getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Barbarian', 2, 3),
          makePlayer('Attacker', 7, 11),
        ]),
        skipRangeCheck: false,
      })

      expect(getDistanceFeet).toHaveBeenCalledWith(
        { gridX: 2, gridY: 3 },
        { gridX: 7, gridY: 11 },
      )
    })

    it('iterates players until finding one with Lion buff in range', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Player2' ? [makeLionBuff()] : []
      )
      getDistanceFeet.mockReturnValue(3)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Player1'),
          makePlayer('Player2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Player2' })
    })

    it('returns false when multiple Lion buffs are all out of range', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(15)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Barbarian1'),
          makePlayer('Barbarian2'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('handles invalid buff types gracefully in range-check mode', () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('not-an-array')
        .mockReturnValueOnce(42)
        .mockReturnValueOnce({ optionName: 'Lion' })

      getDistanceFeet.mockReturnValue(5)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('P1', 1, 0),
          makePlayer('P2', 1, 0),
          makePlayer('P3', 1, 0),
          makePlayer('P4', 1, 0),
          makePlayer('P5', 1, 0),
        ]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('calls getRuntimeValue with correct campaignName', () => {
      getRuntimeValue.mockImplementation(() => [])

      getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: 'MyCampaign',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: false,
      })

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Barbarian',
        'activeBuffs',
        'MyCampaign',
      )
    })
  })

  describe('skipRangeCheck as undefined', () => {
    it('treats undefined as false (uses range checking)', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: undefined,
      })

      expect(result).toEqual({ disadvantage: false })
    })
  })

  describe('only attacker present', () => {
    it('returns false when only the attacker exists in mapData', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })
  })
})
