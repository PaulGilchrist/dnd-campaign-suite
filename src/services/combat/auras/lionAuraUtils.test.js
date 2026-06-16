import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

// ── Imports (Vite returns mocked versions) ─────────────────────

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

function makeLionBuff(range = undefined) {
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

   // ── Early return: mapData missing or empty players ────────────
  describe('early return when mapData is invalid (skipRangeCheck false)', () => {
    it('returns disadvantage false when mapData is undefined', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: undefined,
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when mapData is null', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: null,
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when mapData has no players field', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: {},
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when mapData.players is empty array', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })
     })

   // ── skipRangeCheck = true (no range checking) ────────────────
  describe('skipRangeCheck is true (no range check)', () => {
    it('returns disadvantage false when mapData is undefined', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: undefined,
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when mapData is null', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: null,
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when no players have Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when getRuntimeValue returns null', () => {
      getRuntimeValue.mockImplementation(() => null)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when getRuntimeValue returns non-array string', () => {
      getRuntimeValue.mockImplementation(() => 'not-an-array')

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('skips the attacker itself even if they have Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [{ optionName: 'Lion' }])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage true when a player has Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('returns the first player with Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker'),
          makePlayer('Barbarian1'),
          makePlayer('Barbarian2'),
            ]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian1' })
         })

    it('calls getRuntimeValue with the correct arguments', () => {
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

    it('iterates past players without Lion to find one who does', () => {
      getRuntimeValue.mockImplementation((name) => {
        return name === 'Barbarian' ? [makeLionBuff()] : []
        })

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Wizard'),
          makePlayer('Barbarian'),
          makePlayer('Attacker'),
            ]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('does not call getDistanceFeet when skipRangeCheck is true', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(getDistanceFeet).not.toHaveBeenCalled()
         })

    it('handles buffs as a number in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => 42)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles buffs as a plain object in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => ({ notArray: true }))

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles getRuntimeValue returning undefined in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => undefined)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles buffs as a string in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => 'some-string')

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles buffs array with non-Lion entries only', () => {
      getRuntimeValue.mockImplementation(() => [
         { optionName: 'Bear' },
         { optionName: 'Eagle' },
          ])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('finds Lion buff among other buffs in the array', () => {
      getRuntimeValue.mockImplementation(() => [
         { optionName: 'Bear' },
         makeLionBuff(),
          ])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: true,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })
     })

   // ── skipRangeCheck = false (range checking mode) ─────────────
  describe('skipRangeCheck is false (range check)', () => {
    it('returns disadvantage false when attacker not in mapData.players', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'NonExistent',
        campaignName: '',
        mapData: makeMapData([makePlayer('Barbarian')]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('does not iterate other players when attacker is not found', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'NonExistent',
        campaignName: '',
        mapData: makeMapData([makePlayer('Barbarian')]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
      expect(getRuntimeValue).not.toHaveBeenCalled()
         })

    it('returns disadvantage false when no other players have Lion buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
           ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('skips the attacker itself in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns advantage true when Lion buff is within range at boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(5) // exactly at default 5ft boundary

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('returns advantage true when Lion buff is within range under boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(3) // under 5ft default range

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('returns disadvantage false when Lion buff is out of range (default 5ft)', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(10) // outside default 5ft

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('returns disadvantage false when getDistanceFeet returns null', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(null)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', null, null),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('uses custom range from lionBuff.range string (parsed as number)', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff('10 ft')])
      getDistanceFeet.mockReturnValue(8) // within 10ft but outside default 5ft

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('uses default 5 ft range when lionBuff.range is missing', () => {
      getRuntimeValue.mockImplementation(() => [{ optionName: 'Lion' }]) // no .range → defaults to '5 ft'
      getDistanceFeet.mockReturnValue(5) // exactly at boundary

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('falls back to 5 when parseInt of lionBuff.range gives NaN (in range)', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff('unreachable')]) // parseInt → NaN → || 5
      getDistanceFeet.mockReturnValue(5)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('uses the default 5 fallback when parseInt(range) is NaN and distance exceeds 5', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff('unreachable')])
      getDistanceFeet.mockReturnValue(10) // > 5ft default

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 3, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles getRuntimeValue returning a non-array in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => 'not-an-array')

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles getRuntimeValue returning null in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => null)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles buffs array with non-Lion entries only (range-check mode)', () => {
      getRuntimeValue.mockImplementation(() => [
           { optionName: 'Bear' },
           { optionName: 'Eagle' },
            ])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('finds Lion buff among other buffs in the array (range-check mode)', () => {
      getRuntimeValue.mockImplementation(() => [
           { optionName: 'Bear' },
           makeLionBuff(),
            ])
      getDistanceFeet.mockReturnValue(3)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian', 1, 0), // first non-attacker, has Lion among other buffs
          makePlayer('Attacker', 2, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('passes correct arguments to getDistanceFeet', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(5)

      getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian', 2, 3),
          makePlayer('Attacker', 7, 11),
            ]),
        skipRangeCheck: false,
          })

      expect(getDistanceFeet).toHaveBeenCalledWith(
         { gridX: 2, gridY: 3 },
         { gridX: 7, gridY: 11 }
           )
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
         'MyCampaign'
            )
         })

    it('iterates players until Lion buff is found in range', () => {
      getRuntimeValue.mockImplementation((name) => {
        return name === 'Player2' ? [makeLionBuff()] : []
         })
      getDistanceFeet.mockReturnValue(3)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Player1'),
          makePlayer('Player2'),
          makePlayer('Attacker'),
            ]),
        skipRangeCheck: false,
          })

      expect(result).toEqual({ disadvantage: true, source: 'Player2' })
         })

    it('returns advantage true at exact range boundary (dist === rangeNum)', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff('10 ft')])
      getDistanceFeet.mockReturnValue(10) // exactly at 10ft boundary

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
            ]),
        skipRangeCheck: false,
          })

      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('returns disadvantage false just over range boundary (dist > rangeNum)', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff('10 ft')])
      getDistanceFeet.mockReturnValue(10.5) // 0.5ft over 10ft

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
            ]),
        skipRangeCheck: false,
          })

      expect(result).toEqual({ disadvantage: false })
         })

    it('uses numeric lionBuff.range value directly via parseInt', () => {
      getRuntimeValue.mockImplementation(() => [{ optionName: 'Lion', range: 15 }])
      getDistanceFeet.mockReturnValue(12) // parseInt(15)=15, distance 12 <= 15

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 2, 0),
            ]),
        skipRangeCheck: false,
          })

      expect(result).toEqual({ disadvantage: true, source: 'Barbarian' })
         })

    it('handles only the attacker in mapData (no other players to check)', () => {
      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: false,
          })

      expect(result).toEqual({ disadvantage: false })
         })

    it('handles getRuntimeValue returning undefined in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => undefined)

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Attacker', 0, 0),
          makePlayer('Barbarian', 1, 0),
            ]),
        skipRangeCheck: false,
          })
      expect(result).toEqual({ disadvantage: false })
         })

    it('handles multiple lion buffs all out of range', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])
      getDistanceFeet.mockReturnValue(15) // > 5ft default for both

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Barbarian1'),
          makePlayer('Barbarian2'),
          makePlayer('Attacker'),
            ]),
        skipRangeCheck: false,
          })

      expect(result).toEqual({ disadvantage: false })
         })
     })

   // ── Edge cases for falsy/undefined arguments ─────────────────
  describe('edge cases', () => {
    it('handles skipRangeCheck as undefined (treated as false)', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
        skipRangeCheck: undefined,
          })

      expect(result).toEqual({ disadvantage: false })
         })

    it('handles only one player (the attacker) in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => [makeLionBuff()])

      const result = getLionDisadvantageAgainst({
        attackerName: 'Attacker',
        campaignName: '',
        mapData: makeMapData([makePlayer('Attacker')]),
        skipRangeCheck: true,
          })

      expect(result).toEqual({ disadvantage: false })
         })
     })
})
