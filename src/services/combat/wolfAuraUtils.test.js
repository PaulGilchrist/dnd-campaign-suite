import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../rules/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

// ── Imports (Vite returns mocked versions) ─────────────────────

import { getWolfAdvantageAgainst } from './wolfAuraUtils.js'
import { getDistanceFeet } from '../rules/rangeValidation.js'
import { getRuntimeValue } from '../../hooks/useRuntimeState.js'

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

// ── Tests ───────────────────────────────────────────────────────

describe('getWolfAdvantageAgainst', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
  })

  // ── Early return: mapData missing or empty players ────────────

  describe('early return when mapData is invalid (skipRangeCheck false)', () => {
    it('returns advantage false when mapData is undefined', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: undefined,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when mapData is null', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when mapData has no players field', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: {},
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when mapData.players is empty array', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when targetPos is undefined and skipRangeCheck is false', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: undefined,
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Barbarian')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when targetPos is null and skipRangeCheck is false', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: null,
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Barbarian')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })
  })

  // ── skipRangeCheck = true (no range checking) ────────────────

  describe('skipRangeCheck is true (no range check)', () => {
    it('returns advantage false when mapData is undefined', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: undefined,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when mapData is null', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when no players have Wolf buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when getRuntimeValue returns null', () => {
      getRuntimeValue.mockImplementation(() => null)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage false when getRuntimeValue returns non-array string', () => {
      getRuntimeValue.mockImplementation(() => 'not-an-array')

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('skips the attacker itself even if they have Wolf buff', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage true when a player has Wolf buff', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('returns the first player with Wolf buff', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])

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

    it('calls getRuntimeValue with the correct arguments', () => {
      getRuntimeValue.mockImplementation(() => [])

      getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
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

    it('iterates past players without Wolf to find one who does', () => {
      getRuntimeValue.mockImplementation((name) => {
        return name === 'Barbarian' ? [makeWolfBuff()] : []
      })

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Wizard'),
          makePlayer('Barbarian'),
          makePlayer('Attacker'),
        ]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('does not call getDistanceFeet when skipRangeCheck is true', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])

      getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it('handles buffs as a number in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => 42)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('handles buffs as a plain object in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => ({ notArray: true }))

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('handles getRuntimeValue returning undefined in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => undefined)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('handles buffs as a string in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => 'some-string')

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('handles buffs array with non-Wolf entries only', () => {
      getRuntimeValue.mockImplementation(() => [
        { name: 'Rage of the Wilds', optionName: 'Bear' },
        { name: 'Rage of the Wilds', optionName: 'Eagle' },
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

    it('finds Wolf buff among other buffs in the array', () => {
      getRuntimeValue.mockImplementation(() => [
        { name: 'Rage of the Wilds', optionName: 'Bear' },
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

    it('handles buffs array with wrong name (not Rage of the Wilds)', () => {
      getRuntimeValue.mockImplementation(() => [
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
  })

  // ── skipRangeCheck = false (range checking mode) ─────────────

  describe('skipRangeCheck is false (range check)', () => {
    it('returns advantage false when no other players have Wolf buff', () => {
      getRuntimeValue.mockImplementation(() => [])

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

    it('skips the attacker itself in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: false })
    })

    it('returns advantage true when Wolf buff is within range at boundary (dist === 5)', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
      getDistanceFeet.mockReturnValue(5) // exactly at 5ft boundary

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

    it('returns advantage true when Wolf buff is within range under boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
      getDistanceFeet.mockReturnValue(3) // under 5ft

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

    it('returns advantage false when Wolf buff is out of range (dist > 5)', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
      getDistanceFeet.mockReturnValue(10) // outside 5ft

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

    it('returns advantage false when getDistanceFeet returns null', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
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

    it('handles getRuntimeValue returning a non-array in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => 'not-an-array')

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

    it('handles getRuntimeValue returning null in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => null)

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

    it('handles buffs array with non-Wolf entries only (range-check mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        { name: 'Rage of the Wilds', optionName: 'Bear' },
        { name: 'Rage of the Wilds', optionName: 'Eagle' },
      ])

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

    it('finds Wolf buff among other buffs in the array (range-check mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        { name: 'Rage of the Wilds', optionName: 'Bear' },
        makeWolfBuff(),
      ])
      getDistanceFeet.mockReturnValue(3)

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian', 1, 0), // first non-attacker, has Wolf among other buffs
          makePlayer('Attacker', 2, 0),
        ]),
        skipRangeCheck: false,
      })
      expect(result).toEqual({ advantage: true, source: 'Barbarian' })
    })

    it('passes correct arguments to getDistanceFeet', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
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

    it('calls getRuntimeValue with correct campaignName', () => {
      getRuntimeValue.mockImplementation(() => [])

      getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
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

    it('iterates players until Wolf buff is found in range', () => {
      getRuntimeValue.mockImplementation((name) => {
        return name === 'Player2' ? [makeWolfBuff()] : []
      })
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

    it('returns advantage false just over range boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
      getDistanceFeet.mockReturnValue(5.5) // 0.5ft over 5ft boundary

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

    it('handles only the attacker in mapData (no other players to check)', () => {
      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
      })

      expect(result).toEqual({ advantage: false })
    })

    it('handles getRuntimeValue returning undefined in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => undefined)

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

    it('handles multiple wolf buffs all out of range', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
      getDistanceFeet.mockReturnValue(15) // > 5ft for both

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

    it('does not call getDistanceFeet when no Wolf buff is present', () => {
      getRuntimeValue.mockImplementation(() => [])

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

    it('handles buffs as a number in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => 42)

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

    it('handles buffs as a plain object in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => ({ notArray: true }))

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

    it('handles buffs as a string in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => 'some-string')

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
  })

  // ── Edge cases for falsy/undefined arguments ─────────────────

  describe('edge cases', () => {
    it('handles skipRangeCheck as undefined (treated as false)', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: undefined,
      })

      expect(result).toEqual({ advantage: false })
    })

    it('handles only one player (the attacker) in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])

      const result = getWolfAdvantageAgainst({
        targetPos: { gridX: 1, gridY: 1 },
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
      })

      expect(result).toEqual({ advantage: false })
    })

    it('handles distance of zero (player on same square as target)', () => {
      getRuntimeValue.mockImplementation(() => [makeWolfBuff()])
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
  })
})
