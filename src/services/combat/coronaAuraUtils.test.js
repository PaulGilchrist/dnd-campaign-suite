import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

// ── Imports (Vite returns mocked versions) ─────────────────────

import { getCoronaSaveDisadvantage } from './coronaAuraUtils.js'
import { getDistanceFeet } from '../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../hooks/useRuntimeState.js'

// ── Helpers ─────────────────────────────────────────────────────

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeCoronaBuff(distance, enemiesDisadvantageSaves = []) {
  const buff = { effect: 'sunlight_aura', enemiesDisadvantageSaves }
  if (distance !== undefined) buff.distance = distance
  return buff
}

// ── Tests ───────────────────────────────────────────────────────

describe('getCoronaSaveDisadvantage', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
  })

  // ── Early return: mapData missing or empty players ────────────
  describe('early return when mapData is invalid (skipRangeCheck false)', () => {
    it('returns disadvantage false when mapData is undefined', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: undefined,
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when mapData is null', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: null,
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when mapData has no players field', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: {},
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when mapData.players is empty array', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([]),
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })
  })

  // ── skipRangeCheck = true (no range checking) ────────────────
  describe('skipRangeCheck is true (no range check)', () => {
    it('returns disadvantage false when mapData is undefined', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: undefined,
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when mapData is null', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: null,
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when no players have corona aura buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when getRuntimeValue returns null', () => {
      getRuntimeValue.mockImplementation(() => null)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when getRuntimeValue returns undefined', () => {
      getRuntimeValue.mockImplementation(() => undefined)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when getRuntimeValue returns non-array string', () => {
      getRuntimeValue.mockImplementation(() => 'not-an-array')

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when buffs is a number', () => {
      getRuntimeValue.mockImplementation(() => 42)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when buffs is a plain object', () => {
      getRuntimeValue.mockImplementation(() => ({ notArray: true }))

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('skips the target itself even if they have corona aura buff', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage true when a player has corona aura buff (no damage type)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns the first player with corona aura buff', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target'),
          makePlayer('Paladin1'),
          makePlayer('Paladin2'),
        ]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin1' })
    })

    it('calls getRuntimeValue with the correct arguments', () => {
      getRuntimeValue.mockImplementation(() => [])

      getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'MyCampaign',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Paladin',
        'activeBuffs',
        'MyCampaign',
      )
    })

    it('iterates past players without corona aura to find one who does', () => {
      getRuntimeValue.mockImplementation((name) => {
        return name === 'Paladin' ? [makeCoronaBuff()] : []
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Wizard'),
          makePlayer('Paladin'),
          makePlayer('Target'),
        ]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('does not call getDistanceFeet when skipRangeCheck is true', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])

      getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it('finds corona aura among other buffs in the array', () => {
      getRuntimeValue.mockImplementation(() => [
        { effect: 'other_aura' },
        makeCoronaBuff(),
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('handles buffs array with non-corona entries only', () => {
      getRuntimeValue.mockImplementation(() => [
        { effect: 'other_aura' },
        { effect: 'another_aura' },
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    // ── Damage type filtering (skipRangeCheck = true) ──────────
    it('returns disadvantage true when enemiesDisadvantageSaves is empty and damageType is provided', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff(null, [])])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage true when damageType matches enemiesDisadvantageSaves', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Fire']),
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('normalizes lowercase damageType to match enemiesDisadvantageSaves', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Fire']),
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('normalizes uppercase damageType to match enemiesDisadvantageSaves', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Fire']),
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'FIRE',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage false when damageType does not match enemiesDisadvantageSaves (skip range mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Lightning']),
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('skips to next player when damageType does not match and finds matching aura on another', () => {
      getRuntimeValue.mockImplementation((name) => {
        if (name === 'Paladin1') return [makeCoronaBuff(null, ['Lightning'])]
        if (name === 'Paladin2') return [makeCoronaBuff(null, ['Fire'])]
        return []
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target'),
          makePlayer('Paladin1'),
          makePlayer('Paladin2'),
        ]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin2' })
    })

    it('handles multiple enemiesDisadvantageSaves entries in array', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Fire', 'Cold', 'Lightning']),
       ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Cold',
        skipRangeCheck: true,
       })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
     })

    it('uses fallback empty array when enemiesDisadvantageSaves is missing on buff (skip range mode)', () => {
      // Buff object with no enemiesDisadvantageSaves property at all — exercises the || [] branch
      getRuntimeValue.mockImplementation(() => [{ effect: 'sunlight_aura' }])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
       })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
     })

    it('uses fallback empty array when enemiesDisadvantageSaves is missing on buff and no damage type (skip range mode)', () => {
      getRuntimeValue.mockImplementation(() => [{ effect: 'sunlight_aura' }])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
       })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
     })
  })

  // ── skipRangeCheck = false (range checking mode) ─────────────
  describe('skipRangeCheck is false (range check)', () => {
    it('returns disadvantage false when target not in mapData.players', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'NonExistent',
        campaignName: '',
        mapData: makeMapData([makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('does not iterate other players when target is not found', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getCoronaSaveDisadvantage({
        targetName: 'NonExistent',
        campaignName: '',
        mapData: makeMapData([makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
      expect(getRuntimeValue).not.toHaveBeenCalled()
    })

    it('returns disadvantage false when no other players have corona aura buff', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 3, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('skips the target itself in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target')]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage true when corona buff is within range at boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(60) // exactly at default 60ft boundary

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 12, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage true when corona buff is within range under boundary', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(30) // well within 60ft default range

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage false when corona buff is out of range (default 60ft)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(70) // outside default 60ft

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 14, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage false when getDistanceFeet returns null', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(null)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', null, null),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('uses custom distance from coronaBuff.distance string (parsed as number)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff('30 ft')])
      getDistanceFeet.mockReturnValue(25) // within 30ft but outside default range if different

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 5, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('uses default 60 ft distance when coronaBuff.distance is missing', () => {
      getRuntimeValue.mockImplementation(() => [{ effect: 'sunlight_aura' }]) // no .distance → defaults to '60 ft'
      getDistanceFeet.mockReturnValue(60) // exactly at boundary

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 12, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('falls back to 60 when parseInt of coronaBuff.distance gives NaN (in range)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff('unreachable')]) // parseInt → NaN → || 60
      getDistanceFeet.mockReturnValue(50) // within 60ft default fallback

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 10, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('uses the default 60 fallback when parseInt(distance) is NaN and distance exceeds 60', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff('unreachable')])
      getDistanceFeet.mockReturnValue(70) // > 60ft default

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 14, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('handles getRuntimeValue returning a non-array in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => 'not-an-array')

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 1, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('handles getRuntimeValue returning null in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => null)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 1, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('handles getRuntimeValue returning undefined in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => undefined)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 1, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('handles buffs array with non-corona entries only (range-check mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        { effect: 'other_aura' },
        { effect: 'another_aura' },
      ])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 1, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('finds corona aura among other buffs in the array (range-check mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        { effect: 'other_aura' },
        makeCoronaBuff(),
      ])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Paladin', 1, 0), // first non-target, has corona aura among other buffs
          makePlayer('Target', 2, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('passes correct arguments to getDistanceFeet', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(30)

      getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Paladin', 2, 3),
          makePlayer('Target', 7, 11),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(getDistanceFeet).toHaveBeenCalledWith(
        { gridX: 2, gridY: 3 },
        { gridX: 7, gridY: 11 },
      )
    })

    it('calls getRuntimeValue with correct campaignName', () => {
      getRuntimeValue.mockImplementation(() => [])

      getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'MyCampaign',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(getRuntimeValue).toHaveBeenCalledWith(
        'Paladin',
        'activeBuffs',
        'MyCampaign',
      )
    })

    it('iterates players until corona aura is found in range', () => {
      getRuntimeValue.mockImplementation((name) => {
        return name === 'Player2' ? [makeCoronaBuff()] : []
      })
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Player1'),
          makePlayer('Player2'),
          makePlayer('Target'),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Player2' })
    })

    it('returns exactly at range boundary (dist === rangeNum)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff('30 ft')])
      getDistanceFeet.mockReturnValue(30) // exactly at 30ft boundary

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage false just over range boundary (dist > rangeNum)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff('30 ft')])
      getDistanceFeet.mockReturnValue(31) // 1ft over 30ft

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('uses numeric coronaBuff.distance value directly via parseInt', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff(45)])
      getDistanceFeet.mockReturnValue(40) // parseInt(45)=45, distance 40 <= 45

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 8, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    // ── Damage type filtering in range-check mode ───────────────
    it('returns disadvantage true when enemiesDisadvantageSaves is empty and damageType provided (range mode)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff(null, [])])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage true when damageType matches enemiesDisadvantageSaves (range mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Fire']),
      ])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns disadvantage false when damageType does not match enemiesDisadvantageSaves (range mode)', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Lightning']),
      ])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('normalizes damageType casing in range-check mode', () => {
      getRuntimeValue.mockImplementation(() => [
        makeCoronaBuff(null, ['Radiant']),
      ])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType: 'RADIANT',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('skips to next player when in-range but damage mismatch, finds matching next (range mode)', () => {
      getRuntimeValue.mockImplementation((name) => {
        if (name === 'Paladin1') return [makeCoronaBuff(null, ['Lightning'])]
        if (name === 'Paladin2') return [makeCoronaBuff(null, ['Fire'])]
        return []
      })
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target'),
          makePlayer('Paladin1'),
          makePlayer('Paladin2'),
        ]),
        damageType: 'Fire',
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin2' })
    })

    it('only the target in mapData (no other players to check)', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target')]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('multiple corona buffs all out of range', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(70) // > 60ft default for both

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Paladin1'),
          makePlayer('Paladin2'),
          makePlayer('Target'),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: false })
    })
  })

  // ── Edge cases for falsy/undefined arguments ─────────────────
  describe('edge cases', () => {
    it('handles skipRangeCheck as undefined (treated as false) with valid mapData but no aura', () => {
      getRuntimeValue.mockImplementation(() => [])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: undefined,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('handles only one player (the target) in no-range mode', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target')]),
        damageType: null,
        skipRangeCheck: true,
      })

      expect(result).toEqual({ disadvantage: false })
    })

    it('handles coronaBuff with distance as empty string (uses default 60)', () => {
      getRuntimeValue.mockImplementation(() => [makeCoronaBuff('')])
      getDistanceFeet.mockReturnValue(50) // within 60ft fallback

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 10, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })

      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })
  })
})
