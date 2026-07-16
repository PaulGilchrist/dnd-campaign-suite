// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}))

// ── Imports ─────────────────────────────────────────────────────

import { getCoronaSaveDisadvantage } from './coronaAuraUtils.js'
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary } from '../../encounters/combatData.js'

// ── Helpers ─────────────────────────────────────────────────────

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY }
}

function makeMapData(players) {
  return { players }
}

function makeCoronaBuff(distance, enemiesDisadvantageSaves = ['Fire', 'Radiant']) {
  const buff = { effect: 'sunlight_aura', enemiesDisadvantageSaves }
  if (distance !== undefined) buff.distance = distance
  return buff
}

// ── Tests ───────────────────────────────────────────────────────

describe('getCoronaSaveDisadvantage', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset()
    getDistanceFeet.mockReset()
    getCombatSummary.mockReset()
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'coronaOfLightEnemies') return []
      return []
    })
  })

  // ── Early returns: invalid mapData / no players ──────────────

  describe('early returns when mapData is invalid', () => {
    it.each([
      [undefined, false],
      [undefined, true],
      [null, false],
      [null, true],
    ])('returns { disadvantage: false } when mapData is %s (skipRangeCheck=%s)', (mapData, skipRangeCheck) => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData,
        damageType: 'Fire',
        skipRangeCheck,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns false when mapData.players is missing or empty', () => {
      expect(
        getCoronaSaveDisadvantage({
          targetName: 'Target',
          campaignName: '',
          mapData: {},
          damageType: 'Fire',
          skipRangeCheck: false,
        }),
      ).toEqual({ disadvantage: false })

      expect(
        getCoronaSaveDisadvantage({
          targetName: 'Target',
          campaignName: '',
          mapData: makeMapData([]),
          damageType: 'Fire',
          skipRangeCheck: false,
        }),
      ).toEqual({ disadvantage: false })
    })
  })

  // ── skipRangeCheck = true (no range checking) ────────────────

  describe('skipRangeCheck is true', () => {
    it('returns false when no player has a corona aura buff', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns false when buffs is null, undefined, or a non-array', () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('not-an-array')
        .mockReturnValueOnce(42)
        .mockReturnValueOnce({ effect: 'other' })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target'),
          makePlayer('P1'),
          makePlayer('P2'),
          makePlayer('P3'),
          makePlayer('P4'),
          makePlayer('P5'),
        ]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('skips the target itself even if they have a corona aura buff', () => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('returns disadvantage with source when a non-target player has a corona aura buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Paladin' ? [makeCoronaBuff()] : [],
      )

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns the first non-target player with a corona aura buff', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Paladin1' || name === 'Paladin2' ? [makeCoronaBuff()] : [],
      )

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

    it('finds a corona aura buff among other buff entries', () => {
      getRuntimeValue.mockReturnValue([
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

    it('skips players without corona aura to find one that has it', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Paladin' ? [makeCoronaBuff()] : [],
      )

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

    it('does not call getDistanceFeet', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Paladin' ? [makeCoronaBuff()] : [],
      )

      getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(getDistanceFeet).not.toHaveBeenCalled()
    })

    it.each([
      ['empty saves array grants no disadvantage for any damage type', { damageType: 'Fire', saves: [], expected: false }],
      ['damage type matches saves array', { damageType: 'Fire', saves: ['Fire'], expected: true }],
      ['damage type casing is normalized to match saves', { damageType: 'fire', saves: ['Fire'], expected: true }],
      ['uppercase damage type casing is normalized', { damageType: 'FIRE', saves: ['Fire'], expected: true }],
      ['damage type does not match saves array', { damageType: 'Fire', saves: ['Lightning'], expected: false }],
      ['cold not in multi-entry saves array', { damageType: 'Cold', saves: ['Fire', 'Lightning'], expected: false }],
      ['cold matches one of many saves', { damageType: 'Cold', saves: ['Fire', 'Cold', 'Lightning'], expected: true }],
      ['null damage type with empty saves still no disadvantage', { damageType: null, saves: [], expected: false }],
      ['null damage type with saves matches', { damageType: null, saves: ['Fire'], expected: true }],
      ['undefined damage type with empty saves still no disadvantage', { damageType: undefined, saves: [], expected: false }],
      ['undefined damage type with saves matches', { damageType: undefined, saves: ['Fire'], expected: true }],
    ])('damage type filtering: %s', (_, { damageType, saves, expected }) => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff(null, saves)])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType,
        skipRangeCheck: true,
      })
      expect(result).toEqual(expected ? { disadvantage: true, source: 'Paladin' } : { disadvantage: false })
    })

    it('skips a player whose saves do not match and finds a matching one', () => {
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

    it('handles a buff object missing enemiesDisadvantageSaves (defaults to empty array, no disadvantage)', () => {
      getRuntimeValue.mockReturnValue([{ effect: 'sunlight_aura' }])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })
  })

  // ── skipRangeCheck = false (range checking) ──────────────────

  describe('skipRangeCheck is false', () => {
    it('returns false when target is not found in mapData.players', () => {
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

    it('returns false when no other player has a corona aura buff', () => {
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
      getRuntimeValue.mockReturnValue([makeCoronaBuff()])

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([makePlayer('Target')]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it.each([
      ['at default 60ft boundary', { dist: 60, range: undefined, expected: true }],
      ['within default 60ft range', { dist: 30, range: undefined, expected: true }],
      ['zero distance (same square)', { dist: 0, range: undefined, expected: true }],
      ['within custom 60ft string range', { dist: 59, range: '60 ft', expected: true }],
      ['at custom 30ft string boundary', { dist: 30, range: '30 ft', expected: true }],
      ['within custom 30ft string range', { dist: 25, range: '30 ft', expected: true }],
      ['within numeric range value', { dist: 40, range: 45, expected: true }],
      ['NaN range falls back to 60, within range', { dist: 50, range: 'unreachable', expected: true }],
    ])('returns disadvantage when in range: %s', (_, { dist, range, expected }) => {
      getRuntimeValue.mockImplementation(() =>
        range !== undefined ? [makeCoronaBuff(range)] : [makeCoronaBuff()],
      )
      getDistanceFeet.mockReturnValue(dist)

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
      expect(result).toEqual(expected ? { disadvantage: true, source: 'Paladin' } : { disadvantage: false })
    })

    it.each([
      ['out of default 60ft range', { dist: 70, range: undefined, expected: false }],
      ['just over custom 30ft boundary', { dist: 31, range: '30 ft', expected: false }],
      ['NaN range falls back to 60, out of range', { dist: 70, range: 'unreachable', expected: false }],
    ])('returns false when out of range: %s', (_, { dist, range, expected }) => {
      getRuntimeValue.mockImplementation(() =>
        range !== undefined ? [makeCoronaBuff(range)] : [makeCoronaBuff()],
      )
      getDistanceFeet.mockReturnValue(dist)

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
      expect(result).toEqual(expected ? { disadvantage: true, source: 'Paladin' } : { disadvantage: false })
    })

    it('returns disadvantage when getDistanceFeet returns null (assumes in range)', () => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff()])
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
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns false when buffs is a non-array', () => {
      getRuntimeValue.mockReturnValue('not-an-array')

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

    it('returns false when only non-corona buffs are present', () => {
      getRuntimeValue.mockReturnValue([
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

    it('finds a corona aura buff among other buff entries', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'other_aura' },
        makeCoronaBuff(),
      ])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Paladin', 1, 0),
          makePlayer('Target', 2, 0),
        ]),
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('skips players without corona aura or out of range to find a matching one', () => {
      getRuntimeValue.mockImplementation((name) =>
        name === 'Player2' ? [makeCoronaBuff()] : [],
      )
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

    it('skips an in-range player whose saves do not match and finds a matching one', () => {
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

    it.each([
      ['empty saves array grants no disadvantage for any damage type', { damageType: 'Fire', saves: [], expected: false }],
      ['damage type matches saves array', { damageType: 'Fire', saves: ['Fire'], expected: true }],
      ['damage type casing is normalized', { damageType: 'fire', saves: ['Fire'], expected: true }],
      ['uppercase damage type casing is normalized', { damageType: 'FIRE', saves: ['Fire'], expected: true }],
      ['damage type does not match saves array', { damageType: 'Fire', saves: ['Lightning'], expected: false }],
      ['null damage type with saves matches', { damageType: null, saves: ['Fire'], expected: true }],
      ['null damage type with empty saves grants no disadvantage', { damageType: null, saves: [], expected: false }],
    ])('damage type filtering in range mode: %s', (_, { damageType, saves, expected }) => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff(null, saves)])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: '',
        mapData: makeMapData([
          makePlayer('Target', 0, 0),
          makePlayer('Paladin', 6, 0),
        ]),
        damageType,
        skipRangeCheck: false,
      })
      expect(result).toEqual(expected ? { disadvantage: true, source: 'Paladin' } : { disadvantage: false })
    })

    it('passes correct grid coordinates to getDistanceFeet', () => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff()])
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
      getRuntimeValue.mockReturnValue([])

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

    it('returns false when multiple corona-buffed players are all out of range', () => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(70)

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

  // ── skipRangeCheck edge cases ─────────────────────────────────

  describe('skipRangeCheck edge cases', () => {
    it('treats undefined skipRangeCheck as false (uses range checking)', () => {
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
  })

  // ── Empty / edge buff distance values ─────────────────────────

  describe('edge cases for buff distance', () => {
    it('treats empty string distance as NaN and falls back to default 60ft', () => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff('')])
      getDistanceFeet.mockReturnValue(50)

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

  // ── getCombatSummary fallback ─────────────────────────────────

  describe('getCombatSummary fallback when mapData is unavailable', () => {
    it('falls back to getCombatSummary when mapData is undefined, null, or empty', () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Target', type: 'player' },
          { name: 'Paladin', type: 'player' },
        ],
      })
      getRuntimeValue.mockImplementation((name) =>
        name === 'Paladin' ? [makeCoronaBuff()] : [],
      )

      const result1 = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'test',
        mapData: undefined,
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result1).toEqual({ disadvantage: true, source: 'Paladin' })

      const result2 = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'test',
        mapData: null,
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result2).toEqual({ disadvantage: true, source: 'Paladin' })

      const result3 = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'test',
        mapData: makeMapData([]),
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result3).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns false when getCombatSummary returns no player creatures', () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Goblin', type: 'npc' },
          { name: 'Ogre', type: 'npc' },
        ],
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Goblin',
        campaignName: 'test',
        mapData: undefined,
        damageType: null,
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })
  })

  // ── NPC target path ───────────────────────────────────────────

  describe('NPC target path (range check mode)', () => {
    it('finds NPC target in placedItems', () => {
      getRuntimeValue.mockReturnValue([makeCoronaBuff()])
      getDistanceFeet.mockReturnValue(30)

      const result = getCoronaSaveDisadvantage({
        targetName: 'Goblin',
        campaignName: 'test',
        mapData: {
          players: [makePlayer('Paladin', 2, 3)],
          placedItems: [{ name: 'Goblin', gridX: 7, gridY: 11 }],
        },
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('returns false when NPC target is not in placedItems', () => {
      const result = getCoronaSaveDisadvantage({
        targetName: 'Goblin',
        campaignName: 'test',
        mapData: {
          players: [makePlayer('Paladin', 2, 3)],
          placedItems: [{ name: 'Ogre', gridX: 7, gridY: 11 }],
        },
        damageType: null,
        skipRangeCheck: false,
      })
      expect(result).toEqual({ disadvantage: false })
    })
  })

  // ── Enemy list filtering ──────────────────────────────────────

  describe('enemy list filtering', () => {
    it('applies disadvantage only to creatures in the stored enemy list', () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Target', type: 'player' },
          { name: 'Paladin', type: 'player' },
        ],
      })
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()]
        if (key === 'coronaOfLightEnemies') return ['Target']
        return []
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'test',
        mapData: undefined,
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('skips creatures not in the stored enemy list', () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Target', type: 'player' },
          { name: 'Ally', type: 'player' },
          { name: 'Paladin', type: 'player' },
        ],
      })
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()]
        if (key === 'coronaOfLightEnemies') return ['Target']
        return []
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Ally',
        campaignName: 'test',
        mapData: undefined,
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })

    it('applies to all creatures when enemy list is empty (backward compatibility)', () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Target', type: 'player' },
          { name: 'Paladin', type: 'player' },
        ],
      })
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()]
        return []
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Target',
        campaignName: 'test',
        mapData: undefined,
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: true, source: 'Paladin' })
    })

    it('skips caster even if in enemy list', () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Paladin', type: 'player' },
        ],
      })
      getRuntimeValue.mockImplementation((name, key, _campaign) => {
        if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()]
        if (key === 'coronaOfLightEnemies') return ['Paladin']
        return []
      })

      const result = getCoronaSaveDisadvantage({
        targetName: 'Paladin',
        campaignName: 'test',
        mapData: undefined,
        damageType: 'Fire',
        skipRangeCheck: true,
      })
      expect(result).toEqual({ disadvantage: false })
    })
  })
})
